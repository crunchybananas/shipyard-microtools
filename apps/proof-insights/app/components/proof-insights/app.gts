import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { service } from "@ember/service";
import type ProofAnalyzerService from "proof-insights/services/proof-analyzer";

type TabId = "overview" | "skills" | "patterns" | "portfolio";

export default class ProofInsightsApp extends Component {
  @service declare proofAnalyzer: ProofAnalyzerService;

  @tracked activeTab: TabId = "overview";
  @tracked importText = "";

  get tabs(): { id: TabId; label: string; icon: string }[] {
    return [
      { id: "overview", label: "Overview", icon: "📊" },
      { id: "skills", label: "Skills", icon: "🎯" },
      { id: "patterns", label: "Patterns", icon: "📅" },
      { id: "portfolio", label: "Portfolio", icon: "📋" },
    ];
  }

  get proofTypeCounts(): { type: string; icon: string; count: number; percent: number }[] {
    const counts = this.proofAnalyzer.proofTypeCounts;
    const total = this.proofAnalyzer.totalProofs || 1;
    
    return [
      { type: "github", icon: "🐙", count: counts.github, percent: (counts.github / total) * 100 },
      { type: "url", icon: "🔗", count: counts.url, percent: (counts.url / total) * 100 },
      { type: "screenshot", icon: "📸", count: counts.screenshot, percent: (counts.screenshot / total) * 100 },
      { type: "demo", icon: "🎬", count: counts.demo, percent: (counts.demo / total) * 100 },
    ];
  }

  get dayLabels(): string[] {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  }

  get hourLabels(): number[] {
    return [0, 6, 12, 18];
  }

  get heatmapData(): { day: number; hours: { hour: number; level: number }[] }[] {
    const patterns = this.proofAnalyzer.timePatterns;
    const maxCount = Math.max(...patterns.map(p => p.count), 1);
    
    const data: { day: number; hours: { hour: number; level: number }[] }[] = [];
    
    for (let day = 0; day < 7; day++) {
      const hours: { hour: number; level: number }[] = [];
      for (let hour = 0; hour < 24; hour++) {
        const pattern = patterns.find(p => p.day === day && p.hour === hour);
        const count = pattern?.count || 0;
        const level = count === 0 ? 0 : Math.ceil((count / maxCount) * 5);
        hours.push({ hour, level });
      }
      data.push({ day, hours });
    }
    
    return data;
  }

  get radarPoints(): string {
    const skills = this.proofAnalyzer.skillScores;
    const center = 150;
    const maxRadius = 120;
    const angleStep = (Math.PI * 2) / skills.length;
    
    const points = skills.map((skill, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const radius = (skill.score / 100) * maxRadius;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      return `${x},${y}`;
    });
    
    return points.join(" ");
  }

  get radarGrids(): string[] {
    const center = 150;
    const grids: string[] = [];
    
    for (let r = 30; r <= 120; r += 30) {
      const skills = this.proofAnalyzer.skillScores;
      const angleStep = (Math.PI * 2) / skills.length;
      const points = skills.map((_, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const x = center + Math.cos(angle) * r;
        const y = center + Math.sin(angle) * r;
        return `${x},${y}`;
      });
      grids.push(points.join(" "));
    }
    
    return grids;
  }

  get skillLabels(): { name: string; x: number; y: number }[] {
    const skills = this.proofAnalyzer.skillScores;
    const center = 150;
    const radius = 140;
    const angleStep = (Math.PI * 2) / skills.length;
    
    return skills.map((skill, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      return { name: skill.name, x, y };
    });
  }

  setTab = (tabId: TabId): void => {
    this.activeTab = tabId;
  };

  updateImportText = (event: Event): void => {
    this.importText = (event.target as HTMLTextAreaElement).value;
  };

  importProofs = (): void => {
    const lines = this.importText.split("\n").filter(l => l.trim());
    for (const line of lines) {
      const [url, title] = line.split(",").map(s => s.trim());
      if (url) {
        this.proofAnalyzer.addProof(url, title || "Imported Proof");
      }
    }
    this.importText = "";
  };

  loadSample = (): void => {
    this.proofAnalyzer.loadSampleData();
  };

  copyPortfolio = async (): Promise<void> => {
    await navigator.clipboard.writeText(this.proofAnalyzer.portfolioMarkdown);
    alert("Portfolio copied to clipboard!");
  };

  <template>
    <div class="container">
      <header>
        <a href="../" class="back">← All Tools</a>
        <h1>📊 Proof Insights</h1>
        <p class="subtitle">Personal analytics dashboard for your proof patterns.</p>
      </header>

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

      {{#if (eq this.activeTab "overview")}}
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{this.proofAnalyzer.totalProofs}}</div>
            <div class="stat-label">Total Proofs</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{this.proofAnalyzer.skillScores.length}}</div>
            <div class="stat-label">Skill Areas</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{this.proofAnalyzer.insights.length}}</div>
            <div class="stat-label">Insights</div>
          </div>
        </div>

        <div class="card">
          <h3>Proof Types</h3>
          <div class="proof-types">
            {{#each this.proofTypeCounts as |pt|}}
              <div class="proof-type-row">
                <div class="proof-type-icon {{pt.type}}">{{pt.icon}}</div>
                <div class="proof-type-info">
                  <div class="proof-type-name">{{pt.type}}</div>
                  <div class="proof-type-bar">
                    <div 
                      class="proof-type-fill {{pt.type}}" 
                      style="width: {{pt.percent}}%"
                    ></div>
                  </div>
                </div>
                <div class="proof-type-count">{{pt.count}}</div>
              </div>
            {{/each}}
          </div>
        </div>

        <div class="card">
          <h3>Insights</h3>
          <div class="insights-list">
            {{#each this.proofAnalyzer.insights as |insight|}}
              <div class="insight">
                <div class="insight-icon">{{insight.icon}}</div>
                <div class="insight-text">
                  <div class="insight-title">{{insight.title}}</div>
                  <div class="insight-desc">{{insight.description}}</div>
                </div>
              </div>
            {{/each}}
          </div>
        </div>
      {{/if}}

      {{#if (eq this.activeTab "skills")}}
        <div class="card">
          <h3>Skills Radar</h3>
          <div class="skills-container">
            <div class="radar-chart">
              <svg viewBox="0 0 300 300">
                {{#each this.radarGrids as |grid|}}
                  <polygon 
                    points={{grid}}
                    fill="none" 
                    stroke="rgba(148, 163, 184, 0.2)" 
                    stroke-width="1"
                  />
                {{/each}}
                <polygon 
                  points={{this.radarPoints}}
                  fill="rgba(34, 211, 238, 0.3)" 
                  stroke="var(--accent2)" 
                  stroke-width="2"
                />
                {{#each this.skillLabels as |label|}}
                  <text 
                    x={{label.x}}
                    y={{label.y}}
                    text-anchor="middle" 
                    fill="var(--text)" 
                    font-size="11"
                  >{{label.name}}</text>
                {{/each}}
              </svg>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Skill Breakdown</h3>
          <div class="proof-types">
            {{#each this.proofAnalyzer.skillScores as |skill|}}
              <div class="proof-type-row">
                <div class="proof-type-info">
                  <div class="proof-type-name">{{skill.name}}</div>
                  <div class="proof-type-bar">
                    <div 
                      class="proof-type-fill github" 
                      style="width: {{skill.score}}%"
                    ></div>
                  </div>
                </div>
                <div class="proof-type-count">{{skill.proofCount}}</div>
              </div>
            {{/each}}
          </div>
        </div>
      {{/if}}

      {{#if (eq this.activeTab "patterns")}}
        <div class="card">
          <h3>Activity Heatmap</h3>
          <p style="color: var(--muted); font-size: 0.85rem; margin-bottom: 16px;">
            When you ship proofs (based on timestamp data)
          </p>
          <div class="heatmap">
            {{#each this.heatmapData as |row|}}
              <div class="heatmap-row">
                <div class="heatmap-label">{{get this.dayLabels row.day}}</div>
                <div class="heatmap-cells">
                  {{#each row.hours as |cell|}}
                    <div class="heatmap-cell level-{{cell.level}}" title="{{cell.hour}}:00"></div>
                  {{/each}}
                </div>
              </div>
            {{/each}}
            <div class="heatmap-hours">
              {{#each this.hourLabels as |h|}}
                <div class="heatmap-hour" style="margin-left: {{if (eq h 0) '0' '66'}}px">{{h}}h</div>
              {{/each}}
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Import Proofs</h3>
          <div class="import-section">
            <textarea
              placeholder="Paste proof URLs (one per line, optionally with comma-separated title)&#10;https://github.com/user/repo, My Project&#10;https://myapp.com"
              value={{this.importText}}
              {{on "input" this.updateImportText}}
            ></textarea>
            <div class="import-actions">
              <button type="button" class="btn" {{on "click" this.importProofs}}>
                Import Proofs
              </button>
              <button type="button" class="btn btn-secondary" {{on "click" this.loadSample}}>
                Load Sample Data
              </button>
            </div>
          </div>
        </div>
      {{/if}}

      {{#if (eq this.activeTab "portfolio")}}
        <div class="card">
          <h3>Export Portfolio</h3>
          <p style="color: var(--muted); font-size: 0.85rem; margin-bottom: 16px;">
            Copy this markdown to share your proof portfolio.
          </p>
          <div class="portfolio-preview">{{this.proofAnalyzer.portfolioMarkdown}}</div>
          <div class="import-actions" style="margin-top: 16px;">
            <button type="button" class="btn" {{on "click" this.copyPortfolio}}>
              📋 Copy to Clipboard
            </button>
          </div>
        </div>
      {{/if}}
    </div>
  </template>
}

function eq(a: unknown, b: unknown): boolean {
  return a === b;
}

function get<T>(arr: T[], index: number): T | undefined {
  return arr[index];
}

function fn<T extends unknown[], R>(f: (...args: T) => R, ...args: T): () => R {
  return () => f(...args);
}
