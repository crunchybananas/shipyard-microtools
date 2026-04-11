import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { tracked } from "@glimmer/tracking";
import { modifier } from "ember-modifier";

interface MapNode {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number;
  tint: string;
  description: string;
}

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 700;

const NODES: MapNode[] = [
  {
    id: "throne_room",
    name: "The Throne Room",
    icon: "👑",
    x: 500,
    y: 120,
    tint: "#c9a46a",
    description:
      "Where all paths converge. Requires every region restored to open.",
  },
  {
    id: "wizards_tower",
    name: "Wizard's Tower",
    icon: "🐱",
    x: 180,
    y: 260,
    tint: "#8c79b8",
    description: "A silent observatory where an old cat keeps watch.",
  },
  {
    id: "crystal_caverns",
    name: "Crystal Caverns",
    icon: "💎",
    x: 500,
    y: 260,
    tint: "#5f8bb0",
    description: "Shards of light sleep beneath the stone.",
  },
  {
    id: "rainbow_bridge",
    name: "Rainbow Bridge",
    icon: "🌈",
    x: 820,
    y: 260,
    tint: "#c57a9c",
    description: "Seven colors span the chasm — faded now to grey.",
  },
  {
    id: "starfall_lake",
    name: "Starfall Lake",
    icon: "🐟",
    x: 220,
    y: 410,
    tint: "#4f9e96",
    description: "Where fallen stars cool in dark water.",
  },
  {
    id: "whispering_woods",
    name: "Whispering Woods",
    icon: "🦉",
    x: 500,
    y: 410,
    tint: "#7ca680",
    description: "The trees remember names the wind has forgotten.",
  },
  {
    id: "the_meadow",
    name: "The Meadow",
    icon: "🦄",
    x: 780,
    y: 410,
    tint: "#c9a86a",
    description: "Wildflowers bow toward a hidden sanctuary.",
  },
  {
    id: "misty_shore",
    name: "Misty Shore",
    icon: "🐚",
    x: 500,
    y: 580,
    tint: "#6c96b0",
    description: "Where your journey began. The tide keeps secrets.",
  },
];

const NODE_INDEX: Record<string, MapNode> = Object.fromEntries(
  NODES.map((n) => [n.id, n]),
);

const CONNECTIONS: Array<[string, string]> = [
  ["misty_shore", "starfall_lake"],
  ["misty_shore", "whispering_woods"],
  ["misty_shore", "the_meadow"],
  ["starfall_lake", "wizards_tower"],
  ["whispering_woods", "crystal_caverns"],
  ["the_meadow", "rainbow_bridge"],
  ["wizards_tower", "throne_room"],
  ["crystal_caverns", "throne_room"],
  ["rainbow_bridge", "throne_room"],
];

// Deterministic paper grain
const PAPER_SPECKS: Array<{ x: number; y: number; r: number; a: number }> =
  (() => {
    let seed = 0x5eed;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const specks = [];
    for (let i = 0; i < 2400; i++) {
      specks.push({
        x: rand() * MAP_WIDTH,
        y: rand() * MAP_HEIGHT,
        r: 0.3 + rand() * 1.6,
        a: 0.02 + rand() * 0.08,
      });
    }
    return specks;
  })();

const ISLAND_OUTLINE: Array<[number, number]> = (() => {
  const pts: Array<[number, number]> = [];
  const cx = MAP_WIDTH / 2;
  const cy = MAP_HEIGHT * 0.54;
  const rx = MAP_WIDTH * 0.43;
  const ry = MAP_HEIGHT * 0.39;
  let seed = 0xbeef;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const steps = 120;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const wobble = 0.86 + rand() * 0.22 + Math.sin(t * 4) * 0.04;
    pts.push([cx + Math.cos(t) * rx * wobble, cy + Math.sin(t) * ry * wobble]);
  }
  return pts;
})();

interface MapViewSignature {
  Args: {
    currentSceneId: string;
    restoration: Record<string, number>;
    visited: Record<string, boolean>;
    onClose: () => void;
    onTravel: (sceneId: string) => void;
  };
}

export default class MapView extends Component<MapViewSignature> {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private startTime = 0;

  @tracked hoveredNodeId: string | null = null;
  @tracked tooltipX = 0;
  @tracked tooltipY = 0;
  @tracked tourActive = false;
  @tracked tourIndex = 0;
  @tracked kingdomName: string = this.loadKingdomName();
  private tourTimer: ReturnType<typeof setTimeout> | null = null;

  private loadKingdomName(): string {
    try {
      return localStorage.getItem("fadingKingdom_name") ?? "";
    } catch {
      return "";
    }
  }

  private readonly TOUR_ORDER = [
    "misty_shore",
    "whispering_woods",
    "crystal_caverns",
    "the_meadow",
    "rainbow_bridge",
    "starfall_lake",
    "wizards_tower",
    "throne_room",
  ];
  private readonly TOUR_STEP_MS = 3200;

  setupCanvas = modifier((element: HTMLCanvasElement) => {
    this.canvas = element;
    this.ctx = element.getContext("2d");
    this.startTime = performance.now();

    element.addEventListener("click", this.onCanvasClick);
    element.addEventListener("mousemove", this.onCanvasMouseMove);
    element.addEventListener("mouseleave", this.onCanvasMouseLeave);

    const loop = () => {
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      if (this.rafId !== null) cancelAnimationFrame(this.rafId);
      element.removeEventListener("click", this.onCanvasClick);
      element.removeEventListener("mousemove", this.onCanvasMouseMove);
      element.removeEventListener("mouseleave", this.onCanvasMouseLeave);
    };
  });

  private toCanvasCoords(cssX: number, cssY: number): [number, number] {
    if (!this.canvas) return [0, 0];
    const rect = this.canvas.getBoundingClientRect();
    return [(cssX * MAP_WIDTH) / rect.width, (cssY * MAP_HEIGHT) / rect.height];
  }

  private hitTestNode(px: number, py: number): MapNode | null {
    for (const node of NODES) {
      const dx = px - node.x;
      const dy = py - node.y;
      if (dx * dx + dy * dy <= 50 * 50) return node;
    }
    return null;
  }

  onCanvasClick = (e: MouseEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const [px, py] = this.toCanvasCoords(
      e.clientX - rect.left,
      e.clientY - rect.top,
    );
    const node = this.hitTestNode(px, py);
    if (!node) return;
    if (!this.args.visited[node.id]) return;
    this.args.onTravel(node.id);
  };

  onCanvasMouseMove = (e: MouseEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const [px, py] = this.toCanvasCoords(
      e.clientX - rect.left,
      e.clientY - rect.top,
    );
    const node = this.hitTestNode(px, py);
    if (node?.id !== this.hoveredNodeId) {
      this.hoveredNodeId = node?.id ?? null;
    }
    this.tooltipX = e.clientX - rect.left;
    this.tooltipY = e.clientY - rect.top;
    this.canvas.style.cursor =
      node && this.args.visited[node.id] ? "pointer" : "default";
  };

  onCanvasMouseLeave = () => {
    this.hoveredNodeId = null;
  };

  private restorationOf(id: string): number {
    return this.args.restoration[id] ?? 0;
  }

  private isVisited(id: string): boolean {
    return !!this.args.visited[id];
  }

  get hoveredNode(): MapNode | null {
    return this.hoveredNodeId ? NODE_INDEX[this.hoveredNodeId] ?? null : null;
  }

  get tooltipStyle(): string {
    const x = Math.min(this.tooltipX + 18, MAP_WIDTH - 240);
    const y = Math.max(this.tooltipY - 40, 20);
    return `left: ${x}px; top: ${y}px`;
  }

  private render() {
    const ctx = this.ctx;
    if (!ctx) return;
    const time = (performance.now() - this.startTime) / 1000;
    const intro = Math.min(1, time / 1.1);
    const ease = 1 - Math.pow(1 - intro, 3);

    // Parchment background
    const paper = ctx.createRadialGradient(
      MAP_WIDTH / 2,
      MAP_HEIGHT / 2,
      MAP_WIDTH * 0.1,
      MAP_WIDTH / 2,
      MAP_HEIGHT / 2,
      MAP_WIDTH * 0.75,
    );
    paper.addColorStop(0, "#f4e4c1");
    paper.addColorStop(0.6, "#e8d3a0");
    paper.addColorStop(1, "#c9a876");
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Vignette edges (burnt)
    const vignette = ctx.createRadialGradient(
      MAP_WIDTH / 2,
      MAP_HEIGHT / 2,
      MAP_WIDTH * 0.35,
      MAP_WIDTH / 2,
      MAP_HEIGHT / 2,
      MAP_WIDTH * 0.6,
    );
    vignette.addColorStop(0, "rgba(90, 50, 20, 0)");
    vignette.addColorStop(1, "rgba(70, 35, 10, 0.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Paper grain
    ctx.save();
    for (const s of PAPER_SPECKS) {
      ctx.fillStyle = `rgba(90, 60, 30, ${s.a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Ocean hatching around the island
    ctx.save();
    ctx.strokeStyle = "rgba(60, 40, 20, 0.28)";
    ctx.lineWidth = 1;
    for (let y = 20; y < MAP_HEIGHT - 20; y += 16) {
      for (let x = 20; x < MAP_WIDTH - 20; x += 24) {
        // Skip inside island approximation
        const dx = (x - MAP_WIDTH / 2) / (MAP_WIDTH * 0.46);
        const dy = (y - MAP_HEIGHT * 0.54) / (MAP_HEIGHT * 0.42);
        if (dx * dx + dy * dy < 1) continue;
        const len = 8 + Math.sin(x * 0.03 + y * 0.02 + time * 0.3) * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Island shape
    ctx.save();
    ctx.beginPath();
    ISLAND_OUTLINE.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    const land = ctx.createRadialGradient(
      MAP_WIDTH / 2,
      MAP_HEIGHT * 0.54,
      40,
      MAP_WIDTH / 2,
      MAP_HEIGHT * 0.54,
      MAP_WIDTH * 0.5,
    );
    land.addColorStop(0, "rgba(230, 205, 155, 0.85)");
    land.addColorStop(1, "rgba(180, 140, 85, 0.7)");
    ctx.fillStyle = land;
    ctx.fill();
    ctx.strokeStyle = "rgba(70, 40, 15, 0.78)";
    ctx.lineWidth = 3;
    ctx.stroke();
    // Inner shadow line for depth
    ctx.strokeStyle = "rgba(70, 40, 15, 0.22)";
    ctx.lineWidth = 1;
    ctx.save();
    ctx.clip();
    ISLAND_OUTLINE.forEach((_, i) => {
      if (i % 6 !== 0) return;
      const [x, y] = ISLAND_OUTLINE[i]!;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
    ctx.restore();

    // Connections — dotted ink trails with sealed wax when both endpoints restored
    ctx.save();
    ctx.lineCap = "round";
    for (const [a, b] of CONNECTIONS) {
      const na = NODE_INDEX[a]!;
      const nb = NODE_INDEX[b]!;
      const ra = this.restorationOf(a);
      const rb = this.restorationOf(b);
      const bothRestored = ra >= 1 && rb >= 1;
      const anyVisited = this.isVisited(a) && this.isVisited(b);

      if (bothRestored) {
        // Glowing ink
        ctx.strokeStyle = "rgba(170, 90, 30, 0.85)";
        ctx.lineWidth = 3.5;
        ctx.setLineDash([]);
        ctx.shadowColor = "rgba(255, 200, 120, 0.55)";
        ctx.shadowBlur = 10;
      } else if (anyVisited) {
        ctx.strokeStyle = "rgba(80, 45, 15, 0.62)";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 6]);
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = "rgba(80, 45, 15, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([1, 7]);
        ctx.shadowBlur = 0;
      }

      // Animate path draw with ease
      const pathLen = Math.hypot(nb.x - na.x, nb.y - na.y);
      const revealed = pathLen * ease;
      const angle = Math.atan2(nb.y - na.y, nb.x - na.x);
      const ex = na.x + Math.cos(angle) * revealed;
      const ey = na.y + Math.sin(angle) * revealed;
      ctx.beginPath();
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    ctx.restore();

    // Tour spotlight backdrop — darkens everything except tour node
    const tourId = this.tourNodeId;
    if (tourId) {
      const tourNode = NODE_INDEX[tourId];
      if (tourNode) {
        ctx.save();
        // Full-canvas dark overlay with a spotlight cut-out
        const spot = ctx.createRadialGradient(
          tourNode.x,
          tourNode.y,
          40,
          tourNode.x,
          tourNode.y,
          420,
        );
        spot.addColorStop(0, "rgba(20, 10, 0, 0)");
        spot.addColorStop(0.3, "rgba(20, 10, 0, 0.4)");
        spot.addColorStop(1, "rgba(20, 10, 0, 0.82)");
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
        ctx.restore();
      }
    }

    // Nodes — seal/stamp style
    for (const node of NODES) {
      const rest = this.restorationOf(node.id);
      const visited = this.isVisited(node.id);
      const isCurrent = node.id === this.args.currentSceneId;
      const isHovered = node.id === this.hoveredNodeId;
      const isTourNode = node.id === tourId;

      ctx.save();
      ctx.globalAlpha = ease * (tourId && !isTourNode ? 0.55 : 1);

      // Glow for restored
      if (rest >= 1) {
        const pulse = 0.7 + 0.3 * Math.sin(time * 2 + node.x * 0.01);
        const glow = ctx.createRadialGradient(
          node.x,
          node.y,
          18,
          node.x,
          node.y,
          58 + pulse * 6,
        );
        glow.addColorStop(0, `rgba(255, 180, 80, ${0.45 * pulse})`);
        glow.addColorStop(1, "rgba(255, 180, 80, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 68, 0, Math.PI * 2);
        ctx.fill();
      }

      // Current-scene pulse ring (ink red)
      if (isCurrent) {
        const pulse = (Math.sin(time * 2.5) + 1) / 2;
        ctx.strokeStyle = `rgba(140, 30, 20, ${0.6 + 0.35 * pulse})`;
        ctx.lineWidth = 2 + pulse * 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 46 + pulse * 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Stamp base
      const baseR = 38;
      ctx.beginPath();
      ctx.arc(node.x, node.y, baseR, 0, Math.PI * 2);
      if (!visited) {
        ctx.fillStyle = "rgba(120, 90, 55, 0.78)";
      } else if (rest >= 1) {
        const grad = ctx.createRadialGradient(
          node.x - 10,
          node.y - 10,
          4,
          node.x,
          node.y,
          baseR,
        );
        grad.addColorStop(0, "#fff2d5");
        grad.addColorStop(0.6, node.tint);
        grad.addColorStop(
          1,
          "rgba(70, 40, 15, 1)",
        );
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = "rgba(175, 140, 95, 0.85)";
      }
      ctx.fill();

      // Double ring border
      ctx.strokeStyle = isCurrent
        ? "#8b1a15"
        : visited
          ? "rgba(70, 40, 15, 0.9)"
          : "rgba(70, 40, 15, 0.55)";
      ctx.lineWidth = isCurrent ? 3 : 2.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(node.x, node.y, baseR - 5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(70, 40, 15, 0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Hover lift
      if (isHovered && visited) {
        ctx.strokeStyle = "rgba(255, 220, 120, 0.85)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, baseR + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Tour spotlight on current tour node
      if (isTourNode) {
        const tourPulse = (Math.sin(time * 3) + 1) / 2;
        ctx.strokeStyle = `rgba(255, 230, 140, ${0.75 + 0.25 * tourPulse})`;
        ctx.lineWidth = 3 + tourPulse * 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, baseR + 10 + tourPulse * 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 230, 140, ${0.4 * tourPulse})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, baseR + 22 + tourPulse * 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Icon
      ctx.font = "32px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (!visited) {
        ctx.globalAlpha = 0.4 * ease;
        ctx.fillStyle = "#2b1a08";
        ctx.fillText("?", node.x, node.y + 2);
      } else {
        if (rest < 1) ctx.globalAlpha = 0.7 * ease;
        ctx.fillText(node.icon, node.x, node.y + 2);
      }
      ctx.globalAlpha = ease;

      // Label banner
      const label = visited ? node.name : "Unknown Region";
      ctx.font = "600 14px 'Georgia', 'Times New Roman', serif";
      ctx.textAlign = "center";
      const bannerY = node.y + 58;
      const metrics = ctx.measureText(label);
      const bannerW = metrics.width + 20;
      const bannerH = 22;
      ctx.fillStyle = "rgba(250, 230, 190, 0.92)";
      ctx.strokeStyle = "rgba(70, 40, 15, 0.7)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(
        node.x - bannerW / 2,
        bannerY - bannerH / 2,
        bannerW,
        bannerH,
        3,
      );
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#3a2410";
      ctx.textBaseline = "middle";
      ctx.fillText(label, node.x, bannerY);

      ctx.restore();
    }

    // Title banner
    ctx.save();
    ctx.globalAlpha = ease;
    ctx.font = "700 34px 'Georgia', 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#3a2410";
    ctx.shadowColor = "rgba(90, 50, 20, 0.35)";
    ctx.shadowBlur = 3;
    const name = this.kingdomName.trim();
    const title = name ? `The ${name}` : "Map of the Fading Kingdom";
    ctx.fillText(title, MAP_WIDTH / 2, 55);
    ctx.font = "italic 15px 'Georgia', serif";
    ctx.fillStyle = "#5a3818";
    const restoredCount = NODES.filter((n) => this.restorationOf(n.id) >= 1)
      .length;
    const sub = name
      ? `a kingdom of ${NODES.length} regions · ${restoredCount} restored`
      : `${restoredCount} of ${NODES.length} regions restored`;
    ctx.fillText(sub, MAP_WIDTH / 2, 80);
    // Stamp in the bottom-right corner
    if (name) {
      ctx.save();
      ctx.translate(MAP_WIDTH - 100, MAP_HEIGHT - 60);
      ctx.rotate(-0.08);
      ctx.strokeStyle = "rgba(139, 26, 21, 0.65)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-70, -22, 140, 44);
      ctx.strokeRect(-66, -18, 132, 36);
      ctx.fillStyle = "rgba(139, 26, 21, 0.78)";
      ctx.font = "italic 10px 'Georgia', serif";
      ctx.textAlign = "center";
      ctx.fillText("CHRONICLED BY", 0, -4);
      ctx.font = "bold 12px 'Georgia', serif";
      const displayed = name.length > 18 ? name.slice(0, 17) + "…" : name;
      ctx.fillText(displayed.toUpperCase(), 0, 12);
      ctx.restore();
    }
    ctx.restore();

    // Compass rose (bottom-left)
    this.drawCompassRose(ctx, 90, 615, 44, ease);

    // Corner flourishes
    this.drawCornerFlourish(ctx, 40, 40, 1, ease);
    this.drawCornerFlourish(ctx, MAP_WIDTH - 40, 40, -1, ease);
    this.drawCornerFlourish(ctx, 40, MAP_HEIGHT - 40, 1, ease);
    this.drawCornerFlourish(ctx, MAP_WIDTH - 40, MAP_HEIGHT - 40, -1, ease);
  }

  private drawCompassRose(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    alpha: number,
  ) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.strokeStyle = "rgba(70, 40, 15, 0.75)";
    ctx.fillStyle = "rgba(250, 230, 190, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
    ctx.stroke();

    // Cardinal points (star-diamond)
    ctx.fillStyle = "#5a3818";
    ctx.strokeStyle = "rgba(70, 40, 15, 0.9)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(4, -r * 0.5);
      ctx.lineTo(0, -r);
      ctx.lineTo(-4, -r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // Diagonals thinner
    ctx.strokeStyle = "rgba(70, 40, 15, 0.5)";
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle - Math.PI / 2) * r * 0.7, Math.sin(angle - Math.PI / 2) * r * 0.7);
      ctx.stroke();
    }
    // N label
    ctx.fillStyle = "#3a2410";
    ctx.font = "bold 13px 'Georgia', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", 0, -r - 8);
    ctx.restore();
  }

  private drawCornerFlourish(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    flipX: number,
    alpha: number,
  ) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.translate(x, y);
    ctx.scale(flipX, 1);
    ctx.strokeStyle = "rgba(70, 40, 15, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.quadraticCurveTo(0, -6, 10, 4);
    ctx.quadraticCurveTo(14, 10, 22, 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-2, 2, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(70, 40, 15, 0.7)";
    ctx.fill();
    ctx.restore();
  }

  saveAsPostcard = () => {
    if (!this.canvas) return;
    this.canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `fading-kingdom-${stamp}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  close = () => {
    this.stopTour();
    this.args.onClose();
  };

  onKingdomNameInput = (e: Event) => {
    const next = (e.target as HTMLInputElement).value.slice(0, 28);
    this.kingdomName = next;
    try {
      if (next) {
        localStorage.setItem("fadingKingdom_name", next);
      } else {
        localStorage.removeItem("fadingKingdom_name");
      }
    } catch {
      // localStorage may fail in private mode
    }
  };

  startTour = () => {
    this.tourActive = true;
    this.tourIndex = 0;
    this.scheduleNextTourStep();
  };

  stopTour = () => {
    this.tourActive = false;
    if (this.tourTimer) {
      clearTimeout(this.tourTimer);
      this.tourTimer = null;
    }
  };

  private scheduleNextTourStep() {
    if (this.tourTimer) clearTimeout(this.tourTimer);
    this.tourTimer = setTimeout(() => {
      if (!this.tourActive) return;
      if (this.tourIndex + 1 >= this.TOUR_ORDER.length) {
        this.stopTour();
        return;
      }
      this.tourIndex++;
      this.scheduleNextTourStep();
    }, this.TOUR_STEP_MS);
  }

  get tourNodeId(): string | null {
    if (!this.tourActive) return null;
    return this.TOUR_ORDER[this.tourIndex] ?? null;
  }

  get tourNode(): MapNode | null {
    const id = this.tourNodeId;
    return id ? NODE_INDEX[id] ?? null : null;
  }

  get tourStepLabel(): string {
    return `Step ${this.tourIndex + 1} of ${this.TOUR_ORDER.length}`;
  }

  get tourBtnLabel(): string {
    return this.tourActive ? "⏹ Stop Tour" : "🎬 Start Tour";
  }

  get tourBtnAction() {
    return this.tourActive ? this.stopTour : this.startTour;
  }

  <template>
    <div class="map-overlay">
      <div class="map-container">
        <div class="map-canvas-wrap">
          <canvas
            class="map-canvas"
            width="1000"
            height="700"
            {{this.setupCanvas}}
          ></canvas>
          {{#if this.hoveredNode}}
            <div class="map-tooltip" style={{this.tooltipStyle}}>
              <div class="map-tooltip-title">{{this.hoveredNode.name}}</div>
              <div class="map-tooltip-desc">{{this.hoveredNode.description}}</div>
            </div>
          {{/if}}
          {{#if this.tourNode}}
            <div class="map-tour-banner">
              <div class="map-tour-step">{{this.tourStepLabel}}</div>
              <div class="map-tour-title">{{this.tourNode.name}}</div>
              <div class="map-tour-desc">{{this.tourNode.description}}</div>
            </div>
          {{/if}}
        </div>
        <div class="map-name-row">
          <label class="map-name-label">Name your kingdom</label>
          <input
            type="text"
            class="map-name-input"
            maxlength="28"
            placeholder="e.g. Fading Kingdom of Ilvar"
            value={{this.kingdomName}}
            {{on "input" this.onKingdomNameInput}}
          />
        </div>
        <div class="map-hint">
          Click any visited region to travel there.
        </div>
        <div class="map-actions">
          <button
            type="button"
            class="map-btn"
            {{on "click" this.tourBtnAction}}
          >{{this.tourBtnLabel}}</button>
          <button
            type="button"
            class="map-btn"
            {{on "click" this.saveAsPostcard}}
          >📸 Save Postcard</button>
          <button
            type="button"
            class="map-btn map-btn-close"
            {{on "click" this.close}}
          >Close Map</button>
        </div>
      </div>
    </div>
  </template>
}
