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
      case "tidal_cave":
        return this.svgTidalCave();
      case "underwater_passage":
        return this.svgUnderwaterPassage();
      case "research_station":
        return this.svgResearchStation();
      case "observatory":
        return this.svgObservatory();
      case "vault":
        return this.svgVault();
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
    <svg viewBox="0 180 1200 500" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <linearGradient id="sky-beach" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0e1a"/>
          <stop offset="25%" style="stop-color:#111b33"/>
          <stop offset="55%" style="stop-color:#1a2d4d"/>
          <stop offset="80%" style="stop-color:#2a4a6e"/>
          <stop offset="100%" style="stop-color:#3d6080"/>
        </linearGradient>
        <linearGradient id="ocean-deep" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#1e3f5e"/>
          <stop offset="40%" style="stop-color:#162e48"/>
          <stop offset="100%" style="stop-color:#0c1e30"/>
        </linearGradient>
        <linearGradient id="sand-beach" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#6b5a4a"/>
          <stop offset="30%" style="stop-color:#5a493a"/>
          <stop offset="100%" style="stop-color:#3d3229"/>
        </linearGradient>
        <linearGradient id="wet-sand" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#4a4035"/>
          <stop offset="100%" style="stop-color:#3a3028"/>
        </linearGradient>
        <radialGradient id="moon-outer" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#fffacd;stop-opacity:0.5"/>
          <stop offset="40%" style="stop-color:#fffacd;stop-opacity:0.15"/>
          <stop offset="100%" style="stop-color:#fffacd;stop-opacity:0"/>
        </radialGradient>
        <radialGradient id="moon-surface" cx="40%" cy="35%" r="60%">
          <stop offset="0%" style="stop-color:#fffff0"/>
          <stop offset="60%" style="stop-color:#f5edc0"/>
          <stop offset="100%" style="stop-color:#d4c490"/>
        </radialGradient>
        <radialGradient id="moon-reflect" cx="50%" cy="0%" r="100%">
          <stop offset="0%" style="stop-color:#fffacd;stop-opacity:0.12"/>
          <stop offset="100%" style="stop-color:#fffacd;stop-opacity:0"/>
        </radialGradient>
        <filter id="soft-glow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2"/>
        </filter>
        <filter id="mist">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8"/>
        </filter>
        <clipPath id="rock-clip-1">
          <path d="M140 640 Q160 590 200 580 Q240 575 270 590 Q300 610 310 640 Q290 665 250 670 Q200 672 160 660 Z"/>
        </clipPath>
      </defs>

      <!-- Sky -->
      <rect fill="url(#sky-beach)" width="1200" height="800"/>

      <!-- Stars — fixed positions for no flicker -->
      <g class="stars" opacity="0.9">
        <circle cx="80" cy="60" r="1.2" fill="#fffacd" opacity="0.6"/>
        <circle cx="180" cy="130" r="0.8" fill="#fffacd" opacity="0.4"/>
        <circle cx="260" cy="45" r="1.5" fill="#fffacd" opacity="0.7"/>
        <circle cx="350" cy="95" r="0.9" fill="#fffacd" opacity="0.5"/>
        <circle cx="420" cy="30" r="1.1" fill="#fffacd" opacity="0.6"/>
        <circle cx="500" cy="75" r="1.4" fill="#fffacd" opacity="0.55"/>
        <circle cx="570" cy="150" r="0.7" fill="#fffacd" opacity="0.4"/>
        <circle cx="650" cy="40" r="1.3" fill="#fffacd" opacity="0.65"/>
        <circle cx="720" cy="110" r="1.0" fill="#fffacd" opacity="0.5"/>
        <circle cx="780" cy="55" r="1.6" fill="#fffacd" opacity="0.7"/>
        <circle cx="1050" cy="80" r="1.2" fill="#fffacd" opacity="0.55"/>
        <circle cx="1100" cy="140" r="0.9" fill="#fffacd" opacity="0.45"/>
        <circle cx="1150" cy="50" r="1.1" fill="#fffacd" opacity="0.6"/>
        <circle cx="140" cy="200" r="0.8" fill="#fffacd" opacity="0.35"/>
        <circle cx="310" cy="180" r="1.0" fill="#fffacd" opacity="0.5"/>
        <circle cx="480" cy="210" r="0.7" fill="#fffacd" opacity="0.3"/>
        <circle cx="620" cy="190" r="1.3" fill="#fffacd" opacity="0.45"/>
        <circle cx="760" cy="170" r="0.6" fill="#fffacd" opacity="0.35"/>
        <circle cx="890" cy="60" r="0.8" fill="#fffacd" opacity="0.4"/>
        <circle cx="1000" cy="170" r="1.1" fill="#fffacd" opacity="0.5"/>
        <!-- Twinkling stars -->
        <circle cx="160" cy="80" r="1.2" fill="#fffacd">
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite"/>
        </circle>
        <circle cx="530" cy="55" r="1.4" fill="#fffacd">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="4s" repeatCount="indefinite"/>
        </circle>
        <circle cx="850" cy="95" r="1.0" fill="#fffacd">
          <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.5s" repeatCount="indefinite"/>
        </circle>
      </g>

      <!-- Wispy clouds -->
      <g opacity="0.08">
        <ellipse cx="300" cy="160" rx="180" ry="15" fill="#8899bb"/>
        <ellipse cx="750" cy="100" rx="140" ry="10" fill="#8899bb"/>
        <ellipse cx="1000" cy="200" rx="120" ry="12" fill="#8899bb"/>
      </g>

      <!-- Moon -->
      <circle cx="920" cy="130" r="90" fill="url(#moon-outer)"/>
      <circle cx="920" cy="130" r="38" fill="url(#moon-surface)"/>
      <!-- Moon craters -->
      <circle cx="910" cy="120" r="6" fill="#c8b880" opacity="0.4"/>
      <circle cx="930" cy="140" r="4" fill="#c8b880" opacity="0.3"/>
      <circle cx="905" cy="138" r="3" fill="#c8b880" opacity="0.25"/>
      <circle cx="925" cy="118" r="2.5" fill="#c8b880" opacity="0.2"/>

      <!-- Distant lighthouse silhouette on headland -->
      <g class="lighthouse-distant">
        <!-- Headland -->
        <path d="M80 380 Q100 350 140 340 Q180 335 220 350 Q240 360 250 380 L250 420 L80 420 Z" fill="#14202e"/>
        <!-- Tower -->
        <path d="M148 340 L152 260 L170 260 L174 340 Z" fill="#1a2a3a"/>
        <!-- Lantern housing -->
        <rect x="146" y="252" width="30" height="14" fill="#1a2a3a"/>
        <!-- Dome -->
        <path d="M148 252 Q161 240 174 252" fill="#1a2a3a"/>
        <!-- Light beam sweeping -->
        <g>
          <polygon points="161,258 50,200 80,195 161,252" fill="#ffd700" opacity="0.06">
            <animate attributeName="opacity" values="0.04;0.1;0.04" dur="4s" repeatCount="indefinite"/>
          </polygon>
          <polygon points="161,258 280,220 260,215 161,252" fill="#ffd700" opacity="0.06">
            <animate attributeName="opacity" values="0.08;0.04;0.08" dur="4s" repeatCount="indefinite"/>
          </polygon>
          <!-- Light glow -->
          <circle cx="161" cy="258" r="5" fill="#ffd700" opacity="0.7">
            <animate attributeName="opacity" values="0.5;0.9;0.5" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="161" cy="258" r="12" fill="#ffd700" opacity="0.15" filter="url(#soft-glow)"/>
        </g>
      </g>

      <!-- Ocean body -->
      <rect y="370" fill="url(#ocean-deep)" width="1200" height="180"/>

      <!-- Moon reflection on water -->
      <g opacity="0.3">
        <ellipse cx="920" cy="410" rx="60" ry="8" fill="url(#moon-reflect)"/>
        <line x1="900" y1="395" x2="940" y2="395" stroke="#fffacd" stroke-width="1.5" opacity="0.2"/>
        <line x1="890" y1="420" x2="950" y2="420" stroke="#fffacd" stroke-width="1" opacity="0.15"/>
        <line x1="905" y1="440" x2="935" y2="440" stroke="#fffacd" stroke-width="0.8" opacity="0.1"/>
      </g>

      <!-- Deep wave layer -->
      <path d="M0 405 Q100 395 200 408 Q350 420 500 405 Q650 390 800 408 Q950 425 1100 410 Q1150 405 1200 412 L1200 550 L0 550 Z"
            fill="#19364f" opacity="0.8">
        <animate attributeName="d"
          values="M0 405 Q100 395 200 408 Q350 420 500 405 Q650 390 800 408 Q950 425 1100 410 Q1150 405 1200 412 L1200 550 L0 550 Z;
                  M0 410 Q100 420 200 405 Q350 395 500 412 Q650 425 800 405 Q950 395 1100 415 Q1150 420 1200 408 L1200 550 L0 550 Z;
                  M0 405 Q100 395 200 408 Q350 420 500 405 Q650 390 800 408 Q950 425 1100 410 Q1150 405 1200 412 L1200 550 L0 550 Z"
          dur="6s" repeatCount="indefinite"/>
      </path>

      <!-- Mid wave layer -->
      <path d="M0 430 Q150 418 300 435 Q500 450 700 430 Q900 415 1050 438 L1200 432 L1200 550 L0 550 Z"
            fill="#1d4060" opacity="0.6">
        <animate attributeName="d"
          values="M0 430 Q150 418 300 435 Q500 450 700 430 Q900 415 1050 438 L1200 432 L1200 550 L0 550 Z;
                  M0 435 Q150 445 300 428 Q500 418 700 440 Q900 450 1050 430 L1200 438 L1200 550 L0 550 Z;
                  M0 430 Q150 418 300 435 Q500 450 700 430 Q900 415 1050 438 L1200 432 L1200 550 L0 550 Z"
          dur="5s" repeatCount="indefinite"/>
      </path>

      <!-- Shallow wave -->
      <path d="M0 465 Q200 455 400 470 Q600 480 800 465 Q1000 455 1200 468 L1200 550 L0 550 Z"
            fill="#224a6a" opacity="0.5">
        <animate attributeName="d"
          values="M0 465 Q200 455 400 470 Q600 480 800 465 Q1000 455 1200 468 L1200 550 L0 550 Z;
                  M0 470 Q200 480 400 465 Q600 455 800 472 Q1000 480 1200 463 L1200 550 L0 550 Z;
                  M0 465 Q200 455 400 470 Q600 480 800 465 Q1000 455 1200 468 L1200 550 L0 550 Z"
          dur="4s" repeatCount="indefinite"/>
      </path>

      <!-- Foam/surf line -->
      <g opacity="0.5">
        <path d="M0 500 Q80 494 160 502 Q280 510 400 498 Q520 490 640 504 Q780 514 900 500 Q1020 490 1100 502 L1200 498"
              stroke="#8ab4c8" stroke-width="2.5" fill="none">
          <animate attributeName="d"
            values="M0 500 Q80 494 160 502 Q280 510 400 498 Q520 490 640 504 Q780 514 900 500 Q1020 490 1100 502 L1200 498;
                    M0 504 Q80 510 160 498 Q280 492 400 506 Q520 514 640 500 Q780 492 900 508 Q1020 514 1100 500 L1200 506;
                    M0 500 Q80 494 160 502 Q280 510 400 498 Q520 490 640 504 Q780 514 900 500 Q1020 490 1100 502 L1200 498"
            dur="3.5s" repeatCount="indefinite"/>
        </path>
        <!-- Foam dots -->
        <circle cx="200" cy="502" r="2" fill="#a0c4d4" opacity="0.4">
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="550" cy="498" r="1.5" fill="#a0c4d4" opacity="0.3">
          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="850" cy="504" r="2" fill="#a0c4d4" opacity="0.35">
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite"/>
        </circle>
      </g>

      <!-- Wet sand strip -->
      <path d="M0 500 Q200 495 400 505 Q600 510 800 500 Q1000 495 1200 505 L1200 530 L0 530 Z" fill="url(#wet-sand)"/>

      <!-- Dry sand beach -->
      <path d="M0 522 Q300 515 600 528 Q900 540 1200 530 L1200 800 L0 800 Z" fill="url(#sand-beach)"/>

      <!-- Sand texture — subtle grain lines -->
      <g opacity="0.08" stroke="#8a7a6a" stroke-width="0.5" fill="none">
        <path d="M50 560 Q200 555 400 565"/>
        <path d="M100 590 Q350 585 600 595"/>
        <path d="M200 620 Q500 612 750 625"/>
        <path d="M600 560 Q850 555 1100 565"/>
      </g>

      <!-- Left rock formation — layered with texture -->
      <g data-action="examine" data-target="rocks">
        <!-- Base boulder -->
        <path d="M100 590 Q120 545 170 535 Q220 530 260 548 Q280 568 270 595 Q240 615 190 618 Q130 615 100 590 Z" fill="#3e3e48"/>
        <path d="M103 588 Q123 550 170 540 Q215 536 250 550 Q270 565 265 588 Q240 608 192 610 Q135 608 103 588 Z" fill="#4a4a55"/>
        <!-- Highlight edge -->
        <path d="M125 555 Q165 545 200 548" stroke="#5a5a68" stroke-width="1.5" fill="none"/>
        <!-- Crevice -->
        <path d="M165 545 Q175 570 160 595" stroke="#2a2a32" stroke-width="1" fill="none"/>

        <!-- Second rock -->
        <path d="M220 600 Q240 578 280 574 Q310 576 320 592 Q315 610 290 615 Q250 618 220 600 Z" fill="#444450"/>
        <path d="M225 598 Q245 582 278 578 Q305 580 312 594 Q308 607 288 612 Q252 614 225 598 Z" fill="#505060"/>

        <!-- Small rock -->
        <path d="M130 610 Q145 598 170 600 Q185 605 180 618 Q160 622 135 616 Z" fill="#3a3a44"/>

        ${
          hasKey
            ? `
        <!-- Rusty key — wedged between rocks, glinting -->
        <g data-action="pickup" data-target="rusty_key" class="interactive-item">
          <rect x="185" y="575" width="55" height="55" fill="transparent" class="hit-area"/>
          <!-- Key shape -->
          <g transform="translate(210, 592) rotate(-25)">
            <circle cx="0" cy="0" r="7" fill="#8b6914" stroke="#6b4f10" stroke-width="1"/>
            <circle cx="0" cy="0" r="3.5" fill="none" stroke="#6b4f10" stroke-width="1"/>
            <rect x="-2" y="5" width="4" height="16" fill="#8b6914" rx="1"/>
            <rect x="-5" y="16" width="4" height="5" fill="#8b6914" rx="0.5"/>
            <rect x="1" y="13" width="4" height="5" fill="#8b6914" rx="0.5"/>
          </g>
          <!-- Glint -->
          <circle cx="208" cy="589" r="4" fill="#ffd700" opacity="0.9">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite"/>
          </circle>
          <!-- Pulse ring -->
          <circle cx="210" cy="592" r="14" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0">
            <animate attributeName="opacity" values="0;0.4;0" dur="2.5s" repeatCount="indefinite"/>
            <animate attributeName="r" values="14;28;14" dur="2.5s" repeatCount="indefinite"/>
          </circle>
        </g>
        `
            : ""
        }
      </g>

      <!-- Right rock formation -->
      <g>
        <path d="M830 595 Q860 558 910 550 Q960 548 1000 562 Q1030 585 1020 612 Q990 632 940 636 Q870 632 830 595 Z" fill="#3a3a44"/>
        <path d="M835 593 Q865 560 910 554 Q955 552 990 566 Q1015 585 1010 608 Q985 624 938 628 Q875 626 835 593 Z" fill="#464652"/>
        <path d="M860 568 Q900 560 930 564" stroke="#545462" stroke-width="1.5" fill="none"/>
        <!-- Tide pool -->
        <ellipse cx="930" cy="615" rx="20" ry="8" fill="#1a3050" opacity="0.6"/>
        <ellipse cx="930" cy="614" rx="18" ry="6" fill="#1e3858" opacity="0.4"/>
      </g>

      <!-- Scattered pebbles -->
      <g opacity="0.5">
        <ellipse cx="400" cy="555" rx="5" ry="3" fill="#555" transform="rotate(20,400,555)"/>
        <ellipse cx="500" cy="570" rx="4" ry="2.5" fill="#4a4a4a" transform="rotate(-15,500,570)"/>
        <ellipse cx="650" cy="560" rx="6" ry="3" fill="#505050" transform="rotate(35,650,560)"/>
        <ellipse cx="750" cy="580" rx="4" ry="2" fill="#484848" transform="rotate(10,750,580)"/>
        <ellipse cx="580" cy="590" rx="3" ry="2" fill="#555" transform="rotate(-30,580,590)"/>
      </g>

      <!-- Driftwood — weathered branch -->
      <g>
        <path d="M450 620 Q490 612 550 616 Q590 620 610 625" stroke="#5c4033" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M450 620 Q445 618 435 622" stroke="#5c4033" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M550 616 Q560 610 570 612" stroke="#5c4033" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M470 618 Q510 615 540 618" stroke="#6b5040" stroke-width="0.8" fill="none"/>
      </g>

      <!-- Seaweed/kelp strands -->
      <g>
        <path d="M680 660 Q688 640 678 620 Q668 640 680 660" stroke="#2d4a3e" stroke-width="3" fill="none">
          <animate attributeName="d"
            values="M680 660 Q688 640 678 620 Q668 640 680 660;
                    M680 660 Q692 640 682 620 Q672 640 680 660;
                    M680 660 Q688 640 678 620 Q668 640 680 660"
            dur="4s" repeatCount="indefinite"/>
        </path>
        <path d="M695 668 Q705 648 692 630 Q680 650 695 668" stroke="#3a5a48" stroke-width="2" fill="none">
          <animate attributeName="d"
            values="M695 668 Q705 648 692 630 Q680 650 695 668;
                    M695 668 Q708 650 695 630 Q683 650 695 668;
                    M695 668 Q705 648 692 630 Q680 650 695 668"
            dur="3.5s" repeatCount="indefinite"/>
        </path>
      </g>

      <!-- Forest edge — layered treeline (north) -->
      <g class="forest-edge">
        <!-- Dark forest mass -->
        <path d="M350 55 L350 400 Q420 420 500 400 Q580 385 650 400 Q700 415 750 400 L750 55 Z" fill="#0a0e1a"/>

        <!-- Tree silhouettes — varied sizes and shapes -->
        <!-- Tall pine left -->
        <polygon points="380,400 400,200 420,400" fill="#0f1f0f"/>
        <polygon points="385,360 400,240 415,360" fill="#122212"/>
        <!-- Broad oak center-left -->
        <path d="M440 400 Q440 310 470 280 Q500 260 530 280 Q560 310 560 400 Z" fill="#0f1f0f"/>
        <path d="M450 380 Q455 320 480 295 Q505 275 520 295 Q545 320 548 380 Z" fill="#142414"/>
        <!-- Tall center pine -->
        <polygon points="540,400 565,160 590,400" fill="#0d1a0d"/>
        <polygon points="548,350 565,200 582,350" fill="#112011"/>
        <polygon points="553,300 565,230 577,300" fill="#132213"/>
        <!-- Right cluster -->
        <path d="M620 400 Q625 330 650 300 Q675 280 700 310 Q720 340 720 400 Z" fill="#0f1f0f"/>
        <polygon points="680,400 705,220 730,400" fill="#0d1a0d"/>
        <polygon points="688,350 705,260 722,350" fill="#112011"/>

        <!-- Path opening — gap in the trees with lighter ground -->
        <path d="M490 540 Q500 480 510 430 Q520 400 530 380" stroke="#4a4a3a" stroke-width="50" fill="none" opacity="0.7" stroke-linecap="round"/>
        <path d="M495 520 Q505 470 512 425" stroke="#55523e" stroke-width="25" fill="none" opacity="0.5" stroke-linecap="round"/>
      </g>

      <!-- Mist near waterline -->
      <g filter="url(#mist)" opacity="0.15" style="pointer-events:none">
        <ellipse cx="400" cy="510" rx="300" ry="25" fill="#6688aa"/>
        <ellipse cx="900" cy="505" rx="250" ry="20" fill="#6688aa"/>
      </g>

      <!-- Clickable waves area -->
      <rect x="0" y="370" width="1200" height="140" fill="transparent"
            data-action="examine" data-target="waves" class="hotspot"/>
    </svg>
    `;
  }

  svgForest(): string {
    const hasGear =
      !this.gameState.inventory.includes("gear1") &&
      !this.gameState.flags.foundGear1;

    return `
    <svg viewBox="0 180 1200 500" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <linearGradient id="sky-forest" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#060810"/>
          <stop offset="100%" style="stop-color:#0e1418"/>
        </linearGradient>
        <linearGradient id="forest-ground" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#1a2a18"/>
          <stop offset="100%" style="stop-color:#0e1a0c"/>
        </linearGradient>
        <linearGradient id="shaft1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#c8d8a0;stop-opacity:0.12"/>
          <stop offset="60%" style="stop-color:#a0b880;stop-opacity:0.06"/>
          <stop offset="100%" style="stop-color:#a0b880;stop-opacity:0"/>
        </linearGradient>
        <linearGradient id="shaft2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#d0daa0;stop-opacity:0.08"/>
          <stop offset="100%" style="stop-color:#a0b880;stop-opacity:0"/>
        </linearGradient>
        <filter id="forest-fog">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6"/>
        </filter>
        <filter id="soft-blur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2"/>
        </filter>
      </defs>

      <!-- Background darkness -->
      <rect fill="url(#sky-forest)" width="1200" height="800"/>

      <!-- Deep background trees — distant silhouettes -->
      <g opacity="0.35">
        <polygon points="40,320 70,140 100,320" fill="#0a150a"/>
        <polygon points="100,310 140,120 180,310" fill="#0c180c"/>
        <polygon points="170,325 210,160 250,325" fill="#0a150a"/>
        <polygon points="240,315 275,100 310,315" fill="#0b160b"/>
        <polygon points="310,320 350,130 390,320" fill="#0c180c"/>
        <polygon points="380,310 420,150 460,310" fill="#0a150a"/>
        <polygon points="450,325 490,110 530,325" fill="#0b170b"/>
        <polygon points="700,320 740,130 780,320" fill="#0a150a"/>
        <polygon points="770,310 810,150 850,310" fill="#0c180c"/>
        <polygon points="840,325 880,120 920,325" fill="#0a150a"/>
        <polygon points="920,315 960,140 1000,315" fill="#0b160b"/>
        <polygon points="990,320 1030,130 1070,320" fill="#0c180c"/>
        <polygon points="1060,310 1100,160 1140,310" fill="#0a150a"/>
      </g>

      <!-- Mid trees — slightly more visible -->
      <g opacity="0.55">
        <polygon points="20,380 65,200 110,380" fill="#0d1d0d"/>
        <polygon points="120,370 170,180 220,370" fill="#0f200f"/>
        <polygon points="240,385 290,210 340,385" fill="#0d1d0d"/>
        <polygon points="820,380 870,190 920,380" fill="#0d1d0d"/>
        <polygon points="940,375 990,200 1040,375" fill="#0f200f"/>
        <polygon points="1060,385 1110,210 1160,385" fill="#0d1d0d"/>
      </g>

      <!-- Light shafts — volumetric beams piercing canopy -->
      <g class="light-shafts">
        <polygon points="320,0 360,0 520,650 430,650" fill="url(#shaft1)">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="6s" repeatCount="indefinite"/>
        </polygon>
        <polygon points="720,0 750,0 870,550 810,550" fill="url(#shaft1)">
          <animate attributeName="opacity" values="1;0.7;1" dur="5s" repeatCount="indefinite"/>
        </polygon>
        <polygon points="540,0 560,0 630,400 590,400" fill="url(#shaft2)">
          <animate attributeName="opacity" values="0.6;0.9;0.6" dur="7s" repeatCount="indefinite"/>
        </polygon>
      </g>

      <!-- Ground -->
      <path d="M0 520 Q300 510 600 525 Q900 540 1200 520 L1200 800 L0 800 Z" fill="url(#forest-ground)"/>

      <!-- Ground fog layer -->
      <g filter="url(#forest-fog)" opacity="0.2" style="pointer-events:none">
        <ellipse cx="600" cy="560" rx="650" ry="60" fill="#2a4a2a"/>
      </g>

      <!-- Forest path — winding trail through center -->
      <path d="M540 800 Q530 700 555 600 Q590 510 570 420 Q550 340 585 250 Q620 160 590 60 L600 0"
            stroke="#1e1e12" stroke-width="90" fill="none" opacity="0.65"/>
      <path d="M545 780 Q535 690 558 595 Q588 510 572 425 Q555 345 587 255 Q618 165 592 65"
            stroke="#28281a" stroke-width="45" fill="none" opacity="0.5"/>
      <!-- Path ground texture -->
      <g opacity="0.15" stroke="#4a4830" fill="none" stroke-width="0.8">
        <path d="M530 650 Q560 645 580 650"/>
        <path d="M540 580 Q565 575 585 580"/>
        <path d="M555 510 Q575 505 590 512"/>
        <path d="M560 440 Q578 435 588 442"/>
      </g>

      <!-- Left foreground tree — massive trunk with realistic canopy -->
      <g class="tree-left">
        <!-- Trunk -->
        <path d="M30 800 L40 380 Q50 300 80 250 Q70 300 100 380 L120 800 Z" fill="#1c130c"/>
        <!-- Bark texture -->
        <path d="M55 500 Q62 450 58 400 Q64 350 55 300" stroke="#2a1e14" stroke-width="2" fill="none" opacity="0.6"/>
        <path d="M80 520 Q88 460 84 410 Q90 360 82 310" stroke="#2a1e14" stroke-width="1.5" fill="none" opacity="0.5"/>
        <!-- Root flare -->
        <path d="M30 800 Q10 750 0 730" stroke="#1c130c" stroke-width="18" fill="none"/>
        <path d="M120 800 Q160 740 180 720" stroke="#1c130c" stroke-width="14" fill="none"/>

        <!-- Canopy layers — organic shapes, not ellipses -->
        <path d="M-80 350 Q-40 260 60 230 Q140 210 200 250 Q260 290 240 360 Q200 400 100 410 Q0 405 -80 350 Z" fill="#0e1e0e"/>
        <path d="M-60 300 Q-20 220 70 200 Q150 185 210 220 Q250 260 230 320 Q190 350 100 355 Q10 350 -60 300 Z" fill="#122212"/>
        <path d="M-40 260 Q0 200 80 185 Q140 175 190 200 Q220 230 200 270 Q170 300 90 305 Q20 300 -40 260 Z" fill="#152815"/>

        <!-- Branch reaching across -->
        <path d="M100 320 Q200 310 330 340 Q400 360 420 380"
              stroke="#1c130c" stroke-width="14" fill="none" stroke-linecap="round"/>
        <path d="M330 340 Q360 325 380 330" stroke="#1c130c" stroke-width="6" fill="none" stroke-linecap="round"/>
        <!-- Leaves on branch -->
        <path d="M250 330 Q270 310 290 320 Q310 335 290 340 Q270 345 250 330 Z" fill="#142414" opacity="0.7"/>
        <path d="M350 345 Q365 330 380 340 Q390 355 375 358 Q360 360 350 345 Z" fill="#162816" opacity="0.6"/>
      </g>

      <!-- Right foreground tree -->
      <g class="tree-right">
        <!-- Trunk -->
        <path d="M1060 800 L1070 350 Q1080 270 1110 220 Q1100 270 1130 350 L1160 800 Z" fill="#1c130c"/>
        <!-- Bark -->
        <path d="M1085 500 Q1092 440 1088 390 Q1094 340 1086 290" stroke="#2a1e14" stroke-width="2" fill="none" opacity="0.5"/>
        <!-- Root -->
        <path d="M1060 800 Q1030 740 1010 720" stroke="#1c130c" stroke-width="16" fill="none"/>

        <!-- Canopy -->
        <path d="M960 320 Q1000 230 1090 200 Q1160 185 1220 220 Q1280 270 1260 340 Q1220 380 1130 390 Q1040 385 960 320 Z" fill="#0e1e0e"/>
        <path d="M980 280 Q1020 200 1100 180 Q1170 170 1230 200 Q1260 240 1240 300 Q1200 335 1120 340 Q1050 335 980 280 Z" fill="#122212"/>
        <path d="M1000 250 Q1040 185 1105 170 Q1160 162 1210 185 Q1235 215 1220 260 Q1190 290 1115 295 Q1055 290 1000 250 Z" fill="#152815"/>
      </g>

      <!-- Moss on rocks -->
      <g opacity="0.4">
        <ellipse cx="300" cy="580" rx="40" ry="15" fill="#1a3a18"/>
        <ellipse cx="850" cy="570" rx="35" ry="12" fill="#1a3a18"/>
      </g>

      <!-- Mushrooms — bioluminescent -->
      <g class="mushrooms">
        <g>
          <rect x="278" y="555" width="4" height="12" fill="#5a4030" rx="1"/>
          <ellipse cx="280" cy="554" rx="10" ry="6" fill="#c4883a"/>
          <ellipse cx="280" cy="554" rx="8" ry="4" fill="#daa040"/>
          <circle cx="280" cy="555" r="12" fill="#daa040" opacity="0" filter="url(#soft-blur)">
            <animate attributeName="opacity" values="0;0.15;0" dur="3s" repeatCount="indefinite"/>
          </circle>
        </g>
        <g>
          <rect x="296" y="562" width="3" height="8" fill="#5a4030" rx="1"/>
          <ellipse cx="298" cy="562" rx="7" ry="4" fill="#b07828"/>
          <ellipse cx="298" cy="562" rx="5" ry="3" fill="#c88835"/>
        </g>
        <g>
          <rect x="265" y="558" width="3" height="10" fill="#5a4030" rx="1"/>
          <ellipse cx="267" cy="558" rx="8" ry="5" fill="#ba8035"/>
          <ellipse cx="267" cy="558" rx="6" ry="3.5" fill="#d09040"/>
        </g>
      </g>

      <!-- Fallen log with gear -->
      <g class="fallen-log" data-action="examine" data-target="trees">
        <!-- Log body -->
        <path d="M680 560 Q750 550 840 555 Q880 562 880 575 Q870 588 800 592 Q730 590 690 580 Q670 572 680 560 Z" fill="#302010"/>
        <path d="M685 562 Q750 554 835 558 Q872 564 870 574 Q862 584 798 588 Q734 586 695 577 Q678 570 685 562 Z" fill="#3d2817"/>
        <!-- Bark texture -->
        <path d="M710 560 Q760 556 810 560" stroke="#4a3520" stroke-width="0.8" fill="none" opacity="0.5"/>
        <path d="M720 570 Q770 567 820 572" stroke="#4a3520" stroke-width="0.8" fill="none" opacity="0.4"/>
        <!-- Hollow end -->
        <ellipse cx="685" cy="570" rx="15" ry="13" fill="#1a0f08"/>
        <ellipse cx="685" cy="570" rx="12" ry="10" fill="#120a05"/>

        ${
          hasGear
            ? `
        <!-- Gear in the hollow — partially visible -->
        <g data-action="pickup" data-target="gear1" class="interactive-item">
          <rect x="695" y="540" width="65" height="65" fill="transparent" class="hit-area"/>
          <!-- Gear shape -->
          <g transform="translate(725, 568)">
            <circle cx="0" cy="0" r="12" fill="#8a7352"/>
            <circle cx="0" cy="0" r="8" fill="#a08a60"/>
            <!-- Teeth -->
            <rect x="-2" y="-15" width="4" height="6" fill="#8a7352" rx="1"/>
            <rect x="-2" y="9" width="4" height="6" fill="#8a7352" rx="1"/>
            <rect x="-15" y="-2" width="6" height="4" fill="#8a7352" rx="1"/>
            <rect x="9" y="-2" width="6" height="4" fill="#8a7352" rx="1"/>
            <!-- Diagonal teeth -->
            <rect x="7" y="-12" width="4" height="5" fill="#8a7352" rx="1" transform="rotate(45,9,-9.5)"/>
            <rect x="-11" y="7" width="4" height="5" fill="#8a7352" rx="1" transform="rotate(45,-9,9.5)"/>
            <rect x="-11" y="-12" width="4" height="5" fill="#8a7352" rx="1" transform="rotate(-45,-9,-9.5)"/>
            <rect x="7" y="7" width="4" height="5" fill="#8a7352" rx="1" transform="rotate(-45,9,9.5)"/>
            <!-- Center hole -->
            <circle cx="0" cy="0" r="3.5" fill="#4a3a28"/>
          </g>
          <!-- Glint -->
          <circle cx="722" cy="562" r="2.5" fill="#ffd700" opacity="0.9">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite"/>
          </circle>
          <circle cx="725" cy="568" r="16" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0">
            <animate attributeName="opacity" values="0;0.35;0" dur="2.5s" repeatCount="indefinite"/>
            <animate attributeName="r" values="16;28;16" dur="2.5s" repeatCount="indefinite"/>
          </circle>
        </g>
        `
            : ""
        }
      </g>

      <!-- Ferns — both sides of path -->
      <g opacity="0.6">
        <!-- Left fern cluster -->
        <path d="M200 600 Q215 565 205 530" stroke="#2a4a28" stroke-width="2.5" fill="none"/>
        <path d="M205 575 Q185 560 170 568" stroke="#2a4a28" stroke-width="1.5" fill="none"/>
        <path d="M207 555 Q225 542 240 550" stroke="#2a4a28" stroke-width="1.5" fill="none"/>
        <path d="M206 545 Q188 533 175 540" stroke="#2a4a28" stroke-width="1.5" fill="none"/>
        <!-- Right fern cluster -->
        <path d="M880 590 Q895 555 885 520" stroke="#304e2e" stroke-width="2.5" fill="none"/>
        <path d="M887 565 Q870 550 858 558" stroke="#304e2e" stroke-width="1.5" fill="none"/>
        <path d="M888 545 Q905 532 918 540" stroke="#304e2e" stroke-width="1.5" fill="none"/>
      </g>

      <!-- Ivy on left trunk -->
      <g opacity="0.35">
        <path d="M55 500 Q40 490 35 480 Q30 470 38 460" stroke="#2a4a2a" stroke-width="2" fill="none"/>
        <path d="M60 460 Q48 450 42 440 Q38 430 45 420" stroke="#2a4a2a" stroke-width="1.5" fill="none"/>
        <ellipse cx="35" cy="478" rx="6" ry="4" fill="#1e3a1e"/>
        <ellipse cx="42" cy="458" rx="5" ry="3" fill="#1e3a1e"/>
        <ellipse cx="45" cy="438" rx="5" ry="3.5" fill="#1e3a1e"/>
      </g>

      <!-- Fireflies — glowing particles -->
      <g class="fireflies" style="pointer-events:none">
        <circle cx="380" cy="380" r="2" fill="#e8e0a0">
          <animate attributeName="cy" values="380;360;380" dur="4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.2;0.9;0.2" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="380" cy="380" r="6" fill="#e8e0a0" filter="url(#soft-blur)">
          <animate attributeName="cy" values="380;360;380" dur="4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;0.25;0" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="620" cy="340" r="2" fill="#e8e0a0">
          <animate attributeName="cy" values="340;318;340" dur="5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite"/>
        </circle>
        <circle cx="620" cy="340" r="6" fill="#e8e0a0" filter="url(#soft-blur)">
          <animate attributeName="cy" values="340;318;340" dur="5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;0.3;0" dur="3s" repeatCount="indefinite"/>
        </circle>
        <circle cx="500" cy="460" r="1.5" fill="#e8e0a0">
          <animate attributeName="cy" values="460;440;460" dur="3.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.1;0.7;0.1" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="780" cy="420" r="1.8" fill="#e8e0a0">
          <animate attributeName="cy" values="420;400;420" dur="4.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.2;0.8;0.2" dur="3.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="250" cy="480" r="1.5" fill="#e8e0a0">
          <animate attributeName="cy" values="480;465;480" dur="3s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.15;0.6;0.15" dur="2.8s" repeatCount="indefinite"/>
        </circle>
      </g>
    </svg>
    `;
  }

  svgClearing(): string {
    const hasJournal = !this.gameState.inventory.includes("journal_page1");

    return `
    <svg viewBox="0 180 1200 500" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <linearGradient id="sky-clearing" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0e1a"/>
          <stop offset="40%" style="stop-color:#111b33"/>
          <stop offset="100%" style="stop-color:#1a2d4d"/>
        </linearGradient>
        <linearGradient id="clearing-grass" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#1a3018"/>
          <stop offset="100%" style="stop-color:#0e1a0c"/>
        </linearGradient>
        <radialGradient id="moonlight-pool" cx="50%" cy="40%" r="50%">
          <stop offset="0%" style="stop-color:#b8c8ff;stop-opacity:0.08"/>
          <stop offset="60%" style="stop-color:#8898cc;stop-opacity:0.03"/>
          <stop offset="100%" style="stop-color:#8898cc;stop-opacity:0"/>
        </radialGradient>
        <radialGradient id="stone-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#8888aa;stop-opacity:0.15"/>
          <stop offset="100%" style="stop-color:#8888aa;stop-opacity:0"/>
        </radialGradient>
        <filter id="clearing-mist">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5"/>
        </filter>
      </defs>

      <!-- Sky -->
      <rect fill="url(#sky-clearing)" width="1200" height="800"/>

      <!-- Stars — fixed -->
      <g opacity="0.9">
        <circle cx="300" cy="50" r="1.4" fill="#fffacd" opacity="0.65"/>
        <circle cx="420" cy="30" r="1.0" fill="#fffacd" opacity="0.5"/>
        <circle cx="550" cy="65" r="1.6" fill="#fffacd" opacity="0.7"/>
        <circle cx="680" cy="40" r="1.2" fill="#fffacd" opacity="0.55"/>
        <circle cx="800" cy="55" r="1.3" fill="#fffacd" opacity="0.6"/>
        <circle cx="350" cy="100" r="0.9" fill="#fffacd" opacity="0.4"/>
        <circle cx="500" cy="120" r="1.1" fill="#fffacd" opacity="0.5"/>
        <circle cx="650" cy="95" r="1.5" fill="#fffacd" opacity="0.7"/>
        <circle cx="750" cy="115" r="0.8" fill="#fffacd" opacity="0.4"/>
        <circle cx="450" cy="155" r="1.3" fill="#fffacd" opacity="0.55"/>
        <circle cx="600" cy="140" r="1.0" fill="#fffacd" opacity="0.45"/>
        <!-- Twinkling -->
        <circle cx="380" cy="75" r="1.2" fill="#fffacd">
          <animate attributeName="opacity" values="0.3;0.9;0.3" dur="4s" repeatCount="indefinite"/>
        </circle>
        <circle cx="720" cy="70" r="1.4" fill="#fffacd">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite"/>
        </circle>
      </g>

      <!-- Moonlight pool on clearing -->
      <ellipse cx="600" cy="400" rx="380" ry="250" fill="url(#moonlight-pool)"/>

      <!-- Surrounding forest — dense walls -->
      <g class="forest-edge">
        <!-- Left forest wall -->
        <rect x="0" y="0" width="220" height="800" fill="#080e08"/>
        <!-- Left treeline edge -->
        <path d="M220 800 L220 350 Q190 300 220 250 Q200 180 220 120 Q210 60 220 0" fill="#0a140a"/>
        <path d="M180 420 Q220 340 260 420" fill="#0e1e0e"/>
        <path d="M140 460 Q200 340 260 460" fill="#0c1a0c"/>
        <path d="M200 380 Q240 280 280 380" fill="#0d1c0d"/>
        <path d="M160 500 Q210 400 260 500" fill="#0e1e0e"/>

        <!-- Right forest wall -->
        <rect x="980" y="0" width="220" height="800" fill="#080e08"/>
        <path d="M980 800 L980 350 Q1010 300 980 250 Q1000 180 980 120 Q990 60 980 0" fill="#0a140a"/>
        <path d="M940 420 Q980 340 1020 420" fill="#0e1e0e"/>
        <path d="M960 460 Q1010 340 1060 460" fill="#0c1a0c"/>
        <path d="M920 380 Q960 280 1000 380" fill="#0d1c0d"/>
        <path d="M950 500 Q1000 400 1050 500" fill="#0e1e0e"/>

        <!-- Back forest wall -->
        <rect x="220" y="0" width="760" height="180" fill="#060c06"/>
        <path d="M220 180 Q400 220 600 180 Q800 220 980 180" fill="#080e08"/>
        <!-- Back treeline -->
        <polygon points="250,180 280,80 310,180" fill="#0a140a"/>
        <polygon points="330,180 365,60 400,180" fill="#0c180c"/>
        <polygon points="430,180 470,70 510,180" fill="#0a140a"/>
        <polygon points="540,180 580,50 620,180" fill="#0b160b"/>
        <polygon points="650,180 690,65 730,180" fill="#0c180c"/>
        <polygon points="760,180 800,75 840,180" fill="#0a140a"/>
        <polygon points="870,180 910,55 950,180" fill="#0b160b"/>
      </g>

      <!-- Ground — grassy clearing -->
      <path d="M220 500 Q400 480 600 500 Q800 520 980 500 L980 800 L220 800 Z" fill="url(#clearing-grass)"/>

      <!-- Path to lighthouse (east) — visible gap in trees -->
      <path d="M850 540 Q920 530 980 540" stroke="#3a3a2a" stroke-width="45" fill="none" opacity="0.6" stroke-linecap="round"/>

      <!-- Path back to forest (south) -->
      <path d="M580 620 Q575 700 590 800" stroke="#3a3a2a" stroke-width="50" fill="none" opacity="0.55" stroke-linecap="round"/>

      <!-- Subtle glow around stone circle -->
      <ellipse cx="590" cy="430" rx="200" ry="120" fill="url(#stone-glow)"/>

      <!-- Stone circle -->
      <g class="stone-circle">
        <!-- Stone 1 (North) — tallest, with gear carving -->
        <g data-action="examine" data-target="stones" class="standing-stone">
          <path d="M565 250 Q555 340 550 390 L640 390 Q635 340 625 250 Q595 230 565 250 Z" fill="#4a4a5a"/>
          <path d="M568 255 Q560 335 555 385 L635 385 Q630 335 622 255 Q595 238 568 255 Z" fill="#555568"/>
          <!-- Weathering -->
          <path d="M575 290 Q595 285 615 292" stroke="#3a3a48" stroke-width="1.5" fill="none"/>
          <path d="M572 330 Q590 325 612 332" stroke="#3a3a48" stroke-width="1" fill="none"/>
          <!-- Carved gear symbol — glowing faintly -->
          <circle cx="595" cy="320" r="16" fill="none" stroke="#7878a0" stroke-width="2"/>
          <circle cx="595" cy="320" r="9" fill="none" stroke="#7878a0" stroke-width="1.5"/>
          <!-- Gear teeth -->
          <rect x="593" y="301" width="4" height="5" fill="#7878a0" opacity="0.6"/>
          <rect x="593" y="333" width="4" height="5" fill="#7878a0" opacity="0.6"/>
          <rect x="576" y="318" width="5" height="4" fill="#7878a0" opacity="0.6"/>
          <rect x="609" y="318" width="5" height="4" fill="#7878a0" opacity="0.6"/>
        </g>

        <!-- Stone 2 (East) — star carving -->
        <g class="standing-stone">
          <path d="M780 340 Q772 410 768 470 L838 470 Q834 410 826 340 Q803 325 780 340 Z" fill="#484858"/>
          <path d="M783 345 Q776 408 773 465 L833 465 Q829 408 823 345 Q803 332 783 345 Z" fill="#525264"/>
          <!-- Star carving -->
          <polygon points="803,390 808,405 823,405 811,413 816,428 803,420 790,428 795,413 783,405 798,405"
                   fill="none" stroke="#7878a0" stroke-width="1.5"/>
        </g>

        <!-- Stone 3 (West) — wave carving -->
        <g class="standing-stone">
          <path d="M345 360 Q338 425 334 480 L408 480 Q404 425 397 360 Q371 345 345 360 Z" fill="#484858"/>
          <path d="M348 365 Q342 423 338 475 L404 475 Q400 423 394 365 Q371 352 348 365 Z" fill="#525264"/>
          <!-- Wave carving -->
          <path d="M358 420 Q371 408 384 420 Q397 432 384 420" stroke="#7878a0" stroke-width="2" fill="none"/>
          <path d="M362 435 Q372 425 382 435" stroke="#7878a0" stroke-width="1.5" fill="none"/>
        </g>

        <!-- Stone 4 (South-East) — lighthouse carving -->
        <g class="standing-stone">
          <path d="M720 460 Q715 510 712 550 L772 550 Q769 510 764 460 Q742 448 720 460 Z" fill="#4e4e60"/>
          <path d="M723 464 Q718 508 716 546 L768 546 Q765 508 761 464 Q742 454 723 464 Z" fill="#585870"/>
          <!-- Lighthouse carving -->
          <rect x="736" y="490" width="12" height="28" fill="none" stroke="#7878a0" stroke-width="1.5"/>
          <polygon points="736,490 742,482 748,490" fill="none" stroke="#7878a0" stroke-width="1"/>
          <circle cx="742" cy="488" r="2" fill="#7878a0" opacity="0.5"/>
        </g>

        <!-- Stone 5 (South-West) — "IV" carving -->
        <g class="standing-stone">
          <path d="M410 470 Q405 520 402 560 L468 560 Q465 520 460 470 Q435 458 410 470 Z" fill="#4e4e60"/>
          <path d="M413 474 Q409 518 406 556 L464 556 Q461 518 457 474 Q435 464 413 474 Z" fill="#585870"/>
          <text x="435" y="525" fill="#7878a0" font-size="22" text-anchor="middle" font-family="serif" opacity="0.7">IV</text>
        </g>

        <!-- Center altar stone — flat and worn -->
        <path d="M540 410 Q560 397 600 395 Q640 397 660 410 Q665 423 650 433 Q620 440 580 440 Q550 437 535 425 Q530 417 540 410 Z" fill="#3a3a4a"/>
        <path d="M545 412 Q563 401 600 399 Q637 401 655 412 Q658 421 648 429 Q620 435 582 435 Q555 433 542 423 Q538 417 545 412 Z" fill="#444458"/>

        ${
          hasJournal
            ? `
        <!-- Journal page on altar — weathered parchment -->
        <g data-action="pickup" data-target="journal_page1" class="interactive-item">
          <rect x="565" y="385" width="70" height="55" fill="transparent" class="hit-area"/>
          <!-- Parchment -->
          <g transform="rotate(-5, 600, 408)">
            <rect x="578" y="395" width="44" height="32" fill="#c8b890" rx="1"/>
            <rect x="580" y="397" width="40" height="28" fill="#d4c4a0" rx="1"/>
            <!-- Text lines -->
            <line x1="584" y1="405" x2="614" y2="405" stroke="#6a6a5a" stroke-width="0.8"/>
            <line x1="584" y1="411" x2="616" y2="411" stroke="#6a6a5a" stroke-width="0.8"/>
            <line x1="584" y1="417" x2="610" y2="417" stroke="#6a6a5a" stroke-width="0.8"/>
          </g>
          <!-- Glow -->
          <circle cx="600" cy="408" r="22" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0">
            <animate attributeName="opacity" values="0;0.35;0" dur="2.5s" repeatCount="indefinite"/>
            <animate attributeName="r" values="22;36;22" dur="2.5s" repeatCount="indefinite"/>
          </circle>
        </g>
        `
            : ""
        }
      </g>

      <!-- Ground mist around stones -->
      <g filter="url(#clearing-mist)" opacity="0.12" style="pointer-events:none">
        <ellipse cx="590" cy="430" rx="250" ry="40" fill="#8888bb"/>
      </g>

      <!-- Wisps/energy — mystical particles around stones -->
      <g class="wisps" style="pointer-events:none">
        <circle cx="580" cy="360" r="2.5" fill="#a0b8e0" opacity="0.5">
          <animate attributeName="cy" values="360;340;360" dur="5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.2;0.6;0.2" dur="3s" repeatCount="indefinite"/>
        </circle>
        <circle cx="640" cy="380" r="2" fill="#a0b8e0" opacity="0.4">
          <animate attributeName="cy" values="380;360;380" dur="6s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.15;0.5;0.15" dur="4s" repeatCount="indefinite"/>
        </circle>
        <circle cx="520" cy="400" r="1.8" fill="#a0b8e0" opacity="0.3">
          <animate attributeName="cy" values="400;385;400" dur="4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.1;0.45;0.1" dur="3.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="700" cy="370" r="1.5" fill="#a0b8e0" opacity="0.35">
          <animate attributeName="cy" values="370;352;370" dur="5.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.2;0.55;0.2" dur="4.5s" repeatCount="indefinite"/>
        </circle>
      </g>

      <!-- Scattered leaves -->
      <g opacity="0.4">
        <ellipse cx="450" cy="530" rx="6" ry="3" fill="#4a3a2a" transform="rotate(30,450,530)"/>
        <ellipse cx="700" cy="520" rx="5" ry="2.5" fill="#5a4a3a" transform="rotate(-20,700,520)"/>
        <ellipse cx="550" cy="545" rx="5" ry="2.5" fill="#3a2a1a" transform="rotate(45,550,545)"/>
        <ellipse cx="650" cy="540" rx="4" ry="2" fill="#4a3a2a" transform="rotate(-35,650,540)"/>
      </g>
    </svg>
    `;
  }

  svgLighthouseBase(): string {
    const gearsPlaced = this.gameState.flags.gearsPlaced;
    const doorOpen = this.gameState.flags.lighthouseDoorOpen;
    const hasGear2 =
      !this.gameState.inventory.includes("gear2") && !doorOpen;

    const gearSVG = (cx: number, cy: number, r: number): string => `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#8a7352"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.65}" fill="#a08a60"/>
      <rect x="${cx - 2}" y="${cy - r - 3}" width="4" height="5" fill="#8a7352" rx="1"/>
      <rect x="${cx - 2}" y="${cy + r - 2}" width="4" height="5" fill="#8a7352" rx="1"/>
      <rect x="${cx - r - 3}" y="${cy - 2}" width="5" height="4" fill="#8a7352" rx="1"/>
      <rect x="${cx + r - 2}" y="${cy - 2}" width="5" height="4" fill="#8a7352" rx="1"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.25}" fill="#5a4a30"/>
    `;

    return `
    <svg viewBox="0 180 1200 500" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <linearGradient id="sky-lh" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0e1a"/>
          <stop offset="40%" style="stop-color:#111b33"/>
          <stop offset="100%" style="stop-color:#1e3050"/>
        </linearGradient>
        <linearGradient id="tower-body" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#4a4a58"/>
          <stop offset="35%" style="stop-color:#626272"/>
          <stop offset="65%" style="stop-color:#626272"/>
          <stop offset="100%" style="stop-color:#4a4a58"/>
        </linearGradient>
        <linearGradient id="rocky-ground" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#38384a"/>
          <stop offset="100%" style="stop-color:#282838"/>
        </linearGradient>
        <radialGradient id="lh-moon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#fffacd;stop-opacity:0.4"/>
          <stop offset="50%" style="stop-color:#fffacd;stop-opacity:0.1"/>
          <stop offset="100%" style="stop-color:#fffacd;stop-opacity:0"/>
        </radialGradient>
        <filter id="lh-glow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3"/>
        </filter>
      </defs>

      <!-- Sky -->
      <rect fill="url(#sky-lh)" width="1200" height="800"/>

      <!-- Stars -->
      <g opacity="0.9">
        <circle cx="100" cy="60" r="1.2" fill="#fffacd" opacity="0.6"/>
        <circle cx="300" cy="40" r="1.0" fill="#fffacd" opacity="0.5"/>
        <circle cx="50" cy="120" r="0.8" fill="#fffacd" opacity="0.4"/>
        <circle cx="900" cy="50" r="1.4" fill="#fffacd" opacity="0.65"/>
        <circle cx="1000" cy="90" r="1.0" fill="#fffacd" opacity="0.5"/>
        <circle cx="1100" cy="60" r="1.3" fill="#fffacd" opacity="0.55"/>
        <circle cx="150" cy="180" r="0.9" fill="#fffacd" opacity="0.4"/>
        <circle cx="350" cy="150" r="1.1" fill="#fffacd" opacity="0.5"/>
        <circle cx="850" cy="130" r="1.2" fill="#fffacd" opacity="0.45"/>
        <circle cx="1050" cy="150" r="0.8" fill="#fffacd" opacity="0.35"/>
        <circle cx="220" cy="90" r="1.5" fill="#fffacd">
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite"/>
        </circle>
      </g>

      <!-- Moon -->
      <circle cx="180" cy="95" r="60" fill="url(#lh-moon-glow)"/>
      <circle cx="180" cy="95" r="28" fill="#f5edc0"/>
      <circle cx="172" cy="88" r="4" fill="#d8cc90" opacity="0.4"/>
      <circle cx="188" cy="102" r="3" fill="#d8cc90" opacity="0.3"/>

      <!-- Distant ocean -->
      <path d="M0 460 Q300 450 600 465 Q900 480 1200 460 L1200 520 L0 520 Z" fill="#142840" opacity="0.6"/>

      <!-- Rocky cliff ground -->
      <path d="M0 500 Q200 485 400 510 Q600 495 800 520 Q1000 500 1200 510 L1200 800 L0 800 Z" fill="url(#rocky-ground)"/>
      <!-- Ground texture -->
      <g opacity="0.1" stroke="#5a5a6a" stroke-width="0.8" fill="none">
        <path d="M100 560 Q250 555 400 565"/>
        <path d="M500 550 Q700 545 900 555"/>
        <path d="M50 600 Q200 595 400 605"/>
      </g>

      <!-- Lighthouse tower -->
      <g class="lighthouse-tower">
        <!-- Tower body — slight taper -->
        <path d="M480 520 L498 90 L702 90 L720 520 Z" fill="url(#tower-body)"/>

        <!-- Red stripes — worn paint -->
        <path d="M488 140 L492 180 L708 180 L712 140 Z" fill="#a82030" opacity="0.85"/>
        <path d="M492 240 L496 280 L704 280 L708 240 Z" fill="#a82030" opacity="0.8"/>
        <path d="M496 340 L500 380 L700 380 L704 340 Z" fill="#a82030" opacity="0.75"/>
        <path d="M500 430 L502 460 L698 460 L700 430 Z" fill="#a82030" opacity="0.7"/>

        <!-- Window -->
        <rect x="585" y="200" width="30" height="22" fill="#1a2a3a" rx="3"/>
        <rect x="588" y="203" width="24" height="16" fill="#2a4a6a" opacity="0.5" rx="2"/>

        <!-- Lantern room -->
        <rect x="500" y="65" width="200" height="35" fill="#282838"/>
        <!-- Glass panes -->
        <rect x="508" y="68" width="42" height="28" fill="#2a4a6a" opacity="0.5"/>
        <rect x="554" y="68" width="42" height="28" fill="#2a4a6a" opacity="0.5"/>
        <rect x="600" y="68" width="42" height="28" fill="#2a4a6a" opacity="0.5"/>
        <rect x="646" y="68" width="42" height="28" fill="#2a4a6a" opacity="0.5"/>
        <!-- Railing/gallery -->
        <rect x="495" y="58" width="210" height="10" fill="#3a3a48"/>

        <!-- Dome -->
        <path d="M505 58 Q600 20 695 58" fill="#3a3a48"/>
        <path d="M520 58 Q600 30 680 58" fill="#444458"/>

        <!-- Lightning rod -->
        <line x1="600" y1="20" x2="600" y2="5" stroke="#5a5a6a" stroke-width="2"/>

        <!-- Light beam -->
        <polygon points="600,78 120,0 200,0 600,68 1000,0 1080,0" fill="#ffd700" opacity="0.08">
          <animate attributeName="opacity" values="0.05;0.12;0.05" dur="3s" repeatCount="indefinite"/>
        </polygon>
        <circle cx="600" cy="78" r="8" fill="#ffd700" opacity="0.5" filter="url(#lh-glow)">
          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite"/>
        </circle>

        <!-- Door area -->
        <rect x="555" y="420" width="90" height="110" fill="#1e1e2a" rx="45" ry="45"/>

        ${
          doorOpen
            ? `
        <!-- Open door — dark interior with spiral stairs -->
        <path d="M560 425 L560 530 L605 530 L605 425 Q582 400 560 425" fill="#0a0a14"/>
        <rect x="562" y="435" width="40" height="95" fill="#060610"/>
        <!-- Spiral stairs hint -->
        <line x1="565" y1="465" x2="598" y2="465" stroke="#2a2a3a" stroke-width="2.5"/>
        <line x1="565" y1="485" x2="598" y2="485" stroke="#2a2a3a" stroke-width="2.5"/>
        <line x1="565" y1="505" x2="598" y2="505" stroke="#2a2a3a" stroke-width="2.5"/>
        <!-- Faint light from inside -->
        <rect x="564" y="437" width="36" height="90" fill="#1a1a3a" opacity="0.15"/>
        `
            : `
        <!-- Closed door — heavy wood with iron -->
        <rect x="562" y="430" width="76" height="98" fill="#3a2210" rx="38" ry="38"/>
        <rect x="568" y="436" width="64" height="88" fill="#2a180a" rx="32" ry="32"/>
        <!-- Iron bands -->
        <rect x="562" y="470" width="76" height="4" fill="#3a3a4a" rx="1"/>
        <rect x="562" y="500" width="76" height="4" fill="#3a3a4a" rx="1"/>
        <!-- Door ring -->
        <circle cx="615" cy="485" r="7" fill="none" stroke="#8a7a58" stroke-width="2.5"/>
        <circle cx="615" cy="478" r="2" fill="#8a7a58"/>
        `
        }

        <!-- Gear mechanism — 4 slots around door -->
        <g class="gear-mechanism" data-action="examine" data-target="gear_slots">
          <!-- Slot 1 (top-left) -->
          <g data-action="use" data-target="gear_slot" class="gear-slot ${gearsPlaced >= 1 ? "filled" : ""}">
            <circle cx="530" cy="445" r="22" fill="#1e1e2a" stroke="#3a3a4a" stroke-width="2.5"/>
            <circle cx="530" cy="445" r="18" fill="none" stroke="#3a3a4a" stroke-width="1" stroke-dasharray="4,3"/>
            ${gearsPlaced >= 1 ? gearSVG(530, 445, 15) : ""}
          </g>
          <!-- Slot 2 (top-right) -->
          <g class="gear-slot ${gearsPlaced >= 2 ? "filled" : ""}">
            <circle cx="670" cy="445" r="22" fill="#1e1e2a" stroke="#3a3a4a" stroke-width="2.5"/>
            <circle cx="670" cy="445" r="18" fill="none" stroke="#3a3a4a" stroke-width="1" stroke-dasharray="4,3"/>
            ${gearsPlaced >= 2 ? gearSVG(670, 445, 15) : ""}
          </g>
          <!-- Slot 3 (bottom-left) -->
          <g class="gear-slot ${gearsPlaced >= 3 ? "filled" : ""}">
            <circle cx="530" cy="520" r="22" fill="#1e1e2a" stroke="#3a3a4a" stroke-width="2.5"/>
            <circle cx="530" cy="520" r="18" fill="none" stroke="#3a3a4a" stroke-width="1" stroke-dasharray="4,3"/>
            ${gearsPlaced >= 3 ? gearSVG(530, 520, 15) : ""}
          </g>
          <!-- Slot 4 (bottom-right) -->
          <g class="gear-slot ${gearsPlaced >= 4 ? "filled" : ""}">
            <circle cx="670" cy="520" r="22" fill="#1e1e2a" stroke="#3a3a4a" stroke-width="2.5"/>
            <circle cx="670" cy="520" r="18" fill="none" stroke="#3a3a4a" stroke-width="1" stroke-dasharray="4,3"/>
            ${gearsPlaced >= 4 ? gearSVG(670, 520, 15) : ""}
          </g>
        </g>
      </g>

      <!-- Rocks around base — shaped, not ellipses -->
      <g class="base-rocks">
        <path d="M300 570 Q330 540 370 535 Q410 540 430 565 Q425 585 390 590 Q340 588 300 570 Z" fill="#3e3e4e"/>
        <path d="M305 568 Q335 545 368 540 Q405 544 422 562 Q418 578 388 582 Q345 580 305 568 Z" fill="#484860"/>
        <path d="M810 580 Q850 548 900 545 Q940 550 960 575 Q952 595 910 600 Q855 596 810 580 Z" fill="#3a3a4a"/>
        <path d="M815 578 Q852 552 898 550 Q935 554 952 572 Q946 588 908 592 Q858 590 815 578 Z" fill="#444458"/>
        <path d="M200 610 Q240 585 290 582 Q330 588 345 610 Q338 628 300 632 Q235 628 200 610 Z" fill="#424254"/>
        <path d="M920 615 Q958 592 1000 590 Q1035 596 1048 615 Q1040 630 1005 634 Q950 630 920 615 Z" fill="#3e3e50"/>

        ${
          hasGear2
            ? `
        <!-- Gear wedged between rocks -->
        <g data-action="pickup" data-target="gear2" class="interactive-item">
          <rect x="335" y="555" width="55" height="55" fill="transparent" class="hit-area"/>
          <g transform="translate(362, 575)">
            <circle cx="0" cy="0" r="13" fill="#7a6a4a"/>
            <circle cx="0" cy="0" r="9" fill="#8b7b58"/>
            <rect x="-2" y="-16" width="4" height="5" fill="#7a6a4a" rx="1"/>
            <rect x="-2" y="11" width="4" height="5" fill="#7a6a4a" rx="1"/>
            <rect x="-16" y="-2" width="5" height="4" fill="#7a6a4a" rx="1"/>
            <rect x="11" y="-2" width="5" height="4" fill="#7a6a4a" rx="1"/>
            <circle cx="0" cy="0" r="3.5" fill="#5a4a30"/>
          </g>
          <circle cx="360" cy="570" r="2.5" fill="#ffd700" opacity="0.9">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite"/>
          </circle>
          <circle cx="362" cy="575" r="18" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0">
            <animate attributeName="opacity" values="0;0.35;0" dur="2.5s" repeatCount="indefinite"/>
            <animate attributeName="r" values="18;30;18" dur="2.5s" repeatCount="indefinite"/>
          </circle>
        </g>
        `
            : ""
        }
      </g>

      <!-- Path back west -->
      <path d="M0 580 Q120 565 280 585" stroke="#3a3a2a" stroke-width="50" fill="none" opacity="0.55" stroke-linecap="round"/>

      <!-- Examine door hotspot -->
      <rect x="555" y="420" width="90" height="110" fill="transparent"
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
      <line x1="600" y1="380"
            x2="${600 + Math.cos((angle * Math.PI) / 180) * 250}"
            y2="${380 + Math.sin((angle * Math.PI) / 180) * 250}"
            stroke="#ffd700" stroke-width="1.5" opacity="0.22">
        <animate attributeName="opacity" values="0.1;0.2;0.1" dur="${2 + (angle % 3)}s" repeatCount="indefinite"/>
      </line>
    `,
      )
      .join("");

    return `
    <svg viewBox="0 180 1200 500" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <linearGradient id="sky-top" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#060a14"/>
          <stop offset="100%" style="stop-color:#142440"/>
        </linearGradient>
        <radialGradient id="fresnel-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#fffacd;stop-opacity:0.9"/>
          <stop offset="30%" style="stop-color:#ffd700;stop-opacity:0.5"/>
          <stop offset="70%" style="stop-color:#ffd700;stop-opacity:0.15"/>
          <stop offset="100%" style="stop-color:#ffd700;stop-opacity:0"/>
        </radialGradient>
        <linearGradient id="glass-pane" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#3a6a8a;stop-opacity:0.25"/>
          <stop offset="100%" style="stop-color:#2a4a6a;stop-opacity:0.15"/>
        </linearGradient>
        <filter id="lens-blur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4"/>
        </filter>
      </defs>

      <!-- Night sky through windows -->
      <rect fill="url(#sky-top)" width="1200" height="800"/>

      <!-- Stars — fixed -->
      <g opacity="0.8">
        <circle cx="100" cy="140" r="1.0" fill="#fffacd" opacity="0.5"/>
        <circle cx="200" cy="200" r="0.8" fill="#fffacd" opacity="0.4"/>
        <circle cx="380" cy="160" r="1.3" fill="#fffacd" opacity="0.6"/>
        <circle cx="500" cy="130" r="0.9" fill="#fffacd" opacity="0.45"/>
        <circle cx="700" cy="150" r="1.2" fill="#fffacd" opacity="0.55"/>
        <circle cx="850" cy="180" r="1.0" fill="#fffacd" opacity="0.5"/>
        <circle cx="1000" cy="140" r="1.4" fill="#fffacd" opacity="0.6"/>
        <circle cx="1100" cy="200" r="0.8" fill="#fffacd" opacity="0.4"/>
        <circle cx="150" cy="280" r="1.1" fill="#fffacd" opacity="0.5"/>
        <circle cx="450" cy="250" r="0.7" fill="#fffacd" opacity="0.35"/>
        <circle cx="750" cy="260" r="1.0" fill="#fffacd" opacity="0.45"/>
        <circle cx="1050" cy="270" r="0.9" fill="#fffacd" opacity="0.4"/>
      </g>

      <!-- Distant view through glass -->
      <g class="island-view" opacity="0.6">
        <!-- Horizon ocean -->
        <rect y="420" fill="#0c1e30" width="1200" height="180" opacity="0.5"/>
        <!-- Distant cliffs -->
        <path d="M880 420 Q900 380 930 395 Q950 370 970 345 Q990 360 1010 380 Q1030 365 1060 390 Q1080 410 1100 420"
              fill="#1e2e3e" opacity="0.8"/>
        <path d="M880 420 Q900 385 925 398 Q945 375 965 352 Q985 365 1005 383 Q1025 370 1055 392 Q1075 412 1100 420"
              fill="#243848" opacity="0.6"/>

        ${
          solved
            ? `
        <!-- Illuminated writing on cliffs -->
        <g>
          <text x="990" y="388" fill="#ffd700" font-size="12" font-family="serif" opacity="0.85" letter-spacing="1">TIDE REVEALS</text>
          <text x="1000" y="405" fill="#ffd700" font-size="12" font-family="serif" opacity="0.85" letter-spacing="1">THE CAVE</text>
          <!-- Glow around text -->
          <rect x="980" y="374" width="120" height="40" fill="#ffd700" opacity="0.05" filter="url(#lens-blur)" rx="4"/>
        </g>
        `
            : ""
        }

        <!-- Forest treeline -->
        <path d="M0 450 Q150 435 300 450 Q450 435 600 450 Q750 435 850 450 L850 470 L0 470 Z" fill="#0a150a" opacity="0.5"/>
      </g>

      <!-- Lantern room structure — iron frame with glass -->
      <g class="lantern-room">
        <!-- Outer frame -->
        <rect x="50" y="80" width="1100" height="510" fill="none" stroke="#2e2e3e" stroke-width="18" rx="4"/>

        <!-- Vertical mullions -->
        <line x1="300" y1="80" x2="300" y2="590" stroke="#2e2e3e" stroke-width="8"/>
        <line x1="600" y1="80" x2="600" y2="590" stroke="#2e2e3e" stroke-width="8"/>
        <line x1="900" y1="80" x2="900" y2="590" stroke="#2e2e3e" stroke-width="8"/>
        <!-- Horizontal bar -->
        <line x1="50" y1="340" x2="1150" y2="340" stroke="#2e2e3e" stroke-width="8"/>

        <!-- Glass panes -->
        <rect x="62" y="92" width="232" height="242" fill="url(#glass-pane)"/>
        <rect x="308" y="92" width="286" height="242" fill="url(#glass-pane)"/>
        <rect x="608" y="92" width="286" height="242" fill="url(#glass-pane)"/>
        <rect x="908" y="92" width="232" height="242" fill="url(#glass-pane)"/>
        <rect x="62" y="348" width="232" height="236" fill="url(#glass-pane)"/>
        <rect x="308" y="348" width="286" height="236" fill="url(#glass-pane)"/>
        <rect x="608" y="348" width="286" height="236" fill="url(#glass-pane)"/>
        <rect x="908" y="348" width="232" height="236" fill="url(#glass-pane)"/>
      </g>

      <!-- Central Fresnel lens assembly — clickable for puzzle -->
      <g class="lens-assembly" data-action="puzzle" data-target="mirrors">
        <!-- Outer glow -->
        <circle cx="600" cy="380" r="100" fill="url(#fresnel-glow)" filter="url(#lens-blur)" opacity="0.4">
          <animate attributeName="opacity" values="0.3;0.5;0.3" dur="4s" repeatCount="indefinite"/>
        </circle>

        <!-- Lens housing -->
        <circle cx="600" cy="380" r="85" fill="#1a1a2a" stroke="#3a3a4a" stroke-width="4"/>

        <!-- Fresnel rings -->
        <circle cx="600" cy="380" r="72" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0.5"/>
        <circle cx="600" cy="380" r="58" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0.45"/>
        <circle cx="600" cy="380" r="44" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0.4"/>
        <circle cx="600" cy="380" r="30" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0.35"/>
        <!-- Bright center -->
        <circle cx="600" cy="380" r="18" fill="#fffacd" opacity="0.8"/>
        <circle cx="600" cy="380" r="12" fill="#fffff0"/>

        <!-- Subtle light rays -->
        <g class="light-rays">
          ${lightRays}
        </g>

        <!-- Mirror mounts — 4 positions -->
        <g class="mirrors" data-action="examine" data-target="mirrors">
          <!-- Mirror 1 (top) -->
          <g class="mirror-mount">
            <circle cx="600" cy="200" r="25" fill="#2a2a38" stroke="#4a4a5a" stroke-width="3"/>
            <rect x="583" y="196" width="34" height="8" fill="#6a9aba" rx="2"
                  transform="rotate(${mirrorAngles[0]}, 600, 200)"/>
            <circle cx="600" cy="200" r="4" fill="#3a3a4a"/>
          </g>
          <!-- Mirror 2 (right) -->
          <g class="mirror-mount">
            <circle cx="800" cy="380" r="25" fill="#2a2a38" stroke="#4a4a5a" stroke-width="3"/>
            <rect x="783" y="376" width="34" height="8" fill="#6a9aba" rx="2"
                  transform="rotate(${mirrorAngles[1]}, 800, 380)"/>
            <circle cx="800" cy="380" r="4" fill="#3a3a4a"/>
          </g>
          <!-- Mirror 3 (bottom) -->
          <g class="mirror-mount">
            <circle cx="600" cy="560" r="25" fill="#2a2a38" stroke="#4a4a5a" stroke-width="3"/>
            <rect x="583" y="556" width="34" height="8" fill="#6a9aba" rx="2"
                  transform="rotate(${mirrorAngles[2]}, 600, 560)"/>
            <circle cx="600" cy="560" r="4" fill="#3a3a4a"/>
          </g>
          <!-- Mirror 4 (left) -->
          <g class="mirror-mount">
            <circle cx="400" cy="380" r="25" fill="#2a2a38" stroke="#4a4a5a" stroke-width="3"/>
            <rect x="383" y="376" width="34" height="8" fill="#6a9aba" rx="2"
                  transform="rotate(${mirrorAngles[3]}, 400, 380)"/>
            <circle cx="400" cy="380" r="4" fill="#3a3a4a"/>
          </g>
        </g>

        ${
          solved
            ? `
        <!-- Solved: bright directed beam -->
        <line x1="600" y1="380" x2="600" y2="200" stroke="#ffd700" stroke-width="6" opacity="0.7">
          <animate attributeName="opacity" values="0.5;0.8;0.5" dur="2s" repeatCount="indefinite"/>
        </line>
        <line x1="600" y1="200" x2="990" y2="385" stroke="#ffd700" stroke-width="6" opacity="0.7">
          <animate attributeName="opacity" values="0.5;0.8;0.5" dur="2s" repeatCount="indefinite"/>
        </line>
        <!-- Beam impact glow on cliffs -->
        <circle cx="990" cy="385" r="15" fill="#ffd700" opacity="0.2" filter="url(#lens-blur)"/>
        `
            : ""
        }
      </g>

      <!-- Floor — metal grating -->
      <rect y="620" fill="#222230" width="1200" height="180"/>
      <path d="M0 620 Q300 610 600 625 Q900 640 1200 620" fill="#2a2a3a"/>
      <!-- Floor texture -->
      <g opacity="0.08" stroke="#4a4a5a" stroke-width="0.5">
        <line x1="100" y1="640" x2="1100" y2="640"/>
        <line x1="100" y1="660" x2="1100" y2="660"/>
        <line x1="100" y1="680" x2="1100" y2="680"/>
      </g>

      <!-- Stairs opening -->
      <g>
        <ellipse cx="180" cy="670" rx="55" ry="35" fill="#0a0a14" stroke="#2a2a3a" stroke-width="2"/>
        <ellipse cx="180" cy="668" rx="48" ry="30" fill="#060610"/>
        <!-- Railing hint -->
        <path d="M135 665 Q140 650 145 665" stroke="#3a3a4a" stroke-width="2" fill="none"/>
      </g>

      <!-- Examine view hotspot -->
      <rect x="850" y="340" width="200" height="150" fill="transparent"
            data-action="examine" data-target="view" class="hotspot"/>

      <!-- Examine lens hotspot -->
      <circle cx="600" cy="380" r="90" fill="transparent"
              data-action="examine" data-target="lens" class="hotspot"/>
    </svg>
    `;
  }

  // === ACT 2 SCENES ===

  svgTidalCave(): string {
    const hasGear3 = !this.gameState.inventory.includes("gear3");
    const hasRubbing = !this.gameState.inventory.includes("cave_rubbing");

    return `
    <svg viewBox="0 180 1200 500" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <linearGradient id="cave-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0e14"/>
          <stop offset="100%" style="stop-color:#06080c"/>
        </linearGradient>
        <radialGradient id="bio-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#20d0b0;stop-opacity:0.15"/>
          <stop offset="100%" style="stop-color:#20d0b0;stop-opacity:0"/>
        </radialGradient>
        <filter id="cave-blur"><feGaussianBlur in="SourceGraphic" stdDeviation="4"/></filter>
      </defs>

      <rect fill="url(#cave-bg)" width="1200" height="800"/>

      <!-- Cave walls -->
      <path d="M0 180 Q50 200 80 250 Q40 350 60 450 Q30 550 0 600 L0 800 L1200 800 L1200 600 Q1170 550 1140 450 Q1160 350 1120 250 Q1150 200 1200 180 Z" fill="#0c1018"/>
      <!-- Cave ceiling stalactites -->
      <g opacity="0.6">
        <path d="M200 180 L210 240 L220 180" fill="#141820"/>
        <path d="M400 180 L415 260 L430 180" fill="#121620"/>
        <path d="M600 180 L608 230 L616 180" fill="#141820"/>
        <path d="M800 180 L815 255 L830 180" fill="#121620"/>
        <path d="M1000 180 L1010 235 L1020 180" fill="#141820"/>
      </g>

      <!-- Bioluminescent algae patches -->
      <g style="pointer-events:none">
        <ellipse cx="150" cy="400" rx="80" ry="40" fill="url(#bio-glow)">
          <animate attributeName="opacity" values="0.4;0.7;0.4" dur="4s" repeatCount="indefinite"/>
        </ellipse>
        <ellipse cx="500" cy="350" rx="100" ry="50" fill="url(#bio-glow)">
          <animate attributeName="opacity" values="0.5;0.8;0.5" dur="5s" repeatCount="indefinite"/>
        </ellipse>
        <ellipse cx="900" cy="420" rx="90" ry="45" fill="url(#bio-glow)">
          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="3.5s" repeatCount="indefinite"/>
        </ellipse>
      </g>

      <!-- Cave floor — wet rock -->
      <path d="M60 550 Q300 530 600 560 Q900 540 1140 550 L1140 680 L60 680 Z" fill="#10141c"/>
      <path d="M60 555 Q300 535 600 565 Q900 545 1140 555" stroke="#1a2a30" stroke-width="1" fill="none" opacity="0.3"/>

      <!-- Cave paintings on back wall -->
      <g data-action="examine" data-target="paintings" class="standing-stone">
        <!-- Painting surface -->
        <rect x="350" y="250" width="500" height="200" fill="#12181e" rx="8"/>
        <!-- Painting: constellation pattern (5 stars with connecting lines) -->
        <g stroke="#c0603a" stroke-width="2" fill="none" opacity="0.7">
          <line x1="450" y1="300" x2="520" y2="330"/>
          <line x1="520" y1="330" x2="600" y2="310"/>
          <line x1="600" y1="310" x2="680" y2="340"/>
          <line x1="680" y1="340" x2="700" y2="400"/>
        </g>
        <g fill="#c0603a" opacity="0.8">
          <circle cx="450" cy="300" r="5"/>
          <circle cx="520" cy="330" r="5"/>
          <circle cx="600" cy="310" r="6"/>
          <circle cx="680" cy="340" r="5"/>
          <circle cx="700" cy="400" r="5"/>
        </g>
        <!-- Painting: human figures -->
        <g stroke="#8a5030" stroke-width="2" fill="none" opacity="0.5">
          <line x1="420" y1="390" x2="420" y2="420"/>
          <circle cx="420" cy="385" r="5"/>
          <line x1="410" y1="400" x2="430" y2="400"/>
          <line x1="460" y1="395" x2="460" y2="425"/>
          <circle cx="460" cy="390" r="5"/>
          <line x1="450" y1="405" x2="470" y2="405"/>
        </g>
      </g>

      <!-- Tidal pool — reflective water on cave floor -->
      <ellipse cx="600" cy="600" rx="200" ry="30" fill="#0a1520" opacity="0.6"/>
      <ellipse cx="600" cy="598" rx="180" ry="25" fill="#102030" opacity="0.4"/>

      ${hasRubbing ? `
      <!-- Rubbing materials near paintings -->
      <g data-action="pickup" data-target="cave_rubbing" class="interactive-item">
        <rect x="750" y="380" width="55" height="55" fill="transparent" class="hit-area"/>
        <rect x="760" y="390" width="35" height="40" fill="#2a2018" rx="2"/>
        <rect x="762" y="392" width="31" height="36" fill="#3a3020" rx="1"/>
        <line x1="766" y1="400" x2="788" y2="400" stroke="#5a5040" stroke-width="0.8"/>
        <line x1="766" y1="408" x2="790" y2="408" stroke="#5a5040" stroke-width="0.8"/>
        <circle cx="778" cy="410" r="16" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0">
          <animate attributeName="opacity" values="0;0.35;0" dur="2.5s" repeatCount="indefinite"/>
          <animate attributeName="r" values="16;28;16" dur="2.5s" repeatCount="indefinite"/>
        </circle>
      </g>
      ` : ""}

      ${hasGear3 ? `
      <!-- Gear3 wedged in cave wall crack -->
      <g data-action="pickup" data-target="gear3" class="interactive-item">
        <rect x="140" y="460" width="55" height="55" fill="transparent" class="hit-area"/>
        <g transform="translate(168, 488)">
          <circle cx="0" cy="0" r="13" fill="#5a8a6a"/>
          <circle cx="0" cy="0" r="9" fill="#6a9a7a"/>
          <rect x="-2" y="-16" width="4" height="5" fill="#5a8a6a" rx="1"/>
          <rect x="-2" y="11" width="4" height="5" fill="#5a8a6a" rx="1"/>
          <rect x="-16" y="-2" width="5" height="4" fill="#5a8a6a" rx="1"/>
          <rect x="11" y="-2" width="5" height="4" fill="#5a8a6a" rx="1"/>
          <circle cx="0" cy="0" r="3.5" fill="#3a5a48"/>
        </g>
        <circle cx="166" cy="482" r="2.5" fill="#20d0b0" opacity="0.9">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite"/>
        </circle>
        <circle cx="168" cy="488" r="18" fill="none" stroke="#20d0b0" stroke-width="1.5" opacity="0">
          <animate attributeName="opacity" values="0;0.35;0" dur="2.5s" repeatCount="indefinite"/>
          <animate attributeName="r" values="18;30;18" dur="2.5s" repeatCount="indefinite"/>
        </circle>
      </g>
      ` : ""}

      <!-- Dripping water particles -->
      <g style="pointer-events:none">
        <circle cx="210" cy="250" r="1.5" fill="#4080a0" opacity="0.6">
          <animate attributeName="cy" values="250;600;250" dur="3s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite"/>
        </circle>
        <circle cx="810" cy="260" r="1" fill="#4080a0" opacity="0.5">
          <animate attributeName="cy" values="260;590;260" dur="4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.5;0;0.5" dur="4s" repeatCount="indefinite"/>
        </circle>
      </g>
    </svg>
    `;
  }

  svgUnderwaterPassage(): string {
    return `
    <svg viewBox="0 180 1200 500" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <linearGradient id="passage-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#060a12"/>
          <stop offset="100%" style="stop-color:#040610"/>
        </linearGradient>
        <radialGradient id="passage-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#1a4060;stop-opacity:0.3"/>
          <stop offset="100%" style="stop-color:#1a4060;stop-opacity:0"/>
        </radialGradient>
        <filter id="water-shimmer"><feGaussianBlur in="SourceGraphic" stdDeviation="2"/></filter>
      </defs>

      <rect fill="url(#passage-bg)" width="1200" height="800"/>

      <!-- Passage walls — narrow tunnel feel -->
      <path d="M0 180 L150 180 Q180 250 160 350 Q190 450 150 550 Q180 620 150 680 L0 680 Z" fill="#0a0e16"/>
      <path d="M1200 180 L1050 180 Q1020 250 1040 350 Q1010 450 1050 550 Q1020 620 1050 680 L1200 680 Z" fill="#0a0e16"/>

      <!-- Ceiling -->
      <path d="M150 180 Q400 220 600 200 Q800 220 1050 180 L1050 210 Q800 250 600 230 Q400 250 150 210 Z" fill="#0c1018"/>

      <!-- Water seepage — shimmering lines -->
      <g style="pointer-events:none" opacity="0.3">
        <path d="M200 250 Q210 350 195 450" stroke="#2a5a7a" stroke-width="1" fill="none">
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite"/>
        </path>
        <path d="M400 230 Q415 330 405 430" stroke="#2a5a7a" stroke-width="1.5" fill="none">
          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="4s" repeatCount="indefinite"/>
        </path>
        <path d="M800 240 Q790 340 805 440" stroke="#2a5a7a" stroke-width="1" fill="none">
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="3.5s" repeatCount="indefinite"/>
        </path>
        <path d="M1000 235 Q985 335 995 435" stroke="#2a5a7a" stroke-width="1.5" fill="none">
          <animate attributeName="opacity" values="0.25;0.55;0.25" dur="4.5s" repeatCount="indefinite"/>
        </path>
      </g>

      <!-- Floor — wet rock with puddles -->
      <path d="M150 550 Q400 535 600 555 Q800 540 1050 550 L1050 680 L150 680 Z" fill="#0c1018"/>
      <ellipse cx="400" cy="580" rx="60" ry="12" fill="#0a1520" opacity="0.5"/>
      <ellipse cx="750" cy="570" rx="45" ry="10" fill="#0a1520" opacity="0.4"/>

      <!-- Old diving equipment hanging on wall -->
      <g data-action="examine" data-target="equipment">
        <!-- Diving helmet -->
        <circle cx="350" cy="350" r="25" fill="#3a3a30" stroke="#2a2a20" stroke-width="2"/>
        <circle cx="350" cy="350" r="18" fill="#1a2a30"/>
        <rect x="340" y="375" width="20" height="15" fill="#3a3a30" rx="2"/>
        <!-- Hose -->
        <path d="M375 350 Q420 340 450 360 Q480 380 500 370" stroke="#2a3a20" stroke-width="4" fill="none"/>
      </g>

      <!-- Old lamp on wall bracket -->
      <g data-action="examine" data-target="lamp">
        <rect x="820" y="320" width="8" height="20" fill="#3a3020"/>
        <path d="M810 320 Q824 300 838 320" fill="#4a4030"/>
        <circle cx="824" cy="312" r="4" fill="#806020" opacity="0.4">
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite"/>
        </circle>
      </g>

      <!-- Passage glow — distant light from research station -->
      <ellipse cx="600" cy="400" rx="200" ry="150" fill="url(#passage-glow)" style="pointer-events:none"/>

      <!-- Path markers carved into wall -->
      <g opacity="0.3">
        <path d="M250 400 L270 390 L260 410 Z" fill="#4a5a6a"/>
        <path d="M900 380 L920 370 L910 390 Z" fill="#4a5a6a"/>
      </g>
    </svg>
    `;
  }

  svgResearchStation(): string {
    const hasGear4 = !this.gameState.inventory.includes("gear4");
    const hasJournal2 = !this.gameState.inventory.includes("journal_page2");
    const hasRadioParts = !this.gameState.inventory.includes("radio_parts");

    return `
    <svg viewBox="0 180 1200 500" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <linearGradient id="station-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#0e1218"/>
          <stop offset="100%" style="stop-color:#0a0e14"/>
        </linearGradient>
        <linearGradient id="desk-top" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#3a3a40"/>
          <stop offset="100%" style="stop-color:#2a2a30"/>
        </linearGradient>
      </defs>

      <rect fill="url(#station-bg)" width="1200" height="800"/>

      <!-- Concrete walls -->
      <rect x="80" y="200" width="1040" height="400" fill="#141820"/>
      <rect x="80" y="200" width="1040" height="400" fill="none" stroke="#1a2028" stroke-width="2"/>

      <!-- Ceiling with pipes -->
      <rect x="80" y="200" width="1040" height="30" fill="#181c24"/>
      <line x1="200" y1="210" x2="200" y2="220" stroke="#2a3040" stroke-width="6"/>
      <line x1="150" y1="215" x2="1050" y2="215" stroke="#2a3040" stroke-width="4"/>
      <line x1="500" y1="210" x2="500" y2="220" stroke="#2a3040" stroke-width="6"/>
      <line x1="800" y1="210" x2="800" y2="220" stroke="#2a3040" stroke-width="6"/>

      <!-- Flickering overhead light -->
      <rect x="560" y="220" width="80" height="6" fill="#3a4050"/>
      <rect x="565" y="226" width="70" height="2" fill="#a0a880" opacity="0.4">
        <animate attributeName="opacity" values="0.3;0.6;0.2;0.5;0.3" dur="2s" repeatCount="indefinite"/>
      </rect>
      <!-- Light cone -->
      <polygon points="565,228 635,228 700,500 500,500" fill="#a0a880" opacity="0.03" style="pointer-events:none">
        <animate attributeName="opacity" values="0.02;0.05;0.01;0.04;0.02" dur="2s" repeatCount="indefinite"/>
      </polygon>

      <!-- Steel desk (left) -->
      <g>
        <rect x="150" y="420" width="300" height="8" fill="url(#desk-top)"/>
        <rect x="160" y="428" width="8" height="80" fill="#2a2a30"/>
        <rect x="432" y="428" width="8" height="80" fill="#2a2a30"/>
        <!-- Papers on desk -->
        <rect x="200" y="405" width="40" height="30" fill="#c8c0a8" transform="rotate(-8,220,420)" opacity="0.7"/>
        <rect x="260" y="408" width="35" height="25" fill="#d0c8b0" transform="rotate(5,278,420)" opacity="0.6"/>
        <rect x="320" y="410" width="45" height="28" fill="#c0b898" transform="rotate(-3,342,424)" opacity="0.5"/>
      </g>

      <!-- Radio workbench (right) -->
      <g data-action="examine" data-target="radio">
        <rect x="700" y="410" width="350" height="10" fill="url(#desk-top)"/>
        <rect x="710" y="420" width="8" height="90" fill="#2a2a30"/>
        <rect x="1032" y="420" width="8" height="90" fill="#2a2a30"/>
        <!-- Radio unit -->
        <rect x="800" y="370" width="120" height="50" fill="#2a2820" rx="4"/>
        <rect x="805" y="375" width="50" height="35" fill="#1a1a18" rx="2"/>
        <circle cx="880" cy="395" r="12" fill="#1a1a18" stroke="#3a3830" stroke-width="1.5"/>
        <!-- Dead indicator light -->
        <circle cx="810" cy="377" r="3" fill="#3a2020"/>
        <!-- Torn wires -->
        <path d="M800 400 Q780 410 760 405 Q740 400 720 410" stroke="#6a4020" stroke-width="2" fill="none"/>
        <path d="M920 390 Q940 400 960 395" stroke="#4a6020" stroke-width="2" fill="none"/>
        <!-- Repair hotspot over radio -->
        <rect x="790" y="365" width="140" height="55" fill="transparent"
              data-action="use" data-target="repair_radio" class="hotspot"/>
      </g>

      <!-- Floor -->
      <rect x="80" y="510" width="1040" height="90" fill="#12161e"/>
      <!-- Floor tiles -->
      <g opacity="0.1" stroke="#2a3040" stroke-width="0.5" fill="none">
        <line x1="200" y1="510" x2="200" y2="600"/>
        <line x1="350" y1="510" x2="350" y2="600"/>
        <line x1="500" y1="510" x2="500" y2="600"/>
        <line x1="650" y1="510" x2="650" y2="600"/>
        <line x1="800" y1="510" x2="800" y2="600"/>
        <line x1="950" y1="510" x2="950" y2="600"/>
        <line x1="80" y1="555" x2="1120" y2="555"/>
      </g>

      <!-- Observatory door (east) -->
      <g data-action="examine" data-target="observatory_door">
        <rect x="1040" y="320" width="60" height="130" fill="#1a1e28" rx="3"/>
        <rect x="1045" y="325" width="50" height="120" fill="#141822"/>
        <text x="1070" y="310" fill="#4a5a6a" font-size="9" text-anchor="middle" font-family="sans-serif" letter-spacing="1">OBSERVATORY</text>
        <circle cx="1050" cy="385" r="4" fill="#3a3a40"/>
      </g>

      ${hasJournal2 ? `
      <!-- Research log on desk -->
      <g data-action="pickup" data-target="journal_page2" class="interactive-item">
        <rect x="180" y="388" width="55" height="45" fill="transparent" class="hit-area"/>
        <rect x="190" y="395" width="38" height="28" fill="#d0c8a0" transform="rotate(-5,209,409)" rx="1"/>
        <line x1="195" y1="403" x2="222" y2="402" stroke="#6a6a58" stroke-width="0.8"/>
        <line x1="195" y1="409" x2="224" y2="408" stroke="#6a6a58" stroke-width="0.8"/>
        <line x1="195" y1="415" x2="218" y2="414" stroke="#6a6a58" stroke-width="0.8"/>
        <circle cx="209" cy="409" r="18" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0">
          <animate attributeName="opacity" values="0;0.35;0" dur="2.5s" repeatCount="indefinite"/>
          <animate attributeName="r" values="18;30;18" dur="2.5s" repeatCount="indefinite"/>
        </circle>
      </g>
      ` : ""}

      ${hasRadioParts ? `
      <!-- Radio parts in drawer -->
      <g data-action="pickup" data-target="radio_parts" class="interactive-item">
        <rect x="730" y="440" width="55" height="55" fill="transparent" class="hit-area"/>
        <rect x="740" y="448" width="30" height="22" fill="#3a3020" rx="2"/>
        <circle cx="748" cy="456" r="4" fill="#6a4a30"/>
        <rect x="756" y="452" width="8" height="6" fill="#4a6a30"/>
        <circle cx="755" cy="459" r="14" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0">
          <animate attributeName="opacity" values="0;0.35;0" dur="2.5s" repeatCount="indefinite"/>
          <animate attributeName="r" values="14;26;14" dur="2.5s" repeatCount="indefinite"/>
        </circle>
      </g>
      ` : ""}

      ${hasGear4 ? `
      <!-- Gear4 under desk -->
      <g data-action="pickup" data-target="gear4" class="interactive-item">
        <rect x="370" y="470" width="55" height="55" fill="transparent" class="hit-area"/>
        <g transform="translate(398, 495)">
          <circle cx="0" cy="0" r="13" fill="#6a6a7a"/>
          <circle cx="0" cy="0" r="9" fill="#8a8a9a"/>
          <rect x="-2" y="-16" width="4" height="5" fill="#6a6a7a" rx="1"/>
          <rect x="-2" y="11" width="4" height="5" fill="#6a6a7a" rx="1"/>
          <rect x="-16" y="-2" width="5" height="4" fill="#6a6a7a" rx="1"/>
          <rect x="11" y="-2" width="5" height="4" fill="#6a6a7a" rx="1"/>
          <circle cx="0" cy="0" r="3.5" fill="#4a4a58"/>
        </g>
        <circle cx="396" cy="490" r="2.5" fill="#ffd700" opacity="0.9">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite"/>
        </circle>
        <circle cx="398" cy="495" r="18" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0">
          <animate attributeName="opacity" values="0;0.35;0" dur="2.5s" repeatCount="indefinite"/>
          <animate attributeName="r" values="18;30;18" dur="2.5s" repeatCount="indefinite"/>
        </circle>
      </g>
      ` : ""}

      <!-- Passage back (south) -->
      <rect x="80" y="350" width="30" height="100" fill="#080c12"/>
    </svg>
    `;
  }

  svgObservatory(): string {
    const hasJournal3 = !this.gameState.inventory.includes("journal_page3");
    const solved = this.gameState.puzzlesSolved.constellation;

    return `
    <svg viewBox="0 180 1200 500" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <linearGradient id="obs-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#060a14"/>
          <stop offset="100%" style="stop-color:#0a0e18"/>
        </linearGradient>
        <radialGradient id="dome-sky" cx="50%" cy="30%" r="60%">
          <stop offset="0%" style="stop-color:#0e1a2e;stop-opacity:0.8"/>
          <stop offset="100%" style="stop-color:#060a14;stop-opacity:0"/>
        </radialGradient>
      </defs>

      <rect fill="url(#obs-bg)" width="1200" height="800"/>

      <!-- Dome ceiling — curved -->
      <path d="M100 400 Q100 200 600 180 Q1100 200 1100 400" fill="none" stroke="#1a2030" stroke-width="3"/>
      <path d="M100 400 Q100 210 600 190 Q1100 210 1100 400" fill="url(#dome-sky)"/>

      <!-- Telescope opening — stars visible -->
      <path d="M450 180 Q600 170 750 180 L750 250 Q600 240 450 250 Z" fill="#060a14"/>
      <!-- Stars through opening -->
      <g opacity="0.8">
        <circle cx="500" cy="200" r="1.2" fill="#fffacd" opacity="0.7"/>
        <circle cx="550" cy="195" r="0.9" fill="#fffacd" opacity="0.5"/>
        <circle cx="620" cy="205" r="1.4" fill="#fffacd" opacity="0.8"/>
        <circle cx="680" cy="198" r="1.0" fill="#fffacd" opacity="0.6"/>
        <circle cx="580" cy="210" r="0.8" fill="#fffacd" opacity="0.4"/>
        <circle cx="650" cy="215" r="1.1" fill="#fffacd" opacity="0.55"/>
        <circle cx="710" cy="208" r="0.7" fill="#fffacd" opacity="0.45"/>
      </g>

      <!-- Telescope -->
      <g data-action="examine" data-target="telescope">
        <!-- Telescope body — pointed up through dome opening -->
        <rect x="580" y="300" width="40" height="120" fill="#2a2a38" rx="4" transform="rotate(-15,600,360)"/>
        <rect x="575" y="280" width="50" height="30" fill="#3a3a48" rx="6" transform="rotate(-15,600,295)"/>
        <!-- Eyepiece -->
        <circle cx="610" cy="420" r="12" fill="#2a2a38" stroke="#3a3a48" stroke-width="2"/>
        <!-- Tripod -->
        <line x1="600" y1="420" x2="540" y2="550" stroke="#2a2a38" stroke-width="4"/>
        <line x1="600" y1="420" x2="660" y2="550" stroke="#2a2a38" stroke-width="4"/>
        <line x1="600" y1="420" x2="600" y2="555" stroke="#2a2a38" stroke-width="4"/>
      </g>

      <!-- Star chart on wall -->
      <g data-action="puzzle" data-target="constellation">
        <rect x="150" y="260" width="250" height="180" fill="#141822" stroke="#2a3040" stroke-width="2" rx="4"/>
        <!-- Chart grid -->
        <g opacity="0.15" stroke="#4a5a6a" stroke-width="0.5" fill="none">
          <line x1="175" y1="260" x2="175" y2="440"/>
          <line x1="225" y1="260" x2="225" y2="440"/>
          <line x1="275" y1="260" x2="275" y2="440"/>
          <line x1="325" y1="260" x2="325" y2="440"/>
          <line x1="375" y1="260" x2="375" y2="440"/>
          <line x1="150" y1="300" x2="400" y2="300"/>
          <line x1="150" y1="340" x2="400" y2="340"/>
          <line x1="150" y1="380" x2="400" y2="380"/>
          <line x1="150" y1="420" x2="400" y2="420"/>
        </g>
        <!-- Chart stars (clickable constellation points) -->
        <g fill="#4a6a8a" opacity="0.6">
          <circle cx="200" cy="290" r="3"/>
          <circle cx="250" cy="320" r="3"/>
          <circle cx="275" cy="310" r="4"/>
          <circle cx="320" cy="340" r="3"/>
          <circle cx="340" cy="400" r="3"/>
          <!-- Decoy stars -->
          <circle cx="180" cy="350" r="2" opacity="0.3"/>
          <circle cx="350" cy="290" r="2" opacity="0.3"/>
          <circle cx="230" cy="410" r="2" opacity="0.3"/>
          <circle cx="370" cy="370" r="2" opacity="0.3"/>
        </g>
        ${solved ? `
        <!-- Solved constellation lines -->
        <g stroke="#ffd700" stroke-width="2" opacity="0.7">
          <line x1="200" y1="290" x2="250" y2="320"/>
          <line x1="250" y1="320" x2="275" y2="310"/>
          <line x1="275" y1="310" x2="320" y2="340"/>
          <line x1="320" y1="340" x2="340" y2="400"/>
        </g>
        <g fill="#ffd700" opacity="0.8">
          <circle cx="200" cy="290" r="4"/>
          <circle cx="250" cy="320" r="4"/>
          <circle cx="275" cy="310" r="5"/>
          <circle cx="320" cy="340" r="4"/>
          <circle cx="340" cy="400" r="4"/>
        </g>
        ` : ""}
        <text x="275" y="455" text-anchor="middle" fill="#4a5a6a" font-size="10" font-family="sans-serif">STAR CHART</text>
      </g>

      <!-- Vault hatch in floor -->
      <g data-action="examine" data-target="vault_hatch">
        <ellipse cx="900" cy="530" rx="70" ry="35" fill="#1a1e28" stroke="${solved ? "#ffd700" : "#2a3040"}" stroke-width="2"/>
        <ellipse cx="900" cy="528" rx="60" ry="28" fill="#12161e"/>
        ${solved ? `
        <text x="900" y="535" text-anchor="middle" fill="#ffd700" font-size="11" font-family="sans-serif">OPEN</text>
        ` : `
        <text x="900" y="535" text-anchor="middle" fill="#3a4050" font-size="11" font-family="sans-serif">LOCKED</text>
        `}
      </g>

      <!-- Floor -->
      <rect x="100" y="510" width="1000" height="90" fill="#10141c"/>

      ${hasJournal3 ? `
      <!-- Journal page near telescope -->
      <g data-action="pickup" data-target="journal_page3" class="interactive-item">
        <rect x="640" y="475" width="55" height="55" fill="transparent" class="hit-area"/>
        <rect x="650" y="485" width="38" height="28" fill="#d0c8a0" transform="rotate(8,669,499)" rx="1"/>
        <line x1="655" y1="493" x2="682" y2="495" stroke="#6a6a58" stroke-width="0.8"/>
        <line x1="655" y1="499" x2="684" y2="501" stroke="#6a6a58" stroke-width="0.8"/>
        <circle cx="669" cy="499" r="18" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0">
          <animate attributeName="opacity" values="0;0.35;0" dur="2.5s" repeatCount="indefinite"/>
          <animate attributeName="r" values="18;30;18" dur="2.5s" repeatCount="indefinite"/>
        </circle>
      </g>
      ` : ""}
    </svg>
    `;
  }

  svgVault(): string {
    return `
    <svg viewBox="0 180 1200 500" xmlns="http://www.w3.org/2000/svg" class="scene-svg">
      <defs>
        <linearGradient id="vault-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#08060a"/>
          <stop offset="100%" style="stop-color:#0a080e"/>
        </linearGradient>
        <radialGradient id="pedestal-glow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" style="stop-color:#ffd700;stop-opacity:0.08"/>
          <stop offset="100%" style="stop-color:#ffd700;stop-opacity:0"/>
        </radialGradient>
        <filter id="vault-glow"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter>
      </defs>

      <rect fill="url(#vault-bg)" width="1200" height="800"/>

      <!-- Rough-hewn stone walls -->
      <path d="M100 200 Q80 300 100 400 Q80 500 100 600 L100 680 L1100 680 L1100 600 Q1120 500 1100 400 Q1120 300 1100 200 Z" fill="#0e0c12"/>
      <!-- Wall texture -->
      <g opacity="0.08" stroke="#3a3040" stroke-width="0.8" fill="none">
        <path d="M120 250 Q200 245 280 255"/>
        <path d="M150 350 Q250 345 350 355"/>
        <path d="M130 450 Q230 442 330 450"/>
        <path d="M850 260 Q950 255 1050 265"/>
        <path d="M870 360 Q970 355 1070 365"/>
        <path d="M850 460 Q950 455 1050 465"/>
      </g>

      <!-- Central golden glow -->
      <ellipse cx="600" cy="400" rx="250" ry="180" fill="url(#pedestal-glow)" style="pointer-events:none"/>

      <!-- Stone floor -->
      <path d="M100 530 Q400 520 600 535 Q800 520 1100 530 L1100 680 L100 680 Z" fill="#0c0a10"/>

      <!-- Pedestal -->
      <g data-action="examine" data-target="pedestal">
        <!-- Base -->
        <path d="M540 520 L520 540 L680 540 L660 520 Z" fill="#2a2430"/>
        <path d="M530 510 L520 540 L680 540 L670 510 Z" fill="#342840"/>
        <!-- Column -->
        <rect x="560" y="400" width="80" height="112" fill="#2a2430"/>
        <rect x="565" y="405" width="70" height="102" fill="#302840"/>
        <!-- Top surface -->
        <path d="M550 400 Q600 390 650 400 Q600 395 550 400 Z" fill="#3a3248"/>

        <!-- The final journal on pedestal -->
        <rect x="572" y="380" width="56" height="40" fill="#c8b880" rx="2"/>
        <rect x="575" y="383" width="50" height="34" fill="#d4c4a0" rx="1"/>
        <line x1="580" y1="392" x2="620" y2="392" stroke="#6a6a58" stroke-width="0.8"/>
        <line x1="580" y1="398" x2="618" y2="398" stroke="#6a6a58" stroke-width="0.8"/>
        <line x1="580" y1="404" x2="614" y2="404" stroke="#6a6a58" stroke-width="0.8"/>
        <line x1="580" y1="410" x2="620" y2="410" stroke="#6a6a58" stroke-width="0.8"/>

        <!-- Golden light emanating from journal -->
        <circle cx="600" cy="400" r="40" fill="#ffd700" opacity="0.06" filter="url(#vault-glow)">
          <animate attributeName="opacity" values="0.04;0.1;0.04" dur="4s" repeatCount="indefinite"/>
        </circle>
        <circle cx="600" cy="400" r="25" fill="#ffd700" opacity="0.04" filter="url(#vault-glow)">
          <animate attributeName="opacity" values="0.02;0.08;0.02" dur="3s" repeatCount="indefinite"/>
        </circle>
      </g>

      <!-- Ancient carvings on walls — echoes of the cave paintings -->
      <g opacity="0.15">
        <!-- Left wall: same constellation from cave -->
        <g stroke="#8a6a40" stroke-width="1.5" fill="none">
          <line x1="180" y1="300" x2="220" y2="330"/>
          <line x1="220" y1="330" x2="260" y2="315"/>
          <line x1="260" y1="315" x2="300" y2="345"/>
          <line x1="300" y1="345" x2="310" y2="400"/>
        </g>
        <g fill="#8a6a40">
          <circle cx="180" cy="300" r="3"/>
          <circle cx="220" cy="330" r="3"/>
          <circle cx="260" cy="315" r="4"/>
          <circle cx="300" cy="345" r="3"/>
          <circle cx="310" cy="400" r="3"/>
        </g>
        <!-- Right wall: gear symbol -->
        <circle cx="950" cy="350" r="25" fill="none" stroke="#8a6a40" stroke-width="1.5"/>
        <circle cx="950" cy="350" r="15" fill="none" stroke="#8a6a40" stroke-width="1"/>
      </g>

      <!-- Dust motes in the golden light -->
      <g style="pointer-events:none">
        <circle cx="580" cy="370" r="1" fill="#ffd700" opacity="0.3">
          <animate attributeName="cy" values="370;350;370" dur="5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.1;0.4;0.1" dur="3s" repeatCount="indefinite"/>
        </circle>
        <circle cx="620" cy="390" r="0.8" fill="#ffd700" opacity="0.2">
          <animate attributeName="cy" values="390;375;390" dur="4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.1;0.3;0.1" dur="3.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="600" cy="360" r="1.2" fill="#ffd700" opacity="0.25">
          <animate attributeName="cy" values="360;340;360" dur="6s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.1;0.35;0.1" dur="4s" repeatCount="indefinite"/>
        </circle>
      </g>

      <!-- Stairs back up (south) -->
      <g>
        <ellipse cx="200" cy="560" rx="50" ry="30" fill="#0a0812" stroke="#1a1820" stroke-width="1.5"/>
        <path d="M170 555 Q175 545 180 555" stroke="#1a1820" stroke-width="1.5" fill="none"/>
      </g>
    </svg>
    `;
  }

  <template>
    <div class="scene-container" ...attributes>
      {{this.sceneSVG}}
    </div>
  </template>
}
