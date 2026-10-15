import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTownLibrary, TOWN_LIBRARY_KEY } from '../js/town-library.js';
import { createCompanionStore, HOME_SAVE_KEY, COMPANION_SAVE_KEY } from '../js/companion-store.js';
import { createGame, serialize, restore, tick } from '../js/sim.js';
import { ensureCoop } from '../js/coop-state.js';
class Storage {
 constructor(entries=[]) { this.data=new Map(entries);this.writes=[];this.fail=false; }
 getItem(k){return this.data.get(k)??null;}
 setItem(k,v){if(this.fail)throw Error('Quota');this.data.set(k,v);this.writes.push(k);}
}
const library=storage=>createTownLibrary({storage,requireLock:false});
function pair() {
 const storage=new Storage(), home=createGame();home.resources.wood=123;
 const old=createCompanionStore({storage,requireLock:false});assert.ok(old.create({homeName:'Cory',companionName:'Melissa'},home).ok);
 const proposed=old.proposeOffer({give:{wood:10},request:{stone:4}},home);assert.ok(proposed.ok);
 return {storage,home,proposed};
}
test('migrate a home exactly, retain legacy bytes and migrate only once',()=>{
 const home=createGame();home.resources.wood=99;const raw=serialize(home),storage=new Storage([[HOME_SAVE_KEY,raw]]),l=library(storage);
 assert.equal(l.list().length,1);assert.equal(l.exportTown('s1','home'),raw);assert.equal(storage.getItem(HOME_SAVE_KEY),raw);
 const active=l.companions.loadHome();tick(active,1);assert.ok(l.companions.save(active).ok);
 assert.equal(storage.getItem(HOME_SAVE_KEY),raw);assert.deepEqual(new Set(storage.writes),new Set([TOWN_LIBRARY_KEY]));
 assert.equal(library(storage).list().length,1);
});
test('preserve both named companions and open offers, then trade atomically after migration',()=>{
 const {storage,home,proposed}=pair(), originals=new Map(storage.data),l=library(storage);
 assert.deepEqual(l.list().map(t=>t.name),['Cory','Melissa']);
 const r=l.select('s1','companion',home);assert.ok(r.ok,r.reason);
 const accepted=l.companions.acceptOffer(proposed.offerId,r.state);assert.ok(accepted.ok,accepted.reason);
 assert.equal(l.list()[0].state.resources.wood,113);assert.equal(l.list()[1].state.resources.wood,110);
 for(const[k,v]of originals)assert.equal(storage.getItem(k),v);
 const reload=library(storage);assert.equal(reload.companions.activeId,'companion');assert.equal(reload.companions.loadHome().resources.wood,110);
});
test('new games and duplicates do not replace the current town; changes and selection survive reload',()=>{
 const storage=new Storage(),l=library(storage),first=l.create('Seabrook');const a=l.select(first.id,'home').state;
 a.resources.wood=81;const next=l.create('Second island',a);assert.ok(next.ok);
 assert.equal(l.list().find(t=>t.active).name,'Seabrook');
 const copy=l.duplicate(first.id,'home','Experiment',a);assert.ok(copy.ok);
 const experiment=l.select(copy.id,'home',a).state;experiment.resources.wood=7;l.companions.save(experiment);
 assert.equal(JSON.parse(l.exportTown(first.id,'home')).resources.wood,81);
 const reload=library(storage);assert.equal(reload.list().length,3);assert.equal(reload.list().find(t=>t.active).name,'Experiment');assert.equal(reload.companions.loadHome().resources.wood,7);
});
test('a duplicate keeps all town progress but gets a fresh online identity without link, escrow, or companion offers',()=>{
 const {storage}=pair(),l=library(storage),state=l.companions.loadHome(),c=ensureCoop(state);
 c.link={roomId:'r'.repeat(24),uid:'u'.repeat(24),name:'Cory'};c.storehouse=true;
 c.pending={id:'p'.repeat(24),sequence:1,requested:{wood:10,stone:0,food:0}};
 const result=l.duplicate('s1','home','Test branch',state);assert.ok(result.ok,result.reason);
 const copied=restore(l.exportTown(result.id,'home'));
 assert.notEqual(copied.coop.townId,c.townId);assert.equal(copied.coop.link,null);assert.equal(copied.coop.pending,null);assert.equal(copied.coop.draft,null);assert.equal(copied.coop.storehouse,true);
 assert.deepEqual(copied.resources,state.resources);assert.deepEqual(copied.research,state.research);assert.deepEqual(copied.woodland,state.woodland);assert.deepEqual(copied.minerals,state.minerals);
 assert.equal(l.list().filter(t=>t.slotId===result.id).length,1);assert.equal(JSON.parse(l.exportTown('s1','home')).coop.link.roomId,c.link.roomId);
});
test('copy a developed town with research, animals and finite mineral state intact',()=>{
 const raw=readFileSync(new URL('../review/town-depth/browser-save.json',import.meta.url),'utf8');
 const storage=new Storage([[HOME_SAVE_KEY,raw]]),l=library(storage),before=restore(raw),r=l.duplicate('s1','home','Animal trials');assert.ok(r.ok,r.reason);
 const copy=restore(l.exportTown(r.id,'home'));
 for(const key of ['research','buildings','livestock','minerals','woodland','frontier','resources'])assert.deepEqual(copy[key],before[key],key);
});
test('rename either member without breaking its trade journal or active backend',()=>{
 const {storage}=pair(),l=library(storage);assert.ok(l.rename('s1','companion','Melissa’s coast').ok);
 assert.equal(l.list()[1].name,'Melissa’s coast');assert.ok(l.companions.save(l.companions.loadHome()).ok);
 assert.equal(l.companions.info().offers.length,1);
});
test('quota errors never switch or duplicate and never replace the originals',()=>{
 const storage=new Storage(),l=library(storage);l.create('First');l.create('Second');const before=storage.getItem(TOWN_LIBRARY_KEY);storage.fail=true;
 assert.equal(l.select('s2','home').ok,false);assert.equal(l.duplicate('s1','home','Copy').ok,false);assert.equal(l.rename('s1','home','Changed').ok,false);
 assert.equal(storage.getItem(TOWN_LIBRARY_KEY),before);assert.equal(l.list().find(t=>t.active).name,'First');assert.equal(l.list().length,2);
});
test('failed migration, corrupt libraries and invalid legacy records remain untouched',()=>{
 for(const entry of [[HOME_SAVE_KEY,'bad'],[COMPANION_SAVE_KEY,'{}'],[TOWN_LIBRARY_KEY,'{broken']]){
  const storage=new Storage([entry]),l=library(storage);assert.ok(l.blocked);assert.equal(storage.writes.length,0);assert.equal(storage.getItem(entry[0]),entry[1]);assert.equal(l.create('New').ok,false);assert.ok(l.companions.info().blocked);
 }
 const storage=new Storage([[HOME_SAVE_KEY,serialize(createGame())]]);storage.fail=true;assert.ok(library(storage).blocked);assert.equal(storage.getItem(TOWN_LIBRARY_KEY),null);
});
test('malformed selection and unavailable storage cannot expose a destructive new-game path',()=>{
 const storage=new Storage(),l=library(storage);l.create('First');const value=JSON.parse(storage.getItem(TOWN_LIBRARY_KEY));value.active.townId='missing';storage.data.set(TOWN_LIBRARY_KEY,JSON.stringify(value));assert.ok(library(storage).blocked);
 assert.ok(createTownLibrary({storage:null,requireLock:false}).blocked);
});
test('a legacy client or another library write is detected before a new save',()=>{
 const storage=new Storage([[HOME_SAVE_KEY,serialize(createGame())]]),l=library(storage),before=storage.getItem(TOWN_LIBRARY_KEY);
 storage.data.set(HOME_SAVE_KEY,serialize({...createGame(),resources:{...createGame().resources,wood:121}}));
 assert.equal(l.companions.save(createGame()).ok,false);assert.equal(l.create('Copy').ok,false);assert.equal(storage.getItem(TOWN_LIBRARY_KEY),before);
});
test('a failed or contended writer lock cannot migrate or write; releasing permits another tab',async()=>{
 let held=false;
 const locks={request:async(_,options,callback)=>{assert.equal(options.ifAvailable,true);if(held)return callback(null);held=true;try{return await callback({});}finally{held=false;}}};
 const storage=new Storage([[HOME_SAVE_KEY,serialize(createGame())]]);
 const first=createTownLibrary({storage,locks,requireLock:true});await first.ready;
 const before=storage.getItem(TOWN_LIBRARY_KEY),second=createTownLibrary({storage,locks,requireLock:true});await second.ready;
 assert.ok(second.blocked);assert.equal(second.create('Bad').ok,false);assert.equal(storage.getItem(TOWN_LIBRARY_KEY),before);
 first.companions.release();await new Promise(r=>setTimeout(r,0));
 const third=createTownLibrary({storage,locks,requireLock:true});await third.ready;assert.equal(third.blocked,false);third.companions.release();
});
test('visited town cannot write or overwrite either companion',()=>{
 const {storage}=pair(),l=library(storage),before=l.exportTown('s1','companion'),visit=l.select('s1','companion',null,{visit:true});
 visit.state.resources.wood=999;assert.ok(l.companions.save(visit.state).skipped);assert.equal(l.exportTown('s1','companion'),before);
});
