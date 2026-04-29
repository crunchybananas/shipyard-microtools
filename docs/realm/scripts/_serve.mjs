// Tiny HTTP server helper for verify scripts. Auto-starts python3
// http.server on port 4711 if not already running. Returns a stop()
// function — but if we DIDN'T start it (someone else owns the port),
// stop() is a no-op so we don't kill the user's manual server.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REALM_ROOT = join(__dirname, '..');
const PORT = Number(process.env.REALM_PORT || 4711);

async function isUp() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/index.html`, { signal: AbortSignal.timeout(800) });
    return res.ok;
  } catch { return false; }
}

export async function ensureServer() {
  if (await isUp()) {
    return { origin: `http://127.0.0.1:${PORT}`, stop: async () => {}, started: false };
  }
  const child = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: REALM_ROOT,
    stdio: ['ignore', 'ignore', 'ignore'],
    detached: false,
  });
  // Wait for it to come up.
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (await isUp()) {
      return {
        origin: `http://127.0.0.1:${PORT}`,
        started: true,
        stop: async () => { try { child.kill('SIGTERM'); } catch {} },
      };
    }
  }
  child.kill('SIGTERM');
  throw new Error(`HTTP server did not come up on port ${PORT}`);
}
