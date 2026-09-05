import {
  TRACKS,
  SESSION_NAMES,
  STORAGE_KEY,
  createProject,
  validateProject,
  clone,
  clamp,
  degreeMidi,
  noteName,
  audible,
  rng,
  songBars,
  locateBar,
  barSeconds,
  stepSeconds,
  macroAt,
  eventsForStep,
} from "./score.mjs";
import { SoundEngine, renderAudio, encodeWav, TAIL_SECONDS } from "./audio.mjs";
import { Orbit } from "./orbit.mjs";
const $ = (id) => document.getElementById(id);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const minutes = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const keys = ["a", "s", "d", "f", "g", "h", "j", "k"];
let project = createProject(),
  restoreMessage = "";
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) project = validateProject(JSON.parse(raw));
} catch {
  restoreMessage =
    "The saved session could not be opened. Your stored copy is untouched; a fresh session is ready.";
}
let engine,
  context,
  starting = false,
  playing = false,
  runToken = 0,
  mode = "song",
  selectedTrack = -1;
let nextBar = 0,
  nextStep = 0,
  barStart = 0,
  barTempo = project.bpm,
  barSwing = project.swing,
  loopBar = 0;
let scheduledScene = project.scene,
  scheduledLocation,
  queuedScene = null,
  endTime = null,
  timer,
  queue = [],
  lastFrame = null;
let capture = null,
  captureRequested = false,
  macro = {
    x: project.scenes[project.scene].color,
    y: project.scenes[project.scene].space,
  };
let dragging = false,
  saveTimer,
  toastTimer,
  rendering = false,
  variation = 1,
  sliderGesture = false;
const history = [],
  recentFrames = [];
const orbit = new Orbit($("orbit"));

function notify(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 4500);
}
function checkpoint() {
  history.push(clone(project));
  if (history.length > 24) history.shift();
  $("undo").disabled = false;
  $("undo-project").disabled = false;
}
function persist() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    $("save-state").textContent = "Saved on this device";
  } catch {
    $("save-state").textContent = "Download a project to keep your work";
  }
}
function changed() {
  $("save-state").textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 220);
  orbit.dirty = true;
}
function edit(action, render = true) {
  checkpoint();
  action();
  if (engine) {
    engine.project = project;
    engine.updateMix();
  }
  changed();
  if (render) renderAll();
}
function scene() {
  return project.scenes[project.scene];
}
function setMode(next) {
  mode = next;
  $("song-mode").classList.toggle("active", mode === "song");
  $("loop-mode").classList.toggle("active", mode === "loop");
  $("song-mode").setAttribute("aria-pressed", mode === "song");
  $("loop-mode").setAttribute("aria-pressed", mode === "loop");
}
function chordLabel(degree) {
  const root = degreeMidi(project.root, degree),
    intervals = [2, 4, 6].map(
      (n) => degreeMidi(project.root, degree + n) - root,
    );
  const name = noteName(root).replace(/\d+$/, "");
  return (
    name +
    (intervals[1] === 6
      ? "ø7"
      : intervals[0] === 3
        ? "m7"
        : intervals[2] === 11
          ? "maj7"
          : "7")
  );
}
function renderScenes() {
  const focused = $("scenes").contains(document.activeElement)
    ? document.activeElement.dataset.scene
    : undefined;
  const subtitles = [
    "A spark in the dark",
    "Find the pulse",
    "Room to disappear",
    "The long way home",
  ];
  $("scenes").innerHTML = project.scenes
    .map(
      (s, i) =>
        `<button class="scene ${i === project.scene ? "active" : ""} ${i === queuedScene ? "queued" : ""}" data-scene="${i}" aria-pressed="${i === project.scene}" aria-label="Launch ${escape(s.name)}"><span class="scene-top"><span class="scene-name">${escape(s.name)}</span><span class="scene-number">${i + 1}</span></span><span class="scene-bottom"><span>${i === queuedScene ? "Queued for next bar" : subtitles[i]}</span><span>${i === project.scene ? (playing ? "Playing" : "Selected") : "↗"}</span></span><span class="scene-progress"></span></button>`,
    )
    .join("");
  if (focused !== undefined)
    $("scenes")
      .querySelector(`[data-scene="${focused}"]`)
      ?.focus({ preventScroll: true });
  $("pattern-heading").textContent = `Inside ${scene().name}`;
  $("scene-help").textContent =
    queuedScene !== null
      ? `${project.scenes[queuedScene].name} arrives at the next bar.`
      : playing
        ? "Launch a scene. It lands on the next bar."
        : "Four scenes. One continuous night.";
}
function renderTracks() {
  $("tracks").innerHTML = TRACKS.map(
    (track, i) =>
      `<div class="track-row ${audible(project, i) ? "" : "muted"}" style="--track:${track.color}" data-track="${i}"><div class="track-controls"><button class="track-name ${selectedTrack === i ? "selected" : ""}" data-voice="${i}" aria-label="Edit ${track.name}" aria-expanded="${selectedTrack === i}"><i></i>${track.name}</button><button class="mini" data-mute="${i}" aria-label="Mute ${track.name}" aria-pressed="${project.tracks[i].muted}">M</button><button class="mini" data-solo="${i}" aria-label="Solo ${track.name}" aria-pressed="${project.tracks[i].solo}">S</button></div><div class="step-row">${scene()
        .patterns[i].map((cell, s) => stepHTML(i, s, cell))
        .join("")}</div></div>`,
  ).join("");
}
function stepHTML(track, step, cell) {
  const label = TRACKS[track].drum
    ? ""
    : noteName(degreeMidi(project.root + (track === 3 ? -12 : 0), cell.n));
  return `<button class="step ${cell.v ? "on" : ""} ${cell.v > 0.9 ? "accent" : ""} ${playing && lastFrame?.step === step ? "current" : ""}" data-step="${step}" data-track="${track}" aria-label="${TRACKS[track].name} step ${step + 1}${label ? ", " + label : ""}" aria-pressed="${!!cell.v}" title="${cell.v ? Math.round(cell.v * 100) + "% velocity" : "Add note"}">${cell.v ? label : ""}</button>`;
}
function renderEditor() {
  const open = selectedTrack >= 0;
  $("voice-editor").hidden = !open;
  if (!open) return;
  const track = TRACKS[selectedTrack],
    params = project.tracks[selectedTrack];
  $("voice-editor").style.setProperty("--track", track.color);
  $("voice-name").textContent = `${track.name} / ${track.voice}`;
  $("voice-help").textContent = track.drum
    ? "Shape the voice across every scene."
    : "Notes follow the key and chord progression.";
  $("track-level").value = params.level * 100;
  $("track-tone").value = params.tone * 100;
  $("track-pan").value = params.pan * 100;
  $("piano-roll").parentElement.hidden = track.drum;
  $("piano-help").hidden = track.drum;
  if (!track.drum)
    $("piano-roll").innerHTML = Array.from({ length: 15 }, (_, row) => {
      const n = 14 - row,
        label = noteName(
          degreeMidi(project.root + (selectedTrack === 3 ? -12 : 0), n),
        );
      return `<span class="note-label">${label}</span>${scene()
        .patterns[selectedTrack].map(
          (cell, step) =>
            `<button class="piano-cell ${cell.v && cell.n === n ? "on" : ""}" data-note="${n}" data-step="${step}" aria-pressed="${!!cell.v && cell.n === n}" aria-label="${label}, step ${step + 1}"></button>`,
        )
        .join("")}`;
    }).join("");
}
function renderArrangement() {
  $("arrangement").innerHTML = project.arrangement
    .map(
      (part, i) =>
        `<div class="arrangement-part ${playing && mode === "song" && lastFrame?.section === i ? "active" : ""}" style="--bars:${part.bars}"><span class="part-number">${String(i + 1).padStart(2, "0")}</span><div class="part-fields"><select data-section="${i}" aria-label="Section ${i + 1} scene">${project.scenes.map((s, j) => `<option value="${j}" ${j === part.scene ? "selected" : ""}>${escape(s.name)}</option>`).join("")}</select><label><input data-bars="${i}" type="number" min="1" max="16" value="${part.bars}" aria-label="Section ${i + 1} bars"> bars</label></div><button class="remove-part" data-remove="${i}" aria-label="Remove section ${i + 1}" ${project.arrangement.length === 1 ? "disabled" : ""}>×</button></div>`,
    )
    .join("");
  $("song-duration").textContent =
    `${songBars(project)} bars / ${minutes(songBars(project) * barSeconds(project.bpm))}`;
  $("add-section").disabled =
    project.arrangement.length >= 8 || songBars(project) >= 64;
}
function renderMacro() {
  $("pad-crosshair").style.left = `${macro.x * 100}%`;
  $("pad-crosshair").style.top = `${(1 - macro.y) * 100}%`;
  $("color").value = Math.round(macro.x * 100);
  $("space").value = Math.round(macro.y * 100);
  $("color-value").textContent = Math.round(macro.x * 100);
  $("space-value").textContent = Math.round(macro.y * 100);
  const motion = scene().motion.filter(Boolean);
  $("motion-path").setAttribute(
    "d",
    motion
      .map(
        (point, i) => `${i ? "L" : "M"}${point.x * 220},${(1 - point.y) * 166}`,
      )
      .join(" "),
  );
  $("motion-toggle").disabled = !motion.length;
  $("motion-toggle").setAttribute("aria-pressed", scene().motionEnabled);
  const recording = captureRequested || capture !== null;
  $("capture-motion").setAttribute("aria-pressed", recording);
  document.body.classList.toggle("recording", recording);
  $("capture-motion").innerHTML =
    `<span class="record-dot"></span>${captureRequested ? "Starts next bar…" : capture ? `Capturing ${capture.count}/16` : "Capture motion"}`;
  $("motion-indicator").textContent = recording
    ? "Capturing"
    : scene().motionEnabled
      ? "Motion loop"
      : "Live";
}
function renderAll() {
  $("tempo").value = project.bpm;
  $("key").value = project.root;
  $("swing").value = project.swing * 100;
  $("volume").value = project.master * 100;
  $("key-caption").textContent =
    noteName(project.root).replace(/\d+$/, "") + " minor";
  $("chord-caption").textContent = scene().harmony.map(chordLabel).join(" / ");
  $("project-title").value = project.title;
  $("custom-session").hidden = SESSION_NAMES.includes(project.title);
  $("custom-session").textContent = project.title;
  $("session").value = SESSION_NAMES.includes(project.title)
    ? SESSION_NAMES.indexOf(project.title)
    : "custom";
  renderScenes();
  renderTracks();
  renderEditor();
  renderArrangement();
  renderMacro();
  $("live-keys").innerHTML = keys
    .map(
      (key, i) =>
        `<button class="live-key" data-key="${i}" aria-label="Play ${noteName(degreeMidi(project.root, 7 + i))}">${key.toUpperCase()}<small>${noteName(degreeMidi(project.root, 7 + i))}</small></button>`,
    )
    .join("");
  orbit.dirty = true;
}
function transportUI() {
  document.body.classList.toggle("playing", playing);
  $("play-label").textContent = playing ? "Stop" : "Play";
  $("play").setAttribute("aria-label", playing ? "Stop" : "Play");
  $("play-icon").innerHTML = playing
    ? '<path d="M7 6h10v12H7Z"/>'
    : '<path d="m8 5 11 7-11 7Z"/>';
  $("audio-state").textContent = context
    ? `${context.sampleRate / 1000} kHz / stereo`
    : "Sound starts with you";
  $("orbit-status").textContent = playing
    ? `${scene().name} / six voices in orbit`
    : "Six voices, waiting for you";
}
async function ensureAudio() {
  if (!context || context.state === "closed") {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio)
      throw new Error(
        "Audio is not available in this browser. Try a current Chrome, Safari, or Firefox.",
      );
    context = new Audio({ latencyHint: "interactive" });
    context.addEventListener("statechange", () => {
      if (playing && context.state !== "running")
        stop("Audio interrupted. Press Play to continue.");
    });
  }
  await context.resume();
  if (context.state !== "running")
    throw new Error("Audio is suspended. Press Play again to enable sound.");
}
async function start() {
  if (starting || playing) return;
  starting = true;
  const token = ++runToken;
  $("play").disabled = true;
  try {
    await ensureAudio();
    if (token !== runToken) return;
    engine?.stop();
    engine = new SoundEngine(context, project);
    playing = true;
    nextBar = 0;
    nextStep = 0;
    loopBar = 0;
    queue = [];
    queuedScene = null;
    endTime = null;
    lastFrame = null;
    scheduledScene = project.scene;
    barStart = context.currentTime + 0.075;
    transportUI();
    renderScenes();
    timer = setInterval(schedule, 25);
    schedule();
  } catch (error) {
    notify(error.message);
    $("transport-status").textContent = "Press Play to enable audio";
  } finally {
    starting = false;
    $("play").disabled = false;
  }
}
function stop(message = "Ready when you are") {
  ++runToken;
  playing = false;
  clearInterval(timer);
  queue = [];
  endTime = null;
  queuedScene = null;
  capture = null;
  captureRequested = false;
  engine?.stop();
  engine = null;
  lastFrame = null;
  $("transport-status").textContent = message;
  $("bar-display").innerHTML = '01<span class="time-divider">.</span>1';
  macro = { x: scene().color, y: scene().space };
  transportUI();
  renderScenes();
  renderTracks();
  renderArrangement();
  renderMacro();
  orbit.dirty = true;
}
function schedule() {
  if (!playing) return;
  const now = context.currentTime;
  if (endTime !== null) return;
  // A delayed background timer must never dump missed notes into the output.
  if (barStart + (nextStep / 16) * barSeconds(barTempo) < now - 0.25) {
    stop("Timing paused. Press Play to restart.");
    return;
  }
  if (endTime !== null) return;
  for (let scheduled = 0; scheduled < 32; scheduled++) {
    if (nextStep === 0) {
      if (queuedScene !== null) {
        scheduledScene = queuedScene;
        queuedScene = null;
        loopBar = 0;
        setMode("loop");
      }
      scheduledLocation =
        mode === "song"
          ? locateBar(project, nextBar)
          : { scene: scheduledScene, localBar: loopBar, section: -1 };
      if (!scheduledLocation) {
        endTime = barStart;
        return;
      }
      barTempo = project.bpm;
      barSwing = project.swing;
    }
    const time =
      barStart +
      (60 / barTempo / 4) * (nextStep + (nextStep % 2 ? barSwing : 0));
    if (time >= now + 0.12) return;
    const index = scheduledLocation.scene,
      s = project.scenes[index];
    if (captureRequested && nextStep === 0) {
      captureRequested = false;
      capture = { scene: index, count: 0, values: Array(16).fill(null) };
    }
    const capturing = capture && capture.scene === index;
    const point = capturing || dragging ? { ...macro } : macroAt(s, nextStep);
    const frame = {
      ...scheduledLocation,
      bar: nextBar,
      step: nextStep,
      time,
      macro: point,
      events: eventsForStep(
        { ...project, bpm: barTempo },
        index,
        scheduledLocation.localBar,
        nextStep,
      ),
    };
    if (capturing) {
      capture.values[nextStep] = { ...point };
      capture.count++;
      if (capture.count === 16) {
        frame.captured = { scene: index, values: clone(capture.values) };
        capture = null;
      }
    }
    engine.schedule(frame, time);
    queue.push(frame);
    recentFrames.push({
      time,
      scene: index,
      step: nextStep,
      bar: nextBar,
      notes: frame.events.length,
    });
    if (recentFrames.length > 128) recentFrames.shift();
    nextStep++;
    if (nextStep === 16) {
      nextStep = 0;
      nextBar++;
      loopBar++;
      barStart += barSeconds(barTempo);
    }
  }
}
function onFrame(frame) {
  const previousScene = project.scene;
  project.scene = frame.scene;
  lastFrame = frame;
  if (previousScene !== project.scene) {
    macro = { ...frame.macro };
    renderAll();
    changed();
  }
  if (!dragging && !sliderGesture && !capture && !captureRequested)
    macro = scene().motionEnabled
      ? { ...frame.macro }
      : { x: scene().color, y: scene().space };
  if (frame.captured) {
    project.scenes[frame.captured.scene].motion = frame.captured.values;
    project.scenes[frame.captured.scene].motionEnabled = true;
    changed();
    notify("Motion captured. This bar now plays back with your track.");
  }
  $("bar-display").innerHTML =
    `${String(frame.bar + 1).padStart(2, "0")}<span class="time-divider">.</span>${Math.floor(frame.step / 4) + 1}`;
  $("transport-status").textContent =
    `${mode === "song" ? "Song" : "Loop"} / ${scene().name}`;
  $("orbit-status").textContent =
    `${scene().name} / ${chordLabel(scene().harmony[frame.localBar % 4])}`;
  document
    .querySelectorAll(".step.current")
    .forEach((el) => el.classList.remove("current"));
  document
    .querySelectorAll(`.step[data-step="${frame.step}"]`)
    .forEach((el) => el.classList.add("current"));
  document
    .querySelectorAll(".scene-progress")
    .forEach(
      (el, i) =>
        (el.style.width =
          i === project.scene ? `${((frame.step + 1) / 16) * 100}%` : "0"),
    );
  document
    .querySelectorAll(".arrangement-part")
    .forEach((el, i) =>
      el.classList.toggle("active", mode === "song" && i === frame.section),
    );
  renderMacro();
  orbit.trigger(frame.events);
}
function animate(now) {
  if (playing) {
    while (queue.length && queue[0].time <= context.currentTime)
      onFrame(queue.shift());
    if (endTime !== null && context.currentTime >= endTime) {
      $("transport-status").textContent = "Letting the echoes settle";
      if (context.currentTime >= endTime + TAIL_SECONDS)
        stop("Song finished. Make it yours.");
    }
  }
  const phase = lastFrame
    ? lastFrame.bar * 16 +
      lastFrame.step +
      Math.min(
        1,
        (context.currentTime - lastFrame.time) / stepSeconds(project.bpm),
      )
    : 0;
  orbit.draw(
    project,
    {
      playing,
      step: lastFrame?.step ?? -1,
      phase,
      spectrum: engine?.spectrum(),
    },
    now,
  );
  requestAnimationFrame(animate);
}
function launch(index) {
  if (captureRequested || capture) {
    capture = null;
    captureRequested = false;
    notify("Motion capture cancelled for the scene change.");
  }
  if (playing) {
    queuedScene = index;
    renderScenes();
    renderMacro();
  } else {
    project.scene = index;
    scheduledScene = index;
    macro = { x: scene().color, y: scene().space };
    changed();
    renderAll();
  }
}
function moveMacro(x, y) {
  macro = { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
  scene().color = macro.x;
  scene().space = macro.y;
  if (!capture && !captureRequested) scene().motionEnabled = false;
  if (engine) engine.setMacro(macro.x, macro.y, context.currentTime, true);
  changed();
  renderMacro();
  orbit.dirty = true;
}
function updateFromPointer(event) {
  const rect = $("motion-pad").getBoundingClientRect();
  moveMacro(
    (event.clientX - rect.left) / rect.width,
    1 - (event.clientY - rect.top) / rect.height,
  );
}
async function liveNote(index) {
  const token = runToken;
  try {
    await ensureAudio();
    if (token !== runToken) return;
    if (!engine) engine = new SoundEngine(context, project);
    engine.setMacro(macro.x, macro.y);
    engine.trigger(
      {
        track: 5,
        velocity: 0.68,
        notes: [degreeMidi(project.root, 7 + index)],
        duration: 0.19,
      },
      context.currentTime + 0.005,
    );
    orbit.trigger([{ track: 5, velocity: 0.7 }]);
    transportUI();
  } catch (error) {
    notify(error.message);
  }
}
function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
function filename() {
  return (
    project.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "nightshift"
  );
}
function replaceProject(value) {
  stop();
  checkpoint();
  project = value;
  macro = { x: scene().color, y: scene().space };
  selectedTrack = -1;
  setMode("song");
  renderAll();
  changed();
}
function exportLength() {
  const bars = $("export-mode").value === "song" ? songBars(project) : 4;
  $("export-length").textContent = minutes(
    bars * barSeconds(project.bpm) + TAIL_SECONDS,
  );
}

$("key").innerHTML = Array.from(
  { length: 12 },
  (_, i) =>
    `<option value="${48 + i}">${noteName(48 + i).replace(/\d+$/, "")} minor</option>`,
).join("");
$("beat-ruler").innerHTML = Array.from(
  { length: 16 },
  (_, i) =>
    `<span class="${i % 4 === 0 ? "major" : ""}">${i % 4 === 0 ? i / 4 + 1 : "·"}</span>`,
).join("");
$("play").addEventListener("click", () => (playing ? stop() : start()));
$("scenes").addEventListener("click", (e) => {
  const el = e.target.closest("[data-scene]");
  if (el) launch(+el.dataset.scene);
});
$("song-mode").addEventListener("click", () => {
  const restart = playing;
  stop();
  setMode("song");
  if (restart) start();
});
$("loop-mode").addEventListener("click", () => {
  setMode("loop");
  scheduledScene = project.scene;
  loopBar = lastFrame?.localBar ?? 0;
  queuedScene = null;
  renderScenes();
});
$("session").addEventListener("change", (e) => {
  replaceProject(createProject(+e.target.value));
  notify(`${project.title} loaded. Undo brings back your previous session.`);
});
$("undo").addEventListener("click", () => {
  if (!history.length) return;
  stop();
  project = history.pop();
  macro = { x: scene().color, y: scene().space };
  if (engine) engine.project = project;
  renderAll();
  changed();
  $("undo").disabled = !history.length;
  $("undo-project").disabled = !history.length;
  notify("Last edit undone.");
});
$("tempo").addEventListener("change", (e) => {
  const bpm = clamp(Math.round(+e.target.value || 114), 70, 160);
  edit(() => (project.bpm = bpm));
  if (playing) notify("Tempo changes at the next bar.");
});
$("key").addEventListener("change", (e) =>
  edit(() => (project.root = +e.target.value)),
);
function bindRange(id, action) {
  const input = $(id);
  input.addEventListener("pointerdown", () => {
    checkpoint();
    sliderGesture = true;
  });
  input.addEventListener("keydown", (e) => {
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(e.key)
    )
      checkpoint();
  });
  input.addEventListener("input", () => {
    action(+input.value);
    changed();
  });
  input.addEventListener("change", () => {
    sliderGesture = false;
  });
}
bindRange("swing", (value) => (project.swing = value / 100));
bindRange("volume", (value) => {
  project.master = value / 100;
  engine?.updateMix();
});
bindRange("color", (value) => moveMacro(value / 100, macro.y));
bindRange("space", (value) => moveMacro(macro.x, value / 100));
for (const [id, param, factor] of [
  ["track-level", "level", 100],
  ["track-tone", "tone", 100],
  ["track-pan", "pan", 100],
])
  bindRange(id, (value) => {
    if (selectedTrack < 0) return;
    project.tracks[selectedTrack][param] = value / factor;
    engine?.updateMix();
    engine?.setMacro(macro.x, macro.y);
  });
$("motion-pad").addEventListener("pointerdown", (event) => {
  checkpoint();
  dragging = true;
  $("motion-pad").setPointerCapture(event.pointerId);
  updateFromPointer(event);
});
$("motion-pad").addEventListener("pointermove", (event) => {
  if (dragging) updateFromPointer(event);
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  $("motion-pad").addEventListener(event, () => {
    dragging = false;
    persist();
  });
$("motion-pad").addEventListener("keydown", (event) => {
  const changes = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, 1],
    ArrowDown: [0, -1],
  };
  if (!changes[event.key]) return;
  event.preventDefault();
  checkpoint();
  const [x, y] = changes[event.key],
    amount = event.shiftKey ? 0.1 : 0.02;
  moveMacro(macro.x + x * amount, macro.y + y * amount);
});
$("capture-motion").addEventListener("click", async () => {
  if (capture || captureRequested) {
    capture = null;
    captureRequested = false;
    renderMacro();
    notify("Motion capture cancelled.");
    return;
  }
  checkpoint();
  setMode("loop");
  scheduledScene = project.scene;
  queuedScene = null;
  if (!playing) await start();
  if (!playing) return;
  captureRequested = true;
  renderMacro();
  notify("Capture starts at the next bar. Move the pad for one bar.");
});
$("motion-toggle").addEventListener("click", () =>
  edit(() => (scene().motionEnabled = !scene().motionEnabled)),
);
$("tracks").addEventListener("click", (event) => {
  const step = event.target.closest(".step");
  if (step) {
    const i = +step.dataset.track,
      s = +step.dataset.step;
    checkpoint();
    const cell = scene().patterns[i][s];
    cell.v = event.shiftKey ? (cell.v > 0.9 ? 0.55 : 1) : cell.v ? 0 : 0.65;
    changed();
    const temp = document.createElement("template");
    temp.innerHTML = stepHTML(i, s, cell);
    step.replaceWith(temp.content);
    $("tracks")
      .querySelector(`.step[data-track="${i}"][data-step="${s}"]`)
      ?.focus({ preventScroll: true });
    renderEditor();
    return;
  }
  const mute = event.target.closest("[data-mute]"),
    solo = event.target.closest("[data-solo]"),
    voice = event.target.closest("[data-voice]");
  if (mute) {
    const i = +mute.dataset.mute;
    edit(() => (project.tracks[i].muted = !project.tracks[i].muted));
    $("tracks")
      .querySelector(`[data-mute="${i}"]`)
      ?.focus({ preventScroll: true });
  }
  if (solo) {
    const i = +solo.dataset.solo;
    edit(() => (project.tracks[i].solo = !project.tracks[i].solo));
    $("tracks")
      .querySelector(`[data-solo="${i}"]`)
      ?.focus({ preventScroll: true });
  }
  if (voice) {
    const index = +voice.dataset.voice;
    selectedTrack = selectedTrack === index ? -1 : index;
    renderTracks();
    renderEditor();
    if (selectedTrack >= 0) {
      $("voice-editor").scrollIntoView({
        block: "nearest",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      $("track-level").focus({ preventScroll: true });
    }
  }
});
$("voice-close").addEventListener("click", () => {
  const previous = selectedTrack;
  selectedTrack = -1;
  renderTracks();
  renderEditor();
  $("tracks")
    .querySelector(`[data-voice="${previous}"]`)
    ?.focus({ preventScroll: true });
});
$("clear-track").addEventListener("click", () => {
  if (selectedTrack >= 0)
    edit(() => scene().patterns[selectedTrack].forEach((cell) => (cell.v = 0)));
});
$("piano-roll").addEventListener("click", (event) => {
  const button = event.target.closest("[data-note]");
  if (!button) return;
  const n = +button.dataset.note,
    s = +button.dataset.step;
  edit(() => {
    const cell = scene().patterns[selectedTrack][s];
    cell.v = cell.v && cell.n === n ? 0 : 0.7;
    cell.n = n;
  });
  $("piano-roll")
    .querySelector(`[data-note="${n}"][data-step="${s}"]`)
    ?.focus({ preventScroll: true });
});
$("variation").addEventListener("click", () => {
  edit(() => {
    const random = rng(variation++ * 7391 + project.scene * 37);
    for (const i of [2, 3, 5])
      scene().patterns[i].forEach((cell, s) => {
        if (random() < 0.28) {
          cell.v = cell.v ? 0 : 0.3 + random() * 0.45;
          if (i > 2) cell.n = [0, 2, 4, 6, 7, 9, 11][Math.floor(random() * 7)];
        }
      });
  });
  notify("A new rhythmic variation. Undo takes you back.");
});
$("arrangement").addEventListener("change", (event) => {
  const bars = event.target.dataset.bars,
    section = event.target.dataset.section;
  if (bars !== undefined) {
    const value = clamp(Math.round(+event.target.value || 1), 1, 16);
    if (songBars(project) - project.arrangement[+bars].bars + value > 64) {
      event.target.value = project.arrangement[+bars].bars;
      notify("Keep the arrangement within 64 bars.");
      return;
    }
    stop();
    edit(() => (project.arrangement[+bars].bars = value));
  }
  if (section !== undefined) {
    const value = +event.target.value;
    stop();
    edit(() => (project.arrangement[+section].scene = value));
  }
});
$("arrangement").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button || project.arrangement.length === 1) return;
  stop();
  edit(() => project.arrangement.splice(+button.dataset.remove, 1));
});
$("add-section").addEventListener("click", () => {
  if (project.arrangement.length >= 8 || songBars(project) >= 64) return;
  stop();
  edit(() =>
    project.arrangement.push({
      scene: project.scene,
      bars: Math.min(8, 64 - songBars(project)),
    }),
  );
});
$("live-keys").addEventListener("pointerdown", (event) => {
  const key = event.target.closest("[data-key]");
  if (key) {
    key.setPointerCapture(event.pointerId);
    key.classList.add("pressed");
    liveNote(+key.dataset.key);
  }
});
for (const name of ["pointerup", "pointercancel"])
  $("live-keys").addEventListener(name, (event) =>
    event.target.closest("[data-key]")?.classList.remove("pressed"),
  );
// Native button activation covers keyboard and assistive technology; pointer plays on down.
$("live-keys").addEventListener("click", (event) => {
  if (event.detail === 0) {
    const key = event.target.closest("[data-key]");
    if (key) liveNote(+key.dataset.key);
  }
});
document.addEventListener("keydown", (event) => {
  if (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.repeat ||
    document.querySelector("dialog[open]") ||
    event.target.matches("input,select,textarea,[contenteditable=true]")
  )
    return;
  if (event.code === "Space" && !event.target.closest("button")) {
    event.preventDefault();
    playing ? stop() : start();
  } else if (/^[1-4]$/.test(event.key)) {
    event.preventDefault();
    launch(+event.key - 1);
  } else if (keys.includes(event.key.toLowerCase())) {
    event.preventDefault();
    const index = keys.indexOf(event.key.toLowerCase());
    $("live-keys")
      .querySelector(`[data-key="${index}"]`)
      ?.classList.add("pressed");
    liveNote(index);
  }
});
document.addEventListener("keyup", (event) => {
  const index = keys.indexOf(event.key.toLowerCase());
  if (index >= 0)
    $("live-keys")
      .querySelector(`[data-key="${index}"]`)
      ?.classList.remove("pressed");
});
$("project-menu").addEventListener("click", () =>
  $("project-dialog").showModal(),
);
$("project-title").addEventListener("change", (event) => {
  const title = event.target.value.trim();
  if (!title) {
    event.target.value = project.title;
    return;
  }
  edit(() => (project.title = title));
});
$("save-project").addEventListener("click", () => {
  persist();
  download(
    JSON.stringify(project, null, 2),
    `${filename()}.nightshift.json`,
    "application/json",
  );
  notify("Project downloaded.");
});
$("load-project").addEventListener("click", () => $("project-file").click());
$("project-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 256 * 1024)
      throw new Error("Choose a Nightshift project smaller than 256 KB.");
    const value = validateProject(JSON.parse(await file.text()));
    replaceProject(value);
    $("project-dialog").close();
    notify(`${project.title} opened. Undo restores the previous session.`);
  } catch (error) {
    notify(
      error instanceof SyntaxError
        ? "That file is not valid JSON. Choose a Nightshift project."
        : error.message,
    );
  } finally {
    event.target.value = "";
  }
});
$("export-open").addEventListener("click", () => {
  exportLength();
  $("export-dialog").showModal();
});
$("export-mode").addEventListener("change", exportLength);
$("render-wav").addEventListener("click", async () => {
  if (rendering) return;
  rendering = true;
  const snapshot = clone(project),
    exportMode = $("export-mode").value,
    name = filename();
  $("render-wav").disabled = true;
  $("render-wav").textContent = "Rendering your track…";
  $("render-status").textContent =
    "Rendering the score, mix, effects, and motion. You can keep editing.";
  try {
    const { buffer, bars } = await renderAudio(snapshot, exportMode);
    download(
      encodeWav(buffer),
      `${name}${exportMode === "loop" ? "-scene" : ""}.wav`,
      "audio/wav",
    );
    $("render-status").textContent =
      `Downloaded ${bars} bars with the final echoes. ${minutes(buffer.duration)} of stereo audio.`;
    notify("Your WAV is ready.");
  } catch (error) {
    $("render-status").textContent = error.message;
  } finally {
    rendering = false;
    $("render-wav").disabled = false;
    $("render-wav").textContent = "Render WAV";
  }
});
$("undo-project").addEventListener("click", () => $("undo").click());
$("help-open").addEventListener("click", () => $("help-dialog").showModal());
document.addEventListener("visibilitychange", () => {
  if (document.hidden && (playing || starting)) {
    stop("Stopped while away. Press Play to return.");
    persist();
  }
});
window.addEventListener("pagehide", () => {
  if (saveTimer) persist();
  stop();
});
window.addEventListener("blur", () =>
  document
    .querySelectorAll(".live-key.pressed")
    .forEach((key) => key.classList.remove("pressed")),
);
// Read-only diagnostics make timing, persistence, and audio behavior inspectable.
window.Nightshift = Object.freeze({
  snapshot: () => ({
    project: clone(project),
    playing,
    mode,
    queuedScene,
    step: lastFrame?.step ?? -1,
    bar: lastFrame?.bar ?? -1,
    scene: project.scene,
    capturing: !!capture || captureRequested,
    activeSources: engine?.nodes.size ?? 0,
    audioState: context?.state ?? "uninitialized",
    recentFrames: clone(recentFrames),
  }),
});
renderAll();
requestAnimationFrame(animate);
if (restoreMessage) notify(restoreMessage);
