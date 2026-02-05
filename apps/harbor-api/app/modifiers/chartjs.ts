// Harbor API — Chart.js Modifier
// Vanilla Chart.js wired up via an Ember modifier. No wrapper addon needed.
//
// Usage in .gts template:
//   <canvas {{this.sparkline @data}} />

import { modifier } from "ember-modifier";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
} from "chart.js";

// Register only what we need — tree-shakeable
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
);

/**
 * A modifier that renders a sparkline chart on a <canvas>.
 * Pass an array of numbers. The chart updates reactively.
 * No ember-chart-js addon. Just the modifier.
 */
export const sparkline = modifier(
  (
    canvas: HTMLCanvasElement,
    [data]: [number[]],
    named?: { color?: string; label?: string },
  ) => {
    const color = named?.color ?? "#4a9eff";
    const label = named?.label ?? "Response Time";

    const chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: (data ?? []).map((_, i) => String(i + 1)),
        datasets: [
          {
            label,
            data: data ?? [],
            borderColor: color,
            backgroundColor: `${color}20`,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: color,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => `${Math.round(ctx.parsed.y)} ms`,
            },
          },
        },
        scales: {
          x: {
            display: false,
          },
          y: {
            display: true,
            beginAtZero: true,
            grid: {
              color: "rgba(255,255,255,0.05)",
            },
            ticks: {
              color: "#8888aa",
              font: { size: 10 },
              callback: (val) => `${val}ms`,
            },
          },
        },
        interaction: {
          intersect: false,
          mode: "index",
        },
      },
    });

    return () => {
      chart.destroy();
    };
  },
);
