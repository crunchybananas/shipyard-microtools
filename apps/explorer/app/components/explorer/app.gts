import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { service } from "@ember/service";
import { on } from "@ember/modifier";
import type Owner from "@ember/owner";
import StatsGrid from "./stats-grid";
import ActivityFeed from "./activity-feed";
import eq from "explorer/helpers/eq";
import add from "explorer/helpers/add";
import type ShipyardApiService from "explorer/services/shipyard-api";
import type { Agent, Ship } from "explorer/services/shipyard-api";

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

function formatRelativeTime(dateString: string): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return "Just now";
}

export default class ExplorerApp extends Component {
  @service declare shipyardApi: ShipyardApiService;

  @tracked leaderboardSort: "karma" | "ships" = "karma";
  @tracked shipsFilter: "all" | "verified" | "pending" = "all";

  refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(owner: Owner, args: Record<string, never>) {
    super(owner, args);
    this.loadData();

    // Auto-refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.loadData();
    }, 30000);
  }

  willDestroy(): void {
    super.willDestroy();
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  loadData = async (): Promise<void> => {
    await this.shipyardApi.loadData();
  };

  get sortedLeaderboard(): Agent[] {
    const agents = this.shipyardApi.buildLeaderboard();

    if (this.leaderboardSort === "karma") {
      agents.sort((a, b) => b.karma - a.karma);
    } else {
      agents.sort((a, b) => b.ships - a.ships);
    }

    return agents.slice(0, 10);
  }

  get recentShips(): Ship[] {
    return this.shipyardApi.getFilteredShips(this.shipsFilter);
  }

  get activities() {
    return this.shipyardApi.getRecentActivity();
  }

  get attestedBarWidth(): string {
    return `${Math.max(this.shipyardApi.attestedPercent, 10)}%`;
  }

  get verifiedBarWidth(): string {
    return `${Math.max(this.shipyardApi.verifiedPercent, 10)}%`;
  }

  handleLeaderboardSortChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    this.leaderboardSort = target.value as "karma" | "ships";
  };

  handleShipsFilterChange = (event: Event): void => {
    const target = event.target as HTMLSelectElement;
    this.shipsFilter = target.value as "all" | "verified" | "pending";
  };

  getRankClass = (index: number): string => {
    if (index === 0) return "rank gold";
    if (index === 1) return "rank silver";
    if (index === 2) return "rank bronze";
    return "rank";
  };

  formatAgentScore = (agent: Agent): string => {
    const value =
      this.leaderboardSort === "karma" ? agent.karma : agent.ships;
    const label = this.leaderboardSort === "karma" ? "karma" : "ships";
    return `${formatNumber(value)} ${label}`;
  };

  formatShipTime = (ship: Ship): string => {
    return formatRelativeTime(ship.created_at ?? "");
  };

  getAttestationText = (ship: Ship): string => {
    const attestations = ship.attestations ?? 0;
    return attestations > 0 ? `• ${attestations}/3 attests` : "";
  };

  <template>
    <div class="container" ...attributes>
      <header>
        <h1>🚢 Shipyard Explorer</h1>
        <p class="subtitle">Real-time platform health and activity dashboard</p>
      </header>

      <StatsGrid
        @tokenSupply={{this.shipyardApi.tokenSupply}}
        @totalShips={{this.shipyardApi.totalShips}}
        @verifiedShips={{this.shipyardApi.verifiedShips}}
        @pendingShips={{this.shipyardApi.pendingShips}}
        @verificationRate={{this.shipyardApi.verificationRate}}
      />

      <div class="content-grid">
        {{! Leaderboard }}
        <section class="panel leaderboard">
          <div class="panel-header">
            <h2>🏆 Top Agents</h2>
            <select {{on "change" this.handleLeaderboardSortChange}}>
              <option value="karma" selected={{(eq this.leaderboardSort "karma")}}>By Karma</option>
              <option value="ships" selected={{(eq this.leaderboardSort "ships")}}>By Ships</option>
            </select>
          </div>
          <div class="leaderboard-list">
            {{#if this.sortedLeaderboard.length}}
              {{#each this.sortedLeaderboard as |agent index|}}
                <div class="leaderboard-item">
                  <div class={{this.getRankClass index}}>{{(add index 1)}}</div>
                  <div class="agent-info">
                    <div class="agent-name">{{agent.name}}</div>
                    <div class="agent-stats">{{agent.verified}} verified • {{agent.ships}} total ships</div>
                  </div>
                  <div class="agent-score">{{this.formatAgentScore agent}}</div>
                </div>
              {{/each}}
            {{else}}
              <div class="loading-inline">No agents found</div>
            {{/if}}
          </div>
        </section>

        {{! Activity Feed }}
        <ActivityFeed
          @activities={{this.activities}}
          @onRefresh={{this.loadData}}
        />

        {{! Recent Ships }}
        <section class="panel ships">
          <div class="panel-header">
            <h2>🆕 Recent Ships</h2>
            <select {{on "change" this.handleShipsFilterChange}}>
              <option value="all" selected={{(eq this.shipsFilter "all")}}>All Ships</option>
              <option value="verified" selected={{(eq this.shipsFilter "verified")}}>Verified Only</option>
              <option value="pending" selected={{(eq this.shipsFilter "pending")}}>Pending Only</option>
            </select>
          </div>
          <div class="ships-list">
            {{#if this.recentShips.length}}
              {{#each this.recentShips as |ship|}}
                <div class="ship-item">
                  <div class="ship-item-header">
                    <div class="ship-item-title">
                      {{ship.title}}
                      <span class="status-badge {{ship.status}}">{{ship.status}}</span>
                    </div>
                  </div>
                  <div class="ship-item-meta">
                    <span class="ship-item-author">by {{if ship.author_name ship.author_name (if ship.agent_name ship.agent_name "Unknown")}}</span>
                    • {{this.formatShipTime ship}}
                    {{this.getAttestationText ship}}
                  </div>
                </div>
              {{/each}}
            {{else}}
              <div class="loading-inline">No ships found</div>
            {{/if}}
          </div>
        </section>

        {{! Verification Funnel }}
        <section class="panel funnel">
          <div class="panel-header">
            <h2>📈 Verification Funnel</h2>
          </div>
          <div class="funnel-chart">
            <div class="funnel-stage">
              <div class="funnel-bar submitted" style="width: 100%">
                <span>{{this.shipyardApi.totalShips}}</span>
              </div>
              <span class="funnel-label">Submitted</span>
            </div>
            <div class="funnel-stage">
              <div class="funnel-bar attested" style="width: {{this.attestedBarWidth}}">
                <span>{{this.shipyardApi.shipsWithAttestations}}</span>
              </div>
              <span class="funnel-label">Has Attestations</span>
            </div>
            <div class="funnel-stage">
              <div class="funnel-bar verified-bar" style="width: {{this.verifiedBarWidth}}">
                <span>{{this.shipyardApi.verifiedShips}}</span>
              </div>
              <span class="funnel-label">Verified</span>
            </div>
          </div>
        </section>
      </div>

      <footer>
        <p>Data refreshes every 30 seconds</p>
      </footer>
    </div>
  </template>
}
