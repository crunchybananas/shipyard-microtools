import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

export interface Ship {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "verified" | "rejected";
  author_name?: string;
  agent_name?: string;
  author_karma?: number;
  attestations?: number;
  created_at?: string;
}

export interface TokenInfo {
  total_supply?: number;
  totalSupply?: number;
}

export interface Agent {
  name: string;
  karma: number;
  ships: number;
  verified: number;
}

export interface Activity {
  icon: string;
  text: string;
  author: string;
  shipTitle: string;
  time: string;
  sortTime: Date;
  isVerified: boolean;
}

declare global {
  interface Window {
    __DOCKHAND_NATIVE__?: boolean;
  }
}

const API_BASE = "https://shipyard.bot/api";
const LOCAL_PROXY = "http://localhost:8010/proxy/api";

// Mock data for demo/fallback
const MOCK_SHIPS: Ship[] = [
  {
    id: "1",
    title: "AI Code Assistant",
    status: "verified",
    author_name: "Alice Chen",
    author_karma: 1250,
    attestations: 3,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    title: "Smart Contract Auditor",
    status: "verified",
    author_name: "Bob Smith",
    author_karma: 980,
    attestations: 3,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "3",
    title: "Documentation Generator",
    status: "pending",
    author_name: "Carol Davis",
    author_karma: 720,
    attestations: 1,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "4",
    title: "Test Suite Builder",
    status: "verified",
    author_name: "David Lee",
    author_karma: 1100,
    attestations: 3,
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "5",
    title: "API Gateway Manager",
    status: "pending",
    author_name: "Eve Wilson",
    author_karma: 650,
    attestations: 2,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "6",
    title: "Database Migration Tool",
    status: "verified",
    author_name: "Frank Brown",
    author_karma: 890,
    attestations: 3,
    created_at: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "7",
    title: "Performance Profiler",
    status: "pending",
    author_name: "Grace Kim",
    author_karma: 540,
    attestations: 0,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "8",
    title: "Security Scanner",
    status: "verified",
    author_name: "Henry Zhang",
    author_karma: 1450,
    attestations: 3,
    created_at: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "9",
    title: "CI/CD Pipeline Builder",
    status: "verified",
    author_name: "Alice Chen",
    author_karma: 1250,
    attestations: 3,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "10",
    title: "Log Aggregator",
    status: "pending",
    author_name: "Ivan Petrov",
    author_karma: 320,
    attestations: 1,
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const MOCK_TOKEN_INFO: TokenInfo = {
  total_supply: 10000000,
};

export default class ShipyardApiService extends Service {
  @tracked ships: Ship[] = [];
  @tracked tokenInfo: TokenInfo | null = null;
  @tracked isLoading = false;
  @tracked corsError = false;

  get apiBase(): string {
    if (window.__DOCKHAND_NATIVE__) {
      return API_BASE;
    }

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.protocol === "file:";
    return isLocalhost ? LOCAL_PROXY : API_BASE;
  }

  get isGitHubPages(): boolean {
    if (window.__DOCKHAND_NATIVE__) return false;
    return window.location.hostname.includes("github.io");
  }

  get totalShips(): number {
    return this.ships.length;
  }

  get verifiedShips(): number {
    return this.ships.filter((s) => s.status === "verified").length;
  }

  get pendingShips(): number {
    return this.ships.filter((s) => s.status === "pending").length;
  }

  get verificationRate(): string {
    const total = this.ships.length;
    const verified = this.verifiedShips;
    const rate = total > 0 ? (verified / total) * 100 : 0;
    return `${rate.toFixed(1)}%`;
  }

  get tokenSupply(): number {
    return this.tokenInfo?.total_supply ?? this.tokenInfo?.totalSupply ?? 0;
  }

  get shipsWithAttestations(): number {
    return this.ships.filter((s) => (s.attestations ?? 0) > 0).length;
  }

  get attestedPercent(): number {
    const total = this.ships.length;
    return total > 0 ? (this.shipsWithAttestations / total) * 100 : 0;
  }

  get verifiedPercent(): number {
    const total = this.ships.length;
    return total > 0 ? (this.verifiedShips / total) * 100 : 0;
  }

  async fetchShips(): Promise<Ship[]> {
    try {
      const response = await fetch(`${this.apiBase}/ships?limit=100`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = (await response.json()) as { ships?: Ship[] };
      this.corsError = false;
      return data.ships ?? [];
    } catch (error) {
      console.error("Failed to fetch ships:", error);
      if (this.isGitHubPages) {
        this.corsError = true;
      }
      return [];
    }
  }

  async fetchTokenInfo(): Promise<TokenInfo | null> {
    try {
      const response = await fetch(`${this.apiBase}/token/info`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      return (await response.json()) as TokenInfo;
    } catch (error) {
      console.error("Failed to fetch token info:", error);
      return null;
    }
  }

  async loadData(): Promise<void> {
    this.isLoading = true;

    try {
      const [ships, tokenInfo] = await Promise.all([
        this.fetchShips(),
        this.fetchTokenInfo(),
      ]);

      // Use mock data if API returns empty (for demo purposes)
      this.ships = ships.length > 0 ? ships : MOCK_SHIPS;
      this.tokenInfo = tokenInfo ?? MOCK_TOKEN_INFO;
    } finally {
      this.isLoading = false;
    }
  }

  buildLeaderboard(): Agent[] {
    const agentMap = new Map<string, Agent>();

    for (const ship of this.ships) {
      const name = ship.author_name ?? ship.agent_name ?? "Unknown";
      const karma = ship.author_karma ?? 0;

      if (!agentMap.has(name)) {
        agentMap.set(name, { name, karma, ships: 0, verified: 0 });
      }

      const agent = agentMap.get(name)!;
      agent.ships++;
      if (ship.status === "verified") agent.verified++;
      agent.karma = Math.max(agent.karma, karma);
    }

    return Array.from(agentMap.values());
  }

  getRecentActivity(): Activity[] {
    const activities: Activity[] = [];

    const recentShips = [...this.ships]
      .sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime(),
      )
      .slice(0, 15);

    for (const ship of recentShips) {
      const author = ship.author_name ?? ship.agent_name ?? "Unknown";
      const isVerified = ship.status === "verified";

      activities.push({
        icon: isVerified ? "✅" : "🚀",
        text: isVerified
          ? `got "${ship.title}" verified`
          : `submitted "${ship.title}"`,
        author,
        shipTitle: ship.title,
        time: ship.created_at ?? "",
        sortTime: new Date(ship.created_at ?? 0),
        isVerified,
      });
    }

    activities.sort((a, b) => b.sortTime.getTime() - a.sortTime.getTime());
    return activities.slice(0, 10);
  }

  getFilteredShips(filter: string): Ship[] {
    let ships = [...this.ships];

    if (filter === "verified") {
      ships = ships.filter((s) => s.status === "verified");
    } else if (filter === "pending") {
      ships = ships.filter((s) => s.status === "pending");
    }

    ships.sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime(),
    );
    return ships.slice(0, 10);
  }
}
