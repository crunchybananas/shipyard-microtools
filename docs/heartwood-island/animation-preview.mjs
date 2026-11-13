import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import {buildFrogRig,createFrogAnimator} from './frog-animation.mjs';
const canvas=document.querySelector('#study'),renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight*.8,false);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;
const scene=new T.Scene();scene.background=new T.Color('#203c37');scene.add(new T.HemisphereLight('#fbf4d7','#526348',2.3));const light=new T.DirectionalLight('#ffe1ae',3);light.position.set(-3,5,4);scene.add(light);const fill=new T.DirectionalLight('#b5d9dc',1);fill.position.set(4,3,-3);scene.add(fill);
const camera=new T.PerspectiveCamera(35,innerWidth/(innerHeight*.8),.1,30);camera.position.set(.2,1.1,3.5);camera.lookAt(0,.8,0);
const ground=new T.Mesh(new T.CylinderGeometry(.85,.9,.08,48),new T.MeshStandardMaterial({color:'#526c50',roughness:1}));ground.position.y=-.06;scene.add(ground);
const source=await new GLTFLoader().loadAsync('./assets/frog-alchemist.glb'),rig=buildFrogRig(source.scene),anim=createFrogAnimator(rig);scene.add(rig.root);
let moving=false,motion=!matchMedia('(prefers-reduced-motion:reduce)').matches,last=0,angle=0,targetAngle=0,frame=0;
const $=s=>document.querySelector(s);
function mode(value){moving=value;$('#hop').setAttribute('aria-pressed',String(value));$('#idle').setAttribute('aria-pressed',String(!value));}
$('#hop').onclick=()=>mode(true);$('#idle').onclick=()=>mode(false);$('#celebrate').onclick=()=>{mode(false);anim.celebrate();};$('#motion').onclick=()=>{motion=!motion;$('#motion').textContent=motion?'Motion on':'Motion off';$('#motion').setAttribute('aria-pressed',String(motion));};$('#turn').onclick=()=>targetAngle+=Math.PI/2;
$('#motion').textContent=motion?'Motion on':'Motion off';$('#motion').setAttribute('aria-pressed',String(motion));
function fit(){renderer.setSize(innerWidth,innerHeight*.8,false);camera.aspect=innerWidth/(innerHeight*.8);camera.position.z=Math.max(3.5,1/(Math.tan(35*Math.PI/360)*camera.aspect));camera.lookAt(0,.8,0);camera.updateProjectionMatrix();}fit();window.addEventListener('resize',fit);
function tick(t){const dt=Math.min((t-last)/1000||0,.05);last=t;angle=T.MathUtils.damp(angle,targetAngle,6,dt);rig.root.rotation.y=angle;const pose=anim.update(dt,{moving,motion});canvas.dataset.state=pose.state;canvas.dataset.height=String(pose.height);canvas.dataset.blink=String(pose.blink||0);$('#status').textContent=`${pose.state} · ${rig.meshCount} character draw calls`;renderer.render(scene,camera);frame=requestAnimationFrame(tick);}frame=requestAnimationFrame(tick);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(frame);else{last=performance.now();frame=requestAnimationFrame(tick);}});
