(function () {
  "use strict";

  const MANIFEST_PATH = "manifest.json";
  const NOTES_PREFIX = "micro-app-field-record:";

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function validUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value, document.baseURI);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url.href;
    } catch (_error) {
      return null;
    }
  }

  function addLink(parent, label, href, className, options) {
    const safeHref = validUrl(href);
    if (!safeHref) return null;
    const link = make("a", className, label);
    link.href = safeHref;
    if (options && options.download) link.download = "";
    if (new URL(safeHref).origin !== window.location.origin) {
      link.rel = "noreferrer";
    }
    parent.append(link);
    return link;
  }

  function formatDate(value, includeTime) {
    if (!value) return "Date not recorded";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const options = {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    };
    if (includeTime) {
      options.hour = "2-digit";
      options.minute = "2-digit";
      options.hour12 = false;
    }
    return new Intl.DateTimeFormat("en", options).format(date);
  }

  function sentenceCase(value) {
    const text = String(value || "in progress").replace(/[-_]+/g, " ").trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "In progress";
  }

  async function fetchJson(path) {
    const url = validUrl(path);
    if (!url) throw new Error("The archive contains an invalid data path.");
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
    return response.json();
  }

  function storyDataPath(record) {
    if (record && typeof record.data === "string") return record.data;
    if (record && typeof record.slug === "string") return `stories/${record.slug}.json`;
    return null;
  }

  async function loadStory(record) {
    const path = storyDataPath(record);
    if (!path) throw new Error("This story does not have a data file.");
    return fetchJson(path);
  }

  function setError(container, title, detail) {
    if (!container) return;
    const block = make("div", "error-block");
    const copy = make("p");
    copy.append(make("strong", "", title), document.createTextNode(detail));
    block.append(copy);
    container.replaceChildren(block);
  }

  function storyRoute(record) {
    if (record && typeof record.href === "string") return record.href;
    return record && record.slug ? `${record.slug}/` : "./";
  }

  function renderLedger(manifest) {
    const summary = document.getElementById("ledger-summary");
    const statusRoot = document.getElementById("app-status");
    const apps = Array.isArray(manifest.apps) ? manifest.apps : [];
    const stories = Array.isArray(manifest.stories) ? manifest.stories : [];
    const documentedSlugs = new Set(
      stories.map((story) => story && story.appSlug).filter(Boolean),
    );

    if (summary) {
      summary.replaceChildren();
      const appsLabel = make("span", "", "Apps in the suite");
      const appsCount = make("strong", "", apps.length);
      const storiesLabel = make("span", "", "Stories on file");
      const storiesCount = make("strong", "", stories.length);
      summary.append(appsLabel, appsCount, storiesLabel, storiesCount);
    }

    if (!statusRoot) return;
    const heading = make("h2", "app-status-heading", "App status");
    const list = make("ul", "status-list");

    apps.forEach((app) => {
      if (!app || typeof app !== "object") return;
      const item = make("li", "status-item");
      const status = String(
        app.status || (documentedSlugs.has(app.slug) ? "documented" : "awaiting record"),
      ).toLowerCase();
      item.dataset.status = status;
      const mark = make("span", "status-mark");
      mark.setAttribute("aria-hidden", "true");
      const name = app.name || app.title || app.slug || "Untitled app";
      const href = app.href || (app.slug ? `../${app.slug}/` : null);
      const link = addLink(item, name, href, "");
      if (!link) item.append(make("span", "", name));
      const state = make("span", "status-state", status);
      item.prepend(mark);
      item.append(state);
      list.append(item);
    });

    statusRoot.replaceChildren(heading, list);
  }

  function createViewButton(label, value, update) {
    const button = make("button", "view-button", label);
    button.type = "button";
    button.dataset.value = String(value);
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => update(value));
    return button;
  }

  function comparisonText(value) {
    if (value <= 0) return "Before only";
    if (value >= 100) return "After only";
    return `Split view, ${value}% after`;
  }

  function createComparison(scene, options) {
    const safeScene = scene && typeof scene === "object" ? scene : {};
    const title = safeScene.title || "Before and after";
    const figure = make("figure", "comparison-module");
    const stage = make("div", "comparison-stage");
    const beforePicture = make("div", "comparison-picture comparison-picture--before");
    const afterPicture = make("div", "comparison-picture comparison-picture--after");
    const beforeImage = make("img");
    const afterImage = make("img");
    const beforeUrl = validUrl(safeScene.before && safeScene.before.src);
    const afterUrl = validUrl(safeScene.after && safeScene.after.src);

    beforeImage.alt = (safeScene.before && safeScene.before.alt) || `${title}, before`;
    afterImage.alt = (safeScene.after && safeScene.after.alt) || `${title}, after`;
    beforeImage.decoding = "async";
    afterImage.decoding = "async";
    beforeImage.loading = options && options.eager ? "eager" : "lazy";
    afterImage.loading = options && options.eager ? "eager" : "lazy";
    if (beforeUrl) beforeImage.src = beforeUrl;
    if (afterUrl) afterImage.src = afterUrl;
    beforePicture.append(beforeImage);
    afterPicture.append(afterImage);

    const beforeTag = make("span", "comparison-tag comparison-tag--before", "Before");
    const afterTag = make("span", "comparison-tag comparison-tag--after", "After");
    const seam = make("span", "comparison-seam");
    seam.setAttribute("aria-hidden", "true");
    const handle = make("span", "comparison-handle", "↔");
    seam.append(handle);

    const range = make("input", "comparison-range");
    range.type = "range";
    range.min = "0";
    range.max = "100";
    range.step = "1";
    range.value = "50";
    range.setAttribute("aria-label", `Compare ${title}: reveal the after image`);

    const controls = make("div", "comparison-controls");
    const readout = make("span", "comparison-readout");
    const buttons = [
      createViewButton("Before", 0, update),
      createViewButton("Split", 50, update),
      createViewButton("After", 100, update),
    ];

    function update(nextValue) {
      const value = Math.max(0, Math.min(100, Number(nextValue) || 0));
      stage.style.setProperty("--position", `${value}%`);
      range.value = String(value);
      const wording = comparisonText(value);
      range.setAttribute("aria-valuetext", wording);
      readout.textContent = wording;
      beforeTag.hidden = value >= 100;
      afterTag.hidden = value <= 0;
      buttons.forEach((button) => {
        button.setAttribute("aria-pressed", Number(button.dataset.value) === value ? "true" : "false");
      });
    }

    range.addEventListener("input", () => update(range.value));
    range.addEventListener("focus", () => stage.classList.add("is-range-focused"));
    range.addEventListener("blur", () => stage.classList.remove("is-range-focused"));
    controls.append(...buttons, readout);
    stage.append(beforePicture, afterPicture, beforeTag, afterTag, seam, range);

    const caption = make("figcaption", "comparison-caption");
    const captionText = make("span");
    captionText.append(make("strong", "", title));
    if (safeScene.caption) {
      captionText.append(document.createTextNode(` — ${safeScene.caption}`));
    }
    const hint = make("span", "", "Drag the seam or use arrow keys");
    caption.append(captionText, hint);
    figure.append(stage, controls, caption);
    update(50);
    return figure;
  }

  function storyDate(record, story) {
    return (story && story.publishedAt) || (record && record.publishedAt) || null;
  }

  function storyDateLabel(record, story) {
    const value = storyDate(record, story);
    return value ? formatDate(value, false) : "Revision open";
  }

  async function renderArchive(manifest) {
    const latestRoot = document.getElementById("latest-story");
    const listRoot = document.getElementById("story-list");
    const updated = document.getElementById("archive-updated");
    const records = Array.isArray(manifest.stories) ? manifest.stories.filter(Boolean) : [];

    if (updated) updated.textContent = `Record updated ${formatDate(manifest.updatedAt, false)}`;
    if (!records.length) {
      setError(latestRoot, "No comparisons are on file yet. ", "The first build story will appear here.");
      return;
    }

    const loaded = await Promise.all(
      records.map(async (record, order) => {
        try {
          return { record, story: await loadStory(record), order };
        } catch (error) {
          return { record, story: null, error, order };
        }
      }),
    );

    loaded.sort((a, b) => {
      const aTime = Date.parse(storyDate(a.record, a.story) || "") || 0;
      const bTime = Date.parse(storyDate(b.record, b.story) || "") || 0;
      return bTime - aTime || a.order - b.order;
    });

    const latest = loaded.find((entry) => entry.story && Array.isArray(entry.story.comparisons));
    if (!latest) {
      setError(latestRoot, "The comparison files could not be read. ", "Try refreshing the archive.");
    } else {
      latestRoot.classList.remove("loading-block");
      latestRoot.removeAttribute("aria-live");
      const story = latest.story;
      const header = make("header", "feature-header");
      const title = make("h2", "feature-title", story.title || latest.record.title || "Untitled story");
      const meta = make("p", "feature-meta", storyDateLabel(latest.record, story));
      header.append(title, meta);
      const deck = make("p", "feature-deck", story.thesis || story.summary || "");
      const comparison = createComparison(story.comparisons[0], { eager: true });
      const route = storyRoute(latest.record);
      const link = make("div");
      addLink(link, "Read the build story", route, "text-link");
      latestRoot.replaceChildren(header, deck, comparison, link);
    }

    if (listRoot) {
      const rows = loaded.map((entry) => {
        const story = entry.story || {};
        const row = make("a", "story-row");
        const href = validUrl(storyRoute(entry.record));
        if (href) row.href = href;
        const title = make(
          "h3",
          "story-row-title",
          story.title || entry.record.title || entry.record.slug || "Untitled story",
        );
        const summary = make(
          "p",
          "story-row-summary",
          story.summary || story.thesis || (entry.error ? "Story data is temporarily unavailable." : "Open the record."),
        );
        const isoDate = storyDate(entry.record, story);
        const date = make(isoDate ? "time" : "span", "story-row-date", storyDateLabel(entry.record, story));
        if (isoDate) date.dateTime = isoDate;
        row.append(title, summary, date);
        return row;
      });
      listRoot.replaceChildren(...rows);
    }
  }

  function createVersionLine(story) {
    const line = make("p", "version-line");
    const before = (story.versions && story.versions.before) || {};
    const after = (story.versions && story.versions.after) || {};
    const beforeText = `${before.label || "Before"}${before.commit ? ` (${before.commit})` : ""}`;
    const afterText = `${after.label || "After"}${after.commit ? ` (${after.commit})` : ""}`;
    line.append(make("span", "", beforeText), make("span", "", afterText));
    return line;
  }

  function createSceneBrowser(story) {
    const comparisons = Array.isArray(story.comparisons) ? story.comparisons : [];
    const wrapper = make("div", "scene-browser");
    if (!comparisons.length) {
      setError(wrapper, "No scenes are attached. ", "The narrative is available below.");
      return wrapper;
    }

    const tabs = make("div", "scene-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Comparison scenes");
    const panel = make("div", "scene-panel");
    panel.id = "scene-panel";
    panel.setAttribute("role", "tabpanel");
    panel.tabIndex = 0;
    const tabButtons = [];
    let activeIndex = 0;

    function sceneId(scene, index) {
      return String((scene && scene.id) || `scene-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "-");
    }

    function hashSceneId() {
      const hash = window.location.hash.slice(1);
      try {
        return decodeURIComponent(hash);
      } catch (_error) {
        return hash;
      }
    }

    function select(index, updateHash, moveFocus) {
      activeIndex = Math.max(0, Math.min(comparisons.length - 1, index));
      const scene = comparisons[activeIndex];
      const activeTab = tabButtons[activeIndex];
      tabButtons.forEach((tab, tabIndex) => {
        const selected = tabIndex === activeIndex;
        tab.setAttribute("aria-selected", selected ? "true" : "false");
        tab.tabIndex = selected ? 0 : -1;
      });
      panel.setAttribute("aria-labelledby", activeTab.id);
      panel.dataset.scene = sceneId(scene, activeIndex);
      panel.replaceChildren(createVersionLine(story), createComparison(scene, { eager: true }));
      if (moveFocus) activeTab.focus();
      if (updateHash) {
        const hash = `#${sceneId(scene, activeIndex)}`;
        const route = `${window.location.pathname}${window.location.search}${hash}`;
        window.history.replaceState(null, "", route);
      }
    }

    comparisons.forEach((scene, index) => {
      const id = sceneId(scene, index);
      const button = make("button", "scene-tab", scene.title || `Scene ${index + 1}`);
      button.type = "button";
      button.id = `scene-tab-${id}`;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", panel.id);
      button.addEventListener("click", () => select(index, true, false));
      button.addEventListener("keydown", (event) => {
        let target = null;
        if (event.key === "ArrowRight") target = (index + 1) % comparisons.length;
        if (event.key === "ArrowLeft") target = (index - 1 + comparisons.length) % comparisons.length;
        if (event.key === "Home") target = 0;
        if (event.key === "End") target = comparisons.length - 1;
        if (target === null) return;
        event.preventDefault();
        select(target, true, true);
      });
      tabButtons.push(button);
      tabs.append(button);
    });

    const requestedId = hashSceneId();
    const requestedIndex = comparisons.findIndex((scene, index) => sceneId(scene, index) === requestedId);
    select(requestedIndex >= 0 ? requestedIndex : 0, false, false);
    wrapper.append(tabs, panel);

    window.addEventListener("hashchange", () => {
      const hashId = hashSceneId();
      const index = comparisons.findIndex((scene, sceneIndex) => sceneId(scene, sceneIndex) === hashId);
      if (index >= 0 && index !== activeIndex) select(index, false, false);
    });
    return wrapper;
  }

  function createChanges(story) {
    const section = make("section", "story-section");
    section.id = "changes";
    section.setAttribute("aria-labelledby", "changes-heading");
    section.append(make("h2", "story-section-title", "What changed"));
    section.lastChild.id = "changes-heading";
    const list = make("ol", "change-list");
    const changes = Array.isArray(story.changes) ? story.changes : [];
    changes.forEach((change) => {
      const item = make("li", "change-item");
      item.append(
        make("h3", "", change.title || "Change"),
        make("p", "", change.body || ""),
      );
      list.append(item);
    });
    section.append(list);

    const proof = Array.isArray(story.proof) ? story.proof : [];
    if (proof.length) {
      const proofList = make("dl", "proof-list");
      proof.forEach((item) => {
        const group = make("div", "proof-item");
        group.append(make("dt", "", item.label || "Evidence"), make("dd", "", item.value || "—"));
        proofList.append(group);
      });
      section.append(proofList);
    }
    return section;
  }

  function createBuilderNote(story) {
    const note = story.builderNote;
    if (!note || (!note.quote && !note.context)) return null;
    const figure = make("figure", "builder-note");
    figure.append(
      make("blockquote", "", note.quote || ""),
      make("figcaption", "", note.context || "Builder note"),
    );
    return figure;
  }

  async function copyText(value) {
    const text = String(value || "");
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const field = make("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    if (!copied) throw new Error("Copy is not available.");
  }

  function copyButton(label, value, status) {
    const button = make("button", "plain-button", label);
    button.type = "button";
    button.addEventListener("click", async () => {
      try {
        await copyText(typeof value === "function" ? value() : value);
        status.textContent = `${label} copied.`;
      } catch (_error) {
        status.textContent = "Copy is not available in this browser.";
      }
    });
    return button;
  }

  function createShareArea(story) {
    const section = make("section", "story-section share-section");
    section.setAttribute("aria-labelledby", "share-heading");
    const heading = make("h2", "story-section-title", "Use this story");
    heading.id = "share-heading";
    const actions = make("div", "story-actions");
    const status = make("p", "share-status");
    status.setAttribute("role", "status");

    const links = story.links || {};
    addLink(actions, "Open the live app", links.live, "action-link");
    addLink(actions, "View the source", links.source, "action-link");
    addLink(actions, "Download the montage", links.download, "action-link", { download: true });
    actions.append(
      copyButton("Copy link", () => window.location.href, status),
      copyButton("Copy summary", (story.share && story.share.summary) || story.summary || story.thesis, status),
    );
    section.append(heading, actions, status);
    return section;
  }

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key) || "";
    } catch (_error) {
      return "";
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function createTalkingNotes(story) {
    const section = make("section", "story-section");
    section.id = "notes";
    section.setAttribute("aria-labelledby", "notes-heading");
    const heading = make("h2", "story-section-title", "Local talking notes");
    heading.id = "notes-heading";
    const explainer = make(
      "p",
      "private-note-copy",
      "Stored in this browser for this site and not added to the public story. Don’t store secrets here.",
    );
    const form = make("div", "private-note");
    const label = make("label", "", "Notes for your next post, demo, or conversation");
    const textarea = make("textarea");
    const key = `${NOTES_PREFIX}${story.slug || "story"}`;
    textarea.id = "talking-notes";
    textarea.name = "talking-notes";
    textarea.placeholder = "What surprised you? What should people notice in the comparison?";
    textarea.value = storageGet(key);
    label.htmlFor = textarea.id;
    const status = make("p", "notes-status");
    status.setAttribute("role", "status");
    let saveTimer = 0;
    textarea.addEventListener("input", () => {
      window.clearTimeout(saveTimer);
      status.textContent = "Saving locally…";
      saveTimer = window.setTimeout(() => {
        status.textContent = storageSet(key, textarea.value)
          ? "Saved in this browser."
          : "This browser blocked local storage. Copy your notes before leaving.";
      }, 250);
    });
    const copy = copyButton("Copy notes", () => textarea.value, status);
    form.append(label, textarea, copy, status);
    section.append(heading, explainer, form);
    return section;
  }

  function renderStory(story, record) {
    const root = document.getElementById("story-root");
    if (!root) return;
    root.classList.remove("loading-block");
    root.removeAttribute("aria-live");
    const article = make("article", "story-record");
    const header = make("header", "story-header");
    const kicker = make("p", "story-kicker");
    const status = sentenceCase(story.status || record.status || "published");
    const publishedAt = storyDate(record, story);
    const date = storyDateLabel(record, story);
    const dateElement = make(publishedAt ? "time" : "span", "", date);
    if (publishedAt) dateElement.dateTime = publishedAt;
    const storyKind = story.kind === "app" ? "app story" : story.kind === "surface" ? "surface story" : "build story";
    kicker.append(
      make("span", "", `${status} ${storyKind}`),
      dateElement,
    );
    const title = make("h1", "story-title", story.title || record.title || "Untitled story");
    const thesis = make("p", "story-thesis", story.thesis || story.summary || "");
    header.append(kicker, title, thesis);

    const comparisonSection = make("section", "story-section");
    comparisonSection.id = "comparison";
    comparisonSection.setAttribute("aria-labelledby", "comparison-heading");
    const comparisonHeading = make("h2", "story-section-title", "Screen record");
    comparisonHeading.id = "comparison-heading";
    comparisonSection.append(comparisonHeading, createSceneBrowser(story));

    article.append(header, comparisonSection, createChanges(story));
    const builderNote = createBuilderNote(story);
    if (builderNote) article.append(builderNote);
    article.append(createShareArea(story), createTalkingNotes(story));
    root.replaceChildren(article);
  }

  async function init() {
    try {
      const manifest = await fetchJson(MANIFEST_PATH);
      renderLedger(manifest);
      const storySlug = document.body.dataset.story;
      if (!storySlug) {
        await renderArchive(manifest);
        return;
      }
      const records = Array.isArray(manifest.stories) ? manifest.stories : [];
      const record = records.find((item) => item && item.slug === storySlug);
      if (!record) throw new Error(`The “${storySlug}” story is not listed in the archive.`);
      const story = await loadStory(record);
      renderStory(story, record);
    } catch (error) {
      const root = document.getElementById("story-root") || document.getElementById("latest-story");
      setError(root, "The field record could not be loaded. ", error.message || "Try again later.");
    }
  }

  init();
})();
