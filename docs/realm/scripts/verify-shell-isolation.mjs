// Browser-level core/shell isolation gate. Two deliberately different native
// Math.random streams and a core-only host must converge to the same
// authoritative snapshot while their ambient presentation state differs.

import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { ensureServer } from './_serve.mjs';

const server = await ensureServer();
const browser = await chromium.launch({ headless: true });
const TICKS = 7200;

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function firstDifferences(leftText, rightText, limit = 12) {
  const left = JSON.parse(leftText);
  const right = JSON.parse(rightText);
  const differences = [];
  const visit = (a, b, path) => {
    if (differences.length >= limit || Object.is(a, b)) return;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
      differences.push(`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
      return;
    }
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const key of keys) visit(a[key], b[key], `${path}.${key}`);
  };
  visit(left, right, '$');
  return differences;
}

async function run(mode, nativeSeed) {
  const context = await browser.newContext({ viewport: { width: 960, height: 640 } });
  await context.addInitScript(seed => {
    let state = seed >>> 0;
    Math.random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }, nativeSeed);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  try {
    await page.goto(`${server.gameUrl}?v=shell-isolation-${mode}-${nativeSeed}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => typeof window.startNewGame === 'function' && window.G?.debug?.step);
    const result = await page.evaluate(async ({ mode, ticks }) => {
      const economy = await import('./js/economy.js?realm=195');
      const sim = await import('./js/sim.js?realm=195');
      const stateModule = await import('./js/state.js?realm=195');
      const missionModule = await import('./js/missions.js?realm=195');
      const name = document.getElementById('kingdom-name-input');
      if (name) name.value = 'Shell Isolation Realm';
      window.startNewGame();
      const g = window.G;
      g.speed = 0;
      g.debug.disableEvents = true;
      g.nextRaidDay = 9999;
      for (const key of Object.keys(g.resources)) g.resources[key] = 10000;
      g.researchedTechs = new Set([
        'agriculture', 'forestry', 'masonry', 'commerce', 'military',
        'brewing', 'architecture', 'baking', 'husbandry', 'smithing',
      ]);
      for (const row of g.fog) row.fill(true);

      const candidates = [];
      for (let y = 1; y < g.map.length - 1; y++) {
        for (let x = 1; x < g.map[y].length - 1; x++) {
          candidates.push({ x, y, d: Math.abs(x - 40) + Math.abs(y - 40) });
        }
      }
      candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
      const place = type => {
        for (const { x, y } of candidates) {
          if (g.debug.dispatch({ type: 'PLACE_BUILDING', building: type, x, y }).ok) return;
        }
        throw new Error(`Could not place ${type}`);
      };
      for (const type of [
        'house', 'house', 'house', 'house', 'house', 'house',
        'farm', 'farm', 'lumber', 'quarry', 'storehouse', 'granary',
        'market', 'tavern', 'school', 'blacksmith', 'barracks',
      ]) place(type);
      for (const building of g.buildings) building.buildProgress = 1;
      economy.trySpawnSettlers(18);
      g.resources.food = 10000;

      if (mode === 'core') {
        for (let tick = 0; tick < ticks; tick++) sim.coreTick();
      } else {
        g.debug.step(ticks);
      }

      const collections = [
        ['building', 'buildings'], ['citizen', 'citizens'], ['soldier', 'soldiers'],
        ['enemy', 'enemies'], ['projectile', 'projectiles'], ['walker', 'walkers'],
        ['caravan', 'caravans'],
      ];
      const references = new Map();
      for (const [kind, key] of collections) {
        (g[key] || []).forEach((entity, index) => references.set(entity, `${kind}:${index}`));
      }
      if (g.avatar) references.set(g.avatar, 'avatar:0');
      const renderFields = Object.fromEntries(Object.entries(
        stateModule.RESETTABLE_PRESENTATION_ENTITY_FIELDS,
      ).map(([kind, fields]) => [kind, new Set(fields)]));
      const normalize = (value, entityRoot = null, entityKind = null, ancestors = new Set()) => {
        if (value === undefined) return { $undefined: true };
        if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
        if (typeof value === 'number') {
          if (!Number.isFinite(value) || Object.is(value, -0)) throw new TypeError('Invalid authoritative number');
          return value;
        }
        if (references.has(value) && value !== entityRoot) return { $ref: references.get(value) };
        if (ancestors.has(value)) throw new TypeError('Unresolved authoritative cycle');
        const next = new Set(ancestors);
        next.add(value);
        if (value instanceof Set) {
          const entries = [...value].map(item => normalize(item, null, null, next));
          entries.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
          return { $set: entries };
        }
        if (Array.isArray(value)) {
          const items = value.map(item => normalize(item, null, null, next));
          const properties = {};
          for (const key of Object.keys(value).filter(key => !/^(0|[1-9]\d*)$/.test(key)).sort()) {
            properties[key] = normalize(value[key], null, null, next);
          }
          return Object.keys(properties).length ? { $array: items, $properties: properties } : items;
        }
        const output = {};
        const excluded = renderFields[entityKind] || new Set();
        for (const key of Object.keys(value).sort()) {
          if (excluded.has(key)) continue;
          output[key] = normalize(value[key], null, null, next);
        }
        return output;
      };

      const excludedRoot = new Set([
        ...stateModule.AUTHORITATIVE_SIMULATION_EXCLUDED_G_KEYS,
        // Debug methods are process-local; its sole authoritative flag is
        // projected explicitly below.
        'debug',
      ]);
      const authoritativeKeys = Object.keys(g).filter(key => !excludedRoot.has(key));
      const snapshot = {};
      const collectionKinds = new Map(collections.map(([kind, key]) => [key, kind]));
      for (const key of authoritativeKeys.sort()) {
        const value = g[key];
        if (collectionKinds.has(key)) {
          const kind = collectionKinds.get(key);
          snapshot[key] = (value || []).map(entity => normalize(entity, entity, kind));
        } else if (key === 'avatar' && value) {
          snapshot.avatar = normalize(value, value, 'avatar');
        } else {
          snapshot[key] = normalize(value);
        }
      }
      snapshot.debug = { disableEvents: g.debug.disableEvents === true };
      snapshot.rngSeed = stateModule.getSeed();
      snapshot.missions = missionModule.missions.map(mission => ({
        id: mission.id,
        done: mission.done,
        celebratedTick: mission._celebratedTick ?? null,
      }));
      const ambient = {
        particles: g.particles.length,
        animals: g.animals.length,
        carts: g.carts?.length || 0,
        birds: g.birds?.length || 0,
        boats: g.boats?.length || 0,
        flocks: g.flocks?.length || 0,
        wolves: g.wolves?.length || 0,
        footprints: g.footprints?.length || 0,
      };
      return { snapshot: JSON.stringify(snapshot), ambient };
    }, { mode, ticks: TICKS });
    if (errors.length) throw new Error(`${mode} browser errors: ${errors.join(' | ')}`);
    return result;
  } finally {
    await context.close();
  }
}

try {
  const low = await run('shell-low', 1);
  const high = await run('shell-high', 0xfedcba98);
  const core = await run('core', 123456789);
  if (low.snapshot !== high.snapshot || low.snapshot !== core.snapshot) {
    throw new Error(`Authoritative shell isolation failed: low=${hash(low.snapshot)} high=${hash(high.snapshot)} core=${hash(core.snapshot)}\n`
      + firstDifferences(low.snapshot, core.snapshot).join('\n'));
  }
  const ambientFingerprints = new Set([low, high, core].map(result => JSON.stringify(result.ambient)));
  if (ambientFingerprints.size < 2) throw new Error('Hostile shell controls did not produce different ambient state');
  console.log(`✓ shell/native-random perturbations preserve authoritative hash ${hash(core.snapshot).slice(0, 20)}…`);
  console.log(`✓ ambient controls differ: low=${JSON.stringify(low.ambient)} high=${JSON.stringify(high.ambient)} core=${JSON.stringify(core.ambient)}`);
  console.log(`[shell-isolation] OK — ${TICKS} ticks across two shell hosts and one core-only host`);
} finally {
  await browser.close();
  await server.stop();
}
