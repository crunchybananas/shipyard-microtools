// Read-only diagnostics over the causal Phase 1A ownership stream.

import { G } from './state.js?realm=187';
import { onCitizenTransition } from './citizen-ownership.js?realm=187';
import { buildCurrentCitizenPresentations } from './citizen-presentation.js?realm=187';

const MAX_TRANSITIONS = 2_000;
const ledger = [];
let panel = null;
let captureEnabled = false;
let subscribed = false;

function capture(event) {
  if (!captureEnabled) return;
  ledger.push(event);
  if (ledger.length > MAX_TRANSITIONS) ledger.splice(0, ledger.length - MAX_TRANSITIONS);
  renderInspector();
}

function ensureSubscription() {
  if (subscribed) return;
  subscribed = true;
  onCitizenTransition(capture);
}

export function resetCitizenTransitionLedger() {
  ledger.length = 0;
  renderInspector();
}

export function getCitizenTransitionLedger({ actorId = null, limit = 200 } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new TypeError('limit must be a non-negative safe integer');
  }
  if (actorId !== null && (!Number.isSafeInteger(actorId) || actorId < 1)) {
    throw new TypeError('actorId must be null or a positive safe integer');
  }
  const values = actorId === null ? ledger : ledger.filter(entry => entry.actorId === actorId);
  return values.slice(Math.max(0, values.length - limit)).map(entry => ({
    ...entry,
    oldValue: entry.oldValue ? structuredClone(entry.oldValue) : null,
    newValue: entry.newValue ? structuredClone(entry.newValue) : null,
  }));
}

export function inspectCitizen(actorId = G.selectedCitizenId) {
  const snapshots = buildCurrentCitizenPresentations();
  const snapshot = actorId === null
    ? snapshots[0] || null
    : snapshots.find(value => value.actorId === actorId) || null;
  if (!snapshot) return null;
  const assignment = snapshot.assignment;
  return {
    actorId: snapshot.actorId,
    identity: snapshot.identity,
    profession: snapshot.profession,
    assignment,
    activity: snapshot.activity,
    cargo: snapshot.carrying && snapshot.carryAmount > 0
      ? `${snapshot.carrying}:${snapshot.carryAmount}`
      : null,
    waitAge: snapshot.waitAge,
    lastTransition: getCitizenTransitionLedger({ actorId: snapshot.actorId, limit: 1 })[0] || null,
    recentTransitions: getCitizenTransitionLedger({ actorId: snapshot.actorId, limit: 12 }),
  };
}

function renderInspector() {
  if (!panel) return;
  const value = inspectCitizen();
  if (!value) {
    panel.textContent = 'NPC inspector · no citizen selected';
    return;
  }
  const assignment = value.assignment
    ? `${value.assignment.purpose}:${value.assignment.duty}@${value.assignment.building.x},${value.assignment.building.y}`
    : 'none';
  const lines = [
    `NPC #${value.actorId} · ${value.identity.name}`,
    `appearance ${value.identity.appearanceId} · vocation ${value.profession.kind}`,
    `assignment ${assignment}`,
    `activity ${value.activity.kind} · since ${value.activity.sinceTick}`,
    `cargo ${value.cargo || 'none'} · wait ${value.waitAge}`,
    `reason ${value.lastTransition?.reason || 'none recorded'}`,
  ];
  panel.textContent = lines.join('\n');
}

export function initCitizenInspector({ enabled = false } = {}) {
  ensureSubscription();
  captureEnabled = !!enabled;
  if (typeof window !== 'undefined') {
    window.realmNpcDebug = Object.freeze({
      inspect: inspectCitizen,
      transitions: getCitizenTransitionLedger,
      reset: resetCitizenTransitionLedger,
      enable(value = true) { captureEnabled = !!value; },
    });
  }
  if (!enabled || typeof document === 'undefined') return;
  panel = document.createElement('pre');
  panel.id = 'npc-debug-inspector';
  panel.style.cssText = 'position:fixed;left:0.75rem;top:4.1rem;z-index:120;max-width:30rem;margin:0;padding:0.65rem 0.75rem;border:1px solid rgba(255,209,102,.55);border-radius:7px;background:rgba(4,9,13,.9);color:#f6e7b0;font:12px/1.45 ui-monospace,monospace;pointer-events:none;white-space:pre-wrap';
  document.body.appendChild(panel);
  renderInspector();
}
