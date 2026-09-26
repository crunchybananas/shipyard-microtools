// Book titles are scene lettering, batched into one shared atlas and one draw.
import * as THREE from 'three';
import {mergeGeometries} from './util.js';
import {REFERENCE_LIBRARY} from './content.js';
export function createLibraryLettering(){
  const cols=8,cw=128,ch=512,cv=document.createElement('canvas');
  cv.width=cols*cw;cv.height=Math.ceil(REFERENCE_LIBRARY.length/cols)*ch;
  const g=cv.getContext('2d');g.fillStyle='#d8c79f';g.textAlign='center';g.textBaseline='middle';
  REFERENCE_LIBRARY.forEach((title,i)=>{
    const x=(i%cols)*cw,y=Math.floor(i/cols)*ch;
    g.save();g.translate(x+cw/2,y+ch/2);g.rotate(-Math.PI/2);
    g.font='600 29px Georgia';g.fillText(title,0,0,ch*.83);g.restore();
    for(const yy of [.09,.91])g.fillRect(x+cw*.19,y+ch*yy,cw*.62,3);
    g.beginPath();g.arc(x+cw/2,y+ch*.965,4,0,Math.PI*2);g.fill();
  });
  const texture=new THREE.CanvasTexture(cv);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const geometry=[],books=[];
  return {
    add(matrix,w,h,d,index){
      const cell=index%REFERENCE_LIBRARY.length,geo=new THREE.PlaneGeometry(w*.89,h*.88);
      const uv=geo.attributes.uv,rows=cv.height/ch;
      for(let i=0;i<uv.count;i++)uv.setXY(i,(cell%cols+uv.getX(i))/cols,(rows-1-Math.floor(cell/cols)+uv.getY(i))/rows);
      geo.rotateY(Math.PI);geo.translate(0,0,-d/2-.0018);geo.applyMatrix4(matrix);geometry.push(geo.toNonIndexed());geo.dispose();
      books.push({title:REFERENCE_LIBRARY[cell],height:h,width:w,depth:d});
    },
    finish(){
      const mesh=new THREE.Mesh(mergeGeometries(geometry,['uv']),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
      for(const g of geometry)g.dispose();mesh.name='referenceBookTitles';mesh.userData.books=books;return mesh;
    }
  };
}
