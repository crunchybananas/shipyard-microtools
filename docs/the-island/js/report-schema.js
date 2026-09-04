// report-schema.js — the one replayable field-report shape.
//
// A screenshot may document any frame, but deterministic in-world replay is limited
// to settled play. Transitions own timers and animation state that the save contract
// deliberately does not persist, so accepting them here would promise a false frame.

import { isPackedSavePayload } from './save-schema.js';

export const REPORT_VERSION = 2;
export const STABLE_PLAY_REPLAY = 'stable-play';
export const OBSERVATION_ONLY = 'observation-only';
export const REPORT_THUMBNAIL_MAX_CHARS = 120_000;
export const REPORT_MODES = Object.freeze(['title', 'intro', 'play', 'dive', 'ascend', 'finale']);

const isReportMode = (mode) => REPORT_MODES.includes(mode);

const finiteTuple = (value, length) => Array.isArray(value)
  && value.length === length
  && value.every(Number.isFinite);

export function stablePlayReplay(mode, atTop) {
  if (mode !== 'play') {
    throw new Error(`field reports replay settled play only; current mode is ${mode || 'unknown'}`);
  }
  return { kind: STABLE_PLAY_REPLAY, atTop: atTop === true };
}

export function observationOnly(mode, reason) {
  if (!isReportMode(mode)) {
    throw new Error(`unsupported field report mode: ${mode || 'unknown'}`);
  }
  return {
    kind: OBSERVATION_ONLY,
    mode,
    reason: typeof reason === 'string' && reason ? reason : 'the captured frame is not settled play',
  };
}

export function parseFieldReport(value) {
  const report = typeof value === 'string' ? JSON.parse(value) : value;
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('field report must be an object');
  }
  if (report.v !== REPORT_VERSION) {
    throw new Error(`field report version ${REPORT_VERSION} is required`);
  }
  if (typeof report.t !== 'string' || !report.t.trim()) {
    throw new Error('field report needs a stable timestamp');
  }
  if (!finiteTuple(report.pos, 3) || !Number.isFinite(report.yaw) || !Number.isFinite(report.pitch)) {
    throw new Error('field report has an invalid player pose');
  }
  if (!isReportMode(report.mode)) {
    throw new Error(`unsupported field report mode: ${report.mode || 'unknown'}`);
  }
  if (!isPackedSavePayload(report.save)) {
    throw new Error('field report does not contain a current save');
  }
  if (report.thumbnail !== undefined && (
    typeof report.thumbnail !== 'string'
    || !report.thumbnail.startsWith('data:image/jpeg;base64,')
    || report.thumbnail.length > REPORT_THUMBNAIL_MAX_CHARS
  )) throw new Error('field report has an invalid observation thumbnail');
  const stable = report.replay?.kind === STABLE_PLAY_REPLAY;
  const observation = report.replay?.kind === OBSERVATION_ONLY;
  if (!stable && !observation) throw new Error('field report has no recognized capture kind');
  if (stable && (report.mode !== 'play' || typeof report.replay.atTop !== 'boolean')) {
    throw new Error('stable-play report needs play mode and a gallery position');
  }
  if (observation && (
    typeof report.mode !== 'string'
    || report.replay.mode !== report.mode
    || typeof report.replay.reason !== 'string'
    || !report.replay.reason
  )) throw new Error('observation-only report needs its captured mode and reason');

  return {
    report,
    save: report.save,
    pos: [...report.pos],
    yaw: report.yaw,
    pitch: report.pitch,
    replayable: stable,
    atTop: stable ? report.replay.atTop : null,
  };
}

export function parseReplayReport(value) {
  const parsed = parseFieldReport(value);
  if (!parsed.replayable) {
    throw new Error(`observation-only ${parsed.report.mode} report; the captured frame cannot be replayed as gameplay`);
  }
  return parsed;
}
