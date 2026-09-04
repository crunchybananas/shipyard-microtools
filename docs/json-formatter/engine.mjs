// A position-aware syntax tree: number lexemes and duplicate keys survive
// formatting. JSON.parse only decodes validated string tokens.
export const MAX_BYTES = 2 * 1024 * 1024;
export function parseDocument(source) {
  if (new TextEncoder().encode(source).length > MAX_BYTES) throw new Error('Use a JSON file smaller than 2 MiB.');
  let pos = 0;
  const nodes = [];
  const duplicates = [];
  const fail = message => {
    const error = new SyntaxError(message);
    error.position = pos;
    const prefix = source.slice(0, pos);
    error.line = prefix.split('\n').length;
    error.column = pos - prefix.lastIndexOf('\n');
    throw error;
  };
  const whitespace = () => { while (/[\x20\t\r\n]/.test(source[pos] || '\0')) pos++; };
  function string() {
    const start = pos++;
    while (pos < source.length) {
      const c = source[pos++];
      if (c === '"') return JSON.parse(source.slice(start, pos));
      if (c === '\\') {
        if (source[pos] === 'u') {
          pos++;
          for (let digit = 0; digit < 4; digit++, pos++) {
            if (!/^[0-9a-f]$/i.test(source[pos] || '')) fail('A Unicode escape needs four hexadecimal digits.');
          }
        } else if (source[pos] && '"\\/bfnrt'.includes(source[pos])) pos++;
        else fail('Use a valid JSON escape: \\" \\\\ \\/ \\b \\f \\n \\r \\t or a Unicode escape.');
      }
      else if (c.charCodeAt(0) < 32) { pos--; fail('Escape the line break or control character in this string.'); }
    }
    fail('Close this string with a double quote.');
  }
  function value(key, path, parent, depth) {
    if (depth > 128) fail('This document exceeds the 128-level nesting limit.');
    if (nodes.length >= 50000) fail('This document exceeds the 50,000-value inspection limit.');
    whitespace();
    const node = { id: nodes.length, key, path, parent, depth, start: pos, children: [] };
    nodes.push(node);
    const c = source[pos];
    if (c === '{' || c === '[') {
      node.type = c === '{' ? 'object' : 'array';
      const end = c === '{' ? '}' : ']';
      pos++;
      whitespace();
      const keys = new Set();
      if (source[pos] !== end) {
        while (pos < source.length) {
          whitespace();
          let childKey = String(node.children.length);
          let keyRaw;
          if (c === '{') {
            if (source[pos] !== '"') fail('Object keys need double quotes.');
            const keyStart = pos;
            childKey = string();
            keyRaw = source.slice(keyStart, pos);
            if (keys.has(childKey)) duplicates.push(`${path}/${pointerEscape(childKey)}`);
            keys.add(childKey);
            whitespace();
            if (source[pos] !== ':') fail('Add a colon after this key.');
            pos++;
          }
          const child = value(childKey, `${path}/${pointerEscape(childKey)}`, node.id, depth + 1);
          if (keyRaw) child.keyRaw = keyRaw;
          node.children.push(child.id);
          whitespace();
          if (source[pos] === end) break;
          if (source[pos] !== ',') fail(`Expected a comma or ${end}.`);
          pos++;
          whitespace();
          if (source[pos] === end) fail('Remove this trailing comma.');
        }
      }
      if (source[pos] !== end) fail(`Close this ${node.type} with ${end}.`);
      pos++;
    } else if (c === '"') {
      node.type = 'string';
      node.value = string();
    } else {
      const match = source.slice(pos).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
      if (!match) fail('Expected a JSON value: object, array, string, number, boolean, or null.');
      node.raw = match[0];
      node.type = match[0] === 'null' ? 'null' : /^(true|false)$/.test(match[0]) ? 'boolean' : 'number';
      pos += match[0].length;
    }
    node.end = pos;
    if (!node.raw && !node.children.length) node.raw = source.slice(node.start, node.end);
    return node;
  }
  const root = value('$', '', null, 0);
  whitespace();
  if (pos !== source.length) fail('Unexpected text after the JSON value.');
  return { nodes, root: root.id, duplicates, source };
}
export function pointerEscape(key) { return key.replace(/~/g, '~0').replace(/\//g, '~1'); }
export function formatDocument(document, indent = 2, id = document.root, depth = 0) {
  const node = document.nodes[id];
  if (!node.children.length) return document.source.slice(node.start, node.end);
  const object = node.type === 'object';
  const children = node.children.map(childId => {
    const child = document.nodes[childId];
    const prefix = object ? `${child.keyRaw}:${indent ? ' ' : ''}` : '';
    return `${' '.repeat(indent * (depth + 1))}${prefix}${formatDocument(document, indent, childId, depth + 1)}`;
  });
  return `${object ? '{' : '['}${indent ? '\n' : ''}${children.join(indent ? ',\n' : ',')}${indent ? '\n' + ' '.repeat(indent * depth) : ''}${object ? '}' : ']'}`;
}
export function searchNodes(document, query) {
  const needle = query.toLocaleLowerCase();
  return document.nodes.filter(node => `${node.path} ${node.value ?? node.raw ?? ''}`.toLocaleLowerCase().includes(needle));
}
