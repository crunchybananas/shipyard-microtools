import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { on } from "@ember/modifier";
import { service } from "@ember/service";
import type AnalyzerService from "ship-roast/services/analyzer";
import type { AnalysisResult } from "ship-roast/services/analyzer";

export default class ShipRoastApp extends Component {
  @service declare analyzer: AnalyzerService;

  @tracked proofUrl = "";
  @tracked shipTitle = "";
  @tracked shipDescription = "";
  @tracked isLoading = false;
  @tracked analysis: AnalysisResult | null = null;

  get verdictClass(): string {
    if (!this.analysis) return "";
    const score = this.analysis.overall;
    if (score >= 8) return "excellent";
    if (score >= 6) return "good";
    if (score >= 4) return "fair";
    return "poor";
  }

  @action
  updateProofUrl(event: Event): void {
    this.proofUrl = (event.target as HTMLInputElement).value;
  }

  @action
  updateShipTitle(event: Event): void {
    this.shipTitle = (event.target as HTMLInputElement).value;
  }

  @action
  updateShipDescription(event: Event): void {
    this.shipDescription = (event.target as HTMLTextAreaElement).value;
  }

  @action
  async roastShip(): Promise<void> {
    if (!this.proofUrl.trim()) {
      alert("Please enter a proof URL");
      return;
    }

    this.isLoading = true;

    // Small delay to show loading state
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      this.analysis = this.analyzer.analyze(
        this.proofUrl.trim(),
        this.shipTitle.trim(),
        this.shipDescription.trim(),
      );
    } finally {
      this.isLoading = false;
    }
  }

  <template>
    <div class="container">
      <header>
        <a href="../" class="back">← All Tools</a>
        <h1>🔥 Ship Roast Bot</h1>
        <p class="subtitle">Heuristic-based feedback on your ship before you submit.</p>
      </header>

      <main>
        <div class="input-section">
          <label for="proofUrl">Proof URL</label>
          <input
            type="url"
            id="proofUrl"
            placeholder="https://github.com/you/your-project"
            value={{this.proofUrl}}
            {{on "input" this.updateProofUrl}}
          />

          <label for="shipTitle">Ship Title</label>
          <input
            type="text"
            id="shipTitle"
            placeholder="My Awesome Tool"
            value={{this.shipTitle}}
            {{on "input" this.updateShipTitle}}
          />

          <label for="shipDescription">Description (optional)</label>
          <textarea
            id="shipDescription"
            rows="3"
            placeholder="What does it do?"
            {{on "input" this.updateShipDescription}}
          >{{this.shipDescription}}</textarea>

          <button
            type="button"
            class="primary-btn"
            disabled={{this.isLoading}}
            {{on "click" this.roastShip}}
          >
            {{#if this.isLoading}}
              Analyzing...
            {{else}}
              🔥 Roast My Ship
            {{/if}}
          </button>
        </div>

        {{#if this.analysis}}
          <div class="results">
            <div class="score-card">
              <div class="score-circle">
                <span>{{this.analysis.overall}}</span>
                <small>/10</small>
              </div>
              <div class="score-label">Ship-worthiness</div>
            </div>

            <div class="verdict-card {{this.verdictClass}}">
              <h3>Verdict</h3>
              <p>{{this.analysis.verdict}}</p>
            </div>

            <div class="categories">
              {{#let this.analysis.proof as |proof|}}
                <div class="category">
                  <div class="cat-header">
                    <span class="cat-icon">🔗</span>
                    <span class="cat-name">Proof URL</span>
                    <span class="cat-score">{{proof.score}}/10</span>
                  </div>
                  <ul>
                    {{#each proof.feedback as |item|}}
                      <li class={{item.type}}>{{item.text}}</li>
                    {{else}}
                      <li>No specific feedback</li>
                    {{/each}}
                  </ul>
                </div>
              {{/let}}

              {{#let this.analysis.readme as |readme|}}
                <div class="category">
                  <div class="cat-header">
                    <span class="cat-icon">📖</span>
                    <span class="cat-name">README Quality</span>
                    <span class="cat-score">{{readme.score}}/10</span>
                  </div>
                  <ul>
                    {{#each readme.feedback as |item|}}
                      <li class={{item.type}}>{{item.text}}</li>
                    {{else}}
                      <li>No specific feedback</li>
                    {{/each}}
                  </ul>
                </div>
              {{/let}}

              {{#let this.analysis.demo as |demo|}}
                <div class="category">
                  <div class="cat-header">
                    <span class="cat-icon">🎬</span>
                    <span class="cat-name">Demo Presence</span>
                    <span class="cat-score">{{demo.score}}/10</span>
                  </div>
                  <ul>
                    {{#each demo.feedback as |item|}}
                      <li class={{item.type}}>{{item.text}}</li>
                    {{else}}
                      <li>No specific feedback</li>
                    {{/each}}
                  </ul>
                </div>
              {{/let}}

              {{#let this.analysis.originality as |originality|}}
                <div class="category">
                  <div class="cat-header">
                    <span class="cat-icon">✨</span>
                    <span class="cat-name">Originality</span>
                    <span class="cat-score">{{originality.score}}/10</span>
                  </div>
                  <ul>
                    {{#each originality.feedback as |item|}}
                      <li class={{item.type}}>{{item.text}}</li>
                    {{else}}
                      <li>No specific feedback</li>
                    {{/each}}
                  </ul>
                </div>
              {{/let}}
            </div>

            <div class="suggestions-card">
              <h3>💡 Quick Wins</h3>
              <ul>
                {{#each this.analysis.suggestions as |suggestion|}}
                  <li>{{suggestion}}</li>
                {{else}}
                  <li>✨ No major issues found!</li>
                {{/each}}
              </ul>
            </div>

            <div class="attest-prediction">
              <h3>Would I Attest?</h3>
              <div class="attest-badge {{this.analysis.attestVerdict}}">
                {{this.analysis.attestVerdict}}
              </div>
              <p>{{this.analysis.attestReason}}</p>
            </div>
          </div>
        {{/if}}
      </main>

      <footer>
        <p>Built for <a href="https://shipyard.bot">Shipyard</a> • <a href="https://github.com/crunchybananas/shipyard-microtools">Source</a></p>
      </footer>
    </div>
  </template>
}
