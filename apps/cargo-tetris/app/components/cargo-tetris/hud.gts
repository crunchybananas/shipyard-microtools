import Component from "@glimmer/component";

export interface CargoTetrisHudSignature {
  Element: HTMLDivElement;
  Args: {
    score: number;
    lines: number;
    level: number;
  };
}

export default class CargoTetrisHud extends Component<CargoTetrisHudSignature> {
  <template>
    <div class="hud" ...attributes>
      <div class="hud-item">
        <span class="hud-label">Score</span>
        <span class="hud-value">{{@score}}</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Lines</span>
        <span class="hud-value">{{@lines}}</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Level</span>
        <span class="hud-value">{{@level}}</span>
      </div>
    </div>
  </template>
}
