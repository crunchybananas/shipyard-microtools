// cdp.mjs — minimal CDP driver for the ABYME headless harness (node 22, global WebSocket).
// Usage: node cdp.mjs <command-file.mjs>
const PORT = Number(process.env.CDP_PORT || 9223);

async function json(path) {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return r.json();
}

export async function connect(url) {
  let targets = await json('/json/list');
  let page = targets.find((t) => t.type === 'page');
  if (!page) page = await json(`/json/new?${encodeURIComponent(url || 'about:blank')}`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  const h = {
    ws, send,
    navigate: async (u) => { await send('Page.navigate', { url: u }); await h.wait(1.5); },
    wait: (s) => new Promise((r) => setTimeout(r, s * 1000)),
    evaluate: async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout: 30000 });
      if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 800));
      return r.result?.result?.value;
    },
    screenshot: async (file) => {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      const { writeFileSync } = await import('node:fs');
      writeFileSync(file, Buffer.from(r.result.data, 'base64'));
      return file;
    },
  };
  return h;
}

const cmdFile = process.argv[2];
if (cmdFile) {
  const mod = await import(cmdFile);
  const h = await connect();
  try {
    await mod.default(h);
  } catch (e) {
    console.error('HARNESS-ERR', e.message || e);
    process.exitCode = 1;
  } finally {
    h.ws.close();
    process.exit(0);
  }
}
