import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";
import {
  TAILWIND_COLORS,
  TAILWIND_BORDER_RADIUS,
  TAILWIND_FONT_SIZE,
  TAILWIND_FONT_WEIGHT,
  TAILWIND_OPACITY,
  TAILWIND_BORDER_WIDTH,
} from "atelier/utils/tailwind-defaults";

export interface CustomTokens {
  colors?: Record<string, string>;
  borderRadius?: Record<number, string>;
  fontSize?: Record<number, string>;
  fontWeight?: Record<string, string>;
}

/**
 * Token Registry Service
 *
 * Maps design element CSS values → Tailwind utility classes.
 * Ships with default Tailwind v3 palette. Users can import their
 * own Tailwind config to add custom tokens (brand colors, spacing, etc.).
 */
export default class TokenRegistryService extends Service {
  // Custom tokens override defaults
  @tracked customColors: Record<string, string> = {};
  @tracked customBorderRadius: Record<number, string> = {};
  @tracked customFontSize: Record<number, string> = {};
  @tracked customFontWeight: Record<string, string> = {};
  @tracked hasCustomTokens: boolean = false;

  // Precomputed RGB lookup for nearest-color matching
  private _colorRgbCache: Array<{ hex: string; suffix: string; r: number; g: number; b: number }> | null = null;

  get allColors(): Record<string, string> {
    return { ...TAILWIND_COLORS, ...this.customColors };
  }

  get allBorderRadius(): Record<number, string> {
    return { ...TAILWIND_BORDER_RADIUS, ...this.customBorderRadius };
  }

  get allFontSize(): Record<number, string> {
    return { ...TAILWIND_FONT_SIZE, ...this.customFontSize };
  }

  get allFontWeight(): Record<string, string> {
    return { ...TAILWIND_FONT_WEIGHT, ...this.customFontWeight };
  }

  /**
   * Register custom tokens from a user's Tailwind config or design system.
   */
  registerTokens(tokens: CustomTokens): void {
    if (tokens.colors) {
      this.customColors = { ...this.customColors, ...tokens.colors };
    }
    if (tokens.borderRadius) {
      this.customBorderRadius = { ...this.customBorderRadius, ...tokens.borderRadius };
    }
    if (tokens.fontSize) {
      this.customFontSize = { ...this.customFontSize, ...tokens.fontSize };
    }
    if (tokens.fontWeight) {
      this.customFontWeight = { ...this.customFontWeight, ...tokens.fontWeight };
    }
    this._colorRgbCache = null;
    this.hasCustomTokens = true;
  }

  /**
   * Clear all custom tokens, reverting to defaults.
   */
  clearCustomTokens(): void {
    this.customColors = {};
    this.customBorderRadius = {};
    this.customFontSize = {};
    this.customFontWeight = {};
    this._colorRgbCache = null;
    this.hasCustomTokens = false;
  }

  // ---- Color resolution ----

  /**
   * Resolve a hex color to a Tailwind class with prefix (bg-, text-, border-).
   * Returns the class name if a match is found within threshold, otherwise
   * returns an arbitrary value class like bg-[#818cf8].
   */
  resolveColor(hex: string, prefix: "bg" | "text" | "border"): string | null {
    if (!hex || hex === "transparent") return null;

    const normalized = hex.toLowerCase();

    // Exact match first
    const exact = this.allColors[normalized];
    if (exact) {
      return `${prefix}-${exact}`;
    }

    // Nearest color match (within threshold of 30 RGB distance)
    const nearest = this.findNearestColor(normalized);
    if (nearest) {
      return `${prefix}-${nearest}`;
    }

    // Arbitrary value fallback
    return `${prefix}-[${normalized}]`;
  }

  private findNearestColor(hex: string): string | null {
    const target = hexToRgb(hex);
    if (!target) return null;

    if (!this._colorRgbCache) {
      this._colorRgbCache = [];
      const allColors = this.allColors;
      for (const [h, suffix] of Object.entries(allColors)) {
        const rgb = hexToRgb(h);
        if (rgb) {
          this._colorRgbCache.push({ hex: h, suffix, ...rgb });
        }
      }
    }

    let bestDistance = Infinity;
    let bestSuffix: string | null = null;

    for (const entry of this._colorRgbCache) {
      const d = Math.sqrt(
        (target.r - entry.r) ** 2 +
        (target.g - entry.g) ** 2 +
        (target.b - entry.b) ** 2,
      );
      if (d < bestDistance) {
        bestDistance = d;
        bestSuffix = entry.suffix;
      }
    }

    // Threshold: ~7% of max distance (441). If the nearest color is too far, use arbitrary.
    if (bestDistance < 30 && bestSuffix) {
      return bestSuffix;
    }

    return null;
  }

  // ---- Other property resolution ----

  resolveBorderRadius(px: number): string {
    // Check for exact or close match
    const radiusMap = this.allBorderRadius;
    if (radiusMap[px]) return radiusMap[px]!;

    // For ellipse (border-radius: 50%), use rounded-full
    if (px >= 9999) return "rounded-full";

    // Find nearest
    let closest = "rounded-none";
    let closestDist = Infinity;
    for (const [val, cls] of Object.entries(radiusMap)) {
      const dist = Math.abs(Number(val) - px);
      if (dist < closestDist) {
        closestDist = dist;
        closest = cls;
      }
    }

    // If within 2px, use the named class
    if (closestDist <= 2) return closest;

    return `rounded-[${px}px]`;
  }

  resolveFontSize(px: number): string {
    const sizeMap = this.allFontSize;
    if (sizeMap[px]) return sizeMap[px]!;

    // Find nearest within 2px
    for (const [val, cls] of Object.entries(sizeMap)) {
      if (Math.abs(Number(val) - px) <= 1) return cls;
    }

    return `text-[${px}px]`;
  }

  resolveFontWeight(weight: string): string {
    const weightMap = this.allFontWeight;
    return weightMap[weight] ?? `font-[${weight}]`;
  }

  resolveOpacity(value: number): string | null {
    if (value >= 1) return null; // No class needed
    if (value <= 0) return "opacity-0";

    // Round to nearest 5%
    const rounded = Math.round(value * 20) / 20;
    const match = TAILWIND_OPACITY[rounded];
    if (match) return match;

    return `opacity-[${Math.round(value * 100)}]`;
  }

  resolveBorderWidth(px: number): string {
    const match = TAILWIND_BORDER_WIDTH[px];
    if (match) return match;
    return `border-[${px}px]`;
  }

  // ---- Config import ----

  /**
   * Parse a Tailwind config JSON (theme.extend.colors section) and register tokens.
   * Accepts the format:
   * {
   *   "colors": { "brand": { "50": "#fef2f2", "500": "#ef4444", ... }, "accent": "#818cf8" },
   *   "borderRadius": { "card": "12px" },
   *   "fontSize": { "hero": "48px" }
   * }
   */
  importFromJSON(json: string): { success: boolean; message: string } {
    try {
      const config = JSON.parse(json);
      const tokens: CustomTokens = {};

      // Parse colors
      if (config.colors) {
        tokens.colors = {};
        for (const [name, value] of Object.entries(config.colors)) {
          if (typeof value === "string") {
            tokens.colors[value.toLowerCase()] = name;
          } else if (typeof value === "object" && value !== null) {
            // Nested shades: { "brand": { "50": "#...", "500": "#..." } }
            for (const [shade, hex] of Object.entries(value as Record<string, string>)) {
              if (typeof hex === "string") {
                tokens.colors[hex.toLowerCase()] = `${name}-${shade}`;
              }
            }
          }
        }
      }

      // Parse borderRadius
      if (config.borderRadius) {
        tokens.borderRadius = {};
        for (const [name, value] of Object.entries(config.borderRadius)) {
          const px = parseInt(value as string);
          if (!isNaN(px)) {
            tokens.borderRadius[px] = `rounded-${name}`;
          }
        }
      }

      // Parse fontSize
      if (config.fontSize) {
        tokens.fontSize = {};
        for (const [name, value] of Object.entries(config.fontSize)) {
          const raw = Array.isArray(value) ? value[0] : value;
          const px = parseInt(raw as string);
          if (!isNaN(px)) {
            tokens.fontSize[px] = `text-${name}`;
          }
        }
      }

      this.registerTokens(tokens);

      const colorCount = Object.keys(tokens.colors ?? {}).length;
      return {
        success: true,
        message: `Imported ${colorCount} colors${tokens.borderRadius ? `, ${Object.keys(tokens.borderRadius).length} radii` : ""}${tokens.fontSize ? `, ${Object.keys(tokens.fontSize).length} font sizes` : ""}`,
      };
    } catch (e) {
      return { success: false, message: `Invalid JSON: ${(e as Error).message}` };
    }
  }
}

// ---- Helpers ----

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1]!, 16),
    g: parseInt(match[2]!, 16),
    b: parseInt(match[3]!, 16),
  };
}
