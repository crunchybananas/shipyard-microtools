#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, posix, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archiveRoot = resolve(repoRoot, 'docs/before-after');
const manifestPath = resolve(archiveRoot, 'manifest.json');

const EXCLUDED_DEMO_DIRECTORIES = new Set(['before-after', 'ember', 'morphogen']);
const APP_STATUSES = new Set(['published', 'in-revision', 'queued', 'separate-workstream']);
const SURFACE_STATUSES = new Set(['published', 'in-revision', 'queued']);
const STORY_STATUSES = new Set(['published', 'in-revision']);
const APP_CATEGORIES = new Set(['Games', 'Build tools', 'Creative', 'Explore']);
const STORY_KINDS = new Set(['app', 'surface']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ASSET_PATTERN = /^assets\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpe?g|png)$/;
const STORY_PATH_PATTERN = /^stories\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;
const STORY_HREF_PATTERN = /^\.\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/;
const STORY_SHELL_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\/index\.html$/;
const CANONICAL_ARCHIVE_ROOT = 'https://crunchybananas.github.io/shipyard-microtools/before-after/';
const archiveRealRoot = realpathSync(archiveRoot);

const failures = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function checkRecord(value, label) {
  check(isRecord(value), `${label} must be an object`);
  return isRecord(value);
}

function checkString(value, label) {
  check(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function checkStringOrNull(value, label) {
  check(value === null || (typeof value === 'string' && value.trim().length > 0), `${label} must be null or a non-empty string`);
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    failures.push(`${label} is not readable JSON: ${error.message}`);
    return null;
  }
}

function safeRelativePath(relativePath, pattern, label) {
  if (typeof relativePath !== 'string') {
    check(false, `${label} must be a string`);
    return null;
  }

  const supported = pattern.test(relativePath);
  const forwardSlashes = !relativePath.includes('\\');
  const normalized = posix.normalize(relativePath) === relativePath;
  check(supported, `${label} has an unsupported path: ${relativePath}`);
  check(forwardSlashes, `${label} must use forward slashes: ${relativePath}`);
  check(normalized, `${label} must be normalized: ${relativePath}`);
  if (!supported || !forwardSlashes || !normalized) return null;

  const absolutePath = resolve(archiveRoot, relativePath);
  const contained = absolutePath.startsWith(`${archiveRoot}${sep}`);
  check(contained, `${label} escapes the archive root: ${relativePath}`);
  if (!contained) return null;

  if (existsSync(absolutePath)) {
    try {
      const realPath = realpathSync(absolutePath);
      const realPathContained = realPath.startsWith(`${archiveRealRoot}${sep}`);
      check(realPathContained, `${label} resolves through a symlink outside the archive root: ${relativePath}`);
      if (!realPathContained) return null;
    } catch (error) {
      check(false, `${label} could not be resolved safely: ${error.message}`);
      return null;
    }
  }

  return absolutePath;
}

function checkUniqueSlugs(records, label) {
  const seen = new Set();
  for (const [index, record] of records.entries()) {
    const slug = record?.slug;
    check(typeof slug === 'string' && SLUG_PATTERN.test(slug), `${label}[${index}].slug is invalid`);
    if (typeof slug !== 'string') continue;
    check(!seen.has(slug), `${label} contains duplicate slug: ${slug}`);
    seen.add(slug);
  }
  return seen;
}

function discoverTrackedApps() {
  try {
    return execFileSync('git', ['ls-files', '--', 'docs/*/index.html'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
      .split(/\r?\n/)
      .filter(path => /^docs\/[^/]+\/index\.html$/.test(path))
      .map(path => path.split('/')[1])
      .filter(slug => slug && !EXCLUDED_DEMO_DIRECTORIES.has(slug))
      .sort();
  } catch (error) {
    failures.push(`Could not discover tracked demos: ${error.message}`);
    return [];
  }
}

function checkCommit(commit, label) {
  check(typeof commit === 'string' && COMMIT_PATTERN.test(commit), `${label} must be a 7–40 character lowercase Git commit`);
  if (typeof commit !== 'string' || !COMMIT_PATTERN.test(commit)) return;

  try {
    execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    checks += 1;
  } catch {
    checks += 1;
    failures.push(`${label} does not resolve to a commit in this repository: ${commit}`);
  }
}

function readImageDimensions(path, label) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    failures.push(`${label} could not be read: ${error.message}`);
    return null;
  }

  const isPng =
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes.subarray(1, 4).toString('ascii') === 'PNG' &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (isPng) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const startOfFrameMarkers = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
      0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ]);
    let offset = 2;

    while (offset < bytes.length) {
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
      if (offset >= bytes.length) break;

      const marker = bytes[offset];
      offset += 1;
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;

      const segmentLength = bytes.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
      if (startOfFrameMarkers.has(marker) && segmentLength >= 7) {
        return {
          width: bytes.readUInt16BE(offset + 5),
          height: bytes.readUInt16BE(offset + 3),
        };
      }
      offset += segmentLength;
    }
  }

  failures.push(`${label} is not a readable PNG or JPEG image`);
  return null;
}

function checkAsset(relativePath, label, inspectDimensions = false) {
  const absolutePath = safeRelativePath(relativePath, ASSET_PATTERN, label);
  if (!absolutePath) return null;
  check(existsSync(absolutePath), `${label} does not exist: ${relativePath}`);
  if (!existsSync(absolutePath) || !inspectDimensions) return null;
  return readImageDimensions(absolutePath, label);
}

function checkLiveLink(value, label) {
  checkString(value, label);
  if (typeof value !== 'string') return;
  try {
    const parsed = new URL(value);
    check(parsed.protocol === 'https:', `${label} must use HTTPS`);
    check(parsed.hostname === 'crunchybananas.github.io', `${label} must use the canonical Crunchy Bananas host`);
    check(parsed.pathname.startsWith('/shipyard-microtools/'), `${label} must include the GitHub Pages project prefix`);
    check(!decodeURIComponent(parsed.pathname).split('/').includes('..'), `${label} must not traverse directories`);
    check(parsed.search === '' && parsed.hash === '', `${label} must not include a query string or fragment`);
  } catch {
    check(false, `${label} is not a valid URL`);
  }
}

function checkSourceLink(value, label) {
  checkString(value, label);
  if (typeof value !== 'string') return;
  try {
    const parsed = new URL(value);
    check(parsed.protocol === 'https:', `${label} must use HTTPS`);
    check(parsed.hostname === 'github.com', `${label} must link to github.com`);
    check(
      parsed.pathname === '/crunchybananas/shipyard-microtools' ||
        parsed.pathname.startsWith('/crunchybananas/shipyard-microtools/'),
      `${label} must point into the Shipyard repository`,
    );
  } catch {
    check(false, `${label} is not a valid URL`);
  }
}

function htmlAttribute(tag, name) {
  if (typeof tag !== 'string') return null;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`\\b${escapedName}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match ? match[2] : null;
}

function findHtmlTag(html, tagName, attributeName, attributeValue) {
  const tags = html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? [];
  return tags.find(tag => htmlAttribute(tag, attributeName)?.toLowerCase() === attributeValue.toLowerCase()) ?? null;
}

function checkStoryShell(shellPath, record, story) {
  const label = `${record.slug}/index.html`;
  let html;
  try {
    html = readFileSync(shellPath, 'utf8');
  } catch (error) {
    check(false, `${label} could not be read: ${error.message}`);
    return;
  }

  const bodyTag = html.match(/<body\b[^>]*>/i)?.[0] ?? null;
  check(htmlAttribute(bodyTag, 'data-story') === record.slug, `${label} body data-story must be ${record.slug}`);

  const baseTag = html.match(/<base\b[^>]*>/i)?.[0] ?? null;
  const baseHref = htmlAttribute(baseTag, 'href');
  check(baseHref === '../', `${label} must declare <base href="../">`);

  const canonicalTag = findHtmlTag(html, 'link', 'rel', 'canonical');
  const canonicalUrl = htmlAttribute(canonicalTag, 'href');
  const expectedCanonical = `${CANONICAL_ARCHIVE_ROOT}${record.slug}/`;
  check(canonicalUrl === expectedCanonical, `${label} canonical URL must be ${expectedCanonical}`);

  const hrefValues = [];
  const hrefPattern = /\bhref\s*=\s*(["'])(.*?)\1/gi;
  for (const match of html.matchAll(hrefPattern)) hrefValues.push(match[2]);
  check(
    hrefValues.every(href => !href.startsWith('#')),
    `${label} must not use bare fragment hrefs with its parent-directory base`,
  );

  const expectedFragments = new Set(['#main', '#comparison', '#changes', '#notes']);
  const foundFragments = new Set();
  const shellBaseUrl = new URL('../', expectedCanonical);
  for (const href of hrefValues.filter(value => value.includes('#'))) {
    try {
      const resolved = new URL(href, shellBaseUrl);
      check(
        `${resolved.origin}${resolved.pathname}` === expectedCanonical && resolved.hash.length > 1,
        `${label} fragment href must resolve within its canonical story: ${href}`,
      );
      foundFragments.add(resolved.hash);
    } catch {
      check(false, `${label} contains an invalid fragment href: ${href}`);
    }
  }
  for (const fragment of expectedFragments) {
    check(foundFragments.has(fragment), `${label} is missing its base-safe ${fragment} link`);
  }

  const openGraphUrlTag = findHtmlTag(html, 'meta', 'property', 'og:url');
  check(htmlAttribute(openGraphUrlTag, 'content') === expectedCanonical, `${label} og:url must match its canonical URL`);

  const expectedShareImage = `${CANONICAL_ARCHIVE_ROOT}${story.share?.image ?? ''}`;
  check(record.cover === story.share?.image, `${label} manifest cover must match the story share image`);
  const openGraphImageTag = findHtmlTag(html, 'meta', 'property', 'og:image');
  check(
    htmlAttribute(openGraphImageTag, 'content') === expectedShareImage,
    `${label} og:image must be ${expectedShareImage}`,
  );

  const openGraphImageAltTag = findHtmlTag(html, 'meta', 'property', 'og:image:alt');
  const openGraphImageAlt = htmlAttribute(openGraphImageAltTag, 'content');
  check(
    typeof openGraphImageAlt === 'string' && openGraphImageAlt.trim().length > 0,
    `${label} must include a non-empty og:image:alt`,
  );
  const twitterImageAltTag = findHtmlTag(html, 'meta', 'name', 'twitter:image:alt');
  const twitterImageAlt = htmlAttribute(twitterImageAltTag, 'content');
  check(
    typeof twitterImageAlt === 'string' && twitterImageAlt.trim().length > 0,
    `${label} must include a non-empty twitter:image:alt`,
  );
  if (openGraphImageAlt && twitterImageAlt) {
    check(openGraphImageAlt === twitterImageAlt, `${label} social image alt metadata must agree`);
  }
}

function checkStory(story, record, appBySlug, surfaceBySlug) {
  const label = `stories/${record.slug}.json`;
  if (!checkRecord(story, label)) return;

  check([1, 2].includes(story.schemaVersion), `${label}.schemaVersion must be 1 or 2`);
  check(story.slug === record.slug, `${label}.slug must match its manifest record`);
  check(story.title === record.title, `${label}.title must match its manifest record`);
  check(story.appSlug === record.appSlug, `${label}.appSlug must match its manifest record`);
  check(story.surfaceSlug === record.surfaceSlug, `${label}.surfaceSlug must match its manifest record`);
  checkStringOrNull(story.surfaceSlug, `${label}.surfaceSlug`);
  check(story.kind === record.kind && STORY_KINDS.has(story.kind), `${label}.kind must match its manifest record and be app or surface`);
  check(story.status === record.status && STORY_STATUSES.has(story.status), `${label}.status must match its manifest record and use an allowed status`);
  check(story.publishedAt === record.publishedAt, `${label}.publishedAt must match its manifest record`);
  check(
    story.publishedAt === null || (typeof story.publishedAt === 'string' && DATE_PATTERN.test(story.publishedAt)),
    `${label}.publishedAt must be null or YYYY-MM-DD`,
  );
  check(story.status !== 'published' || story.publishedAt !== null, `${label} must have publishedAt when published`);
  checkString(story.thesis, `${label}.thesis`);
  checkString(story.summary, `${label}.summary`);

  if (story.kind === 'app') {
    check(typeof story.appSlug === 'string' && appBySlug.has(story.appSlug), `${label}.appSlug must identify a manifest app`);
    check(record.appSlug === story.appSlug, `${label} must retain its manifest app owner`);
    check(story.surfaceSlug === null, `${label} must not declare a surface owner`);
  } else if (story.kind === 'surface') {
    check(story.appSlug === null, `${label}.appSlug must be null for a surface story`);
    check(
      typeof story.surfaceSlug === 'string' && surfaceBySlug.has(story.surfaceSlug),
      `${label} must identify an existing manifest surface owner`,
    );
  }

  if (checkRecord(story.versions, `${label}.versions`)) {
    for (const side of ['before', 'after']) {
      const version = story.versions[side];
      if (!checkRecord(version, `${label}.versions.${side}`)) continue;
      checkString(version.label, `${label}.versions.${side}.label`);
      checkCommit(version.commit, `${label}.versions.${side}.commit`);
    }
  }

  if (story.schemaVersion === 2) {
    check(Array.isArray(story.lineage) && story.lineage.length >= 2, `${label}.lineage needs at least two revisions`);
    checkString(story.captureProtocol, `${label}.captureProtocol`);
    const seen = new Set();
    for (const version of (Array.isArray(story.lineage) ? story.lineage : [])) {
      const versionLabel = `${label}.lineage.${version?.id}`;
      if (!checkRecord(version, versionLabel)) continue;
      check(typeof version.id === 'string' && SLUG_PATTERN.test(version.id) && !seen.has(version.id), `${versionLabel} needs a unique valid id`);
      seen.add(version.id);
      checkString(version.label, `${versionLabel}.label`);
      checkString(version.summary, `${versionLabel}.summary`);
      checkCommit(version.commit, `${versionLabel}.commit`);
      if (!checkRecord(version.provenance, `${versionLabel}.provenance`)) continue;
      const provenance = version.provenance;
      checkStringOrNull(provenance.model, `${versionLabel}.provenance.model`);
      checkString(provenance.note, `${versionLabel}.provenance.note`);
      if (!checkRecord(provenance.evidence, `${versionLabel}.provenance.evidence`)) continue;
      const evidence = provenance.evidence;
      check(['commit-trailer', 'unrecorded'].includes(evidence.kind), `${versionLabel} has an unsupported evidence kind`);
      if (evidence.kind === 'unrecorded') check(provenance.model === null, `${versionLabel} cannot attribute an unrecorded model`);
      else if (evidence.kind === 'commit-trailer') {
        checkCommit(evidence.commit, `${versionLabel}.evidence.commit`);
        checkString(evidence.quote, `${versionLabel}.evidence.quote`);
        checkString(provenance.model, `${versionLabel}.provenance.model`);
        try {
          const body = execFileSync('git', ['show', '-s', '--format=%B', evidence.commit], { cwd: repoRoot, encoding: 'utf8' });
          check(body.split('\n').includes(evidence.quote) && evidence.quote.startsWith(`Co-Authored-By: ${provenance.model} <`) && /^Co-Authored-By: .+ <[^>\n]+>$/.test(evidence.quote), `${versionLabel} model credit must match an exact repository trailer`);
          execFileSync('git', ['merge-base', '--is-ancestor', evidence.commit, version.commit], { cwd: repoRoot, stdio: 'ignore' });
          checks++;
        } catch { check(false, `${versionLabel} attribution must resolve and belong to this revision's ancestry`); }
      }
    }
    const lineage = Array.isArray(story.lineage) ? story.lineage : [];
    const receiptPath = safeRelativePath(story.captureReceipt, /^assets\/[a-z0-9-]+\/capture-receipt\.json$/, `${label}.captureReceipt`);
    check(story.captureReceipt === `assets/${story.slug}/capture-receipt.json`, `${label} capture receipt must belong to this story`);
    const receipt = receiptPath ? readJson(receiptPath, `${label} capture receipt`) : null;
    if (receipt) {
      const captures = Array.isArray(receipt.captures) ? receipt.captures : [];
      const scenes = Array.isArray(story.comparisons) ? story.comparisons : [];
      check(captures.length === lineage.length * scenes.length, `${label} receipt must cover every frame exactly once`);
      for (const version of lineage) for (const scene of scenes) {
        const matches = captures.filter(capture => capture.version === version.id && capture.scene === scene.id);
        check(matches.length === 1, `${label} receipt must uniquely identify ${version.id}/${scene.id}`);
        const capture = matches[0];
        if (!capture) continue;
        check(capture.commit === version.commit, `${label} capture commit must match ${version.id}`);
        check(capture.deviceScaleFactor === 1 && capture.viewport?.width === scene.viewport?.width && capture.viewport?.height === scene.viewport?.height, `${label} capture environment differs from its frame`);
        checkString(capture.browser, `${label} capture browser`);
        const frame = scene.frames?.[version.id];
        check(frame?.src === `assets/${story.slug}/${capture.filename}`, `${label} capture filename must match its frame`);
        if (frame?.src) {
          const path = safeRelativePath(frame.src, ASSET_PATTERN, `${label} capture asset`);
          if (path && existsSync(path)) check(createHash('sha256').update(readFileSync(path)).digest('hex') === capture.sha256, `${label} capture hash mismatch: ${version.id}/${scene.id}`);
        }
      }
    }
    check(lineage[0]?.commit === story.versions?.before?.commit && lineage.at(-1)?.commit === story.versions?.after?.commit, `${label} legacy before/after refs must match lineage endpoints`);
    for (let i = 1; i < lineage.length; i++) {
      try { execFileSync('git', ['merge-base', '--is-ancestor', lineage[i - 1].commit, lineage[i].commit], { cwd: repoRoot, stdio: 'ignore' }); checks++; }
      catch { check(false, `${label} lineage commits must follow repository ancestry`); }
    }
  }

  check(Array.isArray(story.comparisons) && story.comparisons.length > 0, `${label}.comparisons must be a non-empty array`);
  const comparisonIds = new Set();
  for (const [index, comparison] of (Array.isArray(story.comparisons) ? story.comparisons : []).entries()) {
    const comparisonLabel = `${label}.comparisons[${index}]`;
    if (!checkRecord(comparison, comparisonLabel)) continue;
    check(typeof comparison.id === 'string' && SLUG_PATTERN.test(comparison.id), `${comparisonLabel}.id is invalid`);
    check(!comparisonIds.has(comparison.id), `${label} contains duplicate comparison id: ${comparison.id}`);
    comparisonIds.add(comparison.id);
    checkString(comparison.title, `${comparisonLabel}.title`);
    checkString(comparison.caption, `${comparisonLabel}.caption`);

    if (story.schemaVersion === 2) {
      const viewport = comparison.viewport;
      check(viewport && Number.isInteger(viewport.width) && viewport.width > 0 && Number.isInteger(viewport.height) && viewport.height > 0, `${comparisonLabel} requires positive viewport dimensions`);
      if (checkRecord(comparison.frames, `${comparisonLabel}.frames`)) {
        const ids = (Array.isArray(story.lineage) ? story.lineage : []).map(version => version.id);
        check(Object.keys(comparison.frames).length === ids.length && Object.keys(comparison.frames).every(id => ids.includes(id)), `${comparisonLabel} frames must exactly cover the lineage`);
        for (const id of ids) {
          const frame = comparison.frames[id];
          if (!checkRecord(frame, `${comparisonLabel}.frames.${id}`)) continue;
          checkString(frame.alt, `${comparisonLabel}.frames.${id}.alt`);
          check(typeof frame.src === 'string' && frame.src.startsWith(`assets/${story.slug}/`), `${comparisonLabel} frame must stay in its story assets`);
          const size = checkAsset(frame.src, `${comparisonLabel}.frames.${id}.src`, true);
          if (size && viewport) check(size.width === viewport.width && size.height === viewport.height, `${comparisonLabel}.${id} capture dimensions must match the recorded viewport`);
        }
        check(comparison.before?.src === comparison.frames[ids[0]]?.src && comparison.after?.src === comparison.frames[ids.at(-1)]?.src, `${comparisonLabel} legacy images must match lineage endpoints`);
      }
    }

    const dimensions = {};
    for (const side of ['before', 'after']) {
      const image = comparison[side];
      if (!checkRecord(image, `${comparisonLabel}.${side}`)) continue;
      checkString(image.alt, `${comparisonLabel}.${side}.alt`);
      check(
        typeof image.src === 'string' && image.src.startsWith(`assets/${story.slug}/`),
        `${comparisonLabel}.${side}.src must stay in assets/${story.slug}/`,
      );
      dimensions[side] = checkAsset(image.src, `${comparisonLabel}.${side}.src`, true);
    }
    if (dimensions.before && dimensions.after) {
      check(
        dimensions.before.width === dimensions.after.width && dimensions.before.height === dimensions.after.height,
        `${comparisonLabel} image dimensions differ: before is ${dimensions.before.width}×${dimensions.before.height}, after is ${dimensions.after.width}×${dimensions.after.height}`,
      );
    }
  }

  check(Array.isArray(story.changes) && story.changes.length > 0, `${label}.changes must be a non-empty array`);
  for (const [index, change] of (Array.isArray(story.changes) ? story.changes : []).entries()) {
    const changeLabel = `${label}.changes[${index}]`;
    if (!checkRecord(change, changeLabel)) continue;
    checkString(change.title, `${changeLabel}.title`);
    checkString(change.body, `${changeLabel}.body`);
  }

  if ((story.schemaVersion === 1 || story.builderNote !== null) && checkRecord(story.builderNote, `${label}.builderNote`)) {
    checkString(story.builderNote.quote, `${label}.builderNote.quote`);
    checkString(story.builderNote.context, `${label}.builderNote.context`);
  }

  check(Array.isArray(story.proof) && story.proof.length > 0, `${label}.proof must be a non-empty array`);
  for (const [index, proof] of (Array.isArray(story.proof) ? story.proof : []).entries()) {
    const proofLabel = `${label}.proof[${index}]`;
    if (!checkRecord(proof, proofLabel)) continue;
    checkString(proof.label, `${proofLabel}.label`);
    checkString(proof.value, `${proofLabel}.value`);
  }

  if (checkRecord(story.links, `${label}.links`)) {
    checkLiveLink(story.links.live, `${label}.links.live`);
    checkSourceLink(story.links.source, `${label}.links.source`);
    check(
      typeof story.links.source === 'string' &&
        typeof story.versions?.after?.commit === 'string' &&
        story.links.source.includes(`/${story.versions.after.commit}/`),
      `${label}.links.source must pin the recorded after commit`,
    );
    checkStringOrNull(story.links.download, `${label}.links.download`);
    if (story.links.download !== null) {
      check(
        typeof story.links.download === 'string' && story.links.download.startsWith(`assets/${story.slug}/`),
        `${label}.links.download must stay in assets/${story.slug}/`,
      );
      checkAsset(story.links.download, `${label}.links.download`);
    }
  }

  if (checkRecord(story.share, `${label}.share`)) {
    checkString(story.share.summary, `${label}.share.summary`);
    check(
      typeof story.share.image === 'string' && story.share.image.startsWith(`assets/${story.slug}/`),
      `${label}.share.image must stay in assets/${story.slug}/`,
    );
    const shareDimensions = checkAsset(story.share.image, `${label}.share.image`, true);
    if (shareDimensions) {
      check(
        shareDimensions.width === 1200 && shareDimensions.height === 630,
        `${label}.share.image must be 1200×630, found ${shareDimensions.width}×${shareDimensions.height}`,
      );
    }
  }
}

const manifest = readJson(manifestPath, 'docs/before-after/manifest.json');
if (manifest && checkRecord(manifest, 'manifest')) {
  check(manifest.schemaVersion === 1, 'manifest.schemaVersion must be 1');
  check(typeof manifest.updatedAt === 'string' && !Number.isNaN(Date.parse(manifest.updatedAt)), 'manifest.updatedAt must be an ISO-compatible timestamp');

  if (checkRecord(manifest.site, 'manifest.site')) {
    checkString(manifest.site.title, 'manifest.site.title');
    checkString(manifest.site.description, 'manifest.site.description');
    check(manifest.site.basePath === '/before-after/', 'manifest.site.basePath must be /before-after/');
    checkSourceLink(manifest.site.repository, 'manifest.site.repository');
  }

  check(Array.isArray(manifest.stories), 'manifest.stories must be an array');
  check(Array.isArray(manifest.surfaces), 'manifest.surfaces must be an array');
  check(Array.isArray(manifest.apps), 'manifest.apps must be an array');

  const stories = Array.isArray(manifest.stories) ? manifest.stories : [];
  const surfaces = Array.isArray(manifest.surfaces) ? manifest.surfaces : [];
  const apps = Array.isArray(manifest.apps) ? manifest.apps : [];
  const storySlugs = checkUniqueSlugs(stories, 'manifest.stories');
  const surfaceSlugs = checkUniqueSlugs(surfaces, 'manifest.surfaces');
  const appSlugs = checkUniqueSlugs(apps, 'manifest.apps');
  const appBySlug = new Map(apps.filter(isRecord).map(app => [app.slug, app]));
  const surfaceBySlug = new Map(surfaces.filter(isRecord).map(surface => [surface.slug, surface]));
  const storyBySlug = new Map(stories.filter(isRecord).map(story => [story.slug, story]));

  for (const [index, app] of apps.entries()) {
    const label = `manifest.apps[${index}]`;
    if (!checkRecord(app, label)) continue;
    checkString(app.title, `${label}.title`);
    check(APP_CATEGORIES.has(app.category), `${label}.category is not allowed: ${app.category}`);
    check(APP_STATUSES.has(app.status), `${label}.status is not allowed: ${app.status}`);
    checkStringOrNull(app.story, `${label}.story`);
    if (app.story !== null) {
      check(storySlugs.has(app.story), `${label}.story does not identify a manifest story: ${app.story}`);
      const currentStory = storyBySlug.get(app.story);
      check(
        currentStory?.kind === 'app' && currentStory.appSlug === app.slug,
        `${label}.story must resolve to an app story owned by ${app.slug}`,
      );
      check(
        currentStory?.status === app.status,
        `${label}.story status must match current app status ${app.status}`,
      );
    }
    check(
      !['published', 'in-revision'].includes(app.status) || app.story !== null,
      `${label} needs a current story while ${app.status}`,
    );
    check(!['queued', 'separate-workstream'].includes(app.status) || app.story === null, `${label} cannot reference a story while ${app.status}`);
  }

  for (const [index, surface] of surfaces.entries()) {
    const label = `manifest.surfaces[${index}]`;
    if (!checkRecord(surface, label)) continue;
    checkString(surface.title, `${label}.title`);
    checkString(surface.category, `${label}.category`);
    check(SURFACE_STATUSES.has(surface.status), `${label}.status is not allowed: ${surface.status}`);
    checkStringOrNull(surface.story, `${label}.story`);
    if (surface.story !== null) {
      check(storySlugs.has(surface.story), `${label}.story does not identify a manifest story: ${surface.story}`);
      const currentStory = storyBySlug.get(surface.story);
      check(
        currentStory?.kind === 'surface' && currentStory.surfaceSlug === surface.slug,
        `${label}.story must resolve to a surface story owned by ${surface.slug}`,
      );
      check(
        currentStory?.status === surface.status,
        `${label}.story status must match current surface status ${surface.status}`,
      );
    }
    check(
      !['published', 'in-revision'].includes(surface.status) || surface.story !== null,
      `${label} needs a current story while ${surface.status}`,
    );
    check(surface.status !== 'queued' || surface.story === null, `${label} cannot reference a story while queued`);
  }
  check(surfaceSlugs.has('demo-hub'), 'manifest.surfaces must include demo-hub');
  check(surfaceBySlug.get('demo-hub')?.status === 'in-revision', 'demo-hub must be marked in-revision');

  const trackedApps = discoverTrackedApps();
  const manifestApps = [...appSlugs].sort();
  check(
    trackedApps.length === manifestApps.length && trackedApps.every((slug, index) => slug === manifestApps[index]),
    `manifest app inventory does not match tracked docs apps\n  tracked:  ${trackedApps.join(', ')}\n  manifest: ${manifestApps.join(', ')}`,
  );

  for (const [index, record] of stories.entries()) {
    const label = `manifest.stories[${index}]`;
    if (!checkRecord(record, label)) continue;
    checkString(record.title, `${label}.title`);
    check(STORY_KINDS.has(record.kind), `${label}.kind must be app or surface`);
    check(STORY_STATUSES.has(record.status), `${label}.status is not allowed: ${record.status}`);
    checkStringOrNull(record.appSlug, `${label}.appSlug`);
    checkStringOrNull(record.surfaceSlug, `${label}.surfaceSlug`);
    if (record.kind === 'app') {
      check(typeof record.appSlug === 'string' && appBySlug.has(record.appSlug), `${label}.appSlug must identify an existing manifest app`);
      check(record.surfaceSlug === null, `${label}.surfaceSlug must be null for an app story`);
    } else if (record.kind === 'surface') {
      check(record.appSlug === null, `${label}.appSlug must be null for a surface story`);
      check(
        typeof record.surfaceSlug === 'string' && surfaceBySlug.has(record.surfaceSlug),
        `${label}.surfaceSlug must identify an existing manifest surface`,
      );
    }
    check(
      record.publishedAt === null || (typeof record.publishedAt === 'string' && DATE_PATTERN.test(record.publishedAt)),
      `${label}.publishedAt must be null or YYYY-MM-DD`,
    );
    check(typeof record.data === 'string' && STORY_PATH_PATTERN.test(record.data), `${label}.data must be a safe stories/<slug>.json path`);
    check(record.data === `stories/${record.slug}.json`, `${label}.data must use its story slug`);
    check(record.href === `./${record.slug}/`, `${label}.href must be its stable archive route`);
    check(STORY_HREF_PATTERN.test(record.href), `${label}.href is not a safe story route`);
    check(
      typeof record.cover === 'string' && record.cover.startsWith(`assets/${record.slug}/`),
      `${label}.cover must stay in assets/${record.slug}/`,
    );
    const storyShellPath =
      typeof record.slug === 'string' && SLUG_PATTERN.test(record.slug)
        ? safeRelativePath(`${record.slug}/index.html`, STORY_SHELL_PATTERN, `${label}.href`)
        : null;
    check(storyShellPath !== null && existsSync(storyShellPath), `${label}.href has no story shell at ${record.slug}/index.html`);
    checkAsset(record.cover, `${label}.cover`);

    const storyPath = safeRelativePath(record.data, STORY_PATH_PATTERN, `${label}.data`);
    check(storyPath !== null && existsSync(storyPath), `${label}.data does not exist: ${record.data}`);
    if (storyPath && existsSync(storyPath)) {
      const story = readJson(storyPath, record.data);
      checkStory(story, record, appBySlug, surfaceBySlug);
      if (storyShellPath && existsSync(storyShellPath) && isRecord(story)) {
        checkStoryShell(storyShellPath, record, story);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Before/after verification failed with ${failures.length} issue${failures.length === 1 ? '' : 's'}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Before/after archive verified (${checks} checks, ${manifest.apps.length} apps, ${manifest.stories.length} stories).`);
}
