import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { modifier } from "ember-modifier";
import { MorphogenEngine, PRESETS, PALETTES } from "morphogen/morphogen/engine";
import type { RDPreset, RDPalette } from "morphogen/morphogen/engine";

interface PresetItem extends RDPreset {
  index: number;
  cls: string;
}

interface PaletteItem extends RDPalette {
  index: number;
  cls: string;
}

export default class MorphogenApp extends Component {
  private engine: MorphogenEngine | null = null;

  // ── UI state ─────────────────────────────────────────────────
  @tracked currentPresetIndex = 0;
  @tracked currentPaletteIndex = 0;
  @tracked panelOpen = true;
  @tracked brushSize = 4;
  @tracked isPainting = false;
  @tracked infoVisible = true;

  // ── Derived state ─────────────────────────────────────────────
  get currentPreset(): RDPreset { return PRESETS[this.currentPresetIndex]!; }
  get currentPalette(): RDPalette { return PALETTES[this.currentPaletteIndex]!; }
  get brushRadiusNorm(): number { return (this.brushSize / 100) * 0.12; }
  get brushSizeDisplay(): string { return String(this.brushSize); }
  get panelClass(): string { return this.panelOpen ? "panel open" : "panel"; }
  get infoClass(): string { return this.infoVisible ? "info-banner visible" : "info-banner"; }

  get presetItems(): PresetItem[] {
    return PRESETS.map((p, i) => ({
      ...p,
      index: i,
      cls: i === this.currentPresetIndex ? "preset-btn active" : "preset-btn",
    }));
  }

  get paletteItems(): PaletteItem[] {
    return PALETTES.map((p, i) => ({
      ...p,
      index: i,
      cls: i === this.currentPaletteIndex ? "color-pill active" : "color-pill",
    }));
  }

  // ── Canvas setup ─────────────────────────────────────────────

  setupCanvas = modifier((el: HTMLElement) => {
    const canvas = el.querySelector<HTMLCanvasElement>("canvas");
    if (!canvas) return;
    try {
      const engine = new MorphogenEngine(canvas);
      this.engine = engine;
      engine.setPreset(this.currentPreset);
      engine.setPalette(this.currentPalette);
      engine.setBrushRadius(this.brushRadiusNorm);
      engine.start();
      return () => engine.destroy();
    } catch (e) {
      el.innerHTML = `<div class="error-msg">${e instanceof Error ? e.message : "WebGL not supported"}</div>`;
    }
    return undefined;
  });

  // ── Event handlers ────────────────────────────────────────────

  selectPreset = (index: number) => {
    this.currentPresetIndex = index;
    this.engine?.setPreset(this.currentPreset);
  };

  selectPalette = (index: number) => {
    this.currentPaletteIndex = index;
    this.engine?.setPalette(this.currentPalette);
  };

  onBrushChange = (e: Event) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    this.brushSize = v;
    this.engine?.setBrushRadius(this.brushRadiusNorm);
  };

  onReset = () => this.engine?.resetSimulation();
  onClear = () => this.engine?.clearCanvas();
  onTogglePanel = () => { this.panelOpen = !this.panelOpen; };
  onDismissInfo = () => { this.infoVisible = false; };

  getCanvasPoint = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement): { x: number; y: number } | null => {
    const rect = canvas.getBoundingClientRect();
    let cx: number, cy: number;
    if (e instanceof TouchEvent) {
      const t = e.touches[0];
      if (!t) return null;
      cx = t.clientX; cy = t.clientY;
    } else {
      cx = e.clientX; cy = e.clientY;
    }
    return { x: (cx - rect.left) / rect.width, y: 1.0 - (cy - rect.top) / rect.height };
  };

  onPointerDown = (e: MouseEvent) => {
    this.isPainting = true;
    const pt = this.getCanvasPoint(e, e.currentTarget as HTMLCanvasElement);
    if (pt) this.engine?.addSplat(pt.x, pt.y);
    e.preventDefault();
  };

  onPointerMove = (e: MouseEvent) => {
    if (!this.isPainting) return;
    const pt = this.getCanvasPoint(e, e.currentTarget as HTMLCanvasElement);
    if (pt) this.engine?.addSplat(pt.x, pt.y);
    e.preventDefault();
  };

  onPointerUp = () => { this.isPainting = false; };

  onTouchStart = (e: TouchEvent) => {
    this.isPainting = true;
    const pt = this.getCanvasPoint(e, e.currentTarget as HTMLCanvasElement);
    if (pt) this.engine?.addSplat(pt.x, pt.y);
    e.preventDefault();
  };

  onTouchMove = (e: TouchEvent) => {
    if (!this.isPainting) return;
    const pt = this.getCanvasPoint(e, e.currentTarget as HTMLCanvasElement);
    if (pt) this.engine?.addSplat(pt.x, pt.y);
    e.preventDefault();
  };

  onTouchEnd = () => { this.isPainting = false; };

  <template>
    <div class="morphogen-root">
      {{! Canvas area }}
      <div class="canvas-wrap" {{this.setupCanvas}}>
        <canvas
          {{on "mousedown" this.onPointerDown}}
          {{on "mousemove" this.onPointerMove}}
          {{on "mouseup" this.onPointerUp}}
          {{on "mouseleave" this.onPointerUp}}
          {{on "touchstart" this.onTouchStart passive=false}}
          {{on "touchmove" this.onTouchMove passive=false}}
          {{on "touchend" this.onTouchEnd}}
        />
      </div>

      {{! Top-right control panel }}
      <div class={{this.panelClass}}>
        <button class="panel-toggle" type="button" {{on "click" this.onTogglePanel}}>
          {{#if this.panelOpen}}▸{{else}}◂{{/if}}
        </button>

        {{#if this.panelOpen}}
          <div class="panel-inner">
            <div class="panel-title">
              <span class="glyph">🧬</span>
              <div>
                <div class="title-text">Morphogen</div>
                <div class="title-sub">Turing Pattern Engine</div>
              </div>
            </div>

            <div class="section-label">Pattern</div>
            <div class="palette-grid">
              {{#each this.presetItems as |preset|}}
                <button
                  type="button"
                  class={{preset.cls}}
                  {{on "click" (fn this.selectPreset preset.index)}}
                  title={{preset.desc}}
                >
                  <span class="preset-emoji">{{preset.emoji}}</span>
                  <span class="preset-name">{{preset.name}}</span>
                </button>
              {{/each}}
            </div>

            <div class="section-label">Colour</div>
            <div class="color-pills">
              {{#each this.paletteItems as |palette|}}
                <button
                  type="button"
                  class={{palette.cls}}
                  data-palette={{palette.name}}
                  {{on "click" (fn this.selectPalette palette.index)}}
                >{{palette.name}}</button>
              {{/each}}
            </div>

            <div class="section-label">Brush Size <span class="val">{{this.brushSizeDisplay}}</span></div>
            <input
              class="slider"
              type="range"
              min="1"
              max="12"
              step="0.5"
              value={{this.brushSize}}
              {{on "input" this.onBrushChange}}
            />

            <div class="action-row">
              <button type="button" class="action-btn" {{on "click" this.onReset}}>↺ Reset</button>
              <button type="button" class="action-btn danger" {{on "click" this.onClear}}>✕ Clear</button>
            </div>
          </div>
        {{/if}}
      </div>

      {{! Floating info banner }}
      <div class={{this.infoClass}}>
        <span class="info-text">Paint chemical seeds · Watch patterns self-organise</span>
        <button type="button" class="info-dismiss" {{on "click" this.onDismissInfo}}>✕</button>
      </div>

      {{! Bottom strip: current species }}
      <div class="species-strip">
        <span class="species-label">{{this.currentPreset.emoji}} {{this.currentPreset.name}}</span>
        <span class="species-desc">{{this.currentPreset.desc}}</span>
        <span class="species-params">F={{this.currentPreset.F}} k={{this.currentPreset.k}}</span>
      </div>
    </div>
  </template>
}
