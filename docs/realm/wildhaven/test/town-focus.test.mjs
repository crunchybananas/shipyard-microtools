import test from 'node:test';
import assert from 'node:assert/strict';
import { preserveReplace } from '../js/town-ui.js';

// Real panel replacement with a small DOM stand-in: the initiating button can
// disappear when a project starts, is funded, or finishes.
for (const scenario of ['removed planning button', 'removed funding button', 'retained allocation button']) {
  test(`town panel preserves navigation after ${scenario}`, () => {
    const oldDocument = globalThis.document, oldCSS = globalThis.CSS;
    const focused = [], action = { dataset: { actionId: 'research-action' }, closest: () => scenario === 'removed planning button' ? null : {} };
    const heading = { focus: options => focused.push(['heading', options]) };
    const replacement = { focus: options => focused.push(['control', options]) };
    let children;
    const container = {
      scrollTop: 140,
      contains: node => node === action,
      querySelectorAll: () => [],
      replaceChildren: (...nodes) => { children = nodes; container.scrollTop = 0; },
      querySelector: selector => selector.includes('research-heading') ? heading : scenario === 'retained allocation button' ? replacement : null,
    };
    globalThis.document = { activeElement: action };
    globalThis.CSS = { escape: value => value };
    try {
      preserveReplace(container, [heading, replacement]);
      assert.deepEqual(children, [heading, replacement]);
      assert.equal(container.scrollTop, 140);
      assert.deepEqual(focused, scenario === 'removed planning button' ? [] : [[scenario === 'removed funding button' ? 'heading' : 'control', { preventScroll: true }]]);
    } finally {
      if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
      if (oldCSS === undefined) delete globalThis.CSS; else globalThis.CSS = oldCSS;
    }
  });
}
