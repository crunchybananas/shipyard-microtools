import Component from "@glimmer/component";
import { service } from "@ember/service";
import { htmlSafe } from "@ember/template";
import type GameStateService from "the-island/services/game-state";

interface SceneRendererSignature {
  Args: {
    sceneId: string;
    onInteraction: (action: string, target: string) => void;
  };
  Element: HTMLDivElement;
}

export default class SceneRenderer extends Component<SceneRendererSignature> {
  @service declare gameState: GameStateService;

  get sceneSVG(): ReturnType<typeof htmlSafe> {
    const svg = this.generateSceneSVG(this.args.sceneId);
    return htmlSafe(svg);
  }

  generateSceneSVG(sceneId: string): string {
    switch (sceneId) {
      case "beach":
        return this.svgBeach();
      case "forest":
        return this.svgForest();
      case "clearing":
        return this.svgClearing();
      case "lighthouse_base":
        return this.svgLighthouseBase();
      case "lighthouse_top":
        return this.svgLighthouseTop();
      default:
        return this.svgBeach();
    }
  }

  generateStars(count: number): string {
    let stars = "";
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 1200;
      const y = Math.random() * 400;
      const r = Math.random() * 1.5 + 0.5;
      const opacity = Math.random() * 0.5 + 0.3;
      stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fffacd" opacity="${opacity}"/>`;
    }
    return stars;
  }

  generateTreeRow(
    yOffset: number,
    count: number,
    scale: number,
    baseY: number = 200,
  ): string {
    let trees = "";
    for (let i = 0; i < count; i++) {
      const x = (i / count) * 1200;
      const height = (100 + Math.random() * 100) * scale;
      const y = baseY + yOffset;
      trees += `<polygon points="${x},${y + height} ${x + 30 * scale},${y} ${x + 60 * scale},${y + height}" fill="#0d1a0d"/>`;
    }
    return trees;
  }

  svgBeach(): string {
    const hasKey = !this.gameState.inventory.includes("rusty_key");

    return `
    <svg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <!-- Sky gradient - twilight -->
        <linearGradient id="sky-beach" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e"/>
          <stop offset="40%" style="stop-color:#16213e"/>
          <stop offset="70%" style="stop-color:#1f3a5f"/>
          <stop offset="100%" style="stop-color:#3d5a80"/>
        </linearGradient>

        <!-- Ocean gradient -->
        <linearGradient id="ocean" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#1a3a5c"/>
          <stop offset="100%" style="stop-color:#0d2137"/>
        </linearGradient>

        <!-- Sand gradient -->
        <linearGradient id="sand" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#5c4a3d"/>
          <stop offset="100%" style="stop-color:#3d3229"/>
        </linearGradient>

        <!-- Moon glow -->
        <radialGradient id="moon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#fffacd;stop-opacity:0.4"/>
          <stop offset="100%" style="stop-color:#fffacd;stop-opacity:0"/>
        </radialGradient>

        <!-- Wave animation -->
        <filter id="wave-blur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1"/>
        </filter>
      </defs>

      <!-- Sky -->
      <rect fill="url(#sky-beach)" width="1200" height="800"/>

      <!-- Stars -->
      <g class="stars">
        ${this.generateStars(50)}
      </g>

      <!-- Moon -->
      <circle cx="950" cy="120" r="60" fill="url(#moon-glow)"/>
      <circle cx="950" cy="120" r="35" fill="#fffacd"/>
      <circle cx="940" cy="110" r="8" fill="#f0e68c" opacity="0.5"/>
      <circle cx="960" cy="130" r="5" fill="#f0e68c" opacity="0.3"/>

      <!-- Distant lighthouse silhouette -->
      <g class="lighthouse-distant" opacity="0.6">
        <rect x="150" y="180" width="25" height="120" fill="#1a1a2e"/>
        <polygon points="150,180 162,140 175,180" fill="#1a1a2e"/>
        <circle cx="162" cy="160" r="8" fill="#ffd700" opacity="0.6">
          <animate attributeName="opacity" values="0.6;0.9;0.6" dur="2s" repeatCount="indefinite"/>
        </circle>
      </g>

      <!-- Ocean -->
      <rect y="350" fill="url(#ocean)" width="1200" height="200"/>

      <!-- Waves -->
      <g class="waves">
        <path d="M0 400 Q150 380 300 400 T600 400 T900 400 T1200 400 L1200 550 L0 550 Z"
              fill="#1a3a5c" opacity="0.7">
          <animate attributeName="d"
            values="M0 400 Q150 380 300 400 T600 400 T900 400 T1200 400 L1200 550 L0 550 Z;
                    M0 400 Q150 420 300 400 T600 400 T900 400 T1200 400 L1200 550 L0 550 Z;
                    M0 400 Q150 380 300 400 T600 400 T900 400 T1200 400 L1200 550 L0 550 Z"
            dur="4s" repeatCount="indefinite"/>
        </path>
        <path d="M0 450 Q200 430 400 450 T800 450 T1200 450 L1200 550 L0 550 Z"
              fill="#234b6e" opacity="0.5">
          <animate attributeName="d"
            values="M0 450 Q200 430 400 450 T800 450 T1200 450 L1200 550 L0 550 Z;
                    M0 450 Q200 470 400 450 T800 450 T1200 450 L1200 550 L0 550 Z;
                    M0 450 Q200 430 400 450 T800 450 T1200 450 L1200 550 L0 550 Z"
            dur="3s" repeatCount="indefinite"/>
        </path>
      </g>

      <!-- Beach/Sand -->
      <path d="M0 520 Q300 500 600 530 Q900 560 1200 540 L1200 800 L0 800 Z" fill="url(#sand)"/>

      <!-- Rocks on beach -->
      <g class="rocks" data-action="examine" data-target="rocks">
        <ellipse cx="200" cy="620" rx="80" ry="40" fill="#4a4a4a"/>
        <ellipse cx="180" cy="610" rx="50" ry="25" fill="#5a5a5a"/>
        <ellipse cx="250" cy="630" rx="40" ry="20" fill="#3a3a3a"/>

        ${
          hasKey
            ? `
        <!-- Rusty key glint -->
        <g data-action="pickup" data-target="rusty_key" class="interactive-item">
          <!-- Larger hit area -->
          <rect x="200" y="605" width="40" height="40" fill="transparent" class="hit-area"/>
          <ellipse cx="220" cy="625" rx="12" ry="6" fill="#8b4513"/>
          <circle cx="220" cy="625" r="3" fill="#ffd700" opacity="0.8">
            <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite"/>
          </circle>
          <circle cx="220" cy="625" r="15" fill="none" stroke="#ffd700" stroke-width="2" opacity="0">
            <animate attributeName="opacity" values="0;0.5;0" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="r" values="15;25;15" dur="2s" repeatCount="indefinite"/>
          </circle>
        </g>
        `
            : ""
        }
      </g>

      <!-- More rocks -->
      <g class="rocks-right">
        <ellipse cx="900" cy="650" rx="100" ry="50" fill="#4a4a4a"/>
        <ellipse cx="950" cy="640" rx="60" ry="30" fill="#5a5a5a"/>
        <ellipse cx="850" cy="660" rx="45" ry="22" fill="#3a3a3a"/>
      </g>

      <!-- Driftwood -->
      <g class="driftwood">
        <path d="M500 680 Q550 670 620 685 Q600 690 500 685 Z" fill="#5c4033"/>
        <path d="M480 700 L530 695 L520 702 Z" fill="#4a3728"/>
      </g>

      <!-- Seaweed/kelp -->
      <g class="seaweed">
        <path d="M700 750 Q710 720 700 690 Q690 720 700 750" stroke="#2d4a3e" stroke-width="4" fill="none"/>
        <path d="M720 760 Q735 730 720 700 Q705 730 720 760" stroke="#3d5a4e" stroke-width="3" fill="none"/>
      </g>

      <!-- Foam line -->
      <path d="M0 530 Q100 525 200 535 Q400 520 600 540 Q800 525 1000 535 Q1100 530 1200 540"
            stroke="#a0c4d4" stroke-width="3" fill="none" opacity="0.4">
        <animate attributeName="d"
          values="M0 530 Q100 525 200 535 Q400 520 600 540 Q800 525 1000 535 Q1100 530 1200 540;
                  M0 535 Q100 530 200 525 Q400 535 600 530 Q800 540 1000 530 Q1100 535 1200 530;
                  M0 530 Q100 525 200 535 Q400 520 600 540 Q800 525 1000 535 Q1100 530 1200 540"
          dur="5s" repeatCount="indefinite"/>
      </path>

      <!-- Forest edge (north) -->
      <g class="forest-edge">
        <path d="M400 0 L400 350 Q500 380 600 350 L600 0 Z" fill="#0d1a0d" opacity="0.9"/>
        <polygon points="420,350 460,250 500,350" fill="#1a2f1a"/>
        <polygon points="480,360 530,240 580,360" fill="#162816"/>
        <polygon points="540,350 590,220 640,350" fill="#1a2f1a"/>

        <!-- Path leading north -->
        <path d="M490 550 Q500 450 510 380" stroke="#3d3229" stroke-width="40" fill="none" opacity="0.6"/>
      </g>

      <!-- Clickable waves area -->
      <rect x="0" y="350" width="1200" height="170" fill="transparent"
            data-action="examine" data-target="waves" class="hotspot"/>
    </svg>
    `;
  }

  svgForest(): string {
    const hasGear =
      !this.gameState.inventory.includes("gear1") &&
      !this.gameState.flags.foundGear1;

    return `
    <svg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <!-- Dark forest sky -->
        <linearGradient id="sky-forest" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0a12"/>
          <stop offset="100%" style="stop-color:#1a1a2e"/>
        </linearGradient>

        <!-- Light shaft -->
        <linearGradient id="light-shaft" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#fffacd;stop-opacity:0.15"/>
          <stop offset="100%" style="stop-color:#fffacd;stop-opacity:0"/>
        </linearGradient>

        <!-- Ground -->
        <linearGradient id="forest-ground" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#1a2f1a"/>
          <stop offset="100%" style="stop-color:#0d1a0d"/>
        </linearGradient>

        <!-- Fog filter -->
        <filter id="fog">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3"/>
        </filter>
      </defs>

      <!-- Background -->
      <rect fill="url(#sky-forest)" width="1200" height="800"/>

      <!-- Distant trees (background layer) -->
      <g class="trees-far" opacity="0.5">
        ${this.generateTreeRow(0, 15, 0.4)}
      </g>

      <!-- Mid-distance trees -->
      <g class="trees-mid" opacity="0.7">
        ${this.generateTreeRow(100, 10, 0.7)}
      </g>

      <!-- Light shafts -->
      <g class="light-shafts">
        <polygon points="300,0 350,0 500,600 400,600" fill="url(#light-shaft)"/>
        <polygon points="700,0 730,0 850,500 780,500" fill="url(#light-shaft)"/>
        <polygon points="550,0 570,0 650,400 600,400" fill="url(#light-shaft)" opacity="0.7"/>
      </g>

      <!-- Ground fog -->
      <ellipse cx="600" cy="750" rx="700" ry="100" fill="#1a2f1a" opacity="0.5" filter="url(#fog)"/>

      <!-- Ground -->
      <rect y="600" fill="url(#forest-ground)" width="1200" height="200"/>

      <!-- Path through forest -->
      <path d="M500 800 Q520 700 550 600 Q600 500 580 400 Q560 300 600 200 Q650 100 600 0"
            stroke="#2a2a1a" stroke-width="80" fill="none" opacity="0.6"/>
      <path d="M500 800 Q520 700 550 600 Q600 500 580 400 Q560 300 600 200 Q650 100 600 0"
            stroke="#3a3a2a" stroke-width="40" fill="none" opacity="0.4"/>

      <!-- Foreground trees (left) -->
      <g class="tree-left">
        <rect x="50" y="100" width="80" height="700" fill="#1a0f0a"/>
        <ellipse cx="90" cy="150" rx="150" ry="100" fill="#0d1a0d"/>
        <ellipse cx="90" cy="200" rx="180" ry="120" fill="#162816"/>
        <ellipse cx="90" cy="280" rx="160" ry="100" fill="#0d1a0d"/>

        <!-- Bark texture -->
        <path d="M60 200 Q70 300 65 400 Q75 500 60 600" stroke="#2a1f15" stroke-width="3" fill="none"/>
        <path d="M100 250 Q110 350 105 450 Q115 550 100 650" stroke="#2a1f15" stroke-width="2" fill="none"/>
      </g>

      <!-- Foreground trees (right) -->
      <g class="tree-right">
        <rect x="1050" y="50" width="100" height="750" fill="#1a0f0a"/>
        <ellipse cx="1100" cy="100" rx="180" ry="100" fill="#0d1a0d"/>
        <ellipse cx="1100" cy="180" rx="200" ry="130" fill="#162816"/>
        <ellipse cx="1100" cy="300" rx="170" ry="110" fill="#0d1a0d"/>
      </g>

      <!-- Twisted branch reaching across -->
      <path d="M130 300 Q300 280 450 350 Q500 380 480 400"
            stroke="#2a1f15" stroke-width="20" fill="none"/>
      <path d="M450 350 Q470 330 500 340" stroke="#2a1f15" stroke-width="8" fill="none"/>

      <!-- Mushrooms -->
      <g class="mushrooms">
        <ellipse cx="300" cy="680" rx="15" ry="8" fill="#8b4513"/>
        <ellipse cx="300" cy="675" rx="12" ry="6" fill="#daa520"/>
        <ellipse cx="320" cy="690" rx="10" ry="5" fill="#8b4513"/>
        <ellipse cx="320" cy="686" rx="8" ry="4" fill="#cd853f"/>
      </g>

      <!-- Fallen log with gear -->
      <g class="fallen-log" data-action="examine" data-target="trees">
        <path d="M700 650 Q800 640 900 660 Q920 670 900 680 Q800 700 700 680 Q680 670 700 650" fill="#3d2817"/>
        <ellipse cx="700" cy="665" rx="20" ry="15" fill="#2a1a0f"/>

        ${
          hasGear
            ? `
        <!-- Gear glinting in hollow -->
        <g data-action="pickup" data-target="gear1" class="interactive-item">
          <!-- Larger hit area -->
          <rect x="725" y="635" width="50" height="50" fill="transparent" class="hit-area"/>
          <circle cx="750" cy="660" r="12" fill="#8b7355"/>
          <circle cx="750" cy="660" r="8" fill="#a08060"/>
          <!-- Gear teeth -->
          <g fill="#8b7355">
            <rect x="746" y="645" width="8" height="6"/>
            <rect x="746" y="669" width="8" height="6"/>
            <rect x="735" y="656" width="6" height="8"/>
            <rect x="759" y="656" width="6" height="8"/>
          </g>
          <circle cx="750" cy="660" r="3" fill="#5c4a3d"/>
          <circle cx="750" cy="660" r="20" fill="none" stroke="#ffd700" stroke-width="2" opacity="0">
            <animate attributeName="opacity" values="0;0.4;0" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="r" values="20;30;20" dur="2s" repeatCount="indefinite"/>
          </circle>
        </g>
        `
            : ""
        }
      </g>

      <!-- Ferns -->
      <g class="ferns">
        <path d="M200 750 Q220 700 200 650" stroke="#2d4a2d" stroke-width="3" fill="none"/>
        <path d="M200 720 Q180 700 160 710" stroke="#2d4a2d" stroke-width="2" fill="none"/>
        <path d="M200 700 Q220 680 240 690" stroke="#2d4a2d" stroke-width="2" fill="none"/>
        <path d="M200 680 Q175 665 155 675" stroke="#2d4a2d" stroke-width="2" fill="none"/>

        <path d="M850 780 Q870 730 850 680" stroke="#3d5a3d" stroke-width="3" fill="none"/>
        <path d="M850 750 Q830 730 810 740" stroke="#3d5a3d" stroke-width="2" fill="none"/>
        <path d="M850 720 Q870 700 890 710" stroke="#3d5a3d" stroke-width="2" fill="none"/>
      </g>

      <!-- Floating particles/fireflies -->
      <g class="fireflies">
        <circle cx="400" cy="400" r="2" fill="#fffacd">
          <animate attributeName="cy" values="400;380;400" dur="3s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="650" cy="350" r="2" fill="#fffacd">
          <animate attributeName="cy" values="350;330;350" dur="4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="550" cy="500" r="1.5" fill="#fffacd">
          <animate attributeName="cy" values="500;480;500" dur="3.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.2;0.7;0.2" dur="3s" repeatCount="indefinite"/>
        </circle>
      </g>
    </svg>
    `;
  }

  svgClearing(): string {
    const hasJournal = !this.gameState.inventory.includes("journal_page1");

    return `
    <svg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <linearGradient id="sky-clearing" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e"/>
          <stop offset="60%" style="stop-color:#16213e"/>
          <stop offset="100%" style="stop-color:#1f3a5f"/>
        </linearGradient>

        <linearGradient id="grass" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#1a3a1a"/>
          <stop offset="100%" style="stop-color:#0d1a0d"/>
        </linearGradient>

        <radialGradient id="moonlight-clearing" cx="50%" cy="30%" r="60%">
          <stop offset="0%" style="stop-color:#fffacd;stop-opacity:0.1"/>
          <stop offset="100%" style="stop-color:#fffacd;stop-opacity:0"/>
        </radialGradient>
      </defs>

      <!-- Sky -->
      <rect fill="url(#sky-clearing)" width="1200" height="800"/>

      <!-- Stars -->
      <g class="stars">
        ${this.generateStars(60)}
      </g>

      <!-- Moonlight glow on clearing -->
      <ellipse cx="600" cy="450" rx="400" ry="250" fill="url(#moonlight-clearing)"/>

      <!-- Surrounding forest -->
      <g class="forest-edge">
        <!-- Left forest wall -->
        <path d="M0 0 L0 800 L200 800 L200 400 Q150 350 200 300 Q180 200 200 100 L200 0 Z" fill="#0d1a0d"/>
        <polygon points="150,400 200,300 250,400" fill="#162816"/>
        <polygon points="100,450 170,320 240,450" fill="#1a2f1a"/>
        <polygon points="180,380 230,260 280,380" fill="#0d1a0d"/>

        <!-- Right forest wall -->
        <path d="M1200 0 L1200 800 L1000 800 L1000 400 Q1050 350 1000 300 Q1020 200 1000 100 L1000 0 Z" fill="#0d1a0d"/>
        <polygon points="950,400 1000,300 1050,400" fill="#162816"/>
        <polygon points="970,450 1040,320 1110,450" fill="#1a2f1a"/>
        <polygon points="920,380 970,260 1020,380" fill="#0d1a0d"/>

        <!-- Back forest wall -->
        <path d="M200 0 L200 200 Q400 250 600 200 Q800 250 1000 200 L1000 0 Z" fill="#0a120a"/>
        ${this.generateTreeRow(0, 12, 0.5, 50)}
      </g>

      <!-- Ground -->
      <ellipse cx="600" cy="650" rx="500" ry="200" fill="url(#grass)"/>

      <!-- Stone circle -->
      <g class="stone-circle">
        <!-- Stone 1 (North) -->
        <g data-action="examine" data-target="stones" class="standing-stone">
          <path d="M580 300 L560 450 L640 450 L620 300 Q600 280 580 300" fill="#5a5a6a"/>
          <path d="M570 350 Q590 340 610 350" stroke="#3a3a4a" stroke-width="2" fill="none"/>
          <path d="M575 380 L605 380" stroke="#3a3a4a" stroke-width="2"/>
          <!-- Carved symbol: gear -->
          <circle cx="600" cy="360" r="15" fill="none" stroke="#8b8b9b" stroke-width="2"/>
          <circle cx="600" cy="360" r="8" fill="none" stroke="#8b8b9b" stroke-width="1"/>
        </g>

        <!-- Stone 2 (East) -->
        <g class="standing-stone">
          <path d="M820 400 L800 520 L870 520 L850 400 Q835 380 820 400" fill="#4a4a5a"/>
          <!-- Carved symbol: star -->
          <polygon points="845,440 850,455 865,455 853,465 858,480 845,470 832,480 837,465 825,455 840,455"
                   fill="none" stroke="#8b8b9b" stroke-width="1.5"/>
        </g>

        <!-- Stone 3 (West) -->
        <g class="standing-stone">
          <path d="M330 420 L310 530 L390 530 L370 420 Q350 400 330 420" fill="#4a4a5a"/>
          <!-- Carved symbol: wave -->
          <path d="M335 470 Q350 455 365 470 Q380 485 365 470" stroke="#8b8b9b" stroke-width="2" fill="none"/>
        </g>

        <!-- Stone 4 (South-East) -->
        <g class="standing-stone">
          <path d="M750 520 L735 600 L800 600 L785 520 Q768 505 750 520" fill="#5a5a6a"/>
          <!-- Carved symbol: lighthouse -->
          <rect x="760" y="545" width="12" height="30" fill="none" stroke="#8b8b9b" stroke-width="1.5"/>
          <polygon points="760,545 766,535 772,545" fill="none" stroke="#8b8b9b" stroke-width="1"/>
        </g>

        <!-- Stone 5 (South-West) -->
        <g class="standing-stone">
          <path d="M400 530 L385 610 L455 610 L440 530 Q420 515 400 530" fill="#5a5a6a"/>
          <!-- Carved: "IV" (four) -->
          <text x="420" y="575" fill="#8b8b9b" font-size="20" text-anchor="middle" font-family="serif">IV</text>
        </g>

        <!-- Center altar stone -->
        <ellipse cx="600" cy="520" rx="60" ry="25" fill="#3a3a4a"/>
        <ellipse cx="600" cy="515" rx="55" ry="20" fill="#4a4a5a"/>

        ${
          hasJournal
            ? `
        <!-- Journal page on altar -->
        <g data-action="pickup" data-target="journal_page1" class="interactive-item">
          <!-- Larger hit area -->
          <rect x="560" y="485" width="80" height="60" fill="transparent" class="hit-area"/>
          <rect x="575" y="500" width="50" height="35" fill="#d4c4a8" transform="rotate(-5, 600, 517)"/>
          <line x1="580" y1="510" x2="615" y2="508" stroke="#4a4a4a" stroke-width="1"/>
          <line x1="580" y1="518" x2="620" y2="516" stroke="#4a4a4a" stroke-width="1"/>
          <line x1="580" y1="526" x2="610" y2="524" stroke="#4a4a4a" stroke-width="1"/>
          <circle cx="600" cy="517" r="20" fill="none" stroke="#ffd700" stroke-width="2" opacity="0">
            <animate attributeName="opacity" values="0;0.4;0" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="r" values="20;35;20" dur="2s" repeatCount="indefinite"/>
          </circle>
        </g>
        `
            : ""
        }
      </g>

      <!-- Path to lighthouse (east) -->
      <path d="M800 600 Q900 580 1000 600" stroke="#3d3d2d" stroke-width="50" fill="none" opacity="0.5"/>

      <!-- Path back to forest (south) -->
      <path d="M600 700 Q580 750 600 800" stroke="#3d3d2d" stroke-width="60" fill="none" opacity="0.5"/>

      <!-- Scattered leaves -->
      <g class="leaves">
        <ellipse cx="450" cy="600" rx="8" ry="4" fill="#4a3a2a" transform="rotate(30, 450, 600)"/>
        <ellipse cx="700" cy="580" rx="6" ry="3" fill="#5a4a3a" transform="rotate(-20, 700, 580)"/>
        <ellipse cx="550" cy="620" rx="7" ry="3" fill="#3a2a1a" transform="rotate(45, 550, 620)"/>
      </g>

      <!-- Wisps/energy -->
      <g class="wisps">
        <circle cx="600" cy="400" r="3" fill="#add8e6" opacity="0.5">
          <animate attributeName="cy" values="400;380;400" dur="4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="3s" repeatCount="indefinite"/>
        </circle>
        <circle cx="650" cy="420" r="2" fill="#add8e6" opacity="0.4">
          <animate attributeName="cy" values="420;400;420" dur="5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.2;0.6;0.2" dur="4s" repeatCount="indefinite"/>
        </circle>
      </g>
    </svg>
    `;
  }

  svgLighthouseBase(): string {
    const gearsPlaced = this.gameState.flags.gearsPlaced;
    const doorOpen = this.gameState.flags.lighthouseDoorOpen;
    const hasGear2 =
      !this.gameState.inventory.includes("gear2") && !doorOpen;

    return `
    <svg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <linearGradient id="sky-lighthouse" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e"/>
          <stop offset="50%" style="stop-color:#16213e"/>
          <stop offset="100%" style="stop-color:#2a4a6e"/>
        </linearGradient>

        <linearGradient id="tower-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#4a4a5a"/>
          <stop offset="50%" style="stop-color:#6a6a7a"/>
          <stop offset="100%" style="stop-color:#4a4a5a"/>
        </linearGradient>

        <linearGradient id="ground-rock" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#3a3a4a"/>
          <stop offset="100%" style="stop-color:#2a2a3a"/>
        </linearGradient>
      </defs>

      <!-- Sky -->
      <rect fill="url(#sky-lighthouse)" width="1200" height="800"/>

      <!-- Stars -->
      <g class="stars">
        ${this.generateStars(40)}
      </g>

      <!-- Moon -->
      <circle cx="200" cy="100" r="40" fill="#fffacd"/>

      <!-- Distant ocean -->
      <rect y="500" fill="#1a3a5c" width="1200" height="100" opacity="0.5"/>

      <!-- Rocky ground -->
      <path d="M0 550 Q200 530 400 560 Q600 540 800 570 Q1000 550 1200 560 L1200 800 L0 800 Z"
            fill="url(#ground-rock)"/>

      <!-- Lighthouse tower -->
      <g class="lighthouse-tower">
        <!-- Main tower -->
        <path d="M450 550 L480 100 L720 100 L750 550 Z" fill="url(#tower-gradient)"/>

        <!-- Horizontal stripes -->
        <rect x="460" y="150" width="280" height="40" fill="#c41e3a"/>
        <rect x="470" y="250" width="260" height="40" fill="#c41e3a"/>
        <rect x="480" y="350" width="240" height="40" fill="#c41e3a"/>
        <rect x="490" y="450" width="220" height="40" fill="#c41e3a"/>

        <!-- Lantern room at top (visible from here) -->
        <rect x="490" y="70" width="220" height="50" fill="#2a2a3a"/>
        <rect x="500" y="75" width="200" height="40" fill="#3a5a7a" opacity="0.6"/>

        <!-- Dome -->
        <ellipse cx="600" cy="70" rx="110" ry="30" fill="#2a2a3a"/>
        <path d="M510 70 Q600 20 690 70" fill="#3a3a4a"/>

        <!-- Light beam from top -->
        <polygon points="600,85 200,0 250,0 600,75 950,0 1000,0" fill="#ffd700" opacity="0.15">
          <animate attributeName="opacity" values="0.1;0.2;0.1" dur="2s" repeatCount="indefinite"/>
        </polygon>

        <!-- Door frame -->
        <rect x="540" y="450" width="120" height="150" fill="#2a2a3a" rx="60" ry="60"/>

        ${
          doorOpen
            ? `
        <!-- Open door -->
        <path d="M545 450 L545 600 L600 600 L600 450 Q570 420 545 450" fill="#1a1a2a"/>
        <rect x="550" y="460" width="45" height="130" fill="#0a0a1a"/>
        <!-- Stairs visible inside -->
        <line x1="555" y1="500" x2="590" y2="500" stroke="#3a3a4a" stroke-width="3"/>
        <line x1="555" y1="530" x2="590" y2="530" stroke="#3a3a4a" stroke-width="3"/>
        <line x1="555" y1="560" x2="590" y2="560" stroke="#3a3a4a" stroke-width="3"/>
        `
            : `
        <!-- Closed door -->
        <rect x="550" y="460" width="100" height="130" fill="#3d2817" rx="50" ry="50"/>
        <rect x="560" y="470" width="80" height="110" fill="#2a1a0f" rx="40" ry="40"/>
        <!-- Door handle -->
        <circle cx="620" cy="530" r="8" fill="#8b7355"/>
        `
        }

        <!-- Gear mechanism around door -->
        <g class="gear-mechanism" data-action="examine" data-target="gear_slots">
          <!-- Slot 1 (top-left) -->
          <g data-action="use" data-target="gear_slot" class="gear-slot ${gearsPlaced >= 1 ? "filled" : ""}">
            <circle cx="510" cy="480" r="25" fill="#2a2a3a" stroke="#4a4a5a" stroke-width="3"/>
            ${
              gearsPlaced >= 1
                ? `
            <circle cx="510" cy="480" r="18" fill="#8b7355"/>
            <circle cx="510" cy="480" r="12" fill="#a08060"/>
            `
                : ""
            }
          </g>

          <!-- Slot 2 (top-right) -->
          <g class="gear-slot ${gearsPlaced >= 2 ? "filled" : ""}">
            <circle cx="690" cy="480" r="25" fill="#2a2a3a" stroke="#4a4a5a" stroke-width="3"/>
            ${
              gearsPlaced >= 2
                ? `
            <circle cx="690" cy="480" r="18" fill="#8b7355"/>
            <circle cx="690" cy="480" r="12" fill="#a08060"/>
            `
                : ""
            }
          </g>

          <!-- Slot 3 (bottom-left) -->
          <g class="gear-slot ${gearsPlaced >= 3 ? "filled" : ""}">
            <circle cx="510" cy="570" r="25" fill="#2a2a3a" stroke="#4a4a5a" stroke-width="3"/>
            ${
              gearsPlaced >= 3
                ? `
            <circle cx="510" cy="570" r="18" fill="#8b7355"/>
            <circle cx="510" cy="570" r="12" fill="#a08060"/>
            `
                : ""
            }
          </g>

          <!-- Slot 4 (bottom-right) -->
          <g class="gear-slot ${gearsPlaced >= 4 ? "filled" : ""}">
            <circle cx="690" cy="570" r="25" fill="#2a2a3a" stroke="#4a4a5a" stroke-width="3"/>
            ${
              gearsPlaced >= 4
                ? `
            <circle cx="690" cy="570" r="18" fill="#8b7355"/>
            <circle cx="690" cy="570" r="12" fill="#a08060"/>
            `
                : ""
            }
          </g>
        </g>
      </g>

      <!-- Rocks around base -->
      <g class="base-rocks">
        <ellipse cx="350" cy="620" rx="70" ry="35" fill="#4a4a5a"/>
        <ellipse cx="850" cy="630" rx="80" ry="40" fill="#3a3a4a"/>
        <ellipse cx="250" cy="680" rx="90" ry="45" fill="#5a5a6a"/>
        <ellipse cx="950" cy="670" rx="85" ry="42" fill="#4a4a5a"/>

        ${
          hasGear2
            ? `
        <!-- Gear hidden in rocks -->
        <g data-action="pickup" data-target="gear2" class="interactive-item">
          <!-- Larger hit area -->
          <rect x="355" y="615" width="50" height="50" fill="transparent" class="hit-area"/>
          <circle cx="380" cy="640" r="15" fill="#6a5a4a"/>
          <circle cx="380" cy="640" r="10" fill="#8b7355"/>
          <circle cx="380" cy="640" r="22" fill="none" stroke="#ffd700" stroke-width="2" opacity="0">
            <animate attributeName="opacity" values="0;0.4;0" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="r" values="22;32;22" dur="2s" repeatCount="indefinite"/>
          </circle>
        </g>
        `
            : ""
        }
      </g>

      <!-- Path back west -->
      <path d="M0 650 Q150 630 300 660" stroke="#2a2a3a" stroke-width="60" fill="none" opacity="0.5"/>

      <!-- Examine door hotspot -->
      <rect x="540" y="450" width="120" height="150" fill="transparent"
            data-action="examine" data-target="door" class="hotspot"/>
    </svg>
    `;
  }

  svgLighthouseTop(): string {
    const solved = this.gameState.puzzlesSolved.lighthouse;
    const mirrorAngles = this.gameState.flags.mirrorAngles;

    const lightRays = [0, 45, 90, 135, 180, 225, 270, 315]
      .map(
        (angle) => `
      <line x1="600" y1="400"
            x2="${600 + Math.cos((angle * Math.PI) / 180) * 300}"
            y2="${400 + Math.sin((angle * Math.PI) / 180) * 300}"
            stroke="#ffd700" stroke-width="2" opacity="0.2"/>
    `,
      )
      .join("");

    return `
    <svg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <linearGradient id="sky-top" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0a1a"/>
          <stop offset="100%" style="stop-color:#1a2a4a"/>
        </linearGradient>

        <radialGradient id="lens-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#ffd700;stop-opacity:0.8"/>
          <stop offset="70%" style="stop-color:#ffd700;stop-opacity:0.3"/>
          <stop offset="100%" style="stop-color:#ffd700;stop-opacity:0"/>
        </radialGradient>

        <linearGradient id="glass-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4a7a9a;stop-opacity:0.6"/>
          <stop offset="50%" style="stop-color:#6a9aba;stop-opacity:0.4"/>
          <stop offset="100%" style="stop-color:#4a7a9a;stop-opacity:0.6"/>
        </linearGradient>
      </defs>

      <!-- Night sky through windows -->
      <rect fill="url(#sky-top)" width="1200" height="800"/>

      <!-- Stars visible through glass -->
      <g class="stars">
        ${this.generateStars(100)}
      </g>

      <!-- Distant island view -->
      <g class="island-view" opacity="0.7">
        <!-- Ocean -->
        <rect y="450" fill="#0d2137" width="1200" height="200" opacity="0.5"/>

        <!-- Distant cliffs -->
        <path d="M900 450 L920 380 L950 400 L980 350 L1010 390 L1040 370 L1080 420 L1100 450"
              fill="#2a3a4a" opacity="0.8"/>

        ${
          solved
            ? `
        <!-- Illuminated text on cliffs -->
        <text x="1000" y="400" fill="#ffd700" font-size="14" font-family="serif" opacity="0.9">
          TIDE REVEALS
        </text>
        <text x="1000" y="420" fill="#ffd700" font-size="14" font-family="serif" opacity="0.9">
          THE CAVE
        </text>
        `
            : ""
        }

        <!-- Forest -->
        <path d="M0 480 Q200 450 400 480 Q600 450 800 480 L800 500 L0 500 Z" fill="#0d1a0d" opacity="0.6"/>
      </g>

      <!-- Lantern room structure -->
      <g class="lantern-room">
        <!-- Window frames -->
        <rect x="50" y="100" width="1100" height="500" fill="none" stroke="#3a3a4a" stroke-width="20"/>

        <!-- Window panes -->
        <line x1="300" y1="100" x2="300" y2="600" stroke="#3a3a4a" stroke-width="10"/>
        <line x1="600" y1="100" x2="600" y2="600" stroke="#3a3a4a" stroke-width="10"/>
        <line x1="900" y1="100" x2="900" y2="600" stroke="#3a3a4a" stroke-width="10"/>
        <line x1="50" y1="350" x2="1150" y2="350" stroke="#3a3a4a" stroke-width="10"/>

        <!-- Glass tint -->
        <rect x="60" y="110" width="1080" height="480" fill="url(#glass-gradient)"/>
      </g>

      <!-- Central lens assembly -->
      <g class="lens-assembly" data-action="puzzle" data-target="mirrors">
        <!-- Lens mount -->
        <circle cx="600" cy="400" r="100" fill="#2a2a3a" stroke="#4a4a5a" stroke-width="5"/>

        <!-- Fresnel lens -->
        <circle cx="600" cy="400" r="80" fill="url(#lens-glow)"/>
        <circle cx="600" cy="400" r="70" fill="none" stroke="#ffd700" stroke-width="2" opacity="0.5"/>
        <circle cx="600" cy="400" r="55" fill="none" stroke="#ffd700" stroke-width="2" opacity="0.4"/>
        <circle cx="600" cy="400" r="40" fill="none" stroke="#ffd700" stroke-width="2" opacity="0.3"/>
        <circle cx="600" cy="400" r="25" fill="#fffacd"/>

        <!-- Light rays -->
        <g class="light-rays">
          ${lightRays}
        </g>

        <!-- Mirror positions (clickable) -->
        <g class="mirrors" data-action="examine" data-target="mirrors">
          <!-- Mirror 1 (top) -->
          <g class="mirror-mount">
            <circle cx="600" cy="200" r="30" fill="#3a3a4a"/>
            <rect x="580" y="195" width="40" height="10" fill="#6a9aba"
                  transform="rotate(${mirrorAngles[0]}, 600, 200)"/>
          </g>

          <!-- Mirror 2 (right) -->
          <g class="mirror-mount">
            <circle cx="800" cy="400" r="30" fill="#3a3a4a"/>
            <rect x="780" y="395" width="40" height="10" fill="#6a9aba"
                  transform="rotate(${mirrorAngles[1]}, 800, 400)"/>
          </g>

          <!-- Mirror 3 (bottom) -->
          <g class="mirror-mount">
            <circle cx="600" cy="580" r="30" fill="#3a3a4a"/>
            <rect x="580" y="575" width="40" height="10" fill="#6a9aba"
                  transform="rotate(${mirrorAngles[2]}, 600, 580)"/>
          </g>

          <!-- Mirror 4 (left) -->
          <g class="mirror-mount">
            <circle cx="400" cy="400" r="30" fill="#3a3a4a"/>
            <rect x="380" y="395" width="40" height="10" fill="#6a9aba"
                  transform="rotate(${mirrorAngles[3]}, 400, 400)"/>
          </g>
        </g>

        ${
          solved
            ? `
        <!-- Solved: directed beam -->
        <line x1="600" y1="400" x2="600" y2="200" stroke="#ffd700" stroke-width="8" opacity="0.6"/>
        <line x1="600" y1="200" x2="1000" y2="400" stroke="#ffd700" stroke-width="8" opacity="0.6"/>
        `
            : ""
        }
      </g>

      <!-- Floor -->
      <rect y="650" fill="#2a2a3a" width="1200" height="150"/>
      <ellipse cx="600" cy="650" rx="300" ry="30" fill="#3a3a4a"/>

      <!-- Stairs down -->
      <g class="stairs-down">
        <ellipse cx="200" cy="700" rx="60" ry="40" fill="#1a1a2a"/>
        <text x="200" y="710" fill="#6a6a7a" font-size="14" text-anchor="middle">↓ Down</text>
      </g>

      <!-- Examine view hotspot -->
      <rect x="850" y="350" width="200" height="150" fill="transparent"
            data-action="examine" data-target="view" class="hotspot"/>

      <!-- Examine lens hotspot -->
      <circle cx="600" cy="400" r="100" fill="transparent"
              data-action="examine" data-target="lens" class="hotspot"/>
    </svg>
    `;
  }

  <template>
    <div class="scene-container" ...attributes>
      {{this.sceneSVG}}
    </div>
  </template>
}
