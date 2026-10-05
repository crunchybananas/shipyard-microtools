// Tiny HTTP server helper for verify scripts. Auto-starts scripts/_serve.py
// on 127.0.0.1:4711 (or REALM_PORT) if nothing already serves Realm there.
// Returns a stop() function — but if we DIDN'T start it (someone else owns
// the port), stop() is a no-op so we don't kill the user's manual server.
//
// _serve.py is the standard library's static handler with a real listen
// backlog. `python3 -m http.server` queues only five connections; a browser
// fetching Realm's module graph overflows that, some modules fail with
// ERR_CONNECTION_RESET, and the game never boots.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REALM_ROOT = join(__dirname, '..');
const PORT = Number(process.env.REALM_PORT || 4711);
const ORIGIN = `http://127.0.0.1:${PORT}`;

async function isUp() {
  try {
    const res = await fetch(`${ORIGIN}/index.html`, { signal: AbortSignal.timeout(800) });
    return res.ok;
  } catch { return false; }
}

function httpServer(started, stop) {
  return { origin: ORIGIN, gameUrl: `${ORIGIN}/index.html`, started, mode: 'http', stop };
}

export async function ensureServer() {
  const fallback = {
    origin: null,
    gameUrl: `file://${join(REALM_ROOT, 'index.html')}`,
    started: false,
    mode: 'file',
    stop: async () => {},
  };
  if (await isUp()) return httpServer(false, async () => {});
  const child = spawn('python3', [
    join(__dirname, '_serve.py'), '--port', String(PORT), '--bind', '127.0.0.1', '--directory', REALM_ROOT,
  ], {
    cwd: REALM_ROOT,
    stdio: ['ignore', 'ignore', 'pipe'],
    detached: false,
  });
  // Startup failures are short; keep a bounded tail, not every request error.
  let stderr = '';
  child.stderr.on('data', d => { stderr = (stderr + d).slice(-8192); });
  let running = true;
  const exited = new Promise(resolve => {
    child.once('close', resolve);
    child.once('error', error => { stderr += error.message; resolve(); });
  }).then(() => { running = false; });
  const kill = signal => { try { child.kill(signal); } catch {} };
  // A gate that throws or calls process.exit() before stop() must not orphan
  // a server that later gates would silently reuse.
  const killOnExit = () => kill('SIGTERM');
  process.once('exit', killOnExit);
  const stop = async () => {
    process.removeListener('exit', killOnExit);
    if (!running) return;
    kill('SIGTERM');
    // Resolve once the port is released, so the next gate cannot mistake a
    // dying server for a live one.
    const force = setTimeout(() => kill('SIGKILL'), 2000);
    await exited;
    clearTimeout(force);
  };
  for (let i = 0; i < 25 && running; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (await isUp()) return httpServer(true, stop);
  }
  await stop();
  // A parallel gate may have bound the port first: share it, never own it.
  if (await isUp()) return httpServer(false, async () => {});
  const likelyBindDenied = /permission denied|operation not permitted|eacces/i.test(stderr);
  if (likelyBindDenied) return fallback;
  throw new Error(`HTTP server did not come up on port ${PORT}${stderr ? `: ${stderr.trim()}` : ''}`);
}
