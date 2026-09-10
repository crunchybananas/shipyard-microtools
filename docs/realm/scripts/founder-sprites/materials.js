import * as THREE from 'three';

// Periodic, seeded height fields produce matching normal and roughness maps.
// These are surface recipes, not generated photographs interpreted as depth.
const SIZE=256,TAU=Math.PI*2;
const hash=(x,y)=>{let n=Math.imul(x+31,374761393)^Math.imul(y+17,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
function noise(x,y,cells){
  x*=cells;y*=cells;const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const a=fx*fx*(3-2*fx),b=fy*fy*(3-2*fy),v=(dx,dy)=>hash(((ix+dx)%cells+cells)%cells,((iy+dy)%cells+cells)%cells);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(v(0,0),v(1,0),a),THREE.MathUtils.lerp(v(0,1),v(1,1),a),b);
}
export function surfaceMaps(kind){
  const height=new Float32Array(SIZE*SIZE),normal=new Uint8Array(SIZE*SIZE*4),rough=new Uint8Array(SIZE*SIZE*4),color=new Uint8Array(SIZE*SIZE*4);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const u=x/SIZE,v=y/SIZE,n=noise(u,v,32),b=noise(u,v,8);
    let value;
    if(kind==='cloth'){
      const warp=Math.cos(u*TAU*32),weft=Math.cos(v*TAU*32);
      value=.5+.15*warp+.15*weft+.07*warp*weft+.025*n;
    }else if(kind==='leather')value=.4+.26*n+.12*noise(u,v,64)+.07*b;
    else if(kind==='wood')value=.5+.13*Math.sin(u*TAU*32+3*Math.sin(v*TAU*2))+.08*Math.sin(u*TAU*77)+.08*n;
    else if(kind==='metal')value=.5+.035*n+.025*Math.sin(u*TAU*109);
    else value=.25+.4*b+.18*n+.1*noise(u,v,64);
    height[y*SIZE+x]=value;
    const i=(y*SIZE+x)*4,shade=Math.round(220+value*35);
    color.set([shade,shade,shade,255],i);
    const r=Math.round((kind==='metal'?.6:kind==='leather'?.75:.88)*255+(value-.5)*35);
    rough.set([r,r,r,255],i);
  }
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const sample=(dx,dy)=>height[((y+dy+SIZE)%SIZE)*SIZE+(x+dx+SIZE)%SIZE];
    const strength=kind==='cloth'?1.4:kind==='metal'?1.5:2.3;
    const nx=(sample(-1,0)-sample(1,0))*strength,ny=(sample(0,-1)-sample(0,1))*strength;
    const len=Math.hypot(nx,ny,1);normal.set([Math.round((nx/len*.5+.5)*255),Math.round((ny/len*.5+.5)*255),Math.round((1/len*.5+.5)*255),255],(y*SIZE+x)*4);
  }
  const texture=(data,srgb=false)=>{
    const t=new THREE.DataTexture(data,SIZE,SIZE,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.needsUpdate=true;return t;
  };
  return{normal:texture(normal),roughness:texture(rough),color:texture(color,true)};
}

export function dressFounder(model,renderer){
  const recipes=Object.fromEntries(['cloth','linen','leather','metal','hair'].map(k=>[k,surfaceMaps(k==='hair'?'wood':k==='linen'?'cloth':k)]));
  const materials=[],meshes=[],stats={triangles:0,regions:{}};
  let pixels,pw,ph;
  model.traverse(o=>{
    if(!o.isMesh)return;
    const original=o.material;
    const explicitKind=original.name?.match(/^Realm (cloth|linen|leather|metal|skin|hair|eyes)$/)?.[1];
    if(!explicitKind&&!pixels){const image=original.map.image,c=document.createElement('canvas');pw=c.width=image.width;ph=c.height=image.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);pixels=ctx.getImageData(0,0,pw,ph).data;}
    const sample=(u,v)=>{
      const x=Math.max(0,Math.min(pw-1,Math.floor(u*pw))),y=Math.max(0,Math.min(ph-1,Math.floor((original.map.flipY?1-v:v)*ph)));
      return Array.from(pixels.slice((y*pw+x)*4,(y*pw+x)*4+3),n=>n/255);
    };
    const region=(u,v,vertex)=>{
      if(explicitKind)return explicitKind;
      const [r,g,b]=sample(u,v),hi=Math.max(r,g,b),lo=Math.min(r,g,b);
      const joints=o.geometry.attributes.skinIndex,weights=o.geometry.attributes.skinWeight;
      let headWeight=0,legWeight=0;
      if(joints&&weights)for(let k=0;k<4;k++){const index=joints.array[vertex*4+k],name=o.skeleton?.bones[index]?.name||'';if(/head/i.test(name))headWeight+=weights.array[vertex*4+k];if(/leg|foot|toe/i.test(name))legWeight+=weights.array[vertex*4+k];}
      if(headWeight>.5&&hi<.22)return 'eyes';
      if(headWeight>.5&&r>g*1.18&&!(r>.78&&g>.5&&b>.32))return 'hair';
      if(o.name==='Rogue_Cape'||g>r*1.12||hi<.22)return 'cloth';
      if(hi-lo<.13&&hi>.25)return 'metal';
      if(r>.78&&g>.5&&b>.32)return headWeight>.5?'skin':legWeight>.5?'linen':'leather';
      return 'leather';
    };
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),pos=g.attributes.position,uv=g.attributes.uv,norm=g.attributes.normal;
    const detail=new Float32Array(pos.count*2),buckets={cloth:[],linen:[],leather:[],metal:[],skin:[],hair:[],eyes:[]};
    for(let i=0;i<pos.count;i+=3){
      const originalVertex=o.geometry.index?o.geometry.index.getX(i):i;
      const type=region((uv.getX(i)+uv.getX(i+1)+uv.getX(i+2))/3,(uv.getY(i)+uv.getY(i+1)+uv.getY(i+2))/3,originalVertex);
      const n=new THREE.Vector3(norm.getX(i),norm.getY(i),norm.getZ(i));
      const axis=Math.abs(n.x)>Math.abs(n.y)&&Math.abs(n.x)>Math.abs(n.z)?0:Math.abs(n.y)>Math.abs(n.z)?1:2;
      const scale=type==='cloth'||type==='linen'?5:3;
      for(let j=i;j<i+3;j++){
        // A second UV set in the undeformed mesh follows skinning. Palette UVs
        // remain untouched, and no world-space texture can slide over a limb.
        const x=pos.getX(j),y=pos.getY(j),z=pos.getZ(j);
        detail[j*2]=(axis===0?z:x)*scale;detail[j*2+1]=(axis===1?z:y)*scale;
        buckets[type].push(j);
      }
    }
    g.setAttribute('uv1',new THREE.BufferAttribute(detail,2));g.clearGroups();
    const indices=[],set=[];
    for(const [kind,vertices] of Object.entries(buckets)){
      if(!vertices.length)continue;
      const maps=recipes[kind];
      const material=new THREE.MeshPhysicalMaterial({name:`Founder ${kind}`,map:original.map,side:THREE.DoubleSide,roughness:kind==='eyes'?.27:kind==='skin'?.88:kind==='metal'?.56:kind==='hair'?.75:1,metalness:kind==='metal'?.72:0,
        sheen:kind==='cloth'?.35:0,sheenColor:new THREE.Color('#718f81'),sheenRoughness:.9,clearcoat:kind==='leather'?.08:0,clearcoatRoughness:.7});
      if(maps){material.normalMap=maps.normal;material.roughnessMap=maps.roughness;material.normalMap.channel=material.roughnessMap.channel=1;material.normalScale.setScalar(kind==='hair'?.13:kind==='cloth'?.55:.35);}
      material.userData.detailNormal=material.normalMap;material.userData.detailRoughness=material.roughnessMap;material.userData.kind=kind;material.userData.authoredSurface=!!explicitKind;
      g.addGroup(indices.length,vertices.length,set.length);indices.push(...vertices);set.push(material);materials.push(material);
      stats.regions[kind]=(stats.regions[kind]||0)+vertices.length/3;
    }
    g.setIndex(indices);o.geometry=g;o.material=set;o.castShadow=true;o.receiveShadow=true;meshes.push(o);stats.triangles+=indices.length/3;
  });
  for(const recipe of Object.values(recipes))for(const texture of Object.values(recipe))texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  return{stats,setDetail(on){for(const m of materials){m.normalMap=on?m.userData.detailNormal:null;m.roughnessMap=on?m.userData.detailRoughness:null;m.needsUpdate=true;}},setWireframe(on){materials.forEach(m=>m.wireframe=on);},materials,meshes};
}
