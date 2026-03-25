/**
 * The Fading Kingdom — Canvas Scene Renderer
 *
 * Hosts the <canvas> element and wires it to the SceneEngine service
 * via a modifier. This replaces the SVG scene-renderer.
 */

import Component from "@glimmer/component";
import { service } from "@ember/service";
import { modifier } from "ember-modifier";
import type SceneEngineService from "the-island/services/scene-engine";
import type ParticleSystemService from "the-island/services/particle-system";
import type MusicEngineService from "the-island/services/music-engine";
import type { HotspotAction } from "the-island/scenes/types";

// Import scene definitions to register them
import { mistyShore } from "the-island/scenes/misty-shore";
import { whisperingWoods } from "the-island/scenes/whispering-woods";
import { crystalCaverns } from "the-island/scenes/crystal-caverns";
import { theMeadow } from "the-island/scenes/the-meadow";
import { rainbowBridge } from "the-island/scenes/rainbow-bridge";
import { wizardsTower } from "the-island/scenes/wizards-tower";
import { starfallLake } from "the-island/scenes/starfall-lake";
import { throneRoom } from "the-island/scenes/throne-room";

interface CanvasRendererSignature {
  Args: {
    sceneId: string;
    restorationProgress: number;
    onInteraction: (action: HotspotAction, target: string) => void;
  };
  Element: HTMLCanvasElement;
}

export default class CanvasRenderer extends Component<CanvasRendererSignature> {
  @service declare sceneEngine: SceneEngineService;
  @service declare particleSystem: ParticleSystemService;
  @service declare musicEngine: MusicEngineService;

  private scenesRegistered = false;

  private registerScenes(): void {
    if (this.scenesRegistered) return;
    this.sceneEngine.registerScene(mistyShore);
    this.sceneEngine.registerScene(whisperingWoods);
    this.sceneEngine.registerScene(crystalCaverns);
    this.sceneEngine.registerScene(theMeadow);
    this.sceneEngine.registerScene(rainbowBridge);
    this.sceneEngine.registerScene(wizardsTower);
    this.sceneEngine.registerScene(starfallLake);
    this.sceneEngine.registerScene(throneRoom);
    // this.sceneEngine.registerScene(crystalCaverns);
    // etc.
    this.scenesRegistered = true;
  }

  setupCanvas = modifier((element: HTMLCanvasElement) => {
    // Register all scenes
    this.registerScenes();

    // Connect subsystems to engine
    this.sceneEngine.particleSystem = this.particleSystem;
    this.sceneEngine.musicEngine = this.musicEngine;

    // Initialize audio (requires user gesture — will activate on first click)
    this.musicEngine.initAudio();

    // Initialize canvas
    this.sceneEngine.setupCanvas(element);

    // Wire hotspot clicks to parent component
    this.sceneEngine.onHotspotClick = (action: HotspotAction, target: string) => {
      this.args.onInteraction(action, target);
    };

    // Load initial scene
    this.sceneEngine.loadScene(
      this.args.sceneId,
      this.args.restorationProgress,
    );

    // Start render loop
    this.sceneEngine.startRenderLoop();

    // Handle resize
    const handleResize = () => this.sceneEngine.resize();
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      this.sceneEngine.stopRenderLoop();
    };
  });

  <template>
    <canvas class="scene-canvas" {{this.setupCanvas}} ...attributes></canvas>
  </template>
}
