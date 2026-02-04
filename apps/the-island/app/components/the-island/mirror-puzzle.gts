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
        <line x1="200" y1="200" x2="200" y2="80" stroke="#FFD700" stroke-width="3" opacity="0.7"/>
        <line x1="200" y1="80" x2="370" y2="50" stroke="#FFD700" stroke-width="3" opacity="0.7"/>
      `;
    }
    return `
      <line x1="200" y1="200" x2="200" y2="80" stroke="#FFD700" stroke-width="2" opacity="0.4"/>
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
      <div class="puzzle-container">
        <h2>Lighthouse Mirrors</h2>
        <p>Rotate the mirrors to align the light beam with the distant cliffs.</p>

        <svg viewBox="0 0 400 400" class="mirror-puzzle-svg">
          <!-- Central lens -->
          <circle cx="200" cy="200" r="30" fill="#FFD700" opacity="0.8" />
          <circle cx="200" cy="200" r="25" fill="#FFF8DC" />

          <!-- Light beam -->
          <g>
            {{! template-lint-disable no-triple-curlies }}
            {{{this.lightBeamsSVG}}}
          </g>

          <!-- Mirror 1 (top) -->
          {{! template-lint-disable require-presentational-children }}
          <g
            class="mirror"
            role="button"
            transform="rotate({{get @mirrorAngles 0}}, 200, 80)"
            {{on "click" (fn this.handleMirrorClick 0)}}
          >
            <rect
              x="185"
              y="60"
              width="30"
              height="8"
              fill="#4A90A4"
              stroke="#2C5F6B"
              stroke-width="2"
              rx="2"
            />
            <circle cx="200" cy="80" r="20" fill="transparent" class="mirror-hit" />
          </g>

          <!-- Mirror 2 (right) -->
          {{! template-lint-disable require-presentational-children }}
          <g
            class="mirror"
            role="button"
            transform="rotate({{get @mirrorAngles 1}}, 320, 200)"
            {{on "click" (fn this.handleMirrorClick 1)}}
          >
            <rect
              x="305"
              y="185"
              width="30"
              height="8"
              fill="#4A90A4"
              stroke="#2C5F6B"
              stroke-width="2"
              rx="2"
            />
            <circle cx="320" cy="200" r="20" fill="transparent" class="mirror-hit" />
          </g>

          <!-- Mirror 3 (bottom) -->
          {{! template-lint-disable require-presentational-children }}
          <g
            class="mirror"
            role="button"
            transform="rotate({{get @mirrorAngles 2}}, 200, 320)"
            {{on "click" (fn this.handleMirrorClick 2)}}
          >
            <rect
              x="185"
              y="332"
              width="30"
              height="8"
              fill="#4A90A4"
              stroke="#2C5F6B"
              stroke-width="2"
              rx="2"
            />
            <circle cx="200" cy="320" r="20" fill="transparent" class="mirror-hit" />
          </g>

          <!-- Mirror 4 (left) -->
          {{! template-lint-disable require-presentational-children }}
          <g
            class="mirror"
            role="button"
            transform="rotate({{get @mirrorAngles 3}}, 80, 200)"
            {{on "click" (fn this.handleMirrorClick 3)}}
          >
            <rect
              x="65"
              y="185"
              width="30"
              height="8"
              fill="#4A90A4"
              stroke="#2C5F6B"
              stroke-width="2"
              rx="2"
            />
            <circle cx="80" cy="200" r="20" fill="transparent" class="mirror-hit" />
          </g>

          <!-- Target (cliffs - northeast) -->
          <g class="target {{if @isSolved 'hit'}}">
            <path
              d="M 350 50 L 370 30 L 390 50 L 380 50 L 380 70 L 360 70 L 360 50 Z"
              fill="#5D4E37"
              stroke="#3D2E17"
            />
            <text x="370" y="85" text-anchor="middle" fill="#8B7355" font-size="10">Cliffs</text>
          </g>
        </svg>

        <p class="puzzle-hint">Click a mirror to rotate it 45°. Solution: Top→NE, Right→NE</p>

        <button type="button" class="puzzle-close" {{on "click" this.handleClose}}>
          Close
        </button>
      </div>
    </div>
  </template>
}
