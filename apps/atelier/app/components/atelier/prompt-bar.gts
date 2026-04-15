import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { inject as service } from "@ember/service";
import type DesignStoreService from "atelier/services/design-store";
import type AiServiceService from "atelier/services/ai-service";
import type { AgentStep, ClaudeModelTier } from "atelier/services/ai-service";
import type VoiceServiceService from "atelier/services/voice-service";
import {
  IconFrame,
  IconRect,
  IconChevronDown,
  IconSparkles,
  IconMic,
} from "atelier/components/atelier/icons";

export interface PromptBarSignature {
  Args: {
    showOnboarding: boolean;
  };
}

export default class AtelierPromptBar extends Component<PromptBarSignature> {
  @service declare designStore: DesignStoreService;
  @service declare aiService: AiServiceService;
  @service('voice-service') declare voiceService: VoiceServiceService;

  @tracked showModelDropdown: boolean = false;
  @tracked aiPrompt: string = "";
  @tracked designFormat: "web" | "app" = "web";
  @tracked toastMessage: string | null = null;
  @tracked showApiKeyInput: boolean = false;
  @tracked apiKeyDraft: string = "";

  get isWebFormat(): boolean {
    return this.designFormat === "web";
  }

  get isAppFormat(): boolean {
    return this.designFormat === "app";
  }

  get isAiDisabled(): boolean {
    return !this.aiPrompt.trim();
  }

  get modelLabel(): string {
    if (this.aiService.selectedModel === "atelier-pro" && this.aiService.hasApiKey) {
      return `Claude ${this.aiService.claudeModel.label}`;
    }
    if (this.aiService.selectedModel === "atelier-pro") return "Atelier Pro";
    return "Atelier v1";
  }

  get isProModel(): boolean {
    return this.aiService.selectedModel === "atelier-pro";
  }

  selectModelTier = (tier: ClaudeModelTier) => {
    this.aiService.setClaudeModelTier(tier);
  };

  isTierSelected = (tier: ClaudeModelTier): boolean => {
    return this.aiService.claudeModelTier === tier;
  };

  get apiKeyStatusClass(): string {
    if (this.aiService.apiKeyTesting) return "testing";
    if (this.aiService.apiKeyValid === true) return "valid";
    if (this.aiService.apiKeyValid === false) return "invalid";
    return "untested";
  }

  get apiKeyStatusText(): string {
    if (this.aiService.apiKeyTesting) return "Testing connection...";
    if (this.aiService.apiKeyValid === true) return "Connected";
    if (this.aiService.apiKeyValid === false) return "Invalid key or connection error";
    return "Key saved — not yet tested";
  }

  testConnection = async () => {
    const valid = await this.aiService.testApiKey();
    if (valid) {
      this.showToast("Connection successful");
    } else {
      this.showToast("Connection failed — check your key");
    }
  };

  get voiceDisplayText(): string {
    return this.voiceService.displayText;
  }

  get promptPlaceholder(): string {
    if (this.voiceService.isListening) {
      return "Listening...";
    }
    return "Describe a UI to generate...";
  }

  get promptValue(): string {
    if (this.voiceService.isListening && this.voiceService.displayText) {
      return this.voiceService.displayText;
    }
    // Consume pending suggestion from AI chat panel
    if (this.aiService.pendingSuggestion) {
      this.aiPrompt = this.aiService.pendingSuggestion;
      this.aiService.pendingSuggestion = "";
      return this.aiPrompt;
    }
    return this.aiPrompt;
  }

  setFormat = (format: "web" | "app") => {
    this.designFormat = format;
  };

  toggleModelDropdown = () => {
    this.showModelDropdown = !this.showModelDropdown;
  };

  selectModel = (model: string) => {
    if (model === "atelier-pro" && !this.aiService.hasApiKey) {
      this.showApiKeyInput = true;
      this.apiKeyDraft = "";
      this.showModelDropdown = false;
      return;
    }
    this.aiService.selectedModel = model;
    this.showModelDropdown = false;
  };

  onApiKeyInput = (e: Event) => {
    this.apiKeyDraft = (e.target as HTMLInputElement).value;
  };

  saveApiKey = () => {
    this.aiService.setApiKey(this.apiKeyDraft);
    this.showApiKeyInput = false;
    if (this.aiService.hasApiKey) {
      this.aiService.selectedModel = "atelier-pro";
      this.showToast("API key saved — Pro mode active");
    }
  };

  closeApiKeyInput = () => {
    this.showApiKeyInput = false;
  };

  clearApiKey = () => {
    this.aiService.setApiKey("");
    this.aiService.selectedModel = "atelier-v1";
    this.showApiKeyInput = false;
    this.showToast("API key cleared");
  };

  isModelSelected = (model: string): boolean => {
    return this.aiService.selectedModel === model;
  };

  onInlinePromptInput = (e: Event) => {
    this.aiPrompt = (e.target as HTMLInputElement).value;
  };

  onInlinePromptKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && this.aiPrompt.trim()) {
      e.preventDefault();
      this.generateDesign();
    }
  };

  generateDesign = async () => {
    if (!this.aiPrompt.trim()) return;
    await this.aiService.generateFromPrompt(this.aiPrompt);
  };

  quickGenerate = async (prompt: string) => {
    if (prompt === "__extract_components__") {
      this.aiService.extractComponents();
      return;
    }
    this.aiPrompt = prompt;
    await this.aiService.generateFromPrompt(prompt);
  };

  toggleVoice = () => {
    if (this.voiceService.isListening) {
      // Stop listening and use transcript
      const transcript = this.voiceService.displayText;
      this.voiceService.stopListening();
      if (transcript.trim()) {
        this.aiPrompt = transcript;
      }
    } else {
      this.voiceService.startListening((transcript: string) => {
        // Auto-submit callback after silence timeout
        this.aiPrompt = transcript;
        this.showToast("Got it!");
        // Auto-generate after a short delay for the toast
        setTimeout(() => {
          this.generateDesign();
        }, 400);
      });
    }
  };

  showToast(message: string): void {
    this.toastMessage = message;
    setTimeout(() => {
      this.toastMessage = null;
    }, 1500);
  }

  stopPropagation = (e: MouseEvent) => {
    e.stopPropagation();
  };

  // ---- Agent log ----

  toggleAgentLog = () => {
    this.aiService.showAgentLog = !this.aiService.showAgentLog;
  };

  isAgentStepComplete = (step: AgentStep): boolean => {
    return step.status === "complete";
  };

  <template>
    {{#if this.designStore.aiGenerating}}
      <div class="ai-generating-overlay">
        <div class="ai-generating-dot"></div>
        <div class="ai-generating-dot"></div>
        <div class="ai-generating-dot"></div>
        <span class="ai-generating-text">Generating your design...</span>
      </div>
    {{else}}
      {{#unless @showOnboarding}}
        <div class="ai-prompt-bar">
          <div class="ai-prompt-bar-chips">
            {{#each this.aiService.smartSuggestions as |suggestion|}}
              <button class="ai-prompt-chip" type="button" {{on "click" (fn this.quickGenerate suggestion.prompt)}}>
                <span class="chip-icon">{{suggestion.icon}}</span>
                {{suggestion.label}}
              </button>
            {{/each}}
          </div>
          <div class="ai-prompt-bar-inner {{if this.voiceService.isListening 'voice-active'}}">
            <div class="ai-prompt-model-selector">
              <button class="model-selector-btn" type="button" {{on "click" this.toggleModelDropdown}}>
                <span class="model-selector-label">{{this.modelLabel}}</span>
                <span class="model-selector-sparkle">&#10022;</span>
                <IconChevronDown />
              </button>
              {{#if this.showModelDropdown}}
                <div class="model-dropdown">
                  <button class="model-dropdown-item {{if (this.isModelSelected 'atelier-v1') 'active'}}" type="button" {{on "click" (fn this.selectModel "atelier-v1")}}>
                    <span>Atelier v1</span>
                    <span class="model-desc">Templates — no API key needed</span>
                  </button>
                  <div class="model-dropdown-divider"></div>
                  <button class="model-dropdown-item {{if (this.isModelSelected 'atelier-pro') 'active'}}" type="button" {{on "click" (fn this.selectModel "atelier-pro")}}>
                    <span>Claude AI</span>
                    <span class="model-pro-badge">BYOK</span>
                  </button>
                  {{#if (this.isModelSelected "atelier-pro")}}
                    {{#each this.aiService.allModelTiers as |entry|}}
                      <button
                        class="model-dropdown-item model-tier-item {{if (this.isTierSelected entry.tier) 'active'}}"
                        type="button"
                        {{on "click" (fn this.selectModelTier entry.tier)}}
                      >
                        <span class="model-tier-name">{{entry.config.label}}</span>
                        <span class="model-tier-desc">{{entry.config.description}}</span>
                        <span class="model-tier-cost">${{entry.config.inputCostPer1M}}/${{entry.config.outputCostPer1M}} per 1M tokens</span>
                      </button>
                    {{/each}}
                  {{/if}}
                </div>
              {{/if}}
            </div>
            <div class="ai-prompt-format-toggle">
              <button class="format-toggle-btn {{if this.isWebFormat 'active'}}" type="button" {{on "click" (fn this.setFormat "web")}}>
                <IconFrame />
                Web
              </button>
              <button class="format-toggle-btn {{if this.isAppFormat 'active'}}" type="button" {{on "click" (fn this.setFormat "app")}}>
                <IconRect />
                App
              </button>
            </div>
            <input
              class="ai-prompt-input"
              type="text"
              placeholder={{this.promptPlaceholder}}
              value={{this.promptValue}}
              {{on "input" this.onInlinePromptInput}}
              {{on "keydown" this.onInlinePromptKeydown}}
            />
            {{#if this.voiceService.isAvailable}}
              <button
                class="ai-prompt-voice {{if this.voiceService.isListening 'recording'}}"
                type="button"
                title={{if this.voiceService.isListening "Stop listening" "Voice input"}}
                {{on "click" this.toggleVoice}}
              >
                <IconMic />
              </button>
            {{/if}}
            <button
              class="ai-prompt-send"
              type="button"
              disabled={{this.isAiDisabled}}
              {{on "click" this.generateDesign}}
            >
              <IconSparkles />
            </button>
          </div>
        </div>
      {{/unless}}
    {{/if}}

    {{! ---- Agent Log ---- }}
    {{#if this.aiService.agentSteps.length}}
      <div class="agent-log {{if this.aiService.showAgentLog 'expanded'}}">
        <button class="agent-log-toggle" type="button" {{on "click" this.toggleAgentLog}}>
          <span class="agent-log-label">Agent log</span>
          <svg class="agent-log-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {{#if this.aiService.showAgentLog}}
          <div class="agent-log-steps">
            {{#each this.aiService.agentSteps as |step|}}
              <div class="agent-step {{if (this.isAgentStepComplete step) 'complete'}}">
                {{#if (this.isAgentStepComplete step)}}
                  <svg class="agent-step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                {{else}}
                  <div class="agent-step-spinner"></div>
                {{/if}}
                <span class="agent-step-text">{{step.message}}</span>
              </div>
            {{/each}}
          </div>
        {{/if}}
      </div>
    {{/if}}

    {{! ---- API Key Input ---- }}
    {{#if this.showApiKeyInput}}
      <div class="api-key-overlay" role="button" {{on "click" this.closeApiKeyInput}}>
        <div class="api-key-modal" role="dialog" {{on "click" this.stopPropagation}}>
          <div class="api-key-header">
            <span class="api-key-title">Atelier Pro — Claude AI</span>
          </div>
          <p class="api-key-desc">Enter your Anthropic API key to enable AI-powered design generation. Your key is stored locally and never sent to our servers.</p>
          <input
            class="api-key-input"
            type="password"
            placeholder="sk-ant-..."
            value={{this.apiKeyDraft}}
            {{on "input" this.onApiKeyInput}}
          />
          {{#if this.aiService.hasApiKey}}
            <div class="api-key-status">
              <span class="api-key-status-dot {{this.apiKeyStatusClass}}"></span>
              <span>{{this.apiKeyStatusText}}</span>
            </div>
          {{/if}}
          <div class="api-key-actions">
            {{#if this.aiService.hasApiKey}}
              <button class="api-key-btn danger" type="button" {{on "click" this.clearApiKey}}>Remove Key</button>
              <button class="api-key-btn" type="button" {{on "click" this.testConnection}}>Test Connection</button>
            {{/if}}
            <button class="api-key-btn" type="button" {{on "click" this.closeApiKeyInput}}>Cancel</button>
            <button class="api-key-btn primary" type="button" {{on "click" this.saveApiKey}}>Save & Activate</button>
          </div>
        </div>
      </div>
    {{/if}}

    {{! ---- Voice Toast ---- }}
    {{#if this.toastMessage}}
      <div class="toast">{{this.toastMessage}}</div>
    {{/if}}
  </template>
}
