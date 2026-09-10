#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { normalizeBlenderTiming } from './export-glb.mjs';
import { FOUNDER_ACTIONS } from './actions.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const blender=process.env.REALM_BLENDER||'/Applications/Blender.app/Contents/MacOS/Blender';
function run(executable,args){const r=spawnSync(executable,args,{cwd:root,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw new Error(`${executable} failed (${r.status})`);}
run(blender,['--background','assets/sprites/founder/founder-actions.blend','--python','scripts/founder-sprites/export_blender.py']);
const exported=resolve(root,'assets/sprites/founder/source/blender-actions.glb');
writeFileSync(exported,normalizeBlenderTiming(readFileSync(exported),Object.fromEntries(Object.values(FOUNDER_ACTIONS).map(a=>[a.clip,a.duration]))));
run(process.execPath,['scripts/founder-sprites/bake.mjs','--from-blender']);
console.log('Rebuilt walk, idle, point and beckon in eight directions from the saved Blender scene. Reload Character Workshop to review.');
