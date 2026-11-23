import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
test('vendored browser Wasm has no unresolved native imports and exposes the town peer',async()=>{
 const bytes=await fs.readFile(new URL('../vendor/iroh/town_peer_bg.wasm',import.meta.url));
 const module=new WebAssembly.Module(bytes),imports=WebAssembly.Module.imports(module),exports=WebAssembly.Module.exports(module);
 assert.equal(imports.some(i=>i.module==='env'),false,'Use LLVM archiver: native ring symbols cannot be resolved in a browser');
 assert.ok(exports.some(e=>e.name==='townpeer_open'));assert.ok(exports.some(e=>e.name==='townpeer_request'));
 assert.ok(bytes.length<5*1024*1024,'Keep the optional peer module below its download budget');
 const js=await fs.readFile(new URL('../vendor/iroh/town_peer.js',import.meta.url),'utf8');assert.match(js,/export class TownPeer/);
});
