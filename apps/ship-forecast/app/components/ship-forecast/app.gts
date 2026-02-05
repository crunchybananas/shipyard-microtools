import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { fn } from "@ember/helper";
import { service } from "@ember/service";
import type ForecastService from "ship-forecast/services/forecast";
import type { ShipForecast, Ship } from "ship-forecast/services/forecast";

type TabId = "overview" | "ships" | "burndown" | "compare";

const eq = (a: unknown, b: unknown): boolean => a === b;

export default class ShipForecastApp extends Component {
  @service declare forecast: ForecastService;

  @tracked activeTab: TabId = "overview";
  @tracked selectedShipId: string | null = null;

  get tabs(): { id: TabId; label: string; icon: string }[] {
    return [
      { id: "overview", label: "Overview", icon: "📊" },
      { id: "ships", label: "Ships", icon: "⛵" },
      { id: "burndown", label: "Burndown", icon: "📉" },
      { id: "compare", label: "Compare", icon: "🔄" },
    ];
  }

  get selectedShip(): Ship | null {
    if (!this.selectedShipId) {
      return this.forecast.ships[0] ?? null;
    }
    return this.forecast.ships.find((s) => s.id === this.selectedShipId) ?? null;
  }

  get selectedForecast(): ShipForecast | null {
    const ship = this.selectedShip;
    if (!ship) return null;
    return this.forecast.calculateForecast(ship);
  }

  get maxVelocity(): number {
    const data = this.forecast.weeklyVelocityData;
    return Math.max(...data.map((d) => d.count), 1);
  }

  get chartBars(): { week: string; count: number; height: number }[] {
    const data = this.forecast.weeklyVelocityData;
    const max = this.maxVelocity;
    return data.map((d) => ({
      week: d.week,
      count: d.count,
      height: (d.count / max) * 100,
    }));
  }

  get burndownSvgPath(): { actual: string; projected: string } {
    const ship = this.selectedShip;
    if (!ship) return { actual: "", projected: "" };

    const data = this.forecast.getBurndownData(ship);
    const width = 600;
    const height = 180;
    const padding = 20;

    const maxX = Math.max(...data.actual.map((p) => p.x), ...data.projected.map((p) => p.x), 1);
    const maxY = ship.estimatedProofs;

    const scaleX = (x: number) => padding + (x / maxX) * (width - 2 * padding);
    const scaleY = (y: number) => height - padding - (y / maxY) * (height - 2 * padding);

    const actualPath = data.actual.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x)} ${scaleY(p.y)}`).join(" ");

    const projectedPath = data.projected.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x)} ${scaleY(p.y)}`).join(" ");

    return { actual: actualPath, projected: projectedPath };
  }

  get similarShips() {
    const ship = this.selectedShip;
    if (!ship) return [];
    return this.forecast.getSimilarShips(ship);
  }

  get totalProofs(): number {
    return this.forecast.ships.reduce((a, b) => a + b.proofs.length, 0);
  }

  get shipsWithEta(): number {
    return this.forecast.forecasts.filter((f) => f.predictedCompletion).length;
  }

  formatDate(date: Date | null): string {
    if (!date) return "TBD";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  setTab = (tabId: TabId): void => {
    this.activeTab = tabId;
  };

  selectShip = (shipId: string): void => {
    this.selectedShipId = shipId;
  };

  <template>
    <div class="container">
      <header>
        <a href="../" class="back">← All Tools</a>
        <h1>📈 Ship Forecast</h1>
        <p class="subtitle">Track proof velocity and predict ship completion dates</p>
      </header>

      {{#if this.forecast.stalledShips.length}}
        <div class="alert-banner">
          <span class="alert-icon">⚠️</span>
          <div class="alert-content">
            <div class="alert-title">{{this.forecast.stalledShips.length}} Stalled Ship{{if (eq this.forecast.stalledShips.length 1) "" "s"}}</div>
            <div class="alert-message">
              {{#each this.forecast.stalledShips as |f index|}}
                {{if index ", " ""}}{{f.ship.name}} ({{f.daysStalled}} days)
              {{/each}}
            </div>
          </div>
        </div>
      {{/if}}

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{this.forecast.ships.length}}</div>
          <div class="stat-label">Active Ships</div>
        </div>
        <div class="stat-card">
          <div class="stat-value healthy">{{this.forecast.healthyCount}}</div>
          <div class="stat-label">Healthy</div>
        </div>
        <div class="stat-card">
          <div class="stat-value at-risk">{{this.forecast.atRiskCount}}</div>
          <div class="stat-label">At Risk</div>
        </div>
        <div class="stat-card">
          <div class="stat-value stalled">{{this.forecast.stalledCount}}</div>
          <div class="stat-label">Stalled</div>
        </div>
      </div>

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
        <div class="card">
          <h3>Weekly Proof Velocity</h3>
          <div class="chart-container">
            <div class="velocity-chart">
              {{#each this.chartBars as |bar|}}
                <div class="chart-bar-container">
                  <div class="chart-value">{{bar.count}}</div>
                  <div class="chart-bar-wrapper">
                    <div class="chart-bar" style="height: {{bar.height}}%"></div>
                  </div>
                  <div class="chart-label">{{bar.week}}</div>
                </div>
              {{/each}}
            </div>
          </div>
        </div>

        <div class="forecast-details">
          <div class="forecast-item">
            <div class="forecast-icon">⚡</div>
            <div class="forecast-value">{{this.forecast.averageVelocity}}</div>
            <div class="forecast-label">Avg Proofs/Week</div>
          </div>
          <div class="forecast-item">
            <div class="forecast-icon">📋</div>
            <div class="forecast-value">{{this.totalProofs}}</div>
            <div class="forecast-label">Total Proofs</div>
          </div>
          <div class="forecast-item">
            <div class="forecast-icon">🎯</div>
            <div class="forecast-value">{{this.shipsWithEta}}</div>
            <div class="forecast-label">Ships with ETA</div>
          </div>
        </div>
      {{/if}}

      {{#if (eq this.activeTab "ships")}}
        <div class="card">
          <h3>Ship Health Status</h3>
          <div class="ship-list">
            {{#each this.forecast.forecasts as |f|}}
              <div class="ship-card" {{on "click" (fn this.selectShip f.ship.id)}}>
                <div class="ship-info">
                  <h4>{{f.ship.name}}</h4>
                  <div class="ship-meta">{{f.ship.description}}</div>
                  <div class="progress-bar">
                    <div class="progress-fill {{f.status}}" style="width: {{f.progress}}%"></div>
                  </div>
                </div>
                <div class="ship-metrics">
                  <div class="metric">
                    <span class="metric-value">{{f.ship.proofs.length}}/{{f.ship.estimatedProofs}}</span>
                    <span class="metric-label">Proofs</span>
                  </div>
                  <div class="metric">
                    <span class="metric-value">{{f.velocity}}</span>
                    <span class="metric-label">Per Week</span>
                  </div>
                  <div class="metric">
                    <span class="trend {{f.trend}}">
                      {{#if (eq f.trend "up")}}↑{{/if}}
                      {{#if (eq f.trend "down")}}↓{{/if}}
                      {{#if (eq f.trend "flat")}}→{{/if}}
                    </span>
                    <span class="metric-label">Trend</span>
                  </div>
                </div>
                <div class="ship-status">
                  <span class="status-badge {{f.status}}">{{f.status}}</span>
                  <span class="eta">
                    {{#if f.predictedCompletion}}
                      ETA: {{this.formatDate f.predictedCompletion}}
                    {{else}}
                      No ETA
                    {{/if}}
                  </span>
                </div>
              </div>
            {{/each}}
          </div>
        </div>
      {{/if}}

      {{#if (eq this.activeTab "burndown")}}
        <div class="card">
          <h3>Select Ship</h3>
          <div class="tabs" style="border: none; padding: 0; margin-bottom: 0;">
            {{#each this.forecast.ships as |ship|}}
              <button
                type="button"
                class="tab {{if (eq this.selectedShip.id ship.id) 'active'}}"
                {{on "click" (fn this.selectShip ship.id)}}
              >
                {{ship.name}}
              </button>
            {{/each}}
          </div>
        </div>

        {{#if this.selectedForecast}}
          <div class="card">
            <h3>Burndown Chart - {{this.selectedShip.name}}</h3>
            <div class="burndown-chart">
              <svg class="burndown-svg" viewBox="0 0 600 180" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="burndownGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color: var(--accent2); stop-opacity: 0.3" />
                    <stop offset="100%" style="stop-color: var(--accent2); stop-opacity: 0" />
                  </linearGradient>
                </defs>
                
                <!-- Grid lines -->
                <line class="burndown-axis" x1="20" y1="160" x2="580" y2="160" />
                <line class="burndown-axis" x1="20" y1="20" x2="20" y2="160" />
                
                <!-- Actual line -->
                <path class="burndown-line" d="{{this.burndownSvgPath.actual}}" />
                
                <!-- Projected line -->
                {{#if this.burndownSvgPath.projected}}
                  <path class="burndown-projected" d="{{this.burndownSvgPath.projected}}" />
                {{/if}}
                
                <!-- Labels -->
                <text class="burndown-label" x="300" y="175" text-anchor="middle">Days</text>
                <text class="burndown-label" x="10" y="90" text-anchor="middle" transform="rotate(-90, 10, 90)">Proofs</text>
              </svg>
            </div>
          </div>

          <div class="two-col">
            <div class="card">
              <h3>Current Status</h3>
              <div class="forecast-details" style="grid-template-columns: 1fr 1fr; margin-bottom: 0;">
                <div class="forecast-item">
                  <div class="forecast-icon">📊</div>
                  <div class="forecast-value">{{this.selectedForecast.progress}}%</div>
                  <div class="forecast-label">Complete</div>
                </div>
                <div class="forecast-item">
                  <div class="forecast-icon">⏳</div>
                  <div class="forecast-value">{{this.selectedForecast.daysStalled}}</div>
                  <div class="forecast-label">Days Since Proof</div>
                </div>
              </div>
            </div>
            <div class="card">
              <h3>Prediction</h3>
              <div class="forecast-details" style="grid-template-columns: 1fr 1fr; margin-bottom: 0;">
                <div class="forecast-item">
                  <div class="forecast-icon">🎯</div>
                  <div class="forecast-value" style="font-size: 1rem;">{{this.formatDate this.selectedForecast.predictedCompletion}}</div>
                  <div class="forecast-label">Est. Completion</div>
                </div>
                <div class="forecast-item">
                  <div class="forecast-icon">⚡</div>
                  <div class="forecast-value">{{this.selectedForecast.velocity}}</div>
                  <div class="forecast-label">Proofs/Week</div>
                </div>
              </div>
            </div>
          </div>
        {{/if}}
      {{/if}}

      {{#if (eq this.activeTab "compare")}}
        <div class="card">
          <h3>Select Ship to Compare</h3>
          <div class="tabs" style="border: none; padding: 0; margin-bottom: 0;">
            {{#each this.forecast.ships as |ship|}}
              <button
                type="button"
                class="tab {{if (eq this.selectedShip.id ship.id) 'active'}}"
                {{on "click" (fn this.selectShip ship.id)}}
              >
                {{ship.name}}
              </button>
            {{/each}}
          </div>
        </div>

        {{#if this.selectedShip}}
          <div class="card">
            <h3>Similar Ships - {{this.selectedShip.category}}</h3>
            <div class="comparison-grid">
              {{#each this.similarShips as |similar|}}
                <div class="comparison-card">
                  <div class="comparison-header">
                    <span class="comparison-name">{{similar.name}}</span>
                    <span class="comparison-similarity">{{similar.similarity}}% similar</span>
                  </div>
                  <div class="comparison-stats">
                    <div>
                      <div class="comparison-stat-value">{{similar.proofsToComplete}}</div>
                      <div class="comparison-stat-label">Proofs</div>
                    </div>
                    <div>
                      <div class="comparison-stat-value">{{similar.daysToComplete}}</div>
                      <div class="comparison-stat-label">Days</div>
                    </div>
                    <div>
                      <div class="comparison-stat-value">{{similar.velocity}}</div>
                      <div class="comparison-stat-label">Per Week</div>
                    </div>
                  </div>
                </div>
              {{/each}}
            </div>
          </div>

          {{#if this.selectedForecast}}
            <div class="card">
              <h3>Your Ship vs Average</h3>
              <div class="comparison-grid">
                <div class="comparison-card">
                  <div class="comparison-header">
                    <span class="comparison-name">{{this.selectedShip.name}}</span>
                    <span class="comparison-similarity">Your Ship</span>
                  </div>
                  <div class="comparison-stats">
                    <div>
                      <div class="comparison-stat-value">{{this.selectedShip.proofs.length}}</div>
                      <div class="comparison-stat-label">Proofs</div>
                    </div>
                    <div>
                      <div class="comparison-stat-value">{{this.selectedForecast.velocity}}</div>
                      <div class="comparison-stat-label">Per Week</div>
                    </div>
                    <div>
                      <div class="comparison-stat-value">{{this.selectedForecast.progress}}%</div>
                      <div class="comparison-stat-label">Complete</div>
                    </div>
                  </div>
                </div>
                <div class="comparison-card">
                  <div class="comparison-header">
                    <span class="comparison-name">Category Average</span>
                    <span class="comparison-similarity">Benchmark</span>
                  </div>
                  <div class="comparison-stats">
                    <div>
                      <div class="comparison-stat-value">20</div>
                      <div class="comparison-stat-label">Proofs</div>
                    </div>
                    <div>
                      <div class="comparison-stat-value">3.0</div>
                      <div class="comparison-stat-label">Per Week</div>
                    </div>
                    <div>
                      <div class="comparison-stat-value">45</div>
                      <div class="comparison-stat-label">Avg Days</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {{/if}}
        {{/if}}
      {{/if}}
    </div>
  </template>
}
