import Component from "@glimmer/component";

export interface StatsGridSignature {
  Element: HTMLElement;
  Args: {
    tokenSupply: number;
    totalShips: number;
    verifiedShips: number;
    pendingShips: number;
    verificationRate: string;
  };
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

export default class StatsGrid extends Component<StatsGridSignature> {
  get formattedTokenSupply(): string {
    return formatNumber(this.args.tokenSupply);
  }

  get formattedTotalShips(): string {
    return formatNumber(this.args.totalShips);
  }

  get formattedVerifiedShips(): string {
    return formatNumber(this.args.verifiedShips);
  }

  get formattedPendingShips(): string {
    return formatNumber(this.args.pendingShips);
  }

  <template>
    <section class="stats-grid" ...attributes>
      <div class="stat-card large">
        <div class="stat-icon">🪙</div>
        <div class="stat-content">
          <span class="stat-value">{{this.formattedTokenSupply}}</span>
          <span class="stat-label">Total Token Supply</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚓</div>
        <div class="stat-content">
          <span class="stat-value">{{this.formattedTotalShips}}</span>
          <span class="stat-label">Total Ships</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <span class="stat-value">{{this.formattedVerifiedShips}}</span>
          <span class="stat-label">Verified Ships</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⏳</div>
        <div class="stat-content">
          <span class="stat-value">{{this.formattedPendingShips}}</span>
          <span class="stat-label">Pending Review</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <span class="stat-value">{{@verificationRate}}</span>
          <span class="stat-label">Verification Rate</span>
        </div>
      </div>
    </section>
  </template>
}
