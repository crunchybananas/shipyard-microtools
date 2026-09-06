// Preserve same-pose game captures as a portable visual comparison.
// node tools/harness/build-coast-comparison.mjs BEFORE_DIR AFTER_DIR REVIEW_DIR
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const [beforeDir,afterDir,reviewDir]=process.argv.slice(2).map(p=>resolve(p));
if(!reviewDir)throw new Error('Usage: build-coast-comparison.mjs BEFORE_DIR AFTER_DIR REVIEW_DIR');
const before=JSON.parse(readFileSync(join(beforeDir,'power.json')));
const after=JSON.parse(readFileSync(join(afterDir,'power.json')));
const out=join(reviewDir,'comparison');mkdirSync(out,{recursive:true});
const pairs=after.samples.map(a=>{
 const b=before.samples.find(s=>s.name===a.name&&s.hour===a.hour);
 if(!b||JSON.stringify(a.pose)!==JSON.stringify(b.pose))throw new Error('Camera mismatch');
 const key=`${a.name}-${a.hour}`;
 copyFileSync(join(beforeDir,b.image),join(out,`${key}-before.jpg`));
 copyFileSync(join(afterDir,a.image),join(out,`${key}-after.jpg`));
 return {key,label:`${a.name[0].toUpperCase()+a.name.slice(1)} · ${a.hour===12?'noon':'night'}`,before:b,after:a};
});
copyFileSync(join(beforeDir,'power.json'),join(out,'before.json'));
copyFileSync(join(afterDir,'power.json'),join(out,'after.json'));
const rows=pairs.map(p=>`<tr><th scope="row">${p.label}</th><td>${p.before.calls} → ${p.after.calls}</td><td>${p.before.triangles.toLocaleString('en-US')} → ${p.after.triangles.toLocaleString('en-US')}</td></tr>`).join('');
writeFileSync(join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Island — before and after</title><style>
*{box-sizing:border-box}body{margin:0;background:#f6f9f8;color:#243e48;font:18px/1.65 Georgia,serif}main{max-width:1260px;margin:auto;padding:40px 28px}h1{font-weight:normal;font-size:clamp(34px,5vw,64px);line-height:1.1}p{max-width:65ch}a{color:#286578;text-underline-offset:.2em}label,select,figcaption,table{font:14px/1.6 system-ui,sans-serif}select{padding:10px;max-width:100%;margin-left:8px;border:1px solid #92aeb3;border-radius:3px;background:white;color:inherit}figure{margin:24px 0}.images{position:relative;aspect-ratio:1.6;background:#25414a;--split:50%}.images img{position:absolute;width:100%;height:100%;object-fit:contain}.after{clip-path:inset(0 calc(100% - var(--split)) 0 0)}.line{position:absolute;inset:0 auto 0 var(--split);border-left:2px solid #fff;pointer-events:none}.tag{position:absolute;bottom:10px;padding:3px 8px;background:#112c36d9;color:white;font:12px system-ui,sans-serif}.new{left:10px}.old{right:10px}input{display:block;width:100%;margin:16px 0;accent-color:#286578}figcaption{margin-top:15px}table{width:100%;border-collapse:collapse;margin:30px 0}th,td{text-align:left;padding:12px 6px;border-bottom:1px solid #c4d5d7}thead th{font-weight:600}tbody th{font-weight:normal}:focus-visible{outline:3px solid #346c80;outline-offset:4px}@media(max-width:600px){main{padding:25px 18px}td,th{font-size:12px;padding:9px 3px}select{display:block;margin:8px 0}h1{max-width:12ch}}
</style><main><a href="../index.html">← The complete journey</a><h1>The room and the trees.</h1><p>Matching views from the published Landfall revision and the Working coast revision. Move the divider to compare the floor, joinery, branches and shore.</p><label for="scene">View<select id="scene">${pairs.map(p=>`<option value="${p.key}">${p.label}</option>`).join('')}</select></label><figure><div class="images" id="images"><img id="before" src="study-12-before.jpg" alt="Study at noon in Landfall"><img class="after" id="after" src="study-12-after.jpg" alt="Study at noon in Working coast"><span class="line"></span><span class="tag new">Working coast</span><span class="tag old">Landfall</span></div><label for="split">Reveal the Working coast revision</label><input id="split" type="range" min="0" max="100" value="50"><figcaption id="caption">Study · noon. The camera and time of day match; clouds, wind and other moving elements can differ.</figcaption></figure><table><thead><tr><th scope="col">View</th><th scope="col">Draw calls</th><th scope="col">Triangles</th></tr></thead><tbody>${rows}</tbody></table><p>The new miniature reduces the study's geometry. Fuller nearby branches increase the cost outdoors. These counts include the complete rendered frame at 1440 × 900.</p><p>GPU timings are retained in the <a href="before.json">before record</a> and <a href="after.json">after record</a>. Host load was not controlled, so the samples do not establish a speed improvement.</p></main><script>
const pairs=${JSON.stringify(pairs.map(({key,label})=>({key,label})))};
const scene=document.getElementById('scene'),split=document.getElementById('split');
split.addEventListener('input',()=>document.getElementById('images').style.setProperty('--split',split.value+'%'));
scene.addEventListener('change',()=>{const p=pairs.find(p=>p.key===scene.value);for(const side of ['before','after']){const image=document.getElementById(side);image.src=p.key+'-'+side+'.jpg';image.alt=p.label+' in '+(side==='before'?'Landfall':'Working coast');}document.getElementById('caption').textContent=p.label+'. The camera and time of day match; clouds, wind and other moving elements can differ.';});
</script></html>`);
console.log(`COMPARISON: ${pairs.length} matched views`);
