import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

export interface Proof {
  id: string;
  shipId: string;
  type: "github" | "url" | "screenshot" | "demo";
  title: string;
  timestamp: Date;
}

export interface Ship {
  id: string;
  name: string;
  description: string;
  category: string;
  startDate: Date;
  targetDate: Date | null;
  estimatedProofs: number;
  proofs: Proof[];
}

export interface WeeklyVelocity {
  week: string;
  weekStart: Date;
  count: number;
}

export interface ShipForecast {
  ship: Ship;
  status: "healthy" | "at-risk" | "stalled";
  velocity: number; // proofs per week
  predictedCompletion: Date | null;
  daysStalled: number;
  progress: number; // 0-100
  trend: "up" | "down" | "flat";
}

export interface SimilarShip {
  name: string;
  category: string;
  proofsToComplete: number;
  daysToComplete: number;
  velocity: number;
  similarity: number; // 0-100
}

export default class ForecastService extends Service {
  @tracked ships: Ship[] = [];

  constructor(owner: unknown) {
    super(owner);
    this.loadSampleData();
  }

  loadSampleData(): void {
    const now = new Date();

    this.ships = [
      {
        id: "1",
        name: "Chronicle",
        description: "Interactive ship story generator",
        category: "Developer Tools",
        startDate: new Date("2026-01-01"),
        targetDate: new Date("2026-03-01"),
        estimatedProofs: 20,
        proofs: this.generateProofs("1", 15, new Date("2026-01-01"), now),
      },
      {
        id: "2",
        name: "Cosmos Explorer",
        description: "3D universe visualization tool",
        category: "Visualization",
        startDate: new Date("2026-01-10"),
        targetDate: new Date("2026-04-15"),
        estimatedProofs: 30,
        proofs: this.generateProofs("2", 12, new Date("2026-01-10"), now),
      },
      {
        id: "3",
        name: "SynthStudio",
        description: "Browser-based music synthesizer",
        category: "Creative",
        startDate: new Date("2025-12-15"),
        targetDate: null,
        estimatedProofs: 25,
        proofs: this.generateProofs("3", 8, new Date("2025-12-15"), new Date("2026-01-15")),
      },
      {
        id: "4",
        name: "FlowForge",
        description: "Visual workflow automation builder",
        category: "Developer Tools",
        startDate: new Date("2026-01-20"),
        targetDate: new Date("2026-05-01"),
        estimatedProofs: 35,
        proofs: this.generateProofs("4", 6, new Date("2026-01-20"), now),
      },
      {
        id: "5",
        name: "The Island",
        description: "Multiplayer survival game prototype",
        category: "Games",
        startDate: new Date("2026-01-05"),
        targetDate: new Date("2026-06-01"),
        estimatedProofs: 40,
        proofs: this.generateProofs("5", 18, new Date("2026-01-05"), now),
      },
    ];
  }

  private generateProofs(shipId: string, count: number, startDate: Date, endDate: Date): Proof[] {
    const proofs: Proof[] = [];
    const types: Proof["type"][] = ["github", "url", "screenshot", "demo"];
    const timeSpan = endDate.getTime() - startDate.getTime();

    for (let i = 0; i < count; i++) {
      const randomOffset = Math.random() * timeSpan;
      const timestamp = new Date(startDate.getTime() + randomOffset);

      proofs.push({
        id: `${shipId}-${i}`,
        shipId,
        type: types[Math.floor(Math.random() * types.length)]!,
        title: `Proof ${i + 1}`,
        timestamp,
      });
    }

    return proofs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  get forecasts(): ShipForecast[] {
    return this.ships.map((ship) => this.calculateForecast(ship));
  }

  get healthyCount(): number {
    return this.forecasts.filter((f) => f.status === "healthy").length;
  }

  get atRiskCount(): number {
    return this.forecasts.filter((f) => f.status === "at-risk").length;
  }

  get stalledCount(): number {
    return this.forecasts.filter((f) => f.status === "stalled").length;
  }

  get stalledShips(): ShipForecast[] {
    return this.forecasts.filter((f) => f.status === "stalled");
  }

  get averageVelocity(): number {
    const velocities = this.forecasts.map((f) => f.velocity);
    if (velocities.length === 0) return 0;
    return velocities.reduce((a, b) => a + b, 0) / velocities.length;
  }

  get weeklyVelocityData(): WeeklyVelocity[] {
    const weeks: Map<string, WeeklyVelocity> = new Map();
    const now = new Date();

    // Generate last 8 weeks
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      // Adjust to start of week (Sunday)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());

      const weekKey = this.formatWeekKey(weekStart);
      weeks.set(weekKey, { week: weekKey, weekStart, count: 0 });
    }

    // Count proofs per week
    for (const ship of this.ships) {
      for (const proof of ship.proofs) {
        const proofWeekStart = new Date(proof.timestamp);
        proofWeekStart.setHours(0, 0, 0, 0);
        proofWeekStart.setDate(proofWeekStart.getDate() - proofWeekStart.getDay());

        const weekKey = this.formatWeekKey(proofWeekStart);
        const weekData = weeks.get(weekKey);
        if (weekData) {
          weekData.count++;
        }
      }
    }

    return Array.from(weeks.values());
  }

  private formatWeekKey(date: Date): string {
    const month = date.toLocaleString("default", { month: "short" });
    const day = date.getDate();
    return `${month} ${day}`;
  }

  calculateForecast(ship: Ship): ShipForecast {
    const now = new Date();
    const proofCount = ship.proofs.length;
    const lastProof = ship.proofs[proofCount - 1];

    // Calculate days since last proof
    const daysStalled = lastProof ? Math.floor((now.getTime() - lastProof.timestamp.getTime()) / (1000 * 60 * 60 * 24)) : 999;

    // Calculate velocity (proofs per week over last 4 weeks)
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const recentProofs = ship.proofs.filter((p) => p.timestamp >= fourWeeksAgo);
    const velocity = recentProofs.length / 4;

    // Calculate previous velocity for trend
    const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
    const previousProofs = ship.proofs.filter((p) => p.timestamp >= eightWeeksAgo && p.timestamp < fourWeeksAgo);
    const previousVelocity = previousProofs.length / 4;

    // Determine trend
    let trend: "up" | "down" | "flat" = "flat";
    if (velocity > previousVelocity * 1.2) trend = "up";
    else if (velocity < previousVelocity * 0.8) trend = "down";

    // Determine status
    let status: "healthy" | "at-risk" | "stalled" = "healthy";
    if (daysStalled >= 14) {
      status = "stalled";
    } else if (daysStalled >= 7 || velocity < 0.5) {
      status = "at-risk";
    }

    // Calculate progress
    const progress = Math.min(100, Math.round((proofCount / ship.estimatedProofs) * 100));

    // Predict completion date
    let predictedCompletion: Date | null = null;
    if (velocity > 0) {
      const remainingProofs = Math.max(0, ship.estimatedProofs - proofCount);
      const weeksToComplete = remainingProofs / velocity;
      predictedCompletion = new Date(now.getTime() + weeksToComplete * 7 * 24 * 60 * 60 * 1000);
    }

    return {
      ship,
      status,
      velocity: Math.round(velocity * 10) / 10,
      predictedCompletion,
      daysStalled,
      progress,
      trend,
    };
  }

  getSimilarShips(ship: Ship): SimilarShip[] {
    // Sample similar ships data
    const similarShipsData: SimilarShip[] = [
      {
        name: "Proof Insights",
        category: "Developer Tools",
        proofsToComplete: 18,
        daysToComplete: 42,
        velocity: 3.0,
        similarity: 92,
      },
      {
        name: "Harbor Master",
        category: "Developer Tools",
        proofsToComplete: 24,
        daysToComplete: 56,
        velocity: 3.0,
        similarity: 87,
      },
      {
        name: "Token Lens",
        category: "Developer Tools",
        proofsToComplete: 15,
        daysToComplete: 35,
        velocity: 3.0,
        similarity: 78,
      },
      {
        name: "Ship Diagnostics",
        category: "Developer Tools",
        proofsToComplete: 22,
        daysToComplete: 48,
        velocity: 3.2,
        similarity: 85,
      },
    ];

    // Filter by similar category and sort by similarity
    return similarShipsData
      .filter((s) => s.category === ship.category)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 4);
  }

  getBurndownData(ship: Ship): { actual: { x: number; y: number }[]; projected: { x: number; y: number }[] } {
    const forecast = this.calculateForecast(ship);
    const totalProofs = ship.estimatedProofs;
    const startDate = ship.startDate;
    const now = new Date();

    // Actual burndown
    const actual: { x: number; y: number }[] = [];
    let remaining = totalProofs;

    // Start point
    actual.push({ x: 0, y: totalProofs });

    // Add points for each proof
    const sortedProofs = [...ship.proofs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    for (const proof of sortedProofs) {
      const daysSinceStart = Math.floor((proof.timestamp.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      remaining--;
      actual.push({ x: daysSinceStart, y: remaining });
    }

    // Current point
    const currentDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    actual.push({ x: currentDays, y: remaining });

    // Projected burndown
    const projected: { x: number; y: number }[] = [];
    projected.push({ x: currentDays, y: remaining });

    if (forecast.velocity > 0 && forecast.predictedCompletion) {
      const completionDays = Math.floor((forecast.predictedCompletion.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      projected.push({ x: completionDays, y: 0 });
    }

    return { actual, projected };
  }

  addShip(name: string, description: string, category: string, estimatedProofs: number, targetDate: Date | null): void {
    const newShip: Ship = {
      id: String(Date.now()),
      name,
      description,
      category,
      startDate: new Date(),
      targetDate,
      estimatedProofs,
      proofs: [],
    };
    this.ships = [...this.ships, newShip];
  }

  addProofToShip(shipId: string, type: Proof["type"], title: string): void {
    const ship = this.ships.find((s) => s.id === shipId);
    if (ship) {
      const newProof: Proof = {
        id: String(Date.now()),
        shipId,
        type,
        title,
        timestamp: new Date(),
      };
      ship.proofs = [...ship.proofs, newProof];
      this.ships = [...this.ships]; // Trigger reactivity
    }
  }
}
