// SHELL: a continuous world-space surface beneath the Canvas depth pass.
// The map texture carries authored terrain, discovery, wear and footprints;
// no repeating terrain image or per-tile color stamp is sampled.
import {G, MAP_W, MAP_H, TW, TH} from './state.js?realm=198';

const VERTEX=`#version 300 es
precision highp float;
const vec2 vertices[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));
void main(){gl_Position=vec4(vertices[gl_VertexID],0.,1.);}`;

const FRAGMENT=`#version 300 es
precision highp float;
uniform sampler2D u_map;
uniform vec2 u_resolution;
uniform vec2 u_canvas;
uniform vec4 u_transform;
uniform vec2 u_tiles;
uniform vec2 u_tileSize;
uniform float u_time;
uniform float u_daylight;
uniform float u_season;
out vec4 color;

float hash(vec2 p){
  vec3 q=fract(vec3(p.xyx)*.1031);
  q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
    mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
}
float terrainNoise(vec2 p){
  return noise(p)*.57+noise(p*2.07+19.2)*.28+noise(p*4.13-8.7)*.15;
}
vec4 cell(vec2 p){return texelFetch(u_map,ivec2(clamp(p,vec2(0.),u_tiles-1.)),0);}
// Unknown neighbors contribute neutral ground to the blend. Their true
// resource type must not change even the discovered side of the fog edge.
float kind(vec4 c){return c.g<.5?2.:floor(c.r*255.+.5);}
float land(vec4 c){return step(.5,kind(c));}
float road(vec4 c){return step(63.5,c.a*255.)*(1.-step(127.5,c.a*255.))*step(.5,c.g);}
float footing(vec4 c){return step(.9,c.a)*step(.5,c.g);}

// Distances follow one connected centerline. Two adjacent arms use a quarter
// circle, so the surface and wheel tracks meet the next tile tangentially.
vec3 roadGeometry(vec2 p){
  vec2 tile=floor(p+.5),q=p-tile;
  if(road(cell(tile))<.5)return vec3(10.,10.,0.);
  vec4 n=vec4(road(cell(tile+vec2(-1.,0.))),road(cell(tile+vec2(1.,0.))),
    road(cell(tile+vec2(0.,-1.))),road(cell(tile+vec2(0.,1.))));
  float count=dot(n,vec4(1.));
  if(count<.5)return vec3(length(q),10.,0.);
  if(count>1.5&&count<2.5&&n.x+n.y>.5&&n.z+n.w>.5){
    vec2 corner=vec2(n.y-n.x,n.w-n.z)*.5;
    float radial=length(q-corner)-.5;
    return vec3(abs(radial),abs(abs(radial)-.16),1.);
  }
  const vec2 arms[4]=vec2[4](vec2(-1.,0.),vec2(1.,0.),vec2(0.,-1.),vec2(0.,1.));
  float distance=10.,rut=10.,strength=1.;
  for(int i=0;i<4;i++){
    if(n[i]<.5)continue;
    float along=dot(q,arms[i]);
    vec2 delta=q-arms[i]*clamp(along,0.,.5);
    float candidate=length(delta);
    if(candidate<distance){
      distance=candidate;rut=abs(abs(dot(q,vec2(-arms[i].y,arms[i].x)))-.16);
      strength=count<1.5?smoothstep(-.02,.20,along):1.;
    }
  }
  if(count>2.5)strength*=smoothstep(.12,.30,length(q));
  return vec3(distance,rut,strength);
}

// Jittered aggregate belongs to world coordinates, not an image repeated in
// every tile. Small stones fade by pixel footprint instead of aliasing at zoom.
vec3 roadAggregate(vec2 p,float aa){
  vec2 v=p*9.5,id=floor(v),f=fract(v),nearest=vec2(0.),stoneId=id;
  float best=10.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 offset=vec2(float(x),float(y)),key=id+offset;
    vec2 jitter=vec2(hash(key),hash(key+vec2(17.3,81.6)));
    vec2 delta=offset+.04+jitter*.92-f;
    float d=dot(delta,delta);
    if(d<best){best=d;nearest=delta;stoneId=key;}
  }
  float seed=hash(stoneId+9.7),size=hash(stoneId+vec2(23.4,67.2));
  float radius=.055+size*size*.19;
  float coverage=(1.-smoothstep(radius-aa*.45,radius+aa*.55,sqrt(best)))
    *step(.59+noise(p*1.75+19.4)*.22,seed)*(1.-smoothstep(.28,.65,aa));
  float relief=clamp(.78+dot(nearest,vec2(-.8,-.5))/max(radius,.01),.45,1.25);
  return vec3(coverage,relief,hash(stoneId+vec2(83.1,5.6)));
}

vec3 pigment(float type,float damp,float patches){
  if(type<.5)return vec3(.16,.29,.30);
  if(type<1.5)return mix(vec3(.53,.49,.38),vec3(.69,.65,.52),patches);
  if(type<2.5)return mix(vec3(.27,.34,.22),vec3(.43,.44,.29),patches)*mix(1.,.82,damp);
  if(type<3.5)return mix(vec3(.20,.26,.18),vec3(.34,.32,.23),patches);
  if(type<4.5)return mix(vec3(.37,.38,.35),vec3(.48,.47,.42),patches);
  if(type<5.5)return mix(vec3(.29,.34,.34),vec3(.41,.39,.34),patches);
  return mix(vec3(.32,.34,.33),vec3(.46,.45,.40),patches);
}
void main(){
  vec2 pixel=vec2(gl_FragCoord.x,u_resolution.y-gl_FragCoord.y)*u_canvas/u_resolution;
  vec2 iso=(pixel-u_transform.zw)/u_transform.xy;
  vec2 p=vec2(iso.x/u_tileSize.x+iso.y/u_tileSize.y,
    iso.y/u_tileSize.y-iso.x/u_tileSize.x);
  float pixelFootprint=max(fwidth(p.x),fwidth(p.y));
  if(any(lessThan(p,vec2(-.5)))||any(greaterThan(p,u_tiles-.5))){color=vec4(0.);return;}
  vec2 base=floor(p),f=fract(p);
  vec2 blend=smoothstep(vec2(.12),vec2(.88),f);
  vec4 a=cell(base),b=cell(base+vec2(1.,0.)),c=cell(base+vec2(0.,1.)),d=cell(base+1.);
  vec4 data=mix(mix(a,b,blend.x),mix(c,d,blend.x),blend.y);
  vec4 center=cell(floor(p+.5));
  float damp=terrainNoise(p*.12+vec2(41.,-6.));
  vec2 warp=vec2(noise(p*.22),noise(p*.22+17.))*2.4;
  float patches=terrainNoise(p*.32+warp);
  float detail=terrainNoise(p*4.7+warp);
  vec3 ground=mix(mix(pigment(kind(a),damp,patches),pigment(kind(b),damp,patches),blend.x),
    mix(pigment(kind(c),damp,patches),pigment(kind(d),damp,patches),blend.x),blend.y);
  float grass=mix(mix(step(1.5,kind(a))*(1.-step(3.5,kind(a))),
    step(1.5,kind(b))*(1.-step(3.5,kind(b))),blend.x),
    mix(step(1.5,kind(c))*(1.-step(3.5,kind(c))),
    step(1.5,kind(d))*(1.-step(3.5,kind(d))),blend.x),blend.y);
  // Bare earth is distributed in irregular patches and around real work.
  float soil=smoothstep(.51,.79,detail+patches*.20)*.24*grass;
  float wear=smoothstep(.012,.40,data.b)*(1.-smoothstep(.46,.84,detail)*.25);
  float foundation=smoothstep(.06,.75,mix(mix(footing(a),footing(b),blend.x),
    mix(footing(c),footing(d),blend.x),blend.y))*.74;
  vec3 earth=mix(vec3(.29,.255,.19),vec3(.48,.41,.30),detail);
  ground=mix(ground,earth,max(soil,max(wear*.85,foundation)));
  ground*=.89+.20*detail;
  float micro=hash(floor(p*137.));
  float microWeight=clamp(1./max(fwidth(p.x)*137.,1.),0.,1.);
  ground+=(micro-.5)*.055*microWeight;
  // Quiet relief comes from one continuous height field, never tile edges.
  float h=terrainNoise(p*1.8);
  vec2 slope=vec2(terrainNoise((p+vec2(.04,0.))*1.8)-h,
    terrainNoise((p+vec2(0.,.04))*1.8)-h);
  vec3 normal=normalize(vec3(-slope*5.,1.));
  ground*=.87+.18*max(0.,dot(normal,normalize(vec3(-.6,-.4,1.))));
  if(u_season>0.5&&u_season<1.5)ground=mix(ground,ground*vec3(1.10,1.01,.91),grass*.65);
  if(u_season>1.5&&u_season<2.5)ground=mix(ground,vec3(.40,.34,.235)*(.85+detail*.3),grass*.45);
  vec3 route=roadGeometry(p);
  float roadMask=0.,ruts=0.;
  if(route.x<.55){
    float aa=pixelFootprint;
    float verge=(noise(p*5.2+3.7)-.5)*.025;
    roadMask=1.-smoothstep(.32+verge-aa*.5,.45+verge+aa*.5,route.x);
    ruts=(1.-smoothstep(.008,.048+aa*.5,route.y))*route.z
      *(.25+.75*smoothstep(.24,.75,noise(p*4.6+vec2(9.3,48.2))));
    float grit=noise(p*39.7),weather=terrainNoise(p*.83+28.1);
    vec3 packed=mix(vec3(.30,.29,.245),vec3(.48,.46,.375),detail*.52+weather*.48);
    packed*=.94+grit*.10;
    packed=mix(packed,vec3(.225,.225,.195),ruts*(.16+damp*.14));
    vec3 aggregate=roadAggregate(p,pixelFootprint*9.5);
    vec3 stone=mix(vec3(.31,.335,.30),vec3(.52,.505,.42),aggregate.z)*aggregate.y;
    float finished=clamp((center.a*255.-64.)/63.,0.,1.);
    packed=mix(earth*.94,packed,finished);
    packed=mix(packed,stone,aggregate.x*(.66-ruts*.34)*finished);
    // Compacted shoulders contain scattered gravel; the edge gives way to the
    // existing soil and grass rather than ending at a dark diamond border.
    ground=mix(ground,packed,roadMask);
  }
  if(u_season>2.5){
    float snow=smoothstep(.24,.53,patches-detail*.10)*(1.-wear*.82)*(1.-foundation*.75)
      *(1.-roadMask*(.80+ruts*.08));
    ground=mix(ground,vec3(.72,.75,.72)*(.94+detail*.12),snow*land(center));
  }
  float shore=mix(mix(land(a),land(b),blend.x),mix(land(c),land(d),blend.x),blend.y);
  float edgeNoise=(noise(p*7.1)-.5)*.08;
  float coast=smoothstep(.45+edgeNoise,.53+edgeNoise,shore);
  if(kind(center)<.5||shore<.99){
    float deep=1.-smoothstep(0.,.55,shore);
    vec3 water=mix(vec3(.235,.365,.35),vec3(.13,.24,.275),deep);
    float wave=sin(dot(p,vec2(2.4,1.5))-u_time*.7+noise(p*.7)*4.);
    float ripples=sin(dot(p,vec2(14.5,8.6))-u_time*1.1+noise(p*2.3)*5.);
    water+=(wave*.009+ripples*.006)*(.45+.55*deep);
    float foam=(1.-smoothstep(.018,.075,abs(shore-.41+wave*.025)))
      *smoothstep(.28,.66,noise(p*11.))* .20;
    water+=foam*vec3(.60,.66,.59);
    ground*=1.-(1.-smoothstep(.52,.72,shore))*.22;
    ground=mix(water,ground,coast);
  }
  // Discovery is read from the map; resource types never show through fog.
  vec3 fog=vec3(.105,.145,.17)+noise(p*.65)*.035;
  float known=smoothstep(.08,.82,data.g+(noise(p*1.7)-.5)*.15);
  ground=mix(fog,ground,known);
  color=vec4(ground*max(.50,u_daylight),1.);
}`;

let renderer=null, failed=false, failure=null, lost=false;
let uploads=0, draws=0, reused=0, lastFrameKey=null;
let animatedWater=false, knownRoadTiles=0;
const mapPixels=new Uint8Array(MAP_W*MAP_H*4);

function compile(gl,type,source){
  const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function initialize(){
  if(renderer||failed)return renderer;
  const canvas=document.createElement('canvas');
  canvas.dataset.realmLandscape='continuous';
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:true});
  if(!gl){failed=true;failure='WebGL2 unavailable';return null;}
  try{
    const vertex=compile(gl,gl.VERTEX_SHADER,VERTEX),fragment=compile(gl,gl.FRAGMENT_SHADER,FRAGMENT);
    const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    const map=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,map);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,MAP_W,MAP_H,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    const uniforms=Object.fromEntries(['map','resolution','canvas','transform','tiles','tileSize','time','daylight','season'].map(name=>[name,gl.getUniformLocation(program,`u_${name}`)]));
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;lastFrameKey=null;});
    canvas.addEventListener('webglcontextrestored',()=>{renderer=null;failed=false;failure=null;lost=false;lastFrameKey=null;});
    renderer={canvas,gl,program,map,uniforms,vao,uploaded:false};
    return renderer;
  }catch(error){failed=true;failure=error.message;return null;}
}

export function drawLandscape(ctx,{width,height,daylight}){
  const r=initialize();if(!r||lost)return false;
  const {gl,canvas,program,uniforms:u}=r;
  const density=Math.min(1.5,ctx.canvas.width/width);
  const w=Math.round(width*density),h=Math.round(height*density);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;lastFrameKey=null;}
  const matrix=ctx.getTransform();
  const waterPadX=TW*Math.abs(matrix.a),waterPadY=TH*Math.abs(matrix.d);
  animatedWater=false;knownRoadTiles=0;
  let dirty=!r.uploaded;
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
    const offset=(y*MAP_W+x)*4,b=G.buildingGrid[y]?.[x];
    const type=G.map[y]?.[x]||0,known=G.fog[y]?.[x]?255:0;
    if(type===0&&known&&!animatedWater){
      const sx=(x-y)*TW/2*matrix.a+matrix.e,sy=(x+y)*TH/2*matrix.d+matrix.f;
      animatedWater=sx>=-waterPadX&&sy>=-waterPadY&&sx<=ctx.canvas.width+waterPadX&&sy<=ctx.canvas.height+waterPadY;
    }
    const wear=Math.min(255,Math.round((G.tileWear?.[y]?.[x]||0)*255/400));
    const footprint=b?(b.type==='road'?64+Math.round(Math.max(0,Math.min(1,b.buildProgress??1))*63):255):0;
    if(b?.type==='road'&&known)knownRoadTiles++;
    if(mapPixels[offset]!==type||mapPixels[offset+1]!==known||mapPixels[offset+2]!==wear||mapPixels[offset+3]!==footprint){
      mapPixels[offset]=type;mapPixels[offset+1]=known;mapPixels[offset+2]=wear;mapPixels[offset+3]=footprint;dirty=true;
    }
  }
  const season=Math.max(0,['spring','summer','autumn','winter'].indexOf(G.season));
  // Dry land and roads have no clock animation. Keep their GPU result between
  // view/light/map changes; visible water alone needs a new time sample.
  const surfaceTick=animatedWater?G.gameTick:0;
  const key=[w,h,ctx.canvas.width,ctx.canvas.height,matrix.a,matrix.d,matrix.e,matrix.f,surfaceTick,daylight,season].join('/');
  if(dirty||key!==lastFrameKey){
    gl.viewport(0,0,w,h);gl.useProgram(program);gl.bindVertexArray(r.vao);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,r.map);
    if(dirty){gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,MAP_W,MAP_H,gl.RGBA,gl.UNSIGNED_BYTE,mapPixels);uploads++;r.uploaded=true;}
    gl.uniform1i(u.map,0);gl.uniform2f(u.resolution,w,h);gl.uniform2f(u.canvas,ctx.canvas.width,ctx.canvas.height);
    gl.uniform4f(u.transform,matrix.a,matrix.d,matrix.e,matrix.f);gl.uniform2f(u.tiles,MAP_W,MAP_H);gl.uniform2f(u.tileSize,TW,TH);
    gl.uniform1f(u.time,surfaceTick/60);gl.uniform1f(u.daylight,daylight);gl.uniform1f(u.season,season);
    gl.drawArrays(gl.TRIANGLES,0,3);lastFrameKey=key;draws++;
  }else reused++;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
  ctx.drawImage(canvas,0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore();
  return true;
}

export function landscapeDiagnostics(){
  return {state:lost?'lost':failed?'unavailable':renderer?'ready':'uninitialized',failure,
    draws,reused,uploads,width:renderer?.canvas.width||0,height:renderer?.canvas.height||0,
    mapBytes:mapPixels.byteLength,pattern:'continuous-world-space',roadMaterial:'worn-gravel',knownRoadTiles,animatedWater,densityCap:1.5};
}
