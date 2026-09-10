#!/usr/bin/env node
// Re-export the edited saved scene. The bootstrap is never a rebuild step.
import {spawn} from 'node:child_process';
import {copyFile, mkdir} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const original = resolve(root, 'assets/sprites/architecture/homes/source/homes.blend');
const out = resolve(root, process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'assets/sprites/architecture/homes');
const source = join(out, 'source'); await mkdir(source, {recursive: true});
if (join(source, 'homes.blend') !== original) await copyFile(original, join(source, 'homes.blend'));
const run = (file, args) => new Promise((resolve, reject) => {
  const child = spawn(file, args, {cwd: root, stdio: 'inherit'});
  child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(`${file} exited ${code}`)));
});
await run(process.env.BLENDER_PATH || '/Applications/Blender.app/Contents/MacOS/Blender', [
  '--background', join(source, 'homes.blend'), '--python', 'scripts/house-sprites/export_blender.py', '--', '--out', relative(root, source),
]);
await run(process.execPath, ['scripts/house-sprites/bake.mjs', out, join(source, 'homes.glb')]);
