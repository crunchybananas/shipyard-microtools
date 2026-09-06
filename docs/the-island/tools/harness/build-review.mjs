// Refresh navigation and fingerprint the runtime that produced a review edition.
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderPlaythrough} from './playthrough-html.mjs';
const island=fileURLToPath(new URL('../../',import.meta.url));
const dir=resolve(process.argv[2]||join(island,'loop/playthrough/2026-09-05/working-coast'));
const root=resolve(dir,'..'),folder=relative(root,dir);
const data=JSON.parse(readFileSync(join(dir,'stages.json')));
const manuscript=JSON.parse(readFileSync(join(dir,'manuscript.json')));
const edition=data.edition||'Landfall';
const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
writeFileSync(join(dir,'index.html'),renderPlaythrough({...data,manuscript}));
const files=['index.html','style.css',
 ...readdirSync(join(island,'js'),{recursive:true}).filter(f=>f.endsWith('.js')).map(f=>'js/'+f),
 ...readdirSync(join(island,'assets')).map(f=>'assets/'+f)];
const hashes=Object.fromEntries(files.sort().map(f=>[f,createHash('sha256').update(readFileSync(join(island,f))).digest('hex')]));
const blender=Object.fromEntries(['geometry','landfall-geometry','working-coast-geometry']
 .filter(f=>existsSync(join(island,'tools/blender',f+'.json')))
 .map(f=>[f,JSON.parse(readFileSync(join(island,'tools/blender',f+'.json')))]));
const pages=Object.values(manuscript.lore).reduce((n,l)=>n+l.pages.length+(l.deep?.length||0),0);
writeFileSync(join(dir,'build.json'),JSON.stringify({source:`local ${edition} revision`,runtimeSha256:hashes,blender,captures:data.stages.length,review:data.review,artifacts:Object.keys(manuscript.lore).length,pages,endings:4},null,2)+'\n');
const places=[
 ['A model of this room','Fitted boards, painted joinery and the working island model.'],
 ['Boughs above the path','Four wind-shaped crowns with geometry for the forest and its miniature.'],
 ['Above the whole island','Eighty-three physical treads lead to the lantern gallery.'],
 ['The drain chamber','A stone ramp leads under the standing stones.'],
 ['The inverted lighthouse','The cellar opens onto the hanging lighthouse.'],
 ['Through the western doorway','Two steps lead from the cellar into the western study.'],
].map(([title,caption])=>{
 const s=data.stages.find(s=>s.title===title);
 return s?`<figure><a href="${folder}/index.html#stage-${s.number}"><img src="${folder}/${s.image}" alt="${esc(title)}"></a><figcaption>${caption}</figcaption></figure>`:'';
}).join('');
const previous=readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name!==folder&&existsSync(join(root,d.name,'index.html')))
 .map(d=>`<a href="${d.name}/index.html">${esc(d.name)} revision</a>`).join('');
writeFileSync(join(root,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Island — ${esc(edition)}</title><style>
body{margin:0;background:#f6f9f8;color:#233f49;font:19px/1.65 Georgia,serif}main{max-width:1250px;margin:auto;padding:65px 32px}h1{font-size:clamp(46px,7vw,88px);font-weight:normal;line-height:1.08;max-width:14ch}h2{font-weight:normal}p{max-width:64ch}a{color:#286578;text-underline-offset:.2em}a:focus-visible{outline:3px solid #286578;outline-offset:5px}.links{display:flex;gap:15px;flex-wrap:wrap;margin:32px 0 50px}.links a{padding:13px 22px;background:#deeaeb;border-radius:5px;text-decoration:none}.places{display:grid;grid-template-columns:1fr 1fr;gap:28px 24px;margin:40px 0}figure{margin:0}img{width:100%;height:auto;border-radius:4px;display:block}figcaption,.small{font:14px/1.65 system-ui,sans-serif}figcaption{margin-top:12px}details{border-top:1px solid #beced1;margin-top:40px;padding-top:24px}summary{cursor:pointer}.old{display:flex;flex-wrap:wrap;gap:22px;margin-top:25px}@media(max-width:680px){main{padding:35px 22px}.places{grid-template-columns:1fr}.links{display:grid}}
</style><main><p>The Island · ${esc(edition)} revision</p><h1>A room shaped by work.</h1><p>Turn the wheel and watch the float fall in its glass. Walk beneath the wind-shaped trees, climb the lighthouse, and follow the water into the rooms under the bluff.</p><div class="links"><a href="${folder}/index.html">Open the complete journey</a><a href="${folder}/manuscript.md">Read the manuscript</a>${existsSync(join(dir,'comparison/index.html'))?'<a href="'+folder+'/comparison/index.html">Before and after</a>':''}<a href="../../../index.html">Play The Island</a></div><div class="places">${places}</div><h2>The complete route</h2><p>${data.review.moments} illustrated moments cover the journey and all four endings. Related pages are grouped; repeated views fold into the action record. All ${data.stages.length} source captures, exact actions, saved states and ${pages} manuscript pages remain in the folder.</p><p class="small">The tower stair and underground connectors use actual player collision in both directions. Long travel is accelerated and encounters use disclosed placement fixtures. This is a scripted route audit with screenshots.</p><details><summary>Source and verification</summary><p class="small">The original Blender files and Python generators are in tools/blender. They contain the lighthouse, stairs, underground rooms, coast, trees, study, bedroom and boat.</p><p class="small"><a href="../../../tools/blender/working-coast.blend">Study and forest source</a> · <a href="../../../tools/blender/working_coast.py">Generator</a> · <a href="../../../tools/blender/working-coast.png">Blender inspection render</a></p><p class="small"><a href="${folder}/validation.txt">Verification record</a> · <a href="${folder}/build.json">Build fingerprints</a> · <a href="${folder}/stages.json">Every captured stage</a></p></details><div class="old small">${previous}</div></main></html>`);
writeFileSync(join(root,'README.md'),`# The Island — review folder\n\nOpen index.html for the latest ${edition} revision. ${data.review.moments} illustrated moments organise ${data.stages.length} source captures, all four endings and ${pages} pages across ${Object.keys(manuscript.lore).length} artifacts. The tower, drain, cellar and western study are physically traversed. Repeated views remain in the expandable action record.\n\n${folder}/ contains the latest manuscript, states, source checkpoint, homecoming save, verification and build fingerprints. Other edition folders preserve their original reviews. The root build.json and validation.txt belong to the earliest room revision.\n\nBlender sources and generators live in ../../../tools/blender. No private narrative source or identifying biography is included.\n`);
console.log(`REVIEW BUILT: ${data.review.moments} moments / ${data.stages.length} captures / ${pages} pages / ${files.length} runtime fingerprints`);
