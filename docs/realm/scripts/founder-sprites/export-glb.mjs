// Preserve the source mesh, skin weights and materials. Replace its animation
// library with the exact local joint transforms used by the sprite compiler.
// Blender can then import and edit the same grounded motion without retargeting.
export function normalizeBlenderTiming(source,durations){
  const jsonLength=source.readUInt32LE(12);
  const doc=JSON.parse(source.subarray(20,20+jsonLength).toString());
  const offset=20+jsonLength;
  const binary=source.subarray(offset+8,offset+8+source.readUInt32LE(offset));
  const chunks=[binary];let byteLength=binary.length;
  const timings={};
  for(const animation of doc.animations){
    const duration=typeof durations==='number'?durations:durations[animation.name];
    if(!duration)throw new Error(`Unknown exported action ${animation.name}`);
    const indices=[...new Set(animation.samplers.map(s=>s.input))];
    const slots=indices.map(index=>{
      const a=doc.accessors[index],v=doc.bufferViews[a.bufferView];
      if(a.type!=='SCALAR'||a.componentType!==5126)throw new Error('Expected floating-point animation times');
      const start=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||4;
      return{index,values:Array.from({length:a.count},(_,i)=>binary.readFloatLE(start+i*stride))};
    });
    const first=Math.min(...slots.flatMap(s=>s.values)),last=Math.max(...slots.flatMap(s=>s.values));
    if(last<=first)throw new Error(`No time span: ${animation.name}`);
    // New accessors prevent one clip from retiming another clip's shared input.
    for(const {index,values} of slots){
      const normalized=values.map(t=>(t-first)/(last-first)*duration);
      const data=Buffer.from(new Float32Array(normalized).buffer);
      const padding=(4-byteLength%4)%4;if(padding){chunks.push(Buffer.alloc(padding));byteLength+=padding;}
      const view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:data.length});
      chunks.push(data);byteLength+=data.length;
      const replacement=doc.accessors.length;
      doc.accessors.push({bufferView:view,componentType:5126,count:values.length,type:'SCALAR',min:[Math.min(...normalized)],max:[Math.max(...normalized)]});
      for(const sampler of animation.samplers)if(sampler.input===index)sampler.input=replacement;
    }
    timings[animation.name]={sourceStart:first,sourceEnd:last,duration};
  }
  doc.buffers=[{byteLength}];doc.asset.extras={...doc.asset.extras,realmTimeline:timings};
  return assembleGLB(doc,Buffer.concat(chunks));
}

export function exportGroundedGLB(source, samples, duration) {
  const library=Array.isArray(samples)?[{name:'Realm_Grounded_Walk',samples,duration}]:Object.values(samples);
  const jsonLength=source.readUInt32LE(12);
  const doc=JSON.parse(source.subarray(20,20+jsonLength).toString());
  const binOffset=20+jsonLength;
  const binary=source.subarray(binOffset+8,binOffset+8+source.readUInt32LE(binOffset));
  const chunks=[binary];let byteLength=binary.length;
  function accessor(values,type){
    const data=Buffer.from(new Float32Array(values).buffer);
    const padding=(4-byteLength%4)%4;
    if(padding){chunks.push(Buffer.alloc(padding));byteLength+=padding;}
    const view=doc.bufferViews.length;
    doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:data.length});
    chunks.push(data);byteLength+=data.length;
    const components={SCALAR:1,VEC3:3,VEC4:4}[type];
    const index=doc.accessors.length;
    doc.accessors.push({bufferView:view,componentType:5126,count:values.length/components,type,...(type==='SCALAR'?{min:[Math.min(...values)],max:[Math.max(...values)]}:{})});
    return index;
  }
  const animations=[];
  for(const {name:clipName,samples,duration} of library){
  const times=accessor(samples.map((_,i)=>i/(samples.length-1)*duration),'SCALAR');
  const animation={name:clipName,samplers:[],channels:[]};
  const hidden=new Set(['Knife_Offhand','1H_Crossbow','2H_Crossbow','Knife','Throwable']);
  for(let node=0;node<doc.nodes.length;node++){
    const name=doc.nodes[node].name;
    if(hidden.has(name)){delete doc.nodes[node].mesh;delete doc.nodes[node].skin;}
    if(!samples[0][name])continue;
    for(const [path,type] of [['translation','VEC3'],['rotation','VEC4'],['scale','VEC3']]){
      const values=samples.flatMap(pose=>pose[name][path]);
      const output=accessor(values,type),sampler=animation.samplers.length;
      animation.samplers.push({input:times,output,interpolation:'LINEAR'});
      animation.channels.push({sampler,target:{node,path}});
    }
  }
  animations.push(animation);
  }
  doc.animations=animations;
  doc.buffers=[{byteLength}];
  doc.asset.generator='Realm grounded walk compiler; original character by Kay Lousberg (CC0)';
  return assembleGLB(doc,Buffer.concat(chunks));
}

function assembleGLB(doc,binary){
  const json=Buffer.from(JSON.stringify(doc));
  const jsonPadded=Buffer.alloc(Math.ceil(json.length/4)*4,0x20);json.copy(jsonPadded);
  const binPadded=Buffer.alloc(Math.ceil(binary.length/4)*4);binary.copy(binPadded);
  const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jsonPadded.length+8+binPadded.length,8);
  const jHeader=Buffer.alloc(8);jHeader.writeUInt32LE(jsonPadded.length);jHeader.writeUInt32LE(0x4e4f534a,4);
  const bHeader=Buffer.alloc(8);bHeader.writeUInt32LE(binPadded.length);bHeader.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,jHeader,jsonPadded,bHeader,binPadded]);
}
