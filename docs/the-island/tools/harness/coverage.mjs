// journal↔SKETCHES coverage: every journal-bound text must hit a SKETCHES matcher.
// T-aware (#75): texts live in content.T; call sites reference T.key.
import { readFileSync } from 'node:fs';
const ROOT = new URL('../../js/', import.meta.url).pathname;
const C = await import(ROOT + 'content.js');
const { SKETCHES, T, LAMPBLACK, CLIMBERS, CLIMBERS_CLOSE, CONGREGATION, CONGREGATION_CLOSE, LORE } = C;

const texts = new Map(); // text -> origin
const add = (t, o) => { if (t && !texts.has(t)) texts.set(t, o); };

// 1) T-keyed addJournal sites in puzzles/main
const src = readFileSync(ROOT + 'puzzles.js', 'utf8') + readFileSync(ROOT + 'main.js', 'utf8');
// #131 rounds: journals travel as _doRound's third arg
for (const m of src.matchAll(/_doRound\('\w+',\s*T\.\w+,\s*T\.(\w+)\)/g)) add(T[m[1]], 'round:' + m[1]);
// ui.js still holds inline literal sites (extraction debt from #75) — scan them too
for (const m of readFileSync(ROOT + 'ui.js', 'utf8').matchAll(/this\.addJournal\(\s*'((?:[^'\\]|\\.)+)'/g)) add(m[1], 'ui-literal');
for (const m of src.matchAll(/UI\.addJournal\(\s*T\.(\w+)/g)) {
  if (!(m[1] in T)) { add('!!MISSING T.' + m[1], 'T'); continue; }
  add(T[m[1]], 'T.' + m[1]);
}
// 2) corpus journals bound at runtime
const LM_ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];
LAMPBLACK.forEach((m, i) => add(`Lampblack, under the glass — on ${m.place}, the ${LM_ORD[i]} of his small true things: “${m.line}”`, 'lampblack'));
for (const c of CLIMBERS) add(c.journal, 'climbers');
add(CLIMBERS_CLOSE.journal, 'climbers-close');
for (const c of CONGREGATION) add(c.journal, 'congregation');
add(CONGREGATION_CLOSE.journal, 'congregation-close');
for (const [id, l] of Object.entries(LORE)) { add(l.journal, 'lore:' + id); add(l.journalDeep, 'loreDeep:' + id); }

let ok = 0; const miss = [];
for (const [t, o] of texts) {
  if (SKETCHES.find(([m]) => t.includes(m))) ok++; else miss.push(`[${o}] ${t.slice(0, 90)}`);
}
console.log(`coverage ${ok}/${texts.size}`);
for (const m of miss) console.log('MISS', m);
process.exit(miss.length ? 1 : 0);
