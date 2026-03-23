import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

const ACCENT_PRESETS = [
  { name: 'Emerald', color: '#10b981', hover: '#059669' },
  { name: 'Sky', color: '#0ea5e9', hover: '#0284c7' },
  { name: 'Coral', color: '#f97316', hover: '#ea580c' },
  { name: 'Rose', color: '#f43f5e', hover: '#e11d48' },
  { name: 'Amber', color: '#f59e0b', hover: '#d97706' },
  { name: 'Teal', color: '#14b8a6', hover: '#0d9488' },
  { name: 'Violet', color: '#8b5cf6', hover: '#7c3aed' },
  { name: 'Indigo', color: '#6366f1', hover: '#4f46e5' },
];

export default class ThemeDebug extends Component {
  @tracked isOpen = false;
  @tracked currentAccent = 'Emerald';

  private panelEl: HTMLElement | null = null;

  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.ctrlKey && e.key === '.') {
      e.preventDefault();
      this.isOpen = !this.isOpen;
      this.renderPanel();
    }
    if (e.key === 'Escape' && this.isOpen) {
      this.isOpen = false;
      this.renderPanel();
    }
  };

  constructor(owner: unknown, args: Record<string, never>) {
    super(owner, args);

    const savedAccent = localStorage.getItem('atelier-accent');
    if (savedAccent) {
      const preset = ACCENT_PRESETS.find(p => p.name === savedAccent);
      if (preset) {
        this.currentAccent = savedAccent;
        this.applyAccent(preset);
      }
    }

    document.addEventListener('keydown', this.handleKeydown);
  }

  willDestroy(): void {
    super.willDestroy();
    document.removeEventListener('keydown', this.handleKeydown);
    this.panelEl?.remove();
  }

  private applyAccent(preset: { color: string; hover: string }): void {
    const root = document.documentElement;
    root.style.setProperty('--accent', preset.color);
    root.style.setProperty('--accent-hover', preset.hover);
    root.style.setProperty('--selection', preset.color);
    // Compute a dim version (30% opacity against dark bg)
    root.style.setProperty('--accent-dim', preset.color + '30');
  }

  private renderPanel(): void {
    if (!this.isOpen) {
      this.panelEl?.remove();
      this.panelEl = null;
      return;
    }

    if (this.panelEl) return;

    const panel = document.createElement('div');
    panel.style.cssText = `
      position: fixed !important;
      bottom: 16px !important;
      right: 16px !important;
      z-index: 99999 !important;
      background: #1a1a1f;
      border: 1px solid #2a2a32;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      font-family: Inter, system-ui, sans-serif;
      font-size: 12px;
      color: #a1a1aa;
      min-width: 200px;
    `;
    panel.innerHTML = this.buildPanelHTML();
    document.body.appendChild(panel);
    this.panelEl = panel;

    panel.querySelectorAll('[data-accent]').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = (btn as HTMLElement).dataset['accent']!;
        const preset = ACCENT_PRESETS.find(p => p.name === name);
        if (!preset) return;
        this.currentAccent = name;
        this.applyAccent(preset);
        localStorage.setItem('atelier-accent', name);
        this.refreshPanel();
      });
    });

    panel.querySelector('[data-reset]')?.addEventListener('click', () => {
      localStorage.removeItem('atelier-accent');
      const root = document.documentElement;
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-hover');
      root.style.removeProperty('--accent-dim');
      root.style.removeProperty('--selection');
      this.currentAccent = 'Emerald';
      this.refreshPanel();
    });
  }

  private refreshPanel(): void {
    if (this.panelEl) {
      this.panelEl.remove();
      this.panelEl = null;
      this.renderPanel();
    }
  }

  private buildPanelHTML(): string {
    const swatches = ACCENT_PRESETS.map(p => {
      const active = p.name === this.currentAccent;
      return `<button data-accent="${p.name}" title="${p.name}" style="
        width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${active ? '#e4e4e7' : 'transparent'};
        background: ${p.color}; cursor: pointer; box-shadow: ${active ? `0 0 0 2px #1a1a1f` : 'none'};
        transition: transform 0.15s;
      " onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'"></button>`;
    }).join('');

    return `
      <div style="margin-bottom: 12px; font-weight: 600; color: #e4e4e7; font-size: 13px;">Accent Color</div>
      <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">${swatches}</div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <button data-reset style="
          background: none; border: 1px solid #2a2a32; border-radius: 6px; color: #71717a;
          padding: 4px 10px; font-size: 11px; cursor: pointer;
        ">Reset</button>
        <span style="color: #52525b; font-size: 10px;">Ctrl + .</span>
      </div>
    `;
  }

  <template>
    {{! Theme debug — Ctrl+. to toggle accent color picker }}
  </template>
}
