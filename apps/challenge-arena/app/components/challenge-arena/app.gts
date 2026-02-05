import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { service } from "@ember/service";
import type ChallengesService from "challenge-arena/services/challenges";
import type {
  Challenge,
  Submission,
  LeaderboardEntry,
  ProofType,
} from "challenge-arena/services/challenges";

type TabId = "challenges" | "leaderboard" | "submit" | "archive";

const eq = (a: unknown, b: unknown): boolean => a === b;
const gt = (a: number, b: number): boolean => a > b;

export default class ChallengeArenaApp extends Component {
  @service declare challenges: ChallengesService;

  @tracked activeTab: TabId = "challenges";
  @tracked selectedChallengeId: string | null = null;
  @tracked showSubmitForm = false;

  // Form state
  @tracked submitProofType: ProofType = "github";
  @tracked submitProofUrl = "";
  @tracked submitDescription = "";
  @tracked submitResult: { success: boolean; message: string } | null = null;

  get tabs(): { id: TabId; label: string; icon: string }[] {
    return [
      { id: "challenges", label: "Challenges", icon: "🎯" },
      { id: "leaderboard", label: "Leaderboard", icon: "🏆" },
      { id: "submit", label: "Submit Proof", icon: "📤" },
      { id: "archive", label: "Archive", icon: "📚" },
    ];
  }

  get proofTypes(): { value: ProofType; label: string; icon: string }[] {
    return [
      { value: "github", label: "GitHub Link", icon: "🔗" },
      { value: "url", label: "Website URL", icon: "🌐" },
      { value: "screenshot", label: "Screenshot", icon: "📸" },
      { value: "demo", label: "Live Demo", icon: "🎮" },
      { value: "video", label: "Video", icon: "🎬" },
    ];
  }

  get selectedChallenge(): Challenge | null {
    if (!this.selectedChallengeId) {
      return this.challenges.activeChallenges[0] ?? null;
    }
    return this.challenges.getChallengeById(this.selectedChallengeId) ?? null;
  }

  get selectedChallengeSubmissions(): Submission[] {
    if (!this.selectedChallenge) return [];
    return this.challenges.getSubmissionsForChallenge(this.selectedChallenge.id);
  }

  get timeRemaining(): { days: number; hours: number; minutes: number } | null {
    if (!this.selectedChallenge) return null;
    return this.challenges.getTimeRemaining(this.selectedChallenge);
  }

  get canSubmit(): boolean {
    return (
      this.submitProofUrl.trim().length > 0 &&
      this.submitDescription.trim().length >= 10 &&
      this.selectedChallenge !== null
    );
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "just now";
  }

  getRankClass(rank: number): string {
    if (rank === 1) return "gold";
    if (rank === 2) return "silver";
    if (rank === 3) return "bronze";
    return "";
  }

  getRankDisplay(rank: number): string {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  }

  getProofTypeIcon(type: ProofType): string {
    const icons: Record<ProofType, string> = {
      github: "🔗",
      url: "🌐",
      screenshot: "📸",
      demo: "🎮",
      video: "🎬",
    };
    return icons[type];
  }

  setTab = (tabId: TabId): void => {
    this.activeTab = tabId;
    this.submitResult = null;
  };

  selectChallenge = (challengeId: string): void => {
    this.selectedChallengeId = challengeId;
  };

  openSubmitForm = (challengeId: string): void => {
    this.selectedChallengeId = challengeId;
    this.activeTab = "submit";
    this.submitResult = null;
  };

  setProofType = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    this.submitProofType = select.value as ProofType;
  };

  setProofUrl = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.submitProofUrl = input.value;
  };

  setDescription = (event: Event): void => {
    const textarea = event.target as HTMLTextAreaElement;
    this.submitDescription = textarea.value;
  };

  handleSubmit = (event: Event): void => {
    event.preventDefault();

    if (!this.selectedChallenge || !this.canSubmit) return;

    const result = this.challenges.submitProof(
      this.selectedChallenge.id,
      this.submitProofType,
      this.submitProofUrl,
      this.submitDescription
    );

    if (result.success && result.submission) {
      const statusText =
        result.submission.verificationStatus === "verified"
          ? `✅ Verified! You earned ${result.submission.points} points!`
          : result.submission.verificationStatus === "pending"
            ? "⏳ Submitted! Queued for review."
            : "❌ Verification failed.";

      this.submitResult = {
        success: result.success,
        message: `${statusText} ${result.submission.verificationMessage || ""}`,
      };

      // Clear form
      this.submitProofUrl = "";
      this.submitDescription = "";
    } else {
      this.submitResult = {
        success: false,
        message: result.error || "Failed to submit proof",
      };
    }
  };

  <template>
    <div class="container">
      <header>
        <a href="../" class="back">← All Tools</a>
        <h1>🏆 Challenge Arena</h1>
        <p class="subtitle">Weekly &amp; monthly community proof challenges</p>
      </header>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value active">{{this.challenges.totalActiveChallenges}}</div>
          <div class="stat-label">Active Challenges</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{this.challenges.totalSubmissions}}</div>
          <div class="stat-label">Total Submissions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value pending">{{this.challenges.pendingSubmissions}}</div>
          <div class="stat-label">Pending Review</div>
        </div>
        <div class="stat-card">
          <div class="stat-value completed">{{this.challenges.verifiedSubmissions}}</div>
          <div class="stat-label">Verified</div>
        </div>
      </div>

      <div class="tabs">
        {{#each this.tabs as |tab|}}
          <button
            type="button"
            class="tab {{if (eq this.activeTab tab.id) 'active'}}"
            {{on "click" (fn this.setTab tab.id)}}
          >
            {{tab.icon}} {{tab.label}}
          </button>
        {{/each}}
      </div>

      {{! Challenges Tab }}
      {{#if (eq this.activeTab "challenges")}}
        <div class="two-col">
          <div>
            <div class="card">
              <h3>🔥 Weekly Challenges</h3>
              <div class="challenge-list">
                {{#each this.challenges.weeklyChallenges as |challenge|}}
                  <div
                    class="challenge-card weekly {{if (eq this.selectedChallengeId challenge.id) 'selected'}}"
                    role="button"
                    {{on "click" (fn this.selectChallenge challenge.id)}}
                  >
                    <div class="challenge-header">
                      <div>
                        <div class="challenge-title">{{challenge.title}}</div>
                        <div class="challenge-category">{{challenge.category}}</div>
                      </div>
                      <span class="challenge-badge weekly">Weekly</span>
                    </div>
                    <p class="challenge-description">{{challenge.description}}</p>
                    <div class="challenge-meta">
                      <span class="challenge-stat">
                        🎁 <span class="challenge-stat-value">{{challenge.pointsReward}}</span> pts
                      </span>
                      <span class="challenge-stat">
                        📝 <span class="challenge-stat-value">{{challenge.submissions}}</span> submissions
                      </span>
                      <span class="challenge-stat">
                        ✅ <span class="challenge-stat-value">{{challenge.verifiedSubmissions}}</span> verified
                      </span>
                    </div>
                    <div class="challenge-actions">
                      <button type="button" class="btn btn-primary" {{on "click" (fn this.openSubmitForm challenge.id)}}>
                        Submit Proof
                      </button>
                    </div>
                  </div>
                {{else}}
                  <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <div class="empty-title">No weekly challenges</div>
                    <p>Check back soon for new challenges!</p>
                  </div>
                {{/each}}
              </div>
            </div>
          </div>

          <div>
            <div class="card">
              <h3>🌟 Monthly Challenges</h3>
              <div class="challenge-list">
                {{#each this.challenges.monthlyChallenges as |challenge|}}
                  <div
                    class="challenge-card monthly"
                    role="button"
                    {{on "click" (fn this.selectChallenge challenge.id)}}
                  >
                    <div class="challenge-header">
                      <div>
                        <div class="challenge-title">{{challenge.title}}</div>
                        <div class="challenge-category">{{challenge.category}}</div>
                      </div>
                      <span class="challenge-badge monthly">Monthly</span>
                    </div>
                    <p class="challenge-description">{{challenge.description}}</p>
                    <div class="challenge-meta">
                      <span class="challenge-stat">
                        🎁 <span class="challenge-stat-value">{{challenge.pointsReward}}</span> pts
                      </span>
                      <span class="challenge-stat">
                        ⚡ <span class="challenge-stat-value">+{{challenge.bonusPoints}}</span> early bonus
                      </span>
                      <span class="challenge-stat">
                        📝 <span class="challenge-stat-value">{{challenge.submissions}}</span> submissions
                      </span>
                    </div>
                    <div class="challenge-actions">
                      <button type="button" class="btn btn-primary" {{on "click" (fn this.openSubmitForm challenge.id)}}>
                        Submit Proof
                      </button>
                    </div>
                  </div>
                {{else}}
                  <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <div class="empty-title">No monthly challenges</div>
                    <p>Check back soon for new challenges!</p>
                  </div>
                {{/each}}
              </div>
            </div>
          </div>
        </div>
      {{/if}}

      {{! Leaderboard Tab }}
      {{#if (eq this.activeTab "leaderboard")}}
        <div class="card">
          <h3>🏆 Top Challengers</h3>
          <div class="leaderboard">
            {{#each this.challenges.leaderboard as |entry|}}
              <div class="leaderboard-entry {{if (gt 4 entry.rank) 'top-3'}}">
                <div class="leaderboard-rank {{this.getRankClass entry.rank}}">
                  {{this.getRankDisplay entry.rank}}
                </div>
                <div class="leaderboard-user">
                  <span class="leaderboard-name">{{entry.userName}}</span>
                  {{#if (gt entry.currentStreak 0)}}
                    <span class="leaderboard-streak">
                      🔥 {{entry.currentStreak}} week streak
                    </span>
                  {{/if}}
                </div>
                <div class="leaderboard-stats">
                  <div class="leaderboard-stat">
                    <span class="leaderboard-stat-value">{{entry.challengesCompleted}}</span>
                    <span class="leaderboard-stat-label">Completed</span>
                  </div>
                  <div class="leaderboard-stat">
                    <span class="leaderboard-stat-value">{{entry.longestStreak}}</span>
                    <span class="leaderboard-stat-label">Best Streak</span>
                  </div>
                </div>
                <div class="leaderboard-points">
                  {{entry.totalPoints}} pts
                </div>
              </div>
            {{/each}}
          </div>
        </div>
      {{/if}}

      {{! Submit Tab }}
      {{#if (eq this.activeTab "submit")}}
        <div class="two-col">
          <div class="card">
            <h3>📤 Submit Proof</h3>

            {{#if this.selectedChallenge}}
              <div class="challenge-card {{this.selectedChallenge.type}}" style="margin-bottom: 20px;">
                <div class="challenge-header">
                  <div>
                    <div class="challenge-title">{{this.selectedChallenge.title}}</div>
                    <div class="challenge-category">{{this.selectedChallenge.category}}</div>
                  </div>
                  <span class="challenge-badge {{this.selectedChallenge.type}}">{{this.selectedChallenge.type}}</span>
                </div>

                {{#if this.timeRemaining}}
                  <div class="time-remaining">
                    <div class="time-unit">
                      <div class="time-value">{{this.timeRemaining.days}}</div>
                      <div class="time-label">Days</div>
                    </div>
                    <div class="time-unit">
                      <div class="time-value">{{this.timeRemaining.hours}}</div>
                      <div class="time-label">Hours</div>
                    </div>
                    <div class="time-unit">
                      <div class="time-value">{{this.timeRemaining.minutes}}</div>
                      <div class="time-label">Minutes</div>
                    </div>
                  </div>
                {{/if}}
              </div>

              <form class="submission-form" {{on "submit" this.handleSubmit}}>
                <div class="form-group">
                  <label class="form-label" for="challenge-select">Challenge</label>
                  <select
                    id="challenge-select"
                    class="form-select"
                    {{on "change" (fn this.selectChallenge)}}
                  >
                    {{#each this.challenges.activeChallenges as |challenge|}}
                      <option
                        value={{challenge.id}}
                        selected={{eq this.selectedChallengeId challenge.id}}
                      >
                        {{challenge.title}} ({{challenge.type}})
                      </option>
                    {{/each}}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label" for="proof-type">Proof Type</label>
                  <select
                    id="proof-type"
                    class="form-select"
                    {{on "change" this.setProofType}}
                  >
                    {{#each this.proofTypes as |type|}}
                      <option value={{type.value}} selected={{eq this.submitProofType type.value}}>
                        {{type.icon}} {{type.label}}
                      </option>
                    {{/each}}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label" for="proof-url">Proof URL</label>
                  <input
                    type="url"
                    id="proof-url"
                    class="form-input"
                    placeholder="https://github.com/user/repo or https://example.com/demo"
                    value={{this.submitProofUrl}}
                    {{on "input" this.setProofUrl}}
                  />
                </div>

                <div class="form-group">
                  <label class="form-label" for="description">Description</label>
                  <textarea
                    id="description"
                    class="form-textarea"
                    placeholder="Describe what you built and how it meets the challenge requirements..."
                    {{on "input" this.setDescription}}
                  >{{this.submitDescription}}</textarea>
                </div>

                <button
                  type="submit"
                  class="btn btn-primary"
                  disabled={{if this.canSubmit false true}}
                >
                  🚀 Submit for Verification
                </button>

                {{#if this.submitResult}}
                  <div class="verification-status {{if this.submitResult.success 'verified' 'rejected'}}">
                    <span class="verification-icon">{{if this.submitResult.success "✅" "❌"}}</span>
                    <div class="verification-content">
                      <div class="verification-title">
                        {{if this.submitResult.success "Submission Complete" "Submission Error"}}
                      </div>
                      <div class="verification-message">{{this.submitResult.message}}</div>
                    </div>
                  </div>
                {{/if}}
              </form>
            {{else}}
              <div class="empty-state">
                <div class="empty-icon">🎯</div>
                <div class="empty-title">Select a Challenge</div>
                <p>Go to the Challenges tab to pick a challenge to submit proof for.</p>
              </div>
            {{/if}}
          </div>

          <div class="card">
            <h3>📋 Requirements</h3>
            {{#if this.selectedChallenge}}
              <ul style="padding-left: 20px; color: var(--muted); line-height: 2;">
                {{#each this.selectedChallenge.requirements as |req|}}
                  <li>{{req}}</li>
                {{/each}}
              </ul>

              <div style="margin-top: 24px; padding: 16px; background: rgba(124, 58, 237, 0.1); border-radius: 8px;">
                <strong style="color: var(--accent);">🤖 Agent Verification</strong>
                <p style="color: var(--muted); font-size: 0.9rem; margin-top: 8px;">
                  Your proof will be automatically verified using heuristic checks.
                  GitHub PRs, npm packages, and valid URLs get instant verification.
                  Other proofs may be queued for manual review.
                </p>
              </div>
            {{else}}
              <p style="color: var(--muted);">Select a challenge to see requirements.</p>
            {{/if}}
          </div>
        </div>

        {{#if this.selectedChallengeSubmissions.length}}
          <div class="card">
            <h3>📝 Recent Submissions</h3>
            <div class="submissions-list">
              {{#each this.selectedChallengeSubmissions as |submission|}}
                <div class="submission-entry">
                  <span class="submission-type-icon">{{this.getProofTypeIcon submission.proofType}}</span>
                  <div class="submission-info">
                    <h4>{{submission.userName}}</h4>
                    <div class="submission-meta">
                      {{submission.description}} • {{this.formatRelativeTime submission.submittedAt}}
                    </div>
                  </div>
                  <span class="submission-status {{submission.verificationStatus}}">
                    {{submission.verificationStatus}}
                  </span>
                  {{#if (gt submission.points 0)}}
                    <span class="submission-points">+{{submission.points}} pts</span>
                  {{/if}}
                </div>
              {{/each}}
            </div>
          </div>
        {{/if}}
      {{/if}}

      {{! Archive Tab }}
      {{#if (eq this.activeTab "archive")}}
        <div class="card">
          <h3>📚 Past Challenges</h3>
          <div class="challenge-list">
            {{#each this.challenges.archivedChallenges as |challenge|}}
              <div class="challenge-card archived">
                <div class="challenge-header">
                  <div>
                    <div class="challenge-title">{{challenge.title}}</div>
                    <div class="challenge-category">{{challenge.category}}</div>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <span class="challenge-badge {{challenge.type}}">{{challenge.type}}</span>
                    <span class="challenge-badge ended">Ended</span>
                  </div>
                </div>
                <p class="challenge-description">{{challenge.description}}</p>
                <div class="challenge-meta">
                  <span class="challenge-stat">
                    📅 {{this.formatDate challenge.startDate}} - {{this.formatDate challenge.endDate}}
                  </span>
                  <span class="challenge-stat">
                    📝 <span class="challenge-stat-value">{{challenge.submissions}}</span> submissions
                  </span>
                  <span class="challenge-stat">
                    ✅ <span class="challenge-stat-value">{{challenge.verifiedSubmissions}}</span> verified
                  </span>
                </div>
              </div>
            {{else}}
              <div class="empty-state">
                <div class="empty-icon">📭</div>
                <div class="empty-title">No archived challenges yet</div>
                <p>Completed challenges will appear here.</p>
              </div>
            {{/each}}
          </div>
        </div>
      {{/if}}
    </div>
  </template>
}
