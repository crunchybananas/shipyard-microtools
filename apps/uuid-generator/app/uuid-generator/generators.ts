// ── ID Generation Utilities ────────────────────────────────────
// Pure functions — no DOM, no side effects.

export function generateUUID4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function generateUUID7(): string {
  const now = Date.now();
  const timestamp = now.toString(16).padStart(12, "0");
  const random = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 65536)
      .toString(16)
      .padStart(4, "0"),
  ).join("");

  return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-7${random.slice(0, 3)}-${(
    0x8 |
    ((Math.random() * 4) | 0)
  ).toString(16)}${random.slice(4, 7)}-${random.slice(7, 19)}`;
}

export function generateNanoId(size = 21): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let id = "";
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  for (let i = 0; i < size; i += 1) {
    id += alphabet[bytes[i]! % alphabet.length];
  }
  return id;
}

export function generateShortId(): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i += 1) {
    id += alphabet[bytes[i]! % alphabet.length];
  }
  return id;
}

// ── Generator registry (data-driven) ──────────────────────────

export interface GeneratorDef {
  id: string;
  title: string;
  description: string;
  generate: () => string;
}

export const GENERATORS: GeneratorDef[] = [
  { id: "uuid4", title: "UUID v4", description: "Random 128-bit identifier", generate: generateUUID4 },
  { id: "uuid7", title: "UUID v7", description: "Time-ordered, sortable UUID", generate: generateUUID7 },
  { id: "nanoid", title: "Nano ID", description: "Compact URL-safe ID (21 chars)", generate: generateNanoId },
  { id: "shortid", title: "Short ID", description: "8-character alphanumeric", generate: generateShortId },
];
