import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

export interface Proof {
  id: string;
  url: string;
  type: "github" | "url" | "screenshot" | "demo" | "unknown";
  title: string;
  timestamp: Date;
  metadata: ProofMetadata;
}

export interface ProofMetadata {
  domain?: string;
  repo?: string;
  language?: string;
  hasReadme?: boolean;
  hasTests?: boolean;
  stars?: number;
}

export interface SkillScore {
  name: string;
  score: number; // 0-100
  proofCount: number;
}

export interface TimePattern {
  day: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  count: number;
}

export interface Insight {
  icon: string;
  title: string;
  description: string;
  type: "positive" | "neutral" | "suggestion";
}

export default class ProofAnalyzerService extends Service {
  @tracked proofs: Proof[] = [];

  constructor(owner: unknown) {
    super(owner);
    this.loadSampleData();
  }

  loadSampleData(): void {
    // Generate sample proofs for demo
    const sampleProofs: Proof[] = [
      {
        id: "1",
        url: "https://github.com/user/awesome-cli-tool",
        type: "github",
        title: "Awesome CLI Tool",
        timestamp: new Date("2026-01-15T10:30:00"),
        metadata: { repo: "awesome-cli-tool", language: "TypeScript", hasReadme: true, hasTests: true },
      },
      {
        id: "2",
        url: "https://github.com/user/react-dashboard",
        type: "github",
        title: "React Dashboard",
        timestamp: new Date("2026-01-20T14:45:00"),
        metadata: { repo: "react-dashboard", language: "TypeScript", hasReadme: true, hasTests: false },
      },
      {
        id: "3",
        url: "https://myapp.vercel.app",
        type: "url",
        title: "My Deployed App",
        timestamp: new Date("2026-01-22T09:15:00"),
        metadata: { domain: "vercel.app" },
      },
      {
        id: "4",
        url: "https://github.com/user/python-ml-project",
        type: "github",
        title: "ML Classifier",
        timestamp: new Date("2026-01-25T16:20:00"),
        metadata: { repo: "python-ml-project", language: "Python", hasReadme: true, hasTests: true },
      },
      {
        id: "5",
        url: "https://imgur.com/a/xyz123",
        type: "screenshot",
        title: "UI Mockup Screenshot",
        timestamp: new Date("2026-01-28T11:00:00"),
        metadata: {},
      },
      {
        id: "6",
        url: "https://www.loom.com/share/abc123",
        type: "demo",
        title: "Feature Demo Video",
        timestamp: new Date("2026-01-30T13:30:00"),
        metadata: {},
      },
      {
        id: "7",
        url: "https://github.com/user/rust-game-engine",
        type: "github",
        title: "Rust Game Engine",
        timestamp: new Date("2026-02-01T10:00:00"),
        metadata: { repo: "rust-game-engine", language: "Rust", hasReadme: true, hasTests: true },
      },
      {
        id: "8",
        url: "https://github.com/user/ember-addon",
        type: "github",
        title: "Ember Addon",
        timestamp: new Date("2026-02-02T15:45:00"),
        metadata: { repo: "ember-addon", language: "TypeScript", hasReadme: true, hasTests: true },
      },
      {
        id: "9",
        url: "https://coolproject.netlify.app",
        type: "url",
        title: "Portfolio Site",
        timestamp: new Date("2026-02-03T08:30:00"),
        metadata: { domain: "netlify.app" },
      },
      {
        id: "10",
        url: "https://github.com/user/go-microservice",
        type: "github",
        title: "Go Microservice",
        timestamp: new Date("2026-02-04T12:00:00"),
        metadata: { repo: "go-microservice", language: "Go", hasReadme: true, hasTests: true },
      },
    ];

    this.proofs = sampleProofs;
  }

  detectProofType(url: string): Proof["type"] {
    const lowered = url.toLowerCase();
    if (lowered.includes("github.com") || lowered.includes("gitlab.com")) {
      return "github";
    }
    if (lowered.includes("imgur.com") || lowered.includes("screenshot") || lowered.includes("i.redd.it")) {
      return "screenshot";
    }
    if (lowered.includes("loom.com") || lowered.includes("youtube.com") || lowered.includes("vimeo.com")) {
      return "demo";
    }
    if (lowered.startsWith("http")) {
      return "url";
    }
    return "unknown";
  }

  addProof(url: string, title: string): void {
    const type = this.detectProofType(url);
    const proof: Proof = {
      id: crypto.randomUUID(),
      url,
      type,
      title,
      timestamp: new Date(),
      metadata: this.extractMetadata(url, type),
    };
    this.proofs = [...this.proofs, proof];
    this.saveToStorage();
  }

  extractMetadata(url: string, type: Proof["type"]): ProofMetadata {
    const metadata: ProofMetadata = {};
    
    if (type === "github") {
      const match = url.match(/github\.com\/[\w-]+\/([\w-]+)/);
      if (match) {
        metadata.repo = match[1];
      }
    } else if (type === "url") {
      try {
        metadata.domain = new URL(url).hostname;
      } catch {
        // Invalid URL
      }
    }
    
    return metadata;
  }

  removeProof(id: string): void {
    this.proofs = this.proofs.filter(p => p.id !== id);
    this.saveToStorage();
  }

  saveToStorage(): void {
    try {
      localStorage.setItem("proof-insights-proofs", JSON.stringify(this.proofs));
    } catch {
      // Storage not available
    }
  }

  loadFromStorage(): void {
    try {
      const stored = localStorage.getItem("proof-insights-proofs");
      if (stored) {
        const parsed = JSON.parse(stored);
        this.proofs = parsed.map((p: Proof) => ({
          ...p,
          timestamp: new Date(p.timestamp),
        }));
      }
    } catch {
      // Storage not available or invalid
    }
  }

  get totalProofs(): number {
    return this.proofs.length;
  }

  get proofTypeCounts(): Record<Proof["type"], number> {
    const counts: Record<Proof["type"], number> = {
      github: 0,
      url: 0,
      screenshot: 0,
      demo: 0,
      unknown: 0,
    };
    
    for (const proof of this.proofs) {
      counts[proof.type]++;
    }
    
    return counts;
  }

  get skillScores(): SkillScore[] {
    const skills: Record<string, { count: number; hasTests: number; hasReadme: number }> = {};
    
    for (const proof of this.proofs) {
      if (proof.type === "github" && proof.metadata.language) {
        const lang = proof.metadata.language;
        if (!skills[lang]) {
          skills[lang] = { count: 0, hasTests: 0, hasReadme: 0 };
        }
        skills[lang].count++;
        if (proof.metadata.hasTests) skills[lang].hasTests++;
        if (proof.metadata.hasReadme) skills[lang].hasReadme++;
      }
    }
    
    // Add skill categories based on proof patterns
    const categories: Record<string, number> = {
      "Web Dev": this.proofs.filter(p => 
        p.metadata.language === "TypeScript" || 
        p.metadata.language === "JavaScript" ||
        p.type === "url"
      ).length,
      "Backend": this.proofs.filter(p => 
        p.metadata.language === "Go" || 
        p.metadata.language === "Rust" ||
        p.metadata.language === "Python"
      ).length,
      "Documentation": this.proofs.filter(p => p.metadata.hasReadme).length,
      "Testing": this.proofs.filter(p => p.metadata.hasTests).length,
      "Demos": this.proofs.filter(p => p.type === "demo" || p.type === "screenshot").length,
    };
    
    const maxCount = Math.max(...Object.values(categories), 1);
    
    return Object.entries(categories).map(([name, count]) => ({
      name,
      score: Math.round((count / maxCount) * 100),
      proofCount: count,
    }));
  }

  get timePatterns(): TimePattern[] {
    const patterns: TimePattern[] = [];
    const counts: Record<string, number> = {};
    
    for (const proof of this.proofs) {
      const day = proof.timestamp.getDay();
      const hour = proof.timestamp.getHours();
      const key = `${day}-${hour}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`;
        patterns.push({
          day,
          hour,
          count: counts[key] || 0,
        });
      }
    }
    
    return patterns;
  }

  get insights(): Insight[] {
    const insights: Insight[] = [];
    const typeCounts = this.proofTypeCounts;
    
    // GitHub-heavy
    if (typeCounts.github > this.totalProofs * 0.5) {
      insights.push({
        icon: "💻",
        title: "Code-First Builder",
        description: "Over half your proofs are from GitHub. You lead with code!",
        type: "positive",
      });
    }
    
    // Visual proofs
    if (typeCounts.screenshot + typeCounts.demo >= 2) {
      insights.push({
        icon: "🎨",
        title: "Visual Communicator",
        description: "You use screenshots and demos effectively to show your work.",
        type: "positive",
      });
    }
    
    // Deployed apps
    if (typeCounts.url >= 2) {
      insights.push({
        icon: "🚀",
        title: "Ships to Production",
        description: "You have multiple deployed apps. You don't just build, you ship!",
        type: "positive",
      });
    }
    
    // Testing
    const testedProofs = this.proofs.filter(p => p.metadata.hasTests).length;
    if (testedProofs >= this.totalProofs * 0.4) {
      insights.push({
        icon: "✅",
        title: "Quality Focused",
        description: `${Math.round((testedProofs / this.totalProofs) * 100)}% of your repos have tests. You value reliability.`,
        type: "positive",
      });
    }
    
    // Suggestions
    if (typeCounts.demo === 0) {
      insights.push({
        icon: "📹",
        title: "Try Video Demos",
        description: "Adding Loom or video demos can make your ships more compelling.",
        type: "suggestion",
      });
    }
    
    // Multi-language
    const languages = new Set(this.proofs.map(p => p.metadata.language).filter(Boolean));
    if (languages.size >= 3) {
      insights.push({
        icon: "🌍",
        title: "Polyglot Developer",
        description: `You've shipped in ${languages.size} different languages. Versatile!`,
        type: "positive",
      });
    }
    
    // Consistency
    if (this.proofs.length >= 5) {
      insights.push({
        icon: "📈",
        title: "Consistent Shipper",
        description: "You have a solid track record of shipping projects.",
        type: "positive",
      });
    }
    
    return insights;
  }

  get portfolioMarkdown(): string {
    const lines: string[] = [
      "# Proof Portfolio",
      "",
      `**Total Ships:** ${this.totalProofs}`,
      "",
      "## Skills",
      "",
    ];
    
    for (const skill of this.skillScores) {
      const bar = "█".repeat(Math.round(skill.score / 10)) + "░".repeat(10 - Math.round(skill.score / 10));
      lines.push(`- **${skill.name}** ${bar} (${skill.proofCount} proofs)`);
    }
    
    lines.push("", "## Proof Types", "");
    
    const typeCounts = this.proofTypeCounts;
    lines.push(`- GitHub: ${typeCounts.github}`);
    lines.push(`- URLs: ${typeCounts.url}`);
    lines.push(`- Screenshots: ${typeCounts.screenshot}`);
    lines.push(`- Demos: ${typeCounts.demo}`);
    
    lines.push("", "## Recent Ships", "");
    
    const recent = [...this.proofs].sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    ).slice(0, 5);
    
    for (const proof of recent) {
      lines.push(`- [${proof.title}](${proof.url}) - ${proof.type}`);
    }
    
    return lines.join("\n");
  }
}
