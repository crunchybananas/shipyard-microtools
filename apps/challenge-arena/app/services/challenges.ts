import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

export type ChallengeType = "weekly" | "monthly";
export type ChallengeStatus = "active" | "ended";
export type ProofType = "github" | "url" | "screenshot" | "demo" | "video";
export type VerificationStatus = "pending" | "verified" | "rejected";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  type: ChallengeType;
  status: ChallengeStatus;
  startDate: Date;
  endDate: Date;
  pointsReward: number;
  bonusPoints: number; // For early submission
  submissions: number;
  verifiedSubmissions: number;
  requirements: string[];
}

export interface Submission {
  id: string;
  challengeId: string;
  userId: string;
  userName: string;
  proofType: ProofType;
  proofUrl: string;
  description: string;
  submittedAt: Date;
  verificationStatus: VerificationStatus;
  verificationMessage: string | null;
  points: number;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalPoints: number;
  challengesCompleted: number;
  currentStreak: number;
  longestStreak: number;
  rank: number;
}

export interface VerificationResult {
  status: VerificationStatus;
  message: string;
  confidence: number;
}

export default class ChallengesService extends Service {
  @tracked challenges: Challenge[] = [];
  @tracked submissions: Submission[] = [];
  @tracked leaderboard: LeaderboardEntry[] = [];

  constructor(owner: unknown) {
    super(owner);
    this.loadSampleData();
  }

  loadSampleData(): void {
    const now = new Date();

    // Sample challenges
    this.challenges = [
      {
        id: "webgl-challenge",
        title: "Build Something with WebGL",
        description:
          "Create an interactive 3D visualization, game, or creative experience using WebGL, Three.js, or similar technologies. Show off your graphics programming skills!",
        category: "Graphics & 3D",
        type: "monthly",
        status: "active",
        startDate: new Date("2026-02-01"),
        endDate: new Date("2026-02-28"),
        pointsReward: 500,
        bonusPoints: 100,
        submissions: 23,
        verifiedSubmissions: 18,
        requirements: [
          "Must use WebGL or a WebGL-based library",
          "Must be interactive (mouse/keyboard input)",
          "Must include source code link",
          "Demo must be accessible online",
        ],
      },
      {
        id: "oss-contribution",
        title: "Open Source Contribution",
        description:
          "Contribute to an open source project by submitting a meaningful pull request. Bug fixes, features, documentation improvements all count!",
        category: "Open Source",
        type: "weekly",
        status: "active",
        startDate: new Date("2026-02-03"),
        endDate: new Date("2026-02-09"),
        pointsReward: 200,
        bonusPoints: 50,
        submissions: 45,
        verifiedSubmissions: 32,
        requirements: [
          "PR must be merged or approved",
          "Must be to a public repository",
          "Must not be your own repository",
          "Include link to the merged PR",
        ],
      },
      {
        id: "cli-tool",
        title: "Ship a CLI Tool",
        description:
          "Build and deploy a command-line tool that solves a real problem. Package it and make it installable via npm, cargo, brew, or similar.",
        category: "Developer Tools",
        type: "monthly",
        status: "active",
        startDate: new Date("2026-02-01"),
        endDate: new Date("2026-02-28"),
        pointsReward: 400,
        bonusPoints: 75,
        submissions: 12,
        verifiedSubmissions: 8,
        requirements: [
          "Must be installable via package manager",
          "Must have a README with usage instructions",
          "Must solve a real-world problem",
          "Include source code repository link",
        ],
      },
      {
        id: "visual-docs",
        title: "Visual Documentation",
        description:
          "Create beautiful diagrams, screenshots, or video walkthroughs for documentation. Help others understand complex systems visually.",
        category: "Documentation",
        type: "weekly",
        status: "active",
        startDate: new Date("2026-02-03"),
        endDate: new Date("2026-02-09"),
        pointsReward: 150,
        bonusPoints: 30,
        submissions: 28,
        verifiedSubmissions: 24,
        requirements: [
          "Must be original content",
          "Must document a real project or concept",
          "Must be clear and visually appealing",
          "Include context for what is being documented",
        ],
      },
      {
        id: "api-integration",
        title: "API Integration Showcase",
        description:
          "Build something cool using a public API. Show creative use of external data sources and services.",
        category: "Integration",
        type: "weekly",
        status: "ended",
        startDate: new Date("2026-01-27"),
        endDate: new Date("2026-02-02"),
        pointsReward: 200,
        bonusPoints: 40,
        submissions: 56,
        verifiedSubmissions: 48,
        requirements: [
          "Must integrate with at least one public API",
          "Must be a working application",
          "Must handle API errors gracefully",
          "Include demo and source code",
        ],
      },
      {
        id: "accessibility",
        title: "Accessibility Audit & Fix",
        description:
          "Audit a website or app for accessibility issues and submit PRs to fix them. Make the web better for everyone.",
        category: "Accessibility",
        type: "monthly",
        status: "ended",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        pointsReward: 350,
        bonusPoints: 70,
        submissions: 34,
        verifiedSubmissions: 29,
        requirements: [
          "Must include accessibility audit report",
          "Must submit PR with fixes",
          "PR must be merged or approved",
          "Must follow WCAG guidelines",
        ],
      },
    ];

    // Sample submissions
    this.submissions = [
      {
        id: "sub-1",
        challengeId: "webgl-challenge",
        userId: "user-1",
        userName: "captain_dev",
        proofType: "github",
        proofUrl: "https://github.com/captain-dev/nebula-viz",
        description: "Interactive galaxy visualization with Three.js",
        submittedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        verificationStatus: "verified",
        verificationMessage: "Great use of shaders and particle systems!",
        points: 600,
      },
      {
        id: "sub-2",
        challengeId: "oss-contribution",
        userId: "user-2",
        userName: "harbor_master",
        proofType: "github",
        proofUrl: "https://github.com/ember-cli/ember-cli/pull/1234",
        description: "Fixed memory leak in build pipeline",
        submittedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        verificationStatus: "verified",
        verificationMessage: "Merged PR to a major project!",
        points: 250,
      },
      {
        id: "sub-3",
        challengeId: "cli-tool",
        userId: "user-3",
        userName: "shipwright",
        proofType: "url",
        proofUrl: "https://www.npmjs.com/package/shipyard-cli",
        description: "CLI tool for managing Shipyard deployments",
        submittedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        verificationStatus: "pending",
        verificationMessage: null,
        points: 0,
      },
      {
        id: "sub-4",
        challengeId: "visual-docs",
        userId: "user-1",
        userName: "captain_dev",
        proofType: "screenshot",
        proofUrl: "https://example.com/architecture-diagram.png",
        description: "System architecture diagram for microservices",
        submittedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        verificationStatus: "verified",
        verificationMessage: "Clear and well-organized diagram",
        points: 180,
      },
    ];

    // Sample leaderboard
    this.leaderboard = [
      {
        userId: "user-1",
        userName: "captain_dev",
        totalPoints: 2450,
        challengesCompleted: 12,
        currentStreak: 8,
        longestStreak: 12,
        rank: 1,
      },
      {
        userId: "user-2",
        userName: "harbor_master",
        totalPoints: 2180,
        challengesCompleted: 10,
        currentStreak: 6,
        longestStreak: 9,
        rank: 2,
      },
      {
        userId: "user-4",
        userName: "pixel_pirate",
        totalPoints: 1920,
        challengesCompleted: 9,
        currentStreak: 5,
        longestStreak: 7,
        rank: 3,
      },
      {
        userId: "user-5",
        userName: "code_sailor",
        totalPoints: 1650,
        challengesCompleted: 8,
        currentStreak: 3,
        longestStreak: 6,
        rank: 4,
      },
      {
        userId: "user-3",
        userName: "shipwright",
        totalPoints: 1420,
        challengesCompleted: 7,
        currentStreak: 4,
        longestStreak: 5,
        rank: 5,
      },
      {
        userId: "user-6",
        userName: "anchor_anna",
        totalPoints: 1280,
        challengesCompleted: 6,
        currentStreak: 2,
        longestStreak: 4,
        rank: 6,
      },
      {
        userId: "user-7",
        userName: "deck_swabber",
        totalPoints: 980,
        challengesCompleted: 5,
        currentStreak: 1,
        longestStreak: 3,
        rank: 7,
      },
      {
        userId: "user-8",
        userName: "mast_climber",
        totalPoints: 750,
        challengesCompleted: 4,
        currentStreak: 0,
        longestStreak: 2,
        rank: 8,
      },
    ];
  }

  get activeChallenges(): Challenge[] {
    return this.challenges.filter((c) => c.status === "active");
  }

  get archivedChallenges(): Challenge[] {
    return this.challenges.filter((c) => c.status === "ended");
  }

  get weeklyChallenges(): Challenge[] {
    return this.activeChallenges.filter((c) => c.type === "weekly");
  }

  get monthlyChallenges(): Challenge[] {
    return this.activeChallenges.filter((c) => c.type === "monthly");
  }

  get totalActiveChallenges(): number {
    return this.activeChallenges.length;
  }

  get totalSubmissions(): number {
    return this.submissions.length;
  }

  get pendingSubmissions(): number {
    return this.submissions.filter((s) => s.verificationStatus === "pending").length;
  }

  get verifiedSubmissions(): number {
    return this.submissions.filter((s) => s.verificationStatus === "verified").length;
  }

  getChallengeById(id: string): Challenge | undefined {
    return this.challenges.find((c) => c.id === id);
  }

  getSubmissionsForChallenge(challengeId: string): Submission[] {
    return this.submissions.filter((s) => s.challengeId === challengeId);
  }

  getTimeRemaining(challenge: Challenge): { days: number; hours: number; minutes: number } {
    const now = new Date();
    const diff = challenge.endDate.getTime() - now.getTime();

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0 };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { days, hours, minutes };
  }

  // Agent verification simulation (heuristic-based)
  verifySubmission(submission: Partial<Submission>): VerificationResult {
    const checks: { passed: boolean; message: string; weight: number }[] = [];

    // Check 1: URL validation
    if (submission.proofUrl) {
      const urlValid = this.isValidUrl(submission.proofUrl);
      checks.push({
        passed: urlValid,
        message: urlValid ? "Valid URL provided" : "Invalid URL format",
        weight: 0.2,
      });

      // Check 2: GitHub URL check for github proof type
      if (submission.proofType === "github") {
        const isGithub = submission.proofUrl.includes("github.com");
        checks.push({
          passed: isGithub,
          message: isGithub ? "GitHub URL detected" : "Expected GitHub URL",
          weight: 0.3,
        });

        // Check for PR or commit
        const hasPrOrCommit = /\/(pull|commit)\//.test(submission.proofUrl);
        checks.push({
          passed: hasPrOrCommit,
          message: hasPrOrCommit ? "PR/commit reference found" : "No PR/commit reference",
          weight: 0.2,
        });
      }

      // Check 3: npm URL check for CLI tools
      if (submission.proofType === "url" && submission.proofUrl.includes("npmjs.com")) {
        checks.push({
          passed: true,
          message: "npm package URL detected",
          weight: 0.25,
        });
      }
    }

    // Check 4: Description quality
    if (submission.description) {
      const descLength = submission.description.length;
      const hasGoodDesc = descLength >= 20 && descLength <= 500;
      checks.push({
        passed: hasGoodDesc,
        message: hasGoodDesc ? "Description is appropriate length" : "Description too short or too long",
        weight: 0.15,
      });
    }

    // Calculate confidence
    const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
    const passedWeight = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);
    const confidence = totalWeight > 0 ? (passedWeight / totalWeight) * 100 : 0;

    // Determine status based on confidence
    let status: VerificationStatus;
    let message: string;

    if (confidence >= 75) {
      status = "verified";
      message = "Proof automatically verified! " + checks.filter((c) => c.passed).map((c) => c.message).join(". ");
    } else if (confidence >= 40) {
      status = "pending";
      message = "Queued for manual review. " + checks.filter((c) => !c.passed).map((c) => c.message).join(". ");
    } else {
      status = "rejected";
      message = "Verification failed. " + checks.filter((c) => !c.passed).map((c) => c.message).join(". ");
    }

    return { status, message, confidence };
  }

  private isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }

  submitProof(
    challengeId: string,
    proofType: ProofType,
    proofUrl: string,
    description: string
  ): { success: boolean; submission?: Submission; error?: string } {
    const challenge = this.getChallengeById(challengeId);

    if (!challenge) {
      return { success: false, error: "Challenge not found" };
    }

    if (challenge.status === "ended") {
      return { success: false, error: "Challenge has ended" };
    }

    // Verify the submission
    const verification = this.verifySubmission({ proofType, proofUrl, description });

    // Calculate points
    let points = 0;
    if (verification.status === "verified") {
      points = challenge.pointsReward;

      // Check for early bird bonus (first 25% of time)
      const totalTime = challenge.endDate.getTime() - challenge.startDate.getTime();
      const elapsed = new Date().getTime() - challenge.startDate.getTime();
      if (elapsed < totalTime * 0.25) {
        points += challenge.bonusPoints;
      }
    }

    const submission: Submission = {
      id: `sub-${Date.now()}`,
      challengeId,
      userId: "current-user",
      userName: "you",
      proofType,
      proofUrl,
      description,
      submittedAt: new Date(),
      verificationStatus: verification.status,
      verificationMessage: verification.message,
      points,
    };

    this.submissions = [...this.submissions, submission];

    return { success: true, submission };
  }
}
