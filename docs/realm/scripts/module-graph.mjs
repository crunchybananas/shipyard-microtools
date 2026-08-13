// Runtime module-identity tooling for Realm's native ES-module build.
//
// This file deliberately has no parser dependency. The lexer below recognizes
// JavaScript lexical boundaries (comments, strings, regexps and template
// expressions) before extracting Realm's executable module-specifier forms:
// static imports, side-effect imports, re-exports, literal dynamic imports and
// native module Worker entry URLs.

// Browser evaluator imports are written as `./js/...` inside scripts, but are
// evaluated relative to index.html rather than the script file. They are
// classified explicitly so they resolve to the same URLs as the live graph.

import {
  readFileSync,
  readdirSync,
  writeFileSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REALM_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JS_ROOT = join(REALM_ROOT, 'js');
const SCRIPTS_ROOT = join(REALM_ROOT, 'scripts');
const CONTRACT_PATH = join(REALM_ROOT, 'runtime-contract.json');

const LINE_START_CACHE = new Map();
function lineAt(source, offset) {
  let starts = LINE_START_CACHE.get(source);
  if (!starts) {
    starts = [0];
    for (let i = 0; i < source.length; i++) if (source.charCodeAt(i) === 10) starts.push(i + 1);
    LINE_START_CACHE.set(source, starts);
  }
  let low = 0;
  let high = starts.length;
  while (low + 1 < high) {
    const middle = (low + high) >> 1;
    if (starts[middle] <= offset) low = middle;
    else high = middle;
  }
  return low + 1;
}

function isIdentifierStart(ch) {
  return ch === '$' || ch === '_' || /[A-Za-z]/.test(ch);
}

function isIdentifierPart(ch) {
  return ch === '$' || ch === '_' || /[A-Za-z0-9]/.test(ch);
}

function decodeStringToken(raw, quote, file, line) {
  // Decoding is intentionally delayed until a string is identified as a
  // module specifier. Ordinary program strings may of course contain escapes.
  if (raw.includes('\n') || raw.includes('\r')) {
    throw new Error(`${file}:${line}: newline in module specifier`);
  }
  return raw;
}

// A regexp can begin where an expression can begin. This is enough to keep
// words such as "import" inside regexp bodies out of the token stream without
// trying to become a full JavaScript grammar.
function regexpMayStart(previous) {
  if (!previous) return true;
  if (previous.type === 'identifier') {
    return new Set([
      'await', 'case', 'delete', 'do', 'else', 'in', 'instanceof', 'new',
      'of', 'return', 'throw', 'typeof', 'void', 'yield',
    ]).has(previous.value);
  }
  return new Set([
    '(', '[', '{', ',', ';', ':', '?', '=', '==', '===', '!=', '!==',
    '!', '~', '+', '-', '*', '%', '&', '|', '^', '&&', '||', '??', '=>',
  ]).has(previous.value);
}

/** Lex JavaScript while preserving string ranges used by revision rewrites. */
export function lexJavaScript(source, file = '<source>') {
  const tokens = [];
  let i = 0;
  let previous = null;

  const push = token => {
    tokens.push(token);
    previous = token;
  };

  function scanString(quote) {
    const start = i;
    i++;
    const contentStart = i;
    while (i < source.length) {
      const ch = source[i];
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) {
        const contentEnd = i;
        i++;
        const raw = source.slice(contentStart, contentEnd);
        push({
          type: 'string',
          value: decodeStringToken(raw, quote, file, lineAt(source, start)),
          quote,
          start,
          end: i,
          contentStart,
          contentEnd,
          line: lineAt(source, start),
        });
        return;
      }
      if (ch === '\n' || ch === '\r') {
        throw new Error(`${file}:${lineAt(source, start)}: unterminated string literal`);
      }
      i++;
    }
    throw new Error(`${file}:${lineAt(source, start)}: unterminated string literal`);
  }

  function skipRegexp() {
    const start = i++;
    let inClass = false;
    while (i < source.length) {
      const ch = source[i++];
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === '[') inClass = true;
      else if (ch === ']') inClass = false;
      else if (ch === '/' && !inClass) {
        while (/[A-Za-z]/.test(source[i] || '')) i++;
        push({ type: 'regexp', value: '<regexp>', start, end: i, line: lineAt(source, start) });
        return;
      } else if (ch === '\n' || ch === '\r') {
        // Invalid regexps are left to the JS engine. Treat the slash as a
        // punctuation token so extraction still fails conservatively.
        i = start + 1;
        push({ type: 'punctuator', value: '/', start, end: i, line: lineAt(source, start) });
        return;
      }
    }
    i = start + 1;
    push({ type: 'punctuator', value: '/', start, end: i, line: lineAt(source, start) });
  }

  function scanTemplate() {
    const start = i++;
    while (i < source.length) {
      const ch = source[i];
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '`') {
        i++;
        return;
      }
      if (ch === '$' && source[i + 1] === '{') {
        i += 2;
        scanCode(true);
        continue;
      }
      i++;
    }
    throw new Error(`${file}:${lineAt(source, start)}: unterminated template literal`);
  }

  function scanCode(stopAtTemplateBrace = false) {
    let braceDepth = stopAtTemplateBrace ? 1 : 0;
    while (i < source.length) {
      const ch = source[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (ch === '/' && source[i + 1] === '/') {
        i += 2;
        while (i < source.length && source[i] !== '\n') i++;
        continue;
      }
      if (ch === '/' && source[i + 1] === '*') {
        const start = i;
        i += 2;
        while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
        if (i >= source.length) throw new Error(`${file}:${lineAt(source, start)}: unterminated block comment`);
        i += 2;
        continue;
      }
      if (ch === "'" || ch === '"') {
        scanString(ch);
        continue;
      }
      if (ch === '`') {
        scanTemplate();
        continue;
      }
      if (ch === '/' && regexpMayStart(previous)) {
        skipRegexp();
        continue;
      }
      if (isIdentifierStart(ch)) {
        const start = i++;
        while (i < source.length && isIdentifierPart(source[i])) i++;
        push({ type: 'identifier', value: source.slice(start, i), start, end: i, line: lineAt(source, start) });
        continue;
      }
      if (/[0-9]/.test(ch)) {
        const start = i++;
        while (i < source.length && /[A-Za-z0-9_.]/.test(source[i])) i++;
        push({ type: 'number', value: source.slice(start, i), start, end: i, line: lineAt(source, start) });
        continue;
      }

      const start = i;
      const three = source.slice(i, i + 3);
      const two = source.slice(i, i + 2);
      const punct = ['===', '!==', '>>>', '**=', '&&=', '||=', '??='].includes(three)
        ? three
        : ['=>', '==', '!=', '<=', '>=', '++', '--', '&&', '||', '??', '?.', '**', '<<', '>>'].includes(two)
          ? two
          : ch;
      i += punct.length;
      if (stopAtTemplateBrace) {
        if (punct === '{') braceDepth++;
        if (punct === '}') {
          braceDepth--;
          if (braceDepth === 0) return;
        }
      }
      push({ type: 'punctuator', value: punct, start, end: i, line: lineAt(source, start) });
    }
    if (stopAtTemplateBrace) throw new Error(`${file}: unterminated template expression`);
  }

  scanCode(false);
  return tokens;
}

function moduleRecord(kind, token, file) {
  if (token.value.includes('\\')) {
    throw new Error(`${file}:${token.line}: escaped module specifiers are not supported`);
  }
  return {
    kind,
    specifier: token.value,
    start: token.contentStart,
    end: token.contentEnd,
    line: token.line,
    file,
  };
}

/** Extract all ECMAScript module edges without matching comments or inert text. */
export function parseModuleSpecifiers(source, file = '<source>') {
  const tokens = lexJavaScript(source, file);
  const records = [];
  const nonLiteralDynamicImports = [];
  const nonLiteralWorkerEntries = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== 'identifier') continue;

    if (
      token.value === 'new'
      && tokens[i + 1]?.value === 'Worker'
      && tokens[i + 2]?.value === '('
    ) {
      const literalUrl = tokens[i + 3]?.value === 'new'
        && tokens[i + 4]?.value === 'URL'
        && tokens[i + 5]?.value === '('
        && tokens[i + 6]?.type === 'string'
        && tokens[i + 7]?.value === ','
        && tokens[i + 8]?.value === 'import'
        && tokens[i + 9]?.value === '.'
        && tokens[i + 10]?.value === 'meta'
        && tokens[i + 11]?.value === '.'
        && tokens[i + 12]?.value === 'url'
        && tokens[i + 13]?.value === ')';
      if (literalUrl) records.push(moduleRecord('worker-entry', tokens[i + 6], file));
      else nonLiteralWorkerEntries.push({ file, line: token.line, offset: token.start });
      continue;
    }

    if (token.value === 'import') {
      if (tokens[i - 1]?.value === '.' || tokens[i - 1]?.value === '?.') continue;
      const next = tokens[i + 1];
      if (!next) continue;
      if (next.value === '.') continue; // import.meta
      if (next.value === '(') {
        const argument = tokens[i + 2];
        if (argument?.type === 'string') records.push(moduleRecord('dynamic-import', argument, file));
        else nonLiteralDynamicImports.push({ file, line: token.line, offset: token.start });
        continue;
      }
      if (next.type === 'string') {
        records.push(moduleRecord('side-effect-import', next, file));
        continue;
      }
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].value === ';') break;
        if (tokens[j].type === 'identifier' && tokens[j].value === 'from' && tokens[j + 1]?.type === 'string') {
          records.push(moduleRecord('static-import', tokens[j + 1], file));
          break;
        }
      }
      continue;
    }

    if (token.value === 'export') {
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].value === ';') break;
        if (tokens[j].type === 'identifier' && tokens[j].value === 'from' && tokens[j + 1]?.type === 'string') {
          records.push(moduleRecord('re-export', tokens[j + 1], file));
          break;
        }
      }
    }
  }
  return { records, nonLiteralDynamicImports, nonLiteralWorkerEntries };
}

/** Find external module script entries while ignoring HTML comments. */
export function parseHtmlModuleEntries(source, file = '<html>') {
  const inert = source.replace(/<!--[\s\S]*?-->/g, match => ' '.repeat(match.length));
  const records = [];
  const scriptRe = /<script\b([^>]*)>/gi;
  for (const script of inert.matchAll(scriptRe)) {
    const attrs = script[1];
    const tagOffset = script.index;
    const type = /\btype\s*=\s*(['"])(.*?)\1/i.exec(attrs);
    if (!type || type[2].toLowerCase() !== 'module') continue;
    const src = /\bsrc\s*=\s*(['"])(.*?)\1/i.exec(attrs);
    if (!src) throw new Error(`${file}:${lineAt(source, tagOffset)}: inline module scripts are not registered runtime roots`);
    const contentOffsetInAttrs = src.index + src[0].indexOf(src[2]);
    const start = tagOffset + script[0].indexOf(attrs) + contentOffsetInAttrs;
    records.push({
      kind: 'html-entry',
      specifier: src[2],
      start,
      end: start + src[2].length,
      line: lineAt(source, start),
      file,
    });
  }
  return records;
}

function splitSpecifier(specifier) {
  const hashAt = specifier.indexOf('#');
  const withoutHash = hashAt === -1 ? specifier : specifier.slice(0, hashAt);
  const fragment = hashAt === -1 ? '' : specifier.slice(hashAt + 1);
  const queryAt = withoutHash.indexOf('?');
  return {
    pathname: queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt),
    query: queryAt === -1 ? '' : withoutHash.slice(queryAt + 1),
    fragment,
  };
}

function isLocal(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/');
}

function resolveRuntimeTarget(record, sourceFile) {
  const { pathname } = splitSpecifier(record.specifier);
  if (sourceFile !== join(REALM_ROOT, 'index.html') && !isLocal(record.specifier)) return null;
  if (!['.js', '.json'].includes(extname(pathname))) return null;

  let target;
  let execution = record.kind === 'worker-entry' ? 'worker-entry' : 'runtime-module';
  if (sourceFile === join(REALM_ROOT, 'index.html')) {
    target = resolve(REALM_ROOT, pathname.replace(/^\//, ''));
    execution = 'html-entry';
  } else if (sourceFile.startsWith(`${SCRIPTS_ROOT}${sep}`) && (pathname.startsWith('./js/') || pathname.startsWith('/js/'))) {
    target = resolve(REALM_ROOT, pathname.replace(/^\.?\//, ''));
    execution = 'browser-evaluator';
  } else {
    target = resolve(dirname(sourceFile), pathname);
    if (sourceFile.startsWith(`${SCRIPTS_ROOT}${sep}`)) execution = 'node-runtime-root';
  }

  const isRuntimeJs = target.startsWith(`${JS_ROOT}${sep}`) && extname(target) === '.js';
  const isRuntimeContract = target === CONTRACT_PATH && extname(target) === '.json';
  if (!isRuntimeJs && !isRuntimeContract) return null;
  return { target, execution };
}

function canonicalError(record, revision) {
  const { pathname, query, fragment } = splitSpecifier(record.specifier);
  if (fragment) return `fragment '#${fragment}' creates an alternate module identity`;
  const params = new URLSearchParams(query);
  const keys = [...params.keys()];
  const realms = params.getAll('realm');
  if (keys.length !== 1 || keys[0] !== 'realm' || realms.length !== 1) {
    return `expected exactly '?realm=${revision}' with no other query parameters`;
  }
  if (realms[0] !== String(revision)) return `stale realm revision '${realms[0]}' (expected '${revision}')`;
  if (`${pathname}?realm=${revision}` !== record.specifier) return `noncanonical encoding (expected '${pathname}?realm=${revision}')`;
  return null;
}

export function validateCanonicalRuntimeSpecifier(specifier, revision) {
  return canonicalError({ specifier }, revision);
}

function displayPath(file) {
  const rel = relative(REALM_ROOT, file);
  return rel.startsWith('..') ? file : rel;
}

function sourceFor(file, overrides) {
  return overrides?.has(file) ? overrides.get(file) : readFileSync(file, 'utf8');
}

function listRuntimeSources() {
  return readdirSync(JS_ROOT)
    .filter(name => name.endsWith('.js'))
    .sort()
    .map(name => join(JS_ROOT, name));
}

function listVerifierSources() {
  return readdirSync(SCRIPTS_ROOT)
    .filter(name => name.endsWith('.mjs'))
    .sort()
    .map(name => join(SCRIPTS_ROOT, name));
}

/**
 * Analyze every runtime source and every executable verifier root.
 * No alternate-identity allowlist exists today: every runtime-bearing edge
 * must use the one canonical identity, including stateless leaf modules.
 */
export function analyzeRuntimeGraph({ revision, overrides = new Map() } = {}) {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error(`invalid module revision '${revision}'`);
  const errors = [];
  const edges = [];
  const sources = listRuntimeSources();
  const verifierSources = listVerifierSources();
  const indexFile = join(REALM_ROOT, 'index.html');

  const addRecords = (file, records) => {
    for (const record of records) {
      const resolved = resolveRuntimeTarget(record, file);
      if (!resolved) {
        if (file.startsWith(`${JS_ROOT}${sep}`) && isLocal(record.specifier)) {
          errors.push(`${displayPath(file)}:${record.line}: runtime source imports an unsupported/out-of-graph local module: ${record.specifier}`);
        }
        continue;
      }
      const entry = { ...record, source: file, ...resolved };
      edges.push(entry);
      const problem = canonicalError(record, revision);
      if (problem) errors.push(`${displayPath(file)}:${record.line}: ${problem}: ${record.specifier}`);
      try {
        sourceFor(resolved.target, overrides);
      } catch {
        errors.push(`${displayPath(file)}:${record.line}: runtime import does not exist: ${record.specifier}`);
      }
    }
  };

  let indexEntries = [];
  try {
    indexEntries = parseHtmlModuleEntries(sourceFor(indexFile, overrides), displayPath(indexFile));
    addRecords(indexFile, indexEntries);
  } catch (error) {
    errors.push(error.message);
  }
  if (indexEntries.length !== 1) errors.push(`index.html: expected exactly one external module entry, found ${indexEntries.length}`);

  for (const file of [...sources, ...verifierSources]) {
    try {
      const parsed = parseModuleSpecifiers(sourceFor(file, overrides), displayPath(file));
      addRecords(file, parsed.records);
      for (const dynamic of parsed.nonLiteralDynamicImports) {
        errors.push(`${displayPath(file)}:${dynamic.line}: non-literal dynamic import is not registered; runtime reachability must fail closed`);
      }
      for (const worker of parsed.nonLiteralWorkerEntries) {
        errors.push(`${displayPath(file)}:${worker.line}: non-literal Worker entry is not registered; runtime reachability must fail closed`);
      }
    } catch (error) {
      errors.push(error.message);
    }
  }

  const identities = new Map();
  for (const edge of edges) {
    const parts = splitSpecifier(edge.specifier);
    const identity = `?${parts.query}${parts.fragment ? `#${parts.fragment}` : ''}`;
    if (!identities.has(edge.target)) identities.set(edge.target, new Set());
    identities.get(edge.target).add(identity);
  }
  for (const [target, values] of identities) {
    if (values.size > 1) {
      errors.push(`${displayPath(target)}: multiple resolved URL identities: ${[...values].sort().join(', ')}`);
    }
  }

  // Reachability is computed from the HTML entry plus every verifier runtime
  // root. Scanning every js/ file above is intentional: dormant modules cannot
  // retain a stale identity and become unsafe when reintroduced later.
  const roots = edges.filter(edge => edge.execution !== 'runtime-module').map(edge => edge.target);
  const adjacency = new Map();
  for (const edge of edges.filter(edge => edge.source.startsWith(`${JS_ROOT}${sep}`))) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source).push(edge.target);
  }
  const reachable = new Set();
  const queue = [...roots];
  while (queue.length) {
    const file = queue.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    for (const child of adjacency.get(file) || []) queue.push(child);
  }

  const counts = {
    runtimeSources: sources.length,
    runtimeEdges: edges.filter(edge => edge.source.startsWith(`${JS_ROOT}${sep}`)).length,
    htmlEntries: edges.filter(edge => edge.execution === 'html-entry').length,
    browserEvaluatorRoots: edges.filter(edge => edge.execution === 'browser-evaluator').length,
    workerEntries: edges.filter(edge => edge.execution === 'worker-entry').length,
    nodeRuntimeRoots: edges.filter(edge => edge.execution === 'node-runtime-root').length,
    reachableRuntimeFiles: [...reachable].filter(file => file.startsWith(`${JS_ROOT}${sep}`)).length,
    contractEdges: edges.filter(edge => edge.target === CONTRACT_PATH).length,
    alternateIdentityAllowlist: 0,
  };

  return { ok: errors.length === 0, errors, edges, reachable, counts };
}

function canonicalSpecifier(specifier, revision) {
  const { pathname } = splitSpecifier(specifier);
  return `${pathname}?realm=${revision}`;
}

function applyReplacements(source, replacements) {
  const ordered = [...replacements].sort((a, b) => b.start - a.start);
  let result = source;
  for (const replacement of ordered) {
    result = `${result.slice(0, replacement.start)}${replacement.value}${result.slice(replacement.end)}`;
  }
  return result;
}

/** Canonicalize only executable runtime-bearing specifiers in one source. */
export function rewriteRuntimeSpecifiers(source, file, revision) {
  const records = file.endsWith('.html')
    ? parseHtmlModuleEntries(source, displayPath(file))
    : parseModuleSpecifiers(source, displayPath(file)).records;
  const replacements = [];
  for (const record of records) {
    if (!resolveRuntimeTarget(record, file)) continue;
    const value = canonicalSpecifier(record.specifier, revision);
    if (value !== record.specifier) replacements.push({ start: record.start, end: record.end, value });
  }
  return applyReplacements(source, replacements);
}

/** Build, but do not write, a complete canonical revision transaction. */
export function prepareRevisionTransaction(revision) {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error(`invalid module revision '${revision}'`);
  const files = [join(REALM_ROOT, 'index.html'), ...listRuntimeSources(), ...listVerifierSources()];
  const overrides = new Map();
  const observed = new Map();

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    observed.set(file, source);
    const rewritten = rewriteRuntimeSpecifiers(source, file, revision);
    if (rewritten !== source) overrides.set(file, rewritten);
  }

  const currentContractSource = readFileSync(CONTRACT_PATH, 'utf8');
  observed.set(CONTRACT_PATH, currentContractSource);
  const contract = JSON.parse(currentContractSource);
  contract.moduleRevision = revision;
  const contractSource = `${JSON.stringify(contract, null, 2)}\n`;
  if (contractSource !== currentContractSource) overrides.set(CONTRACT_PATH, contractSource);

  const validation = analyzeRuntimeGraph({ revision, overrides });
  if (!validation.ok) {
    throw new Error(`prospective module graph is invalid:\n${validation.errors.map(error => `  - ${error}`).join('\n')}`);
  }
  return { revision, overrides, observed, validation };
}

/** Commit prepared sources with rollback if any rename fails. */
export function commitRevisionTransaction(transaction) {
  const originals = new Map();
  const temps = new Map();
  const committed = [];
  try {
    for (const [file, observedSource] of transaction.observed || []) {
      if (readFileSync(file, 'utf8') !== observedSource) {
        throw new Error(`revision transaction aborted: ${displayPath(file)} changed after preparation`);
      }
    }
    for (const [file, source] of transaction.overrides) {
      originals.set(file, readFileSync(file, 'utf8'));
      const temp = `${file}.realm-revision-${process.pid}.tmp`;
      writeFileSync(temp, source, 'utf8');
      temps.set(file, temp);
    }
    for (const [file, temp] of temps) {
      renameSync(temp, file);
      committed.push(file);
    }
    const committedGraph = analyzeRuntimeGraph({ revision: transaction.revision });
    if (!committedGraph.ok) {
      throw new Error(`committed module graph failed validation:\n${committedGraph.errors.map(error => `  - ${error}`).join('\n')}`);
    }
  } catch (error) {
    for (const file of committed.reverse()) writeFileSync(file, originals.get(file), 'utf8');
    for (const temp of temps.values()) {
      try { unlinkSync(temp); } catch {}
    }
    throw error;
  }
  return { changedFiles: committed.map(displayPath) };
}

export function readRuntimeContract() {
  return JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
}

export function formatGraphSummary(result, revision) {
  const c = result.counts;
  return `[module-graph] realm=${revision}; ${c.reachableRuntimeFiles}/${c.runtimeSources} runtime files reachable; ` +
    `${c.runtimeEdges} internal edges; ${c.htmlEntries} HTML, ${c.browserEvaluatorRoots} browser-evaluator, ` +
    `${c.nodeRuntimeRoots} Node roots, ${c.workerEntries} Worker; ${c.contractEdges} contract edges; allowlist=${c.alternateIdentityAllowlist}`;
}
