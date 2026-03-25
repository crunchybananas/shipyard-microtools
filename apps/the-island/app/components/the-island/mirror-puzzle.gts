import Component from "@glimmer/component";
import { fn, get } from "@ember/helper";
import { on } from "@ember/modifier";

interface MirrorPuzzleSignature {
  Args: {
    mirrorAngles: [number, number, number, number];
    onRotateMirror: (index: number) => void;
    onClose: () => void;
    isSolved: boolean;
  };
  Element: HTMLDivElement;
}

export default class MirrorPuzzle extends Component<MirrorPuzzleSignature> {
  get lightBeamsSVG(): string {
    if (this.args.isSolved) {
      return `
        <!-- Beam from lens to top mirror -->
        <line x1="250" y1="250" x2="250" y2="110" stroke="#FFD700" stroke-width="4" opacity="0.8">
          <animate attributeName="opacity" values="0.6;0.9;0.6" dur="1.5s" repeatCount="indefinite"/>
        </line>
        <!-- Beam from top mirror to cliffs (NE) -->
        <line x1="250" y1="110" x2="440" y2="60" stroke="#FFD700" stroke-width="4" opacity="0.8">
          <animate attributeName="opacity" values="0.6;0.9;0.6" dur="1.5s" repeatCount="indefinite"/>
        </line>
        <!-- Impact glow on cliffs -->
        <circle cx="440" cy="60" r="12" fill="#FFD700" opacity="0.3">
          <animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite"/>
        </circle>
      `;
    }
    // Default: beam goes straight up from lens
    return `
      <line x1="250" y1="250" x2="250" y2="110" stroke="#FFD700" stroke-width="2.5" opacity="0.35"/>
    `;
  }

  handleMirrorClick = (index: number): void => {
    this.args.onRotateMirror(index);
  };

  handleClose = (): void => {
    this.args.onClose();
  };

  <template>
    <div class="puzzle-overlay" ...attributes>
      <div class="puzzle-container mirror-puzzle-container">
        <h2>Lighthouse Mirrors</h2>
        <p>Rotate the mirrors to direct the light beam toward the distant cliffs.</p>

        <svg viewBox="0 0 500 500" class="mirror-puzzle-svg">
          <defs>
            <radialGradient id="mp-lens-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style="stop-color:#fffacd;stop-opacity:0.8"/>
              <stop offset="50%" style="stop-color:#ffd700;stop-opacity:0.3"/>
              <stop offset="100%" style="stop-color:#ffd700;stop-opacity:0"/>
            </radialGradient>
            <filter id="mp-glow">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3"/>
            </filter>
          </defs>

          <!-- Background — dark room -->
          <rect width="500" height="500" fill="#0a0e18" rx="8"/>

          <!-- Subtle radial guide lines -->
          <circle cx="250" cy="250" r="130" fill="none" stroke="#1a1a2e" stroke-width="1" stroke-dasharray="6,4"/>
          <circle cx="250" cy="250" r="200" fill="none" stroke="#1a1a2e" stroke-width="0.5" stroke-dasharray="4,6"/>

          <!-- Light beam(s) -->
          <g>
            {{! template-lint-disable no-triple-curlies }}
            {{{this.lightBeamsSVG}}}
          </g>

          <!-- Central Fresnel lens -->
          <circle cx="250" cy="250" r="40" fill="url(#mp-lens-glow)" filter="url(#mp-glow)" opacity="0.5"/>
          <circle cx="250" cy="250" r="28" fill="#1a1a2a" stroke="#3a3a4a" stroke-width="2"/>
          <circle cx="250" cy="250" r="22" fill="none" stroke="#ffd700" stroke-width="1" opacity="0.4"/>
          <circle cx="250" cy="250" r="16" fill="none" stroke="#ffd700" stroke-width="1" opacity="0.3"/>
          <circle cx="250" cy="250" r="10" fill="#fffacd" opacity="0.9"/>

          <!-- Mirror 1 (top) — position: above lens -->
          {{! template-lint-disable require-presentational-children }}
          <g
            class="mirror"
            role="button"
            transform="rotate({{get @mirrorAngles 0}}, 250, 110)"
            {{on "click" (fn this.handleMirrorClick 0)}}
          >
            <circle cx="250" cy="110" r="22" fill="#1a1a28" stroke="#3a3a4a" stroke-width="1.5"/>
            <rect x="232" y="106" width="36" height="8" fill="#5a9ab4" stroke="#3a7090" stroke-width="1.5" rx="2"/>
            <circle cx="250" cy="110" r="3" fill="#3a3a4a"/>
            <circle cx="250" cy="110" r="28" fill="transparent" class="mirror-hit"/>
          </g>

          <!-- Mirror 2 (right) -->
          {{! template-lint-disable require-presentational-children }}
          <g
            class="mirror"
            role="button"
            transform="rotate({{get @mirrorAngles 1}}, 390, 250)"
            {{on "click" (fn this.handleMirrorClick 1)}}
          >
            <circle cx="390" cy="250" r="22" fill="#1a1a28" stroke="#3a3a4a" stroke-width="1.5"/>
            <rect x="372" y="246" width="36" height="8" fill="#5a9ab4" stroke="#3a7090" stroke-width="1.5" rx="2"/>
            <circle cx="390" cy="250" r="3" fill="#3a3a4a"/>
            <circle cx="390" cy="250" r="28" fill="transparent" class="mirror-hit"/>
          </g>

          <!-- Mirror 3 (bottom) -->
          {{! template-lint-disable require-presentational-children }}
          <g
            class="mirror"
            role="button"
            transform="rotate({{get @mirrorAngles 2}}, 250, 390)"
            {{on "click" (fn this.handleMirrorClick 2)}}
          >
            <circle cx="250" cy="390" r="22" fill="#1a1a28" stroke="#3a3a4a" stroke-width="1.5"/>
            <rect x="232" y="386" width="36" height="8" fill="#5a9ab4" stroke="#3a7090" stroke-width="1.5" rx="2"/>
            <circle cx="250" cy="390" r="3" fill="#3a3a4a"/>
            <circle cx="250" cy="390" r="28" fill="transparent" class="mirror-hit"/>
          </g>

          <!-- Mirror 4 (left) -->
          {{! template-lint-disable require-presentational-children }}
          <g
            class="mirror"
            role="button"
            transform="rotate({{get @mirrorAngles 3}}, 110, 250)"
            {{on "click" (fn this.handleMirrorClick 3)}}
          >
            <circle cx="110" cy="250" r="22" fill="#1a1a28" stroke="#3a3a4a" stroke-width="1.5"/>
            <rect x="92" y="246" width="36" height="8" fill="#5a9ab4" stroke="#3a7090" stroke-width="1.5" rx="2"/>
            <circle cx="110" cy="250" r="3" fill="#3a3a4a"/>
            <circle cx="110" cy="250" r="28" fill="transparent" class="mirror-hit"/>
          </g>

          <!-- Target: distant cliffs (upper-right) -->
          <g class="target {{if @isSolved 'hit'}}">
            <path d="M420 75 L430 55 L445 65 L455 40 L465 55 L475 48 L480 70 L480 85 L420 85 Z"
                  fill="{{if @isSolved '#5a4a30' '#3a2e22'}}"
                  stroke="{{if @isSolved '#ffd700' '#2a2218'}}"
                  stroke-width="{{if @isSolved '1.5' '1'}}"/>
            <text x="450" y="98" text-anchor="middle" fill="{{if @isSolved '#ffd700' '#6a5a40'}}" font-size="10" font-family="serif">Cliffs</text>
          </g>

          <!-- Labels for orientation -->
          <text x="250" y="28" text-anchor="middle" fill="#4a4a5a" font-size="9" font-family="sans-serif">N</text>
          <text x="250" y="485" text-anchor="middle" fill="#4a4a5a" font-size="9" font-family="sans-serif">S</text>
          <text x="15" y="254" text-anchor="middle" fill="#4a4a5a" font-size="9" font-family="sans-serif">W</text>
          <text x="488" y="254" text-anchor="middle" fill="#4a4a5a" font-size="9" font-family="sans-serif">E</text>
        </svg>

        <p class="puzzle-hint">Click a mirror to rotate it 45°. Direct the light toward the distant cliffs.</p>

        <button type="button" class="puzzle-close" {{on "click" this.handleClose}}>
          Close
        </button>
      </div>
    </div>
  </template>
}
