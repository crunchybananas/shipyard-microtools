// ══════��════════════════════════════���════════════════════════
// World generation — terrain, fog, noise
// ════════��═════════════════════════��═════════════════════════

import { G, TILE, MAP_W, MAP_H, rng, rngInt, rngRange, randomName } from './state.js';

function hash2(x,y){ let n=x*374761393+y*668265263; n=(n^(n>>13))*1274126177; return(n^(n>>16))&0x7fffffff; }
function noise2(x,y){
  const ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy;
  const sx=fx*fx*(3-2*fx), sy=fy*fy*(3-2*fy);
  const a=hash2(ix,iy)/0x7fffffff, b=hash2(ix+1,iy)/0x7fffffff;
  const c=hash2(ix,iy+1)/0x7fffffff, d=hash2(ix+1,iy+1)/0x7fffffff;
  return a+(b-a)*sx + (c-a+(a-b-c+d)*sx)*sy;
}
function fbm(x,y,oct){
  let v=0,a=1,f=1,t=0;
  for(let i=0;i<oct;i++){v+=noise2(x*f,y*f)*a;t+=a;a*=0.5;f*=2;}
  return v/t;
}

export function revealAround(cx,cy,r){
  for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
    const nx=cx+dx,ny=cy+dy;
    if(nx>=0&&nx<MAP_W&&ny>=0&&ny<MAP_H&&dx*dx+dy*dy<=r*r+1) G.fog[ny][nx]=true;
  }
}

export function rebuildBuildingGrid(){
  G.buildingGrid = Array.from({length:MAP_H}, ()=>Array(MAP_W).fill(null));
  for(const b of G.buildings) G.buildingGrid[b.y][b.x] = b;
}

export function makeCitizen(x,y){
  return {
    x, y, tx:x, ty:y,
    speed: 0.02 + rng()*0.01,
    job: null, jobBuilding: null,
    carrying: null, carryAmount: 0,
    name: randomName(),
    hunger: 0, rest: 0,
    state: 'idle', stateTimer: 0,
    path: null, pathIdx: 0,
  };
}

export function generateWorld(){
  G.map = Array.from({length:MAP_H}, ()=>Array(MAP_W).fill(TILE.WATER));
  G.fog = Array.from({length:MAP_H}, ()=>Array(MAP_W).fill(false));
  G.buildingGrid = Array.from({length:MAP_H}, ()=>Array(MAP_W).fill(null));

  const cx=MAP_W/2, cy=MAP_H/2;
  for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++){
    const dx=(x-cx)/cx, dy=(y-cy)/cy;
    const dist=Math.sqrt(dx*dx+dy*dy);
    const n = fbm(x*0.08,y*0.08,3) * 0.5 + 0.5;
    const height = n - dist*1.1;
    if(height<0.05) G.map[y][x]=TILE.WATER;
    else if(height<0.12) G.map[y][x]=TILE.SAND;
    else if(height<0.35) G.map[y][x]=TILE.GRASS;
    else if(height<0.45) { const r=rng(); G.map[y][x]=r<0.6?TILE.FOREST:TILE.GRASS; }
    else if(height<0.55) { const r=rng(); G.map[y][x]=r<0.3?TILE.STONE:r<0.4?TILE.IRON:TILE.GRASS; }
    else G.map[y][x]=TILE.MOUNTAIN;
  }

  for(let i=0;i<12;i++){
    const px=rngInt(8,MAP_W-8), py=rngInt(8,MAP_H-8);
    const type = rng()<0.5 ? TILE.STONE : (rng()<0.5 ? TILE.IRON : TILE.FOREST);
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      const nx=px+dx,ny=py+dy;
      if(nx>=0&&nx<MAP_W&&ny>=0&&ny<MAP_H&&G.map[ny][nx]!==TILE.WATER&&G.map[ny][nx]!==TILE.MOUNTAIN&&rng()<0.7){
        G.map[ny][nx]=type;
      }
    }
  }

  const sx=Math.floor(cx), sy=Math.floor(cy);
  for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++){
    const nx=sx+dx, ny=sy+dy;
    if(nx>=0&&nx<MAP_W&&ny>=0&&ny<MAP_H){
      if(Math.abs(dx)<=1&&Math.abs(dy)<=1) G.map[ny][nx]=TILE.GRASS;
      else if(G.map[ny][nx]===TILE.WATER) G.map[ny][nx]=TILE.SAND;
      revealAround(nx,ny,1);
    }
  }
  revealAround(sx,sy,5);

  G.citizens = [];
  for(let i=0;i<3;i++){
    G.citizens.push(makeCitizen(sx+rngRange(-1,1), sy+rngRange(-1,1)));
  }
}
