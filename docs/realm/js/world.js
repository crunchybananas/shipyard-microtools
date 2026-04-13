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
    else if(height<0.48) { const r=rng(); G.map[y][x]=r<0.70?TILE.FOREST:TILE.GRASS; }
    else if(height<0.55) { const r=rng(); G.map[y][x]=r<0.25?TILE.STONE:r<0.35?TILE.IRON:r<0.75?TILE.FOREST:TILE.GRASS; }
    else if(height<0.60) { const r=rng(); G.map[y][x]=r<0.35?TILE.STONE:r<0.45?TILE.MOUNTAIN:TILE.FOREST; }
    else G.map[y][x]=TILE.MOUNTAIN;
  }

  for(let i=0;i<20;i++){
    const px=rngInt(8,MAP_W-8), py=rngInt(8,MAP_H-8);
    const type = rng()<0.5 ? TILE.STONE : (rng()<0.5 ? TILE.IRON : TILE.FOREST);
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
      const nx=px+dx,ny=py+dy;
      if(nx>=0&&nx<MAP_W&&ny>=0&&ny<MAP_H&&G.map[ny][nx]!==TILE.WATER&&G.map[ny][nx]!==TILE.MOUNTAIN&&rng()<0.7){
        G.map[ny][nx]=type;
      }
    }
  }

  // Starting clearing — larger area for initial building
  const sx = Math.floor(cx), sy = Math.floor(cy);
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
    const nx = sx + dx, ny = sy + dy;
    if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= 3) G.map[ny][nx] = TILE.GRASS;
      else if (dist <= 5 && G.map[ny][nx] === TILE.WATER) G.map[ny][nx] = TILE.SAND;
      else if (dist <= 5 && (G.map[ny][nx] === TILE.MOUNTAIN || G.map[ny][nx] === TILE.STONE)) G.map[ny][nx] = TILE.GRASS;
    }
  }

  // River — carve from near center toward coast
  let rx = sx + 4, ry = sy;
  for (let step = 0; step < 35; step++) {
    if (rx < 1 || rx >= MAP_W-1 || ry < 1 || ry >= MAP_H-1) break;
    if (G.map[ry][rx] === TILE.WATER) break;
    // River tile
    G.map[ry][rx] = TILE.WATER;
    // Sand banks
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const bx = rx+dx, by = ry+dy;
      if (bx>=0 && bx<MAP_W && by>=0 && by<MAP_H && G.map[by][bx] !== TILE.WATER) {
        if (G.map[by][bx] !== TILE.SAND) G.map[by][bx] = TILE.SAND;
      }
    }
    // Flow generally toward the nearest edge with some meandering
    rx += 1;
    ry += Math.round(rng() * 2 - 1);
  }

  revealAround(sx, sy, 9);

  G.citizens = [];
  for(let i=0;i<3;i++){
    G.citizens.push(makeCitizen(sx+rngRange(-1,1), sy+rngRange(-1,1)));
  }

  // Center camera on the island (critical — iso projection)
  const centerScreen = { x: (sx-sy)*(64/2), y: (sx+sy)*(32/2) };
  G.camera.x = centerScreen.x;
  G.camera.y = centerScreen.y;
  G.camera.zoom = 1;
}
