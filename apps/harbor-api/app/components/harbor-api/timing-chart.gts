import Component from "@glimmer/component";

import { sparkline } from "harbor-api/modifiers/chartjs";

export interface TimingChartSignature {
  Element: HTMLDivElement;
  Args: {
    data: number[];
  };
}

export default class TimingChart extends Component<TimingChartSignature> {
  get avgTime(): string {
    const data = this.args.data;
    if (data.length === 0) return "—";
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    return `${Math.round(avg)} ms`;
  }

  get minTime(): string {
    const data = this.args.data;
    if (data.length === 0) return "—";
    return `${Math.round(Math.min(...data))} ms`;
  }

  get maxTime(): string {
    const data = this.args.data;
    if (data.length === 0) return "—";
    return `${Math.round(Math.max(...data))} ms`;
  }

  <template>
    <div class="timing-chart" ...attributes>
      <div class="timing-header">
        <span class="timing-title">📊 Response Times</span>
        <div class="timing-stats">
          <span class="timing-stat">
            <span class="stat-label">Avg</span>
            <span class="stat-value">{{this.avgTime}}</span>
          </span>
          <span class="timing-stat">
            <span class="stat-label">Min</span>
            <span class="stat-value min">{{this.minTime}}</span>
          </span>
          <span class="timing-stat">
            <span class="stat-label">Max</span>
            <span class="stat-value max">{{this.maxTime}}</span>
          </span>
        </div>
      </div>
      <div class="timing-canvas-wrapper">
        <canvas
          class="timing-canvas"
          {{sparkline @data color="#4a9eff" label="Response Time"}}
        ></canvas>
      </div>
    </div>
  </template>
}
