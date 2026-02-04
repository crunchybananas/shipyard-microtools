import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { htmlSafe } from "@ember/template";
import type { SafeString } from "@ember/template/-private/handlebars";

export default class GradientGeneratorApp extends Component {
  @tracked type: "linear" | "radial" = "linear";
  @tracked angle = 135;
  @tracked color1 = "#7C3AED";
  @tracked color2 = "#06B6D4";
  @tracked color3 = "#F97316";
  @tracked stop1 = 0;
  @tracked stop2 = 100;
  @tracked stop3 = 50;
  @tracked enableColor3 = true;

  get gradient(): string {
    const stops = [
      { color: this.color1, stop: this.stop1 },
      { color: this.color2, stop: this.stop2 },
    ];

    if (this.enableColor3) {
      stops.push({ color: this.color3, stop: this.stop3 });
    }

    const sorted = stops.sort((a, b) => a.stop - b.stop);
    const stopString = sorted.map((s) => `${s.color} ${s.stop}%`).join(", ");

    if (this.type === "radial") {
      return `radial-gradient(circle, ${stopString})`;
    }
    return `linear-gradient(${this.angle}deg, ${stopString})`;
  }

  get cssOutput(): string {
    return `background: ${this.gradient};`;
  }

  get previewStyle(): SafeString {
    return htmlSafe(`background: ${this.gradient};`);
  }

  get angleControlOpacity(): SafeString {
    return htmlSafe(`opacity: ${this.type === "radial" ? "0.3" : "1"};`);
  }

  @action
  updateType(event: Event): void {
    this.type = (event.target as HTMLSelectElement).value as "linear" | "radial";
  }

  @action
  updateAngle(event: Event): void {
    this.angle = parseInt((event.target as HTMLInputElement).value);
  }

  @action
  updateColor1(event: Event): void {
    this.color1 = (event.target as HTMLInputElement).value;
  }

  @action
  updateColor2(event: Event): void {
    this.color2 = (event.target as HTMLInputElement).value;
  }

  @action
  updateColor3(event: Event): void {
    this.color3 = (event.target as HTMLInputElement).value;
  }

  @action
  updateStop1(event: Event): void {
    this.stop1 = parseInt((event.target as HTMLInputElement).value);
  }

  @action
  updateStop2(event: Event): void {
    this.stop2 = parseInt((event.target as HTMLInputElement).value);
  }

  @action
  updateStop3(event: Event): void {
    this.stop3 = parseInt((event.target as HTMLInputElement).value);
  }

  @action
  toggleColor3(): void {
    this.enableColor3 = !this.enableColor3;
  }

  @action
  randomize(): void {
    this.color1 = this.randomColor();
    this.color2 = this.randomColor();
    this.color3 = this.randomColor();
    this.stop1 = 0;
    this.stop2 = 100;
    this.stop3 = 50;
    this.enableColor3 = Math.random() > 0.3;
    this.angle = Math.floor(Math.random() * 360);
  }

  @action
  copyCss(): void {
    navigator.clipboard.writeText(this.cssOutput);
  }

  @action
  copyColors(): void {
    const colors = [this.color1, this.color2];
    if (this.enableColor3) colors.push(this.color3);
    navigator.clipboard.writeText(colors.join(", "));
  }

  randomColor(): string {
    return `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")}`;
  }

  <template>
    <div class="app">
      <header class="header">
        <a href="../../" class="back">← All Tools</a>
        <div class="header-content">
          <div>
            <h1>🎨 Gradient Generator</h1>
            <p>Create beautiful CSS gradients in seconds.</p>
          </div>
          <button type="button" class="btn primary" {{on "click" this.randomize}}>Randomize</button>
        </div>
      </header>

      <section class="preview">
        <div class="preview-swatch" style={{this.previewStyle}}></div>
        <div class="preview-actions">
          <button type="button" class="btn" {{on "click" this.copyCss}}>Copy CSS</button>
          <button type="button" class="btn" {{on "click" this.copyColors}}>Copy Colors</button>
        </div>
      </section>

      <section class="controls">
        <div class="control">
          <label>Type</label>
          <select {{on "change" this.updateType}}>
            <option value="linear" selected={{eq this.type "linear"}}>Linear</option>
            <option value="radial" selected={{eq this.type "radial"}}>Radial</option>
          </select>
        </div>

        <div class="control" style={{this.angleControlOpacity}}>
          <label>Angle: {{this.angle}}°</label>
          <input
            type="range"
            min="0"
            max="360"
            value={{this.angle}}
            {{on "input" this.updateAngle}}
          />
        </div>

        <div class="control">
          <label>Color 1</label>
          <div class="color-row">
            <input type="color" value={{this.color1}} {{on "input" this.updateColor1}} />
            <input
              type="range"
              min="0"
              max="100"
              value={{this.stop1}}
              {{on "input" this.updateStop1}}
            />
            <span>{{this.stop1}}%</span>
          </div>
        </div>

        <div class="control">
          <label>Color 2</label>
          <div class="color-row">
            <input type="color" value={{this.color2}} {{on "input" this.updateColor2}} />
            <input
              type="range"
              min="0"
              max="100"
              value={{this.stop2}}
              {{on "input" this.updateStop2}}
            />
            <span>{{this.stop2}}%</span>
          </div>
        </div>

        <div class="control">
          <label>Color 3 (optional)</label>
          <div class="color-row">
            <input type="color" value={{this.color3}} {{on "input" this.updateColor3}} />
            <input
              type="range"
              min="0"
              max="100"
              value={{this.stop3}}
              {{on "input" this.updateStop3}}
            />
            <span>{{this.stop3}}%</span>
            <label class="toggle">
              <input type="checkbox" checked={{this.enableColor3}} {{on "change" this.toggleColor3}} />
              <span>Enable</span>
            </label>
          </div>
        </div>
      </section>

      <section class="output">
        <label>CSS</label>
        <pre>{{this.cssOutput}}</pre>
      </section>

      <footer class="footer">
        <p>Part of <a href="https://shipyard.bot">Shipyard</a> Microtools</p>
        <p class="footer-credit">
          Made with 🧡 by
          <a href="https://crunchybananas.com" target="_blank" rel="noopener">Crunchy Bananas</a>
          using <a href="https://emberjs.com" target="_blank" rel="noopener">Ember</a>
        </p>
      </footer>
    </div>
  </template>
}

function eq(a: unknown, b: unknown): boolean {
  return a === b;
}
