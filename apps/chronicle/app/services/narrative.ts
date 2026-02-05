import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

export interface Proof {
  id: string;
  url: string;
  type: "github" | "url" | "screenshot" | "demo" | "unknown";
  title: string;
  timestamp: Date;
}

export type StoryTemplate = "weekly" | "case-study" | "retrospective" | "pitch";

export interface GeneratedStory {
  title: string;
  content: string;
  template: StoryTemplate;
  generatedAt: Date;
}

export default class NarrativeService extends Service {
  @tracked proofs: Proof[] = [];
  @tracked currentStory: GeneratedStory | null = null;
  @tracked isGenerating = false;

  constructor(owner: unknown) {
    super(owner);
    this.loadSampleData();
  }

  loadSampleData(): void {
    this.proofs = [
      {
        id: "1",
        url: "https://github.com/user/task-cli",
        type: "github",
        title: "Task CLI Tool",
        timestamp: new Date("2026-01-10T09:00:00"),
      },
      {
        id: "2",
        url: "https://github.com/user/task-cli",
        type: "github",
        title: "Added Recurring Tasks",
        timestamp: new Date("2026-01-15T14:30:00"),
      },
      {
        id: "3",
        url: "https://mytasks.app",
        type: "url",
        title: "Deployed to Production",
        timestamp: new Date("2026-01-20T11:00:00"),
      },
      {
        id: "4",
        url: "https://imgur.com/gallery/abc123",
        type: "screenshot",
        title: "Final UI Screenshot",
        timestamp: new Date("2026-01-22T16:00:00"),
      },
      {
        id: "5",
        url: "https://loom.com/share/xyz789",
        type: "demo",
        title: "Feature Demo Video",
        timestamp: new Date("2026-01-25T10:00:00"),
      },
    ];
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
    const proof: Proof = {
      id: crypto.randomUUID(),
      url,
      type: this.detectProofType(url),
      title: title || this.generateTitle(url),
      timestamp: new Date(),
    };
    this.proofs = [...this.proofs, proof];
  }

  removeProof(id: string): void {
    this.proofs = this.proofs.filter(p => p.id !== id);
  }

  generateTitle(url: string): string {
    try {
      const urlObj = new URL(url);
      if (url.includes("github.com")) {
        const parts = urlObj.pathname.split("/").filter(Boolean);
        return parts[parts.length - 1] || "GitHub Project";
      }
      return urlObj.hostname;
    } catch {
      return "Proof";
    }
  }

  async generateStory(template: StoryTemplate): Promise<void> {
    this.isGenerating = true;
    
    // Simulate AI generation delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const sortedProofs = [...this.proofs].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    
    let story: GeneratedStory;
    
    switch (template) {
      case "weekly":
        story = this.generateWeeklySummary(sortedProofs);
        break;
      case "case-study":
        story = this.generateCaseStudy(sortedProofs);
        break;
      case "retrospective":
        story = this.generateRetrospective(sortedProofs);
        break;
      case "pitch":
        story = this.generatePitch(sortedProofs);
        break;
      default:
        story = this.generateWeeklySummary(sortedProofs);
    }
    
    this.currentStory = story;
    this.isGenerating = false;
  }

  private generateWeeklySummary(proofs: Proof[]): GeneratedStory {
    const githubCount = proofs.filter(p => p.type === "github").length;
    const deployCount = proofs.filter(p => p.type === "url").length;
    const demoCount = proofs.filter(p => p.type === "demo" || p.type === "screenshot").length;
    
    const content = `
## What I Shipped This Week

It was a productive week! Here's what I accomplished:

### Development Progress
${githubCount > 0 ? `I made **${githubCount} code commits** this week, steadily building toward the goal.` : ""}

${proofs.filter(p => p.type === "github").map(p => `- **${p.title}** - Pushed to GitHub`).join("\n")}

### Deployments
${deployCount > 0 ? `Shipped **${deployCount} deployment(s)** to production this week.` : "No deployments this week, but making progress!"}

${proofs.filter(p => p.type === "url").map(p => `- [${p.title}](${p.url})`).join("\n")}

### Demos & Documentation
${demoCount > 0 ? `Created **${demoCount} visual proof(s)** to showcase the work.` : ""}

${proofs.filter(p => p.type === "demo" || p.type === "screenshot").map(p => `- ${p.title}`).join("\n")}

### What's Next
Building on this momentum, the focus next week will be on refining and expanding what's been built.
    `.trim();
    
    return {
      title: "Weekly Summary",
      content,
      template: "weekly",
      generatedAt: new Date(),
    };
  }

  private generateCaseStudy(proofs: Proof[]): GeneratedStory {
    const firstProof = proofs[0];
    const lastProof = proofs[proofs.length - 1];
    const durationDays = firstProof && lastProof 
      ? Math.ceil((lastProof.timestamp.getTime() - firstProof.timestamp.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    const content = `
## Case Study: From Idea to Shipped

### The Challenge
Every great project starts with a problem to solve. This journey began with an idea and a commitment to ship.

### Timeline
This project spanned **${durationDays} days** from first commit to final deployment.

### Development Journey

**Phase 1: Foundation**
${proofs.slice(0, Math.ceil(proofs.length / 3)).map(p => `- ${p.title} (${p.type})`).join("\n")}

**Phase 2: Building Features**
${proofs.slice(Math.ceil(proofs.length / 3), Math.ceil(proofs.length * 2 / 3)).map(p => `- ${p.title} (${p.type})`).join("\n")}

**Phase 3: Polish & Deploy**
${proofs.slice(Math.ceil(proofs.length * 2 / 3)).map(p => `- ${p.title} (${p.type})`).join("\n")}

### Key Metrics
- **${proofs.length}** total proofs of work
- **${proofs.filter(p => p.type === "github").length}** code commits
- **${proofs.filter(p => p.type === "url").length}** live deployments
- **${durationDays}** days from start to ship

### Lessons Learned
Consistent small steps lead to completed projects. Each proof in this timeline represents progress, not perfection.

### The Result
A shipped product with documented proof of work at every stage.
    `.trim();
    
    return {
      title: "Case Study",
      content,
      template: "case-study",
      generatedAt: new Date(),
    };
  }

  private generateRetrospective(proofs: Proof[]): GeneratedStory {
    const content = `
## Project Retrospective

### What Went Well ✅

**Consistent Progress**
With ${proofs.length} documented proofs, there was steady momentum throughout the project.

**Diverse Proof Types**
The work was documented through multiple formats:
- Code commits for technical progress
- Screenshots for visual milestones  
- Demos for stakeholder communication
- Live URLs for real-world validation

### What Could Be Improved 🔄

**Documentation Gaps**
Consider adding more context to each proof - what was the goal? What blockers were overcome?

**Proof Cadence**
${proofs.length < 5 ? "More frequent, smaller proofs would tell a richer story." : "Good rhythm of proof submissions."}

### Timeline Review

${proofs.map(p => {
  const date = p.timestamp.toLocaleDateString();
  return `**${date}** - ${p.title} (${p.type})`;
}).join("\n\n")}

### Action Items for Next Project
1. Start with a clear proof strategy
2. Document blockers as they happen
3. Celebrate small wins publicly
4. Request attestations early
    `.trim();
    
    return {
      title: "Retrospective",
      content,
      template: "retrospective",
      generatedAt: new Date(),
    };
  }

  private generatePitch(proofs: Proof[]): GeneratedStory {
    const hasDemo = proofs.some(p => p.type === "demo");
    const hasLive = proofs.some(p => p.type === "url");
    const liveUrl = proofs.find(p => p.type === "url")?.url;
    
    const content = `
## Ship Pitch

### 🚀 The Ship

A fully functional project, built and shipped with ${proofs.length} documented proofs of work.

### 💡 The Problem

[Your problem statement here - what pain point does this solve?]

### ✨ The Solution

This ship delivers:
${proofs.slice(-3).map(p => `- **${p.title}**`).join("\n")}

### 📊 Proof of Work

| Metric | Value |
|--------|-------|
| Total Proofs | ${proofs.length} |
| Code Commits | ${proofs.filter(p => p.type === "github").length} |
| Live Demo | ${hasLive ? "✅ Yes" : "❌ No"} |
| Video Demo | ${hasDemo ? "✅ Yes" : "❌ No"} |

### 🔗 Links

${liveUrl ? `**Live:** [Try it now](${liveUrl})` : ""}
${proofs.filter(p => p.type === "github").slice(-1).map(p => `**Code:** [View source](${p.url})`).join("")}

### 🎯 Why This Matters

This isn't just an idea - it's shipped. Every proof in the timeline demonstrates real work, real progress, and real results.

**Ready for attestation.**
    `.trim();
    
    return {
      title: "Ship Pitch",
      content,
      template: "pitch",
      generatedAt: new Date(),
    };
  }

  get sortedProofs(): Proof[] {
    return [...this.proofs].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }
}
