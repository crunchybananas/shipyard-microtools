// Rate Limit Playground
// Fully client-side simulation of token bucket and sliding window rate limiters.

// --- Pure limiter logic (no DOM) ---

function createBucket(capacity, refillRate, now) {
  return { capacity, refillRate, tokens: capacity, lastRefill: now };
}

function refillBucket(bucket, now) {
  const elapsed = Math.max(0, now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refillRate);
  bucket.lastRefill = now;
}

function tryTokenBucket(bucket, now) {
  refillBucket(bucket, now);
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

function createSlidingWindow(limit, windowMs) {
  return { limit, windowMs, timestamps: [] };
}

function pruneWindow(win, now) {
  const cutoff = now - win.windowMs;
  while (win.timestamps.length && win.timestamps[0] <= cutoff) {
    win.timestamps.shift();
  }
}

function trySlidingWindow(win, now) {
  pruneWindow(win, now);
  if (win.timestamps.length < win.limit) {
    win.timestamps.push(now);
    return true;
  }
  return false;
}

// --- UI wiring ---

document.addEventListener('DOMContentLoaded', () => {
  const VIZ_MS = 30000; // timeline horizon
  const TICK_STRIP = 30; // px reserved at the bottom for request ticks

  const EXPLAINERS = {
    bucket:
      'A token bucket holds up to N tokens and refills continuously at a steady rate. ' +
      'Each request spends one token, so short bursts pass instantly (up to the bucket size) ' +
      'while sustained traffic is capped at the refill rate.',
    window:
      'A sliding window counts every request in the trailing window. A request is allowed only ' +
      'if fewer than N requests happened in the last W seconds — bursts can never exceed the ' +
      'limit, but a big burst blocks traffic until it ages out.'
  };

  // Elements
  const tabs = document.querySelectorAll('.algo-tab');
  const algoExplainer = document.getElementById('algoExplainer');
  const limitSlider = document.getElementById('limitSlider');
  const limitLabel = document.getElementById('limitLabel');
  const limitValue = document.getElementById('limitValue');
  const rateSlider = document.getElementById('rateSlider');
  const rateLabel = document.getElementById('rateLabel');
  const rateValue = document.getElementById('rateValue');
  const sendBtn = document.getElementById('sendBtn');
  const burstBtn = document.getElementById('burstBtn');
  const autoToggle = document.getElementById('autoToggle');
  const autoRateSlider = document.getElementById('autoRateSlider');
  const autoRateValue = document.getElementById('autoRateValue');
  const canvas = document.getElementById('vizCanvas');
  const ctx = canvas.getContext('2d');
  const meterIcon = document.getElementById('meterIcon');
  const meterTitle = document.getElementById('meterTitle');
  const meterValue = document.getElementById('meterValue');
  const meterFill = document.getElementById('meterFill');
  const meterStatus = document.getElementById('meterStatus');
  const acceptValue = document.getElementById('acceptValue');
  const acceptFill = document.getElementById('acceptFill');
  const acceptStatus = document.getElementById('acceptStatus');
  const resetBtn = document.getElementById('resetBtn');

  // State
  let algo = 'bucket';
  const cfg = {
    bucket: { capacity: 5, refillRate: 1 },
    window: { limit: 5, windowSec: 10 }
  };
  let bucket = createBucket(cfg.bucket.capacity, cfg.bucket.refillRate, performance.now());
  let slidingWin = createSlidingWindow(cfg.window.limit, cfg.window.windowSec * 1000);
  const stats = { allowed: 0, denied: 0 };
  let events = []; // { t, allowed }
  let samples = []; // { t, frac } headroom over time
  let autoTimer = null;
  let lastMeterUpdate = 0;

  function sendRequest() {
    const now = performance.now();
    const ok = algo === 'bucket'
      ? tryTokenBucket(bucket, now)
      : trySlidingWindow(slidingWin, now);

    if (ok) {
      stats.allowed += 1;
    } else {
      stats.denied += 1;
    }
    events.push({ t: now, allowed: ok });

    // Keep the event list bounded even while the tab is hidden
    const cutoff = now - VIZ_MS - 1000;
    while (events.length && events[0].t < cutoff) {
      events.shift();
    }
  }

  // Fraction of capacity still available (0 = at the limit)
  function headroom(now) {
    if (algo === 'bucket') {
      refillBucket(bucket, now);
      return bucket.capacity > 0 ? bucket.tokens / bucket.capacity : 0;
    }
    pruneWindow(slidingWin, now);
    return slidingWin.limit > 0
      ? Math.max(0, (slidingWin.limit - slidingWin.timestamps.length) / slidingWin.limit)
      : 0;
  }

  function applyAlgoLabels() {
    algoExplainer.textContent = EXPLAINERS[algo];
    meterIcon.textContent = algo === 'bucket' ? '🪣' : '🪟';
    meterTitle.textContent = algo === 'bucket' ? 'Tokens Available' : 'Requests in Window';
  }

  function configureSliders() {
    if (algo === 'bucket') {
      limitLabel.textContent = 'Bucket capacity';
      limitSlider.min = '1';
      limitSlider.max = '20';
      limitSlider.step = '1';
      limitSlider.value = String(cfg.bucket.capacity);
      rateLabel.textContent = 'Refill rate';
      rateSlider.min = '0.5';
      rateSlider.max = '10';
      rateSlider.step = '0.5';
      rateSlider.value = String(cfg.bucket.refillRate);
    } else {
      limitLabel.textContent = 'Max requests';
      limitSlider.min = '1';
      limitSlider.max = '20';
      limitSlider.step = '1';
      limitSlider.value = String(cfg.window.limit);
      rateLabel.textContent = 'Window length';
      rateSlider.min = '1';
      rateSlider.max = '30';
      rateSlider.step = '1';
      rateSlider.value = String(cfg.window.windowSec);
    }
    updateSliderReadouts();
  }

  function updateSliderReadouts() {
    limitValue.textContent = limitSlider.value;
    rateValue.textContent = algo === 'bucket'
      ? `${rateSlider.value}/s`
      : `${rateSlider.value}s`;
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.algo === algo) return;
      algo = tab.dataset.algo;
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      // Fresh limiter state so the two algorithms don't bleed into each other
      bucket = createBucket(cfg.bucket.capacity, cfg.bucket.refillRate, performance.now());
      slidingWin = createSlidingWindow(cfg.window.limit, cfg.window.windowSec * 1000);
      applyAlgoLabels();
      configureSliders();
    });
  });

  limitSlider.addEventListener('input', () => {
    const v = Number(limitSlider.value);
    if (algo === 'bucket') {
      cfg.bucket.capacity = v;
      bucket.capacity = v;
      bucket.tokens = Math.min(bucket.tokens, v);
    } else {
      cfg.window.limit = v;
      slidingWin.limit = v;
    }
    updateSliderReadouts();
  });

  rateSlider.addEventListener('input', () => {
    const v = Number(rateSlider.value);
    if (algo === 'bucket') {
      // Settle accrued tokens at the old rate before switching
      refillBucket(bucket, performance.now());
      cfg.bucket.refillRate = v;
      bucket.refillRate = v;
    } else {
      cfg.window.windowSec = v;
      slidingWin.windowMs = v * 1000;
    }
    updateSliderReadouts();
  });

  sendBtn.addEventListener('click', sendRequest);

  burstBtn.addEventListener('click', () => {
    for (let i = 0; i < 10; i++) {
      sendRequest();
    }
  });

  function restartAutoTimer() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    if (autoToggle.checked) {
      autoTimer = setInterval(sendRequest, 1000 / Number(autoRateSlider.value));
    }
  }

  autoToggle.addEventListener('change', restartAutoTimer);

  autoRateSlider.addEventListener('input', () => {
    autoRateValue.textContent = `${autoRateSlider.value}/s`;
    restartAutoTimer();
  });

  resetBtn.addEventListener('click', () => {
    stats.allowed = 0;
    stats.denied = 0;
    events = [];
    samples = [];
    bucket = createBucket(cfg.bucket.capacity, cfg.bucket.refillRate, performance.now());
    slidingWin = createSlidingWindow(cfg.window.limit, cfg.window.windowSec * 1000);
  });

  function updateMeterCard(now) {
    let valueText;
    let fillFrac;
    let statusText;

    if (algo === 'bucket') {
      valueText = `${bucket.tokens.toFixed(1)} / ${bucket.capacity}`;
      fillFrac = bucket.capacity > 0 ? bucket.tokens / bucket.capacity : 0;
      if (bucket.tokens >= 1) {
        const ready = Math.floor(bucket.tokens);
        statusText = `${ready} request${ready === 1 ? '' : 's'} ready`;
      } else {
        const eta = (1 - bucket.tokens) / bucket.refillRate;
        statusText = `Next token in ${eta.toFixed(1)}s`;
      }
    } else {
      const used = slidingWin.timestamps.length;
      valueText = `${used} / ${slidingWin.limit}`;
      fillFrac = slidingWin.limit > 0 ? used / slidingWin.limit : 1;
      if (used < slidingWin.limit) {
        statusText = `${slidingWin.limit - used} remaining`;
      } else {
        const eta = Math.max(0, (slidingWin.timestamps[0] + slidingWin.windowMs - now) / 1000);
        statusText = `Free slot in ${eta.toFixed(1)}s`;
      }
    }

    const room = headroom(now);
    const cls = room <= 0 ? ' danger' : room < 0.25 ? ' warning' : '';
    meterValue.textContent = valueText;
    meterFill.style.width = `${Math.round(Math.max(0, Math.min(1, fillFrac)) * 100)}%`;
    meterFill.className = `counter-fill${cls}`;
    meterStatus.className = `counter-status${cls}`;
    meterStatus.textContent = statusText;

    const total = stats.allowed + stats.denied;
    const pct = total > 0 ? (stats.allowed / total) * 100 : null;
    const aCls = pct !== null && pct < 50 ? ' danger' : pct !== null && pct < 80 ? ' warning' : '';
    acceptValue.textContent = pct === null ? '—' : `${Math.round(pct)}%`;
    acceptFill.style.width = pct === null ? '0%' : `${Math.round(pct)}%`;
    acceptFill.className = `counter-fill${aCls}`;
    acceptStatus.className = `counter-status${aCls}`;
    acceptStatus.textContent = total > 0
      ? `${stats.allowed} allowed · ${stats.denied} denied`
      : 'No requests yet';
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    const now = performance.now();

    // Sample current headroom and prune history beyond the horizon
    samples.push({ t: now, frac: headroom(now) });
    const cutoff = now - VIZ_MS - 1000;
    while (samples.length && samples[0].t < cutoff) {
      samples.shift();
    }
    while (events.length && events[0].t < cutoff) {
      events.shift();
    }

    resizeCanvas();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const chartTop = 8;
    const chartBottom = h - TICK_STRIP;
    const chartH = chartBottom - chartTop;

    ctx.clearRect(0, 0, w, h);

    const xFor = t => w - ((now - t) / VIZ_MS) * w;
    const yFor = f => chartBottom - Math.max(0, Math.min(1, f)) * chartH;

    // Gridlines at 100% and 50% headroom
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    [1, 0.5].forEach(f => {
      ctx.beginPath();
      ctx.moveTo(0, yFor(f));
      ctx.lineTo(w, yFor(f));
      ctx.stroke();
    });

    // The limit: zero headroom — requests are denied when the curve sits here
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, chartBottom);
    ctx.lineTo(w, chartBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Headroom area + line
    if (samples.length > 1) {
      ctx.beginPath();
      samples.forEach((s, i) => {
        if (i === 0) {
          ctx.moveTo(xFor(s.t), yFor(s.frac));
        } else {
          ctx.lineTo(xFor(s.t), yFor(s.frac));
        }
      });
      ctx.lineTo(xFor(samples[samples.length - 1].t), chartBottom);
      ctx.lineTo(xFor(samples[0].t), chartBottom);
      ctx.closePath();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.fill();

      ctx.beginPath();
      samples.forEach((s, i) => {
        if (i === 0) {
          ctx.moveTo(xFor(s.t), yFor(s.frac));
        } else {
          ctx.lineTo(xFor(s.t), yFor(s.frac));
        }
      });
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Request ticks: allowed short green, denied tall red
    events.forEach(ev => {
      const x = xFor(ev.t);
      if (x < -2) return;
      const tickH = ev.allowed ? 12 : 18;
      ctx.fillStyle = ev.allowed ? '#22c55e' : '#ef4444';
      ctx.fillRect(x - 1, h - 6 - tickH, 2, tickH);
    });

    // Time labels
    ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`-${VIZ_MS / 1000}s`, 6, chartTop + 10);
    ctx.textAlign = 'right';
    ctx.fillText('now', w - 6, chartTop + 10);

    // Throttle the DOM meter updates
    if (now - lastMeterUpdate > 150) {
      lastMeterUpdate = now;
      updateMeterCard(now);
    }

    requestAnimationFrame(draw);
  }

  // Initialize
  applyAlgoLabels();
  configureSliders();
  autoRateValue.textContent = `${autoRateSlider.value}/s`;
  window.addEventListener('resize', resizeCanvas);
  requestAnimationFrame(draw);
});
