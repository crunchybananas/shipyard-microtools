import { htmlSafe } from "@ember/template";

const toKebabCase = (value: string) => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
};

export function style(named: Record<string, unknown>) {
  const declarations = Object.entries(named)
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    )
    .map(([key, value]) => `${toKebabCase(key)}: ${String(value)};`)
    .join(" ");

  return htmlSafe(declarations);
}
