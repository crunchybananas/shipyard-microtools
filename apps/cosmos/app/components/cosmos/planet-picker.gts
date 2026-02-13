import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import type { Planet } from "cosmos/services/universe-generator";
import { fn } from "@ember/helper";

interface PlanetPickerSignature {
  Args: {
    planets: Planet[];
    focusedPlanet: Planet | null;
    onSelect: (planet: Planet) => void;
  };
}

export default class PlanetPicker extends Component<PlanetPickerSignature> {
  get formattedPlanets(): Array<{
    planet: Planet;
    typeName: string;
    isFocused: boolean;
    icon: string;
  }> {
    return this.args.planets.map((planet) => ({
      planet,
      typeName: planet.type
        .replace("_", " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase()),
      isFocused: this.args.focusedPlanet?.seed === planet.seed,
      icon: this.planetIcon(planet.type),
    }));
  }

  private planetIcon(type: string): string {
    switch (type) {
      case "rocky": return "🪨";
      case "gas_giant": return "🟠";
      case "earth_like": return "🌍";
      case "ocean": return "🌊";
      case "lava": return "🌋";
      case "ice": return "🧊";
      case "desert": return "🏜️";
      case "ice_giant": return "💠";
      default: return "🪐";
    }
  }

  handleSelect = (planet: Planet): void => {
    this.args.onSelect(planet);
  };

  <template>
    <div class="planet-picker">
      <div class="planet-picker-label">Select Planet</div>
      <div class="planet-picker-list">
        {{#each this.formattedPlanets as |entry|}}
          {{! template-lint-disable no-invalid-interactive }}
          <div
            class="planet-picker-item {{if entry.isFocused 'focused'}}"
            role="button"
            {{on "click" (fn this.handleSelect entry.planet)}}
          >
            <span class="planet-icon">{{entry.icon}}</span>
            <div class="planet-picker-info">
              <span class="planet-name">{{entry.planet.name}}</span>
              <span class="planet-type">{{entry.typeName}}</span>
            </div>
          </div>
        {{/each}}
      </div>
    </div>
  </template>
}
