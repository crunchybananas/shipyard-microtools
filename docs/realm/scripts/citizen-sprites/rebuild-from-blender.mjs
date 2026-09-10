#!/usr/bin/env node
// Rebuild edited saved actions. author_builder.py is a bootstrap, never an
// implicit rebuild step: artists' edits to the .blend remain authoritative.
import {spawn} from 'node:child_process';
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeBlenderTiming} from '../founder-sprites/export-glb.mjs';
import {BUILDER_ACTIONS} from './contract.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const original=resolve(root,'assets/sprites/citizens/builder/source/builder.blend');
const out=resolve(root,process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'assets/sprites/citizens/builder');
const source=join(out,'source');await mkdir(source,{recursive:true});
if(join(source,'builder.blend')!==original)await copyFile(original,join(source,'builder.blend'));
const run=(file,args)=>new Promise((resolve,reject)=>{
  const child=spawn(file,args,{cwd:root,stdio:'inherit'});
  child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(`${file} exited ${code}`)));
});
await run(process.env.BLENDER_PATH||'/Applications/Blender.app/Contents/MacOS/Blender',[
  '--background',join(source,'builder.blend'),'--python','scripts/citizen-sprites/export_blender.py','--',
  '--output',relative(root,join(source,'builder.glb')),'--witness',relative(root,join(source,'joints.json')),
]);
await writeFile(join(source,'builder.glb'),normalizeBlenderTiming(await readFile(join(source,'builder.glb')),
  Object.fromEntries(Object.values(BUILDER_ACTIONS).map(action=>[action.clip,action.duration]))));
await run(process.execPath,['scripts/citizen-sprites/bake.mjs',out,join(source,'builder.glb')]);
