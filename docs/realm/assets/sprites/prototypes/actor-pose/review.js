(() => {
  'use strict';

  const OUTPUT_ROOT =
    'assets/sprites/prototypes/actor-pose/output/a2-layered2d/';
  const FRAME_WIDTH = 64;
  const FRAME_HEIGHT = 84;
  const FRAME_COUNT = 8;
  const FRAME_MS = 117;
  const cacheToken =
    new URLSearchParams(window.location.search).get('v') || 'a2-reference-v3';

  const elements = {
    status: document.querySelector('#build-state'),
    native: document.querySelector('#native-canvas'),
    runtime: document.querySelector('#runtime-canvas'),
    zoom: document.querySelector('#zoom-canvas'),
    strip: document.querySelector('#strip-canvas'),
    playhead: document.querySelector('#strip-playhead'),
    phase: document.querySelector('#phase-output'),
    frame: document.querySelector('#frame-output'),
    range: document.querySelector('#frame-range'),
    play: document.querySelector('#play-button'),
    previous: document.querySelector('#previous-button'),
    next: document.querySelector('#next-button'),
    surface: document.querySelector('#surface-select'),
    surfaceBadge: document.querySelector('#surface-badge'),
    beatButtons: document.querySelector('#beat-buttons'),
    support: document.querySelector('#support-value'),
    height: document.querySelector('#height-value'),
    hand: document.querySelector('#hand-value'),
    transition: document.querySelector('#transition-value'),
    gates: document.querySelector('#gate-grid'),
    heroState: document.querySelector('.pending-copy'),
    freezeBadge: document.querySelector('.freeze-badge'),
    copyApproval: document.querySelector('#copy-approval'),
    copyVeto: document.querySelector('#copy-veto'),
    copyState: document.querySelector('#copy-state'),
  };

  const state = {
    frame: 0,
    playing: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    speed: 1,
    surface: 'final',
    lastTimestamp: 0,
    accumulator: 0,
    manifest: null,
    gate: null,
    landmarks: null,
    quality: null,
    images: {},
    beatButtons: [],
  };

  function asset(relative) {
    const url = new URL(`${OUTPUT_ROOT}${relative}`, window.location.href);
    url.searchParams.set('v', cacheToken);
    return url.href;
  }

  function repositoryAsset(relative) {
    const url = new URL(relative, window.location.href);
    url.searchParams.set('v', cacheToken);
    return url.href;
  }

  async function fetchJson(relative) {
    const response = await fetch(asset(relative), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`${relative} returned ${response.status}`);
    }
    return response.json();
  }

  function stableJson(value) {
    if (Array.isArray(value)) {
      return value.map(stableJson);
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, stableJson(value[key])]),
      );
    }
    return value;
  }

  async function sha256(buffer) {
    const result = await window.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(result), (value) =>
      value.toString(16).padStart(2, '0')).join('');
  }

  async function fetchVerifiedUrl(url, label, expectedSha) {
    if (!/^[0-9a-f]{64}$/.test(expectedSha || '')) {
      throw new Error(`${label} lacks a valid manifest SHA-256`);
    }
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`${label} returned ${response.status}`);
    }
    const bytes = await response.arrayBuffer();
    const actualSha = await sha256(bytes);
    if (actualSha !== expectedSha) {
      throw new Error(
        `${label} byte hash ${actualSha} does not match ${expectedSha}`,
      );
    }
    return {
      bytes,
      mime: response.headers.get('content-type') || 'application/octet-stream',
    };
  }

  function fetchVerifiedBytes(relative, expectedSha) {
    return fetchVerifiedUrl(asset(relative), relative, expectedSha);
  }

  async function fetchVerifiedJson(relative, expectedSha, repository = false) {
    const verified = await fetchVerifiedUrl(
      repository ? repositoryAsset(relative) : asset(relative),
      relative,
      expectedSha,
    );
    return JSON.parse(new TextDecoder().decode(verified.bytes));
  }

  async function deriveReview(record, manifest) {
    const failures = [];
    const subjectFailures = [];
    const reject = (message, subject = false) => {
      failures.push(message);
      if (subject) {
        subjectFailures.push(message);
      }
    };
    if (record?.schema !== 'realm.actor-pose.review-record.v1') {
      reject('review record schema is not v1');
    }
    if (record?.review_id !== 'a2-right-reference-v3') {
      reject('review ID is not the frozen v3 reference');
    }
    const subject =
      record?.subject && typeof record.subject === 'object'
        ? record.subject
        : {};
    if (subject.purpose !== 'derivation-reference-only') {
      reject('review purpose is not derivation-reference-only', true);
    }
    const expectedScope = {
      identity: 'watchman',
      garment: 'watch-blue',
      attachment: 'off',
      action: 'carry',
      direction: 'right',
    };
    if (JSON.stringify(subject.scope) !== JSON.stringify(expectedScope)) {
      reject('review record scope does not match the frozen row', true);
    }
    const expectedArtifacts = {
      flattened_row: [
        'flattened_row',
        'rows/watchman/watch-blue/off/carry-right.png',
      ],
      native_unlabeled_loop: [
        'native_1x_loop',
        'proof/carry-right-unlabeled-x1.gif',
      ],
    };
    const artifacts = {};
    for (const [name, [subjectKey, path]] of Object.entries(
      expectedArtifacts,
    )) {
      const subjectArtifact = subject[subjectKey] || {};
      if (subjectArtifact.path !== path) {
        reject(`review record ${name} path changed`, true);
        continue;
      }
      const actualSha = manifest.outputs[path]?.sha256;
      if (subjectArtifact.sha256 !== actualSha) {
        reject(
          `review target ${name} changed: expected ` +
            `${subjectArtifact.sha256}, got ${actualSha}`,
          true,
        );
      }
      artifacts[name] = { path, sha256: actualSha };
    }
    const subjectBytes = new TextEncoder().encode(
      JSON.stringify(stableJson(subject)),
    );
    const subjectSha = await sha256(subjectBytes);
    if (record.subject_sha256 !== subjectSha) {
      reject('review subject digest is stale', true);
    }
    const reviews =
      record.decisions && typeof record.decisions === 'object'
        ? record.decisions
        : {};
    const reviewerNames = Object.keys(reviews).sort();
    if (
      JSON.stringify(reviewerNames) !==
      JSON.stringify(['luna', 'owner', 'terra'])
    ) {
      reject('review record must contain exactly Terra, Luna, and owner');
    }
    const decisions = {};
    const allowed = new Set(['pending', 'approve-reference-only', 'veto']);
    for (const reviewer of ['terra', 'luna', 'owner']) {
      const decision =
        reviews[reviewer] && typeof reviews[reviewer] === 'object'
          ? reviews[reviewer]
          : {};
      const verdict = decision.verdict;
      decisions[reviewer] = verdict;
      if (!allowed.has(verdict)) {
        reject(`${reviewer} verdict is outside the review vocabulary`);
        continue;
      }
      if (verdict === 'pending') {
        continue;
      }
      if (decision.subject_sha256 !== subjectSha) {
        reject(`${reviewer} decision is bound to another subject`);
      }
      for (const field of ['recorded_at', 'evidence_ref']) {
        if (
          typeof decision[field] !== 'string' ||
          decision[field].trim() === ''
        ) {
          reject(`${reviewer} decision lacks ${field}`);
        }
      }
      if (
        verdict === 'veto' &&
        (typeof decision.defect !== 'string' || decision.defect.trim() === '')
      ) {
        reject(`${reviewer} veto lacks a defect`);
      }
    }
    const valid = failures.length === 0;
    const subjectBound = subjectFailures.length === 0;
    const councilPass =
      valid &&
      subjectBound &&
      ['terra', 'luna'].every(
        (reviewer) =>
          reviews[reviewer]?.verdict === 'approve-reference-only' &&
          reviews[reviewer]?.subject_sha256 === subjectSha,
      );
    const ownerPass =
      valid &&
      subjectBound &&
      reviews.owner?.verdict === 'approve-reference-only' &&
      reviews.owner?.subject_sha256 === subjectSha;
    const factorialAuthorized = valid && councilPass && ownerPass;
    let status = 'review-incomplete';
    if (!valid) {
      status = 'invalid';
    } else if (reviews.owner?.verdict === 'veto') {
      status = 'owner-veto';
    } else if (
      ['terra', 'luna'].some(
        (reviewer) => reviews[reviewer]?.verdict === 'veto',
      )
    ) {
      status = 'council-veto';
    } else if (factorialAuthorized) {
      status = 'owner-approved-reference';
    } else if (councilPass && reviews.owner?.verdict === 'pending') {
      status = 'council-approved-owner-pending';
    }
    return {
      schema: 'realm.actor-pose.review-evaluation.v1',
      record: manifest.review.record,
      review_id: record.review_id,
      subject_sha256: subjectSha,
      artifacts,
      decisions,
      subject_bound: subjectBound,
      council_reference_pass: councilPass,
      owner_reference_pass: ownerPass,
      factorial_authorized: factorialAuthorized,
      status,
      valid,
      failures,
    };
  }

  async function loadVerifiedImage(relative, expectedSha) {
    const verified = await fetchVerifiedBytes(relative, expectedSha);
    const url = URL.createObjectURL(
      new Blob([verified.bytes], { type: verified.mime }),
    );
    const image = await new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load ${relative}`));
      image.src = url;
    });
    URL.revokeObjectURL(url);
    return image;
  }

  function currentImage() {
    return state.images[state.surface] || state.images.final;
  }

  function phaseName(value) {
    return value
      .replace(/^near-/, 'near ')
      .replace(/^far-/, 'far ')
      .replaceAll('-', ' ');
  }

  function surfaceName(value) {
    return {
      final: 'Final paint',
      identity: 'Identity plane',
      garment: 'Garment plane',
      semantic: 'Semantic mask',
    }[value];
  }

  function drawFrame(canvas, image, frame, smoothing) {
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = smoothing;
    context.drawImage(
      image,
      frame * FRAME_WIDTH,
      0,
      FRAME_WIDTH,
      FRAME_HEIGHT,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }

  function drawStrip(image) {
    const context = elements.strip.getContext('2d');
    context.clearRect(0, 0, elements.strip.width, elements.strip.height);
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, 512, 84, 0, 0, 512, 84);
  }

  function updateFrameLedger() {
    const metric = state.gate.frame_metrics[state.frame];
    const landmark = state.landmarks.frames[state.frame];
    const nextDelta = state.gate.transition_deltas[state.frame];
    const ratio = nextDelta / state.gate.internal_transition_median;
    const seam = state.frame === FRAME_COUNT - 1 ? ' · loop seam' : '';

    elements.support.textContent = metric.contacts.join(' + ');
    elements.height.textContent = `${metric.height}px`;
    elements.hand.textContent = metric.far_hand_has_2x2_cluster
      ? `${metric.far_hand_visible_pixels}px visible`
      : 'collapsed';
    elements.transition.textContent = `${ratio.toFixed(2)}× median${seam}`;
    elements.phase.textContent =
      `Frame ${state.frame + 1} · ${phaseName(landmark.phase)}`;
  }

  function render() {
    if (!state.images.final) {
      return;
    }
    const image = currentImage();
    drawFrame(elements.native, image, state.frame, false);
    drawFrame(
      elements.runtime,
      image,
      state.frame,
      state.surface !== 'semantic',
    );
    drawFrame(elements.zoom, image, state.frame, false);
    drawStrip(image);

    elements.range.value = String(state.frame);
    elements.frame.textContent = `${state.frame + 1} / ${FRAME_COUNT}`;
    elements.surfaceBadge.textContent = surfaceName(state.surface);
    elements.playhead.style.transform =
      `translateX(${state.frame * FRAME_WIDTH}px)`;
    state.beatButtons.forEach((button, index) => {
      button.setAttribute(
        'aria-current',
        index === state.frame ? 'true' : 'false',
      );
    });
    updateFrameLedger();
  }

  function setFrame(frame, pause = false) {
    state.frame = (frame + FRAME_COUNT) % FRAME_COUNT;
    state.accumulator = 0;
    if (pause) {
      setPlaying(false);
    }
    render();
  }

  function setPlaying(playing) {
    state.playing = playing;
    elements.play.textContent = playing ? 'Pause' : 'Play';
    elements.play.setAttribute(
      'aria-label',
      playing ? 'Pause the animation' : 'Play the animation',
    );
  }

  function makeBeatButtons() {
    elements.beatButtons.replaceChildren();
    state.beatButtons = state.landmarks.frames.map((frame, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(index + 1).padStart(2, '0');
      button.title = phaseName(frame.phase);
      button.setAttribute(
        'aria-label',
        `Show frame ${index + 1}, ${phaseName(frame.phase)}`,
      );
      button.addEventListener('click', () => setFrame(index, true));
      elements.beatButtons.append(button);
      return button;
    });
  }

  function gateCard(title, value, description, kind = 'pass') {
    const card = document.createElement('article');
    card.className = `gate-card ${kind}`;
    const status = document.createElement('span');
    status.textContent = value;
    const heading = document.createElement('h3');
    heading.textContent = title;
    const copy = document.createElement('p');
    copy.textContent = description;
    card.append(status, heading, copy);
    return card;
  }

  function renderGates() {
    const heights = state.gate.body_heights;
    const handFrames = state.gate.frame_metrics.filter(
      (frame) => frame.far_hand_has_2x2_cluster,
    ).length;
    const supportFrames = state.gate.frame_metrics.filter(
      (frame) => frame.ground_runs.length === frame.contacts.length,
    ).length;
    const review = state.manifest.review;
    let humanValue = 'Review incomplete';
    let humanKind = 'pending';
    let humanDescription =
      'The hash-bound human review record is valid but has not reached a decision.';
    if (review.status === 'owner-approved-reference') {
      humanValue = 'Owner approved';
      humanKind = 'pass';
      humanDescription =
        'The exact row and native loop are approved as the derivation reference only.';
    } else if (review.status === 'owner-veto') {
      humanValue = 'Owner veto';
      humanKind = 'pending';
      humanDescription =
        'The hash-bound owner veto keeps propagation closed until a new subject is reviewed.';
    } else if (review.status === 'council-veto') {
      humanValue = 'Council veto';
      humanKind = 'pending';
      humanDescription =
        'A hash-bound council veto keeps this reference from reaching the owner gate.';
    } else if (review.status === 'council-approved-owner-pending') {
      humanValue = 'Owner pending';
      humanDescription =
        'Frame 3/7 pass-leg balance, flat foot contacts, rigid carry arms, ' +
          'and the frame 8→1 wrap still require an explicit native-1× decision.';
    }
    const cards = [
      gateCard(
        'Stable Realm scale',
        'Pass',
        `${Math.min(...heights)}–${Math.max(...heights)}px body height; ` +
          `median ${state.quality.medianBodyHeight}px on ground row ` +
          `${state.gate.ground_y}.`,
      ),
      gateCard(
        'Alternating support',
        'Pass',
        `${supportFrames}/${FRAME_COUNT} beats match their authored near/far ` +
          'foot contacts; reserved rows 80–83 remain clear.',
      ),
      gateCard(
        'Readable second hand',
        'Pass',
        `${handFrames}/${FRAME_COUNT} beats retain the required exposed 2×2 ` +
          'far-hand cluster instead of merging into the torso.',
      ),
      gateCard(
        'Clean flattened paint',
        'Pass',
        `${state.gate.cargo_pixels} cargo pixels, ` +
          `${state.quality.maxFragmentPixels} fragment pixels, and ` +
          `${state.quality.warnings.length} quality warnings.`,
      ),
      gateCard(
        'Closed loop seam',
        'Pass',
        `Last→first change is ${state.gate.loop_delta_ratio.toFixed(3)}× the ` +
          'median internal transition; the executable ceiling is 1.35×.',
      ),
      gateCard(
        'Human motion judgment',
        humanValue,
        humanDescription,
        humanKind,
      ),
    ];
    elements.gates.replaceChildren(...cards);
  }

  function bindControls() {
    elements.play.addEventListener('click', () => {
      setPlaying(!state.playing);
    });
    elements.previous.addEventListener('click', () => {
      setFrame(state.frame - 1, true);
    });
    elements.next.addEventListener('click', () => {
      setFrame(state.frame + 1, true);
    });
    elements.range.addEventListener('input', (event) => {
      setFrame(Number(event.currentTarget.value), true);
    });
    elements.surface.addEventListener('change', (event) => {
      state.surface = event.currentTarget.value;
      render();
    });
    document.querySelectorAll('[data-speed]').forEach((button) => {
      button.addEventListener('click', () => {
        state.speed = Number(button.dataset.speed);
        document.querySelectorAll('[data-speed]').forEach((candidate) => {
          candidate.setAttribute(
            'aria-pressed',
            candidate === button ? 'true' : 'false',
          );
        });
      });
    });
  }

  function animationFrame(timestamp) {
    if (!state.lastTimestamp) {
      state.lastTimestamp = timestamp;
    }
    const elapsed = Math.min(250, timestamp - state.lastTimestamp);
    state.lastTimestamp = timestamp;
    if (state.playing && state.images.final) {
      state.accumulator += elapsed * state.speed;
      while (state.accumulator >= FRAME_MS) {
        state.accumulator -= FRAME_MS;
        state.frame = (state.frame + 1) % FRAME_COUNT;
        render();
      }
    }
    window.requestAnimationFrame(animationFrame);
  }

  async function copyDecision(text, message) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.append(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    elements.copyState.textContent = message;
  }

  function bindDecision(rowSha, nativeSha, subjectSha) {
    elements.copyApproval.addEventListener('click', () => {
      copyDecision(
        `Approve A2 right-reference v3 at native 1× — ` +
          `watchman × watch-blue × attachment-off × carry/right, ` +
          `row SHA-256 ${rowSha}, as the derivation reference only. ` +
          `Native-loop SHA-256 ${nativeSha}; review subject ${subjectSha}. ` +
          `Attachments, atlas promotion, and runtime integration remain vetoed.`,
        'Approval phrase copied. Paste it into this Codex task.',
      );
    });
    elements.copyVeto.addEventListener('click', () => {
      copyDecision(
        `Veto A2 right-reference v3 at native 1× — defect: [frame or ` +
          `transition] [what moves incorrectly] [what should happen instead]. ` +
          `Row SHA-256 ${rowSha}; native-loop SHA-256 ${nativeSha}; ` +
          `review subject ${subjectSha}.`,
        'Veto template copied. Replace the brackets, then paste it into Codex.',
      );
    });
  }

  async function load() {
    try {
      state.manifest = await fetchJson('manifest.json');
      const manifestReview = state.manifest.review;
      const reviewPath = manifestReview?.record;
      const reviewSource = state.manifest.sources?.files?.[reviewPath];
      if (reviewSource?.owner !== 'human-review-authority') {
        throw new Error('Review record lacks human-review authority');
      }
      const reviewRecord = await fetchVerifiedJson(
        reviewPath,
        reviewSource.sha256,
        true,
      );
      const review = await deriveReview(reviewRecord, state.manifest);
      if (
        JSON.stringify(stableJson(review)) !==
        JSON.stringify(stableJson(manifestReview))
      ) {
        throw new Error('Manifest review differs from authored review data');
      }
      const reviewAuthorization = Boolean(
        review?.valid &&
        review.subject_bound &&
        review.council_reference_pass &&
        review.owner_reference_pass
      );
      const expectedAuthorization = Boolean(
        reviewAuthorization &&
        state.manifest.verification.mechanical_passed &&
        state.manifest.verification.byte_deterministic_second_pass
      );
      if (
        state.manifest.stage !== 'right-reference-cycle' ||
        !review?.valid ||
        !review.subject_bound ||
        !state.manifest.verification.mechanical_passed ||
        !state.manifest.verification.byte_deterministic_second_pass ||
        review.factorial_authorized !== reviewAuthorization ||
        state.manifest.scope.factorial_expansion !==
          (expectedAuthorization ? 'authorized' : 'vetoed') ||
        state.manifest.status !== review.status
      ) {
        throw new Error(
          `Reference review state is ${state.manifest.status || 'missing'}`,
        );
      }
      const reviewReportPath = state.manifest.verification.review_report;
      let reviewReport;
      [state.gate, state.landmarks, state.quality, reviewReport] =
        await Promise.all([
          fetchVerifiedJson(
            state.manifest.verification.report,
            state.manifest.outputs[state.manifest.verification.report]?.sha256,
          ),
          fetchVerifiedJson(
            state.manifest.row.landmarks,
            state.manifest.outputs[state.manifest.row.landmarks]?.sha256,
          ),
          fetchVerifiedJson(
            state.manifest.proof.quality_report,
            state.manifest.outputs[state.manifest.proof.quality_report]?.sha256,
          ),
          fetchVerifiedJson(
            reviewReportPath,
            state.manifest.outputs[reviewReportPath]?.sha256,
          ),
        ]);
      if (
        JSON.stringify(stableJson(reviewReport)) !==
        JSON.stringify(stableJson(review))
      ) {
        throw new Error('Review evaluation report differs from authored data');
      }
      const rowSha = state.manifest.outputs[state.manifest.row.path]?.sha256;
      const nativePath = state.manifest.proof.native_unlabeled_loop;
      const nativeSha = state.manifest.outputs[nativePath]?.sha256;
      if (
        review.artifacts.flattened_row?.path !== state.manifest.row.path ||
        review.artifacts.flattened_row?.sha256 !== rowSha ||
        review.artifacts.native_unlabeled_loop?.path !== nativePath ||
        review.artifacts.native_unlabeled_loop?.sha256 !== nativeSha
      ) {
        throw new Error('Review subject artifacts differ from the manifest');
      }
      const [final, identity, garment, semantic] = await Promise.all([
        loadVerifiedImage(state.manifest.row.path, rowSha),
        loadVerifiedImage(
          state.manifest.row.identity_plane,
          state.manifest.outputs[state.manifest.row.identity_plane]?.sha256,
        ),
        loadVerifiedImage(
          state.manifest.row.garment_plane,
          state.manifest.outputs[state.manifest.row.garment_plane]?.sha256,
        ),
        loadVerifiedImage(
          state.manifest.row.semantic_mask,
          state.manifest.outputs[state.manifest.row.semantic_mask]?.sha256,
        ),
        fetchVerifiedBytes(nativePath, nativeSha),
      ]);
      state.images = { final, identity, garment, semantic };

      makeBeatButtons();
      renderGates();
      bindControls();
      bindDecision(
        rowSha,
        nativeSha,
        review.subject_sha256,
      );
      setPlaying(state.playing);
      render();
      elements.status.classList.add('ready');
      const stateCopy = {
        'owner-approved-reference': 'Owner approved',
        'council-approved-owner-pending': 'Owner review',
        'owner-veto': 'Owner veto',
        'council-veto': 'Council veto',
        'review-incomplete': 'Review incomplete',
      }[review.status] || review.status;
      elements.heroState.textContent = stateCopy;
      elements.freezeBadge.textContent = review.factorial_authorized
        ? 'Reference approved'
        : 'Expansion frozen';
      elements.status.lastChild.textContent =
        ` Frozen bytes hash-bound · ${stateCopy.toLowerCase()}`;
    } catch (error) {
      elements.status.classList.add('failed');
      elements.status.lastChild.textContent =
        ` Evidence failed: ${error.message}`;
      elements.gates.innerHTML =
        '<article class="gate-card loading"><span>Blocked</span>' +
        '<h3>Reference evidence did not load</h3>' +
        `<p>${error.message}</p></article>`;
      console.error(error);
    }
  }

  window.requestAnimationFrame(animationFrame);
  load();
})();
