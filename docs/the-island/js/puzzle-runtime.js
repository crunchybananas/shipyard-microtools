// puzzle-runtime.js — fresh, non-persistent state for one Game session.
//
// WorldState owns progress. These values only describe work currently in flight:
// input sequences, clocks, encounter regard, borrowed tableaux, and render caches.

export function resetPuzzleRuntimeState(target) {
  target.anim = {
    chest: 0, vault: 0, hatch: 0, boxLid: 0, innerDoor: 0,
    beamI: 0, shaft: 0, valveSpin: 0, stoneGlow: [0, 0, 0, 0, 0, 0],
    shimmer: 0,
  };

  target.stoneSeq = [];
  target.songSeq = [];
  target.birdTimer = 8;
  target.boxPlaying = false;
  target.glyphsLit = false;
  target.hallLit = false;

  target._brink = false;
  target._refugeBrink = false;
  target._pendHour = 0;
  target._pendHold = 0;
  target._crankAcc = 0;
  target._crankAcc2 = 0;
  target._eraLineT = 0;
  target._lawT = 0;
  target._breachT = null;
  target._farewellT = null;
  target._farewellA0 = 0;
  target._regT = 0;
  target._buoyT = 0;
  target._buoyRing = 0;

  target._watcherRegard = 0;
  target._tideRegard = 0;
  target._tfPrev = null;
  target.watcherEchoT = null;
  target.tideFigureEchoT = null;
  target._lowerLook = 0;
  target._lowerLookTarget = 0;
  target._lowerRegard = 0;
  target._lowerPrev = null;

  target._tabMoor = null;
  target._tabMoorSaved = null;
  target._tabLog = null;
  target._tabLogSaved = null;
  target._tabLogP = null;
  target._tabLight = null;
  target._tabWind = null;
  target._tabWindChirped = false;

  target._causewayNoted = false;
  target._lampLitOnce = false;
  target._walkedBridge = false;
  target._sawOarNudge = false;
  target._level2Study = false;
  target._leftStudy = false;
  target._roomDisagrees = false;

  target._marks = [];
  target._marksFor = null;
  target._heardMarks = new Set();
  target._markCool = 0;
  target._writingFor = null;
  target._upstreamAudioStop = null;

  return target;
}
