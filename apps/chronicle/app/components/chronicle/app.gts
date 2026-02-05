import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { service } from "@ember/service";
import type NarrativeService from "chronicle/services/narrative";
import type { StoryTemplate } from "chronicle/services/narrative";

export default class ChronicleApp extends Component {
  @service declare narrative: NarrativeService;

  @tracked newUrl = "";
  @tracked newTitle = "";
  @tracked selectedTemplate: StoryTemplate = "weekly";

  get templates(): { id: StoryTemplate; label: string; icon: string }[] {
    return [
      { id: "weekly", label: "Weekly Summary", icon: "📅" },
      { id: "case-study", label: "Case Study", icon: "📚" },
      { id: "retrospective", label: "Retrospective", icon: "🔄" },
      { id: "pitch", label: "Ship Pitch", icon: "🚀" },
    ];
  }

  updateUrl = (event: Event): void => {
    this.newUrl = (event.target as HTMLInputElement).value;
  };

  updateTitle = (event: Event): void => {
    this.newTitle = (event.target as HTMLInputElement).value;
  };

  addProof = (): void => {
    if (!this.newUrl.trim()) return;
    this.narrative.addProof(this.newUrl.trim(), this.newTitle.trim());
    this.newUrl = "";
    this.newTitle = "";
  };

  removeProof = (id: string): void => {
    this.narrative.removeProof(id);
  };

  selectTemplate = (template: StoryTemplate): void => {
    this.selectedTemplate = template;
  };

  generateStory = async (): Promise<void> => {
    await this.narrative.generateStory(this.selectedTemplate);
  };

  loadSample = (): void => {
    this.narrative.loadSampleData();
  };

  copyStory = async (): Promise<void> => {
    if (this.narrative.currentStory) {
      await navigator.clipboard.writeText(this.narrative.currentStory.content);
      alert("Story copied to clipboard!");
    }
  };

  formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  <template>
    <div class="container">
      <header>
        <a href="../" class="back">← All Tools</a>
        <h1>📖 Chronicle</h1>
        <p class="subtitle">AI work journal that builds narratives from your attestations.</p>
      </header>

      <div class="card">
        <h3>Add Proof</h3>
        <div class="input-section">
          <div class="input-row">
            <input
              type="url"
              placeholder="Proof URL (GitHub, screenshot, demo, etc.)"
              value={{this.newUrl}}
              {{on "input" this.updateUrl}}
            />
            <input
              type="text"
              placeholder="Title (optional)"
              value={{this.newTitle}}
              {{on "input" this.updateTitle}}
            />
            <button type="button" class="btn btn-small" {{on "click" this.addProof}}>
              Add
            </button>
          </div>
          <button type="button" class="btn btn-secondary btn-small" {{on "click" this.loadSample}}>
            Load Sample Data
          </button>
        </div>
      </div>

      <div class="card">
        <h3>Proof Timeline ({{this.narrative.proofs.length}})</h3>
        {{#if this.narrative.sortedProofs.length}}
          <div class="timeline">
            {{#each this.narrative.sortedProofs as |proof|}}
              <div class="timeline-item">
                <div class="timeline-dot">
                  {{#if (eq proof.type "github")}}🐙{{/if}}
                  {{#if (eq proof.type "url")}}🔗{{/if}}
                  {{#if (eq proof.type "screenshot")}}📸{{/if}}
                  {{#if (eq proof.type "demo")}}🎬{{/if}}
                </div>
                <div class="timeline-content">
                  <div class="timeline-date">{{this.formatDate proof.timestamp}}</div>
                  <div class="timeline-title">
                    <span class="timeline-type {{proof.type}}">{{proof.type}}</span>
                    {{proof.title}}
                  </div>
                  <a href={{proof.url}} target="_blank" rel="noopener" class="timeline-url">
                    {{proof.url}}
                  </a>
                </div>
              </div>
            {{/each}}
          </div>
        {{else}}
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <p>No proofs yet. Add some proof URLs to build your timeline.</p>
          </div>
        {{/if}}
      </div>

      <div class="card">
        <h3>Generate Story</h3>
        <div class="templates">
          {{#each this.templates as |template|}}
            <button
              type="button"
              class="template-btn {{if (eq this.selectedTemplate template.id) 'active'}}"
              {{on "click" (fn this.selectTemplate template.id)}}
            >
              {{template.icon}} {{template.label}}
            </button>
          {{/each}}
        </div>
        <button 
          type="button" 
          class="btn" 
          disabled={{this.narrative.isGenerating}}
          {{on "click" this.generateStory}}
        >
          {{#if this.narrative.isGenerating}}
            Generating...
          {{else}}
            ✨ Generate {{this.selectedTemplate}} Story
          {{/if}}
        </button>
      </div>

      {{#if this.narrative.isGenerating}}
        <div class="card">
          <div class="loading">
            <div class="spinner"></div>
            AI is analyzing your proofs and crafting a narrative...
          </div>
        </div>
      {{/if}}

      {{#if this.narrative.currentStory}}
        <div class="card">
          <h3>Generated Story</h3>
          <div class="story-output">
            {{! Using pre to preserve markdown formatting }}
            <pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">{{this.narrative.currentStory.content}}</pre>
          </div>
          <div class="actions">
            <button type="button" class="btn" {{on "click" this.copyStory}}>
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

function fn<T extends unknown[], R>(f: (...args: T) => R, ...args: T): () => R {
  return () => f(...args);
}
