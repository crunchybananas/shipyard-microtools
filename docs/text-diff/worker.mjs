import { diffDocuments } from './engine.mjs';
self.onmessage = ({ data }) => {
  try { self.postMessage({ result: diffDocuments(data.before, data.after, data.ignoreWhitespace) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
