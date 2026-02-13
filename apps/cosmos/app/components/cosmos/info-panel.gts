import Component from "@glimmer/component";
import { htmlSafe } from "@ember/template";
import type { Scale, Galaxy, Star, Planet } from "cosmos/services/universe-generator";
import { getObjectDescription } from "cosmos/services/universe-generator";

export interface InfoPanelSignature {
  Element: HTMLDivElement;
  Args: {
    scale: Scale;
    selectedObject: Galaxy | Star | Planet | null;
    cameraX: number;
    cameraY: number;
    cameraZoom: number;
    onCopyCoords: () => void;
    isSurface?: boolean;
  };
}

export default class InfoPanel extends Component<InfoPanelSignature> {
  get title(): string {
    if (this.args.selectedObject) {
      return this.args.selectedObject.name;
    }
    return `Exploring the ${this.args.scale.name}`;
  }

  get subtitle(): string {
    if (this.args.selectedObject) {
      return getObjectDescription(this.args.selectedObject);
    }
    if (this.args.isSurface) {
      return "WASD to move · Drag to look · Scroll to adjust speed";
    }
    if (this.args.cameraZoom >= 3000) {
      return "Click a planet to land on its surface";
    }
    return "Scroll to zoom · Drag to pan · Click to focus";
  }

  get coordsDisplay(): string {
    const { cameraX, cameraY, cameraZoom } = this.args;
    return `${cameraX.toFixed(2)}, ${cameraY.toFixed(2)} @ ${cameraZoom.toFixed(1)}x`;
  }

  get zoomPercent(): number {
    const minZoom = Math.log10(0.5);
    const maxZoom = Math.log10(500000000);
    const currentZoom = Math.log10(this.args.cameraZoom);
    return ((currentZoom - minZoom) / (maxZoom - minZoom)) * 100;
  }

  get zoomStyle(): ReturnType<typeof htmlSafe> {
    return htmlSafe(`width: ${this.zoomPercent}%`);
  }

  <template>
    <div class="info-panel" ...attributes>
      <div class="location-info">
        <div class="info-title">{{this.title}}</div>
        <div class="info-subtitle">{{this.subtitle}}</div>
      </div>
      <div class="coordinates">
        <span class="coords-display">{{this.coordsDisplay}}</span>
        <span class="zoom-label">Zoom:</span>
        <div class="zoom-bar">
          <div class="zoom-fill" style={{this.zoomStyle}}></div>
        </div>
        <button
          class="copy-coords"
          type="button"
          title="Copy coordinates"
          {{on "click" @onCopyCoords}}
        >📋</button>
      </div>
    </div>
  </template>
}

import { on } from "@ember/modifier";
