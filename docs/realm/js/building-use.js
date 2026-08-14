// Player-facing building use: one compact answer to who uses a structure,
// what is happening there now, and why that structure changes the realm.
//
// The report is derived from authoritative ownership/activity state. It owns
// no simulation data and returns a frozen, reference-free snapshot for UI and
// verification consumers.

import { G, BUILDINGS } from './state.js?realm=195';
import {
  activeStaffingCount,
  isBuildingComplete,
} from './building-operation.js?realm=195';
import { workersForBuilding } from './citizen-ownership.js?realm=195';
import { residentsForHouse } from './residences.js?realm=195';
import { foodCapacity, isFoodStore, storedFood } from './building-inventory.js?realm=195';

const STRATEGIC_ROLE = Object.freeze({
  house: 'Adds four beds, a private eight-ration pantry, nightly sleep, raid shelter, and taxable household growth.',
  farm: 'Creates direct rations and bulk wheat. Pulling its farmer into the army stops that supply.',
  lumber: 'Turns nearby forest into the wood required by almost every expansion choice.',
  sawmill: 'Converts stored wood into planks for advanced military, civic, and wonder construction.',
  quarry: 'Extracts stone for storage, fortification, and durable civic buildings.',
  mine: 'Extracts iron for recruitment, tools, towers, and advanced construction.',
  market: 'Turns an attended trade floor into gold and improves nearby homes.',
  barracks: 'Converts named civilians, iron, and stored food into swordsmen; at least one instructor must remain on duty.',
  tower: 'Reveals terrain and attacks raiders; a soldier garrison extends range and increases its firing rate.',
  well: 'Improves nearby households and gives firefighters a chance to extinguish burning buildings.',
  tavern: 'Gives citizens a physical leisure destination and raises happiness around nearby homes.',
  wall: 'Physically blocks ground movement and adds five defense along a chosen frontier.',
  road: 'Makes routed ground travel faster, increasing effective labor and emergency response.',
  tradingpost: 'Sends attended coastal caravans that exchange travel time and risk for gold.',
  castle: 'Adds housing, happiness, and the realm\'s strongest static defense while unlocking the Hall of Ages.',
  wonder: 'Consumes a staged bill of real delivered goods; completing all stages wins the age.',
  granary: 'Stores thirty public rations and halves winter hunger growth while operational.',
  storehouse: 'Receives physical deliveries and exposes forty public ration slots to citizens and recruitment.',
  church: 'Gives citizens a physical faith destination and raises happiness around nearby homes.',
  school: 'Uses a scholar to accelerate active research by fifty percent.',
  windmill: 'Consumes stored wheat and turns it into flour for the Bakery chain.',
  bakery: 'Consumes flour and bakes dense food reserves while improving nearby happiness.',
  chickencoop: 'Uses one rancher to create a small, steady direct-food supply.',
  cowpen: 'Uses one rancher to create two direct rations per production cycle.',
  fisherman: 'Uses one fisher at the shoreline to create three direct rations per cycle.',
  blacksmith: 'Consumes iron to forge production tools and increases nearby soldier damage.',
  archery: 'Converts named civilians, wood, and stored food into ranged soldiers.',
  townhall: 'Adds civic housing and happiness under the realm\'s named mayor.',
});

function boundedName(person) {
  return person?.identity?.name || person?.name || 'Unknown';
}

function names(people) {
  return people.map(boundedName).join(', ');
}

function peopleAtFoodStore(building, state) {
  return (state.citizens || []).filter(citizen => (
    citizen._foodTarget === building || citizen._deliveryTarget === building
  ));
}

function peopleSummary(building, state) {
  if (!isBuildingComplete(building)) {
    const builders = workersForBuilding(building);
    return builders.length ? names(builders) : 'No builder assigned yet';
  }
  if (building.type === 'house') {
    const residents = residentsForHouse(building);
    return residents.length ? names(residents) : 'No residents assigned yet';
  }
  if (building.type === 'tower') {
    const garrison = (state.soldiers || []).filter(soldier => soldier.garrison === building);
    return garrison.length ? names(garrison) : 'No permanent crew · no garrison';
  }
  if (building.type === 'road') return 'Citizens, the Founder, soldiers, carts, and raiders';
  if (building.type === 'wall') return 'Builders raise it · no permanent crew';
  const workers = workersForBuilding(building);
  if (workers.length) return names(workers);
  if (isFoodStore(building, state)) {
    const visitors = peopleAtFoodStore(building, state);
    return visitors.length ? names(visitors) : 'Citizens and delivery carriers';
  }
  return 'No permanent crew';
}

function activitySummary(building, state) {
  if (!isBuildingComplete(building)) {
    const builders = workersForBuilding(building);
    const active = builders.filter(citizen => citizen.activity?.kind === 'working').length;
    return active > 0
      ? `${active} builder${active === 1 ? '' : 's'} raising the structure now`
      : builders.length > 0 ? 'Assigned builders are travelling or off duty' : 'Construction is waiting for labor';
  }
  if (building.type === 'house') {
    const residents = residentsForHouse(building);
    const sleeping = residents.filter(citizen => citizen.activity?.kind === 'sleep').length;
    const sheltering = residents.filter(citizen => citizen.activity?.kind === 'sheltered').length;
    if (sheltering > 0) return `${sheltering} resident${sheltering === 1 ? '' : 's'} sheltering from the raid`;
    if (sleeping > 0) return `${sleeping} resident${sleeping === 1 ? '' : 's'} sleeping inside`;
    return residents.length > 0 ? 'Residents are away at work and return here to sleep' : 'The home is ready for its first household';
  }
  if (building.type === 'tower') {
    const count = (state.soldiers || []).filter(soldier => soldier.garrison === building).length;
    return count > 0 ? `${count} soldier${count === 1 ? '' : 's'} watching and firing from the tower` : 'Automatic watch active · stronger with a garrison';
  }
  if (building.type === 'road') {
    const crossing = [
      ...(state.citizens || []),
      ...(state.soldiers || []),
      ...(state.walkers || []),
      ...(state.carts || []),
      ...(state.avatar ? [state.avatar] : []),
    ].filter(actor => Math.hypot(actor.x - building.x, actor.y - building.y) <= 0.7).length;
    return crossing > 0 ? `${crossing} traveller${crossing === 1 ? '' : 's'} crossing now` : 'Open to routed traffic';
  }
  if (building.type === 'wall') {
    const nearby = (state.enemies || []).filter(enemy => Math.hypot(enemy.x - building.x, enemy.y - building.y) <= 1.5).length;
    return nearby > 0 ? `Holding ${nearby} raider${nearby === 1 ? '' : 's'} at the frontier` : 'Standing barrier · no work shift required';
  }
  if (building.recruitType) {
    const active = activeStaffingCount(building);
    return active > 0
      ? `${active} instructor${active === 1 ? '' : 's'} drilling ${building.recruitName}`
      : `Drill for ${building.recruitName} paused until an instructor returns`;
  }
  const required = BUILDINGS[building.type]?.workers || 0;
  if (required > 0) {
    const assigned = workersForBuilding(building).length;
    const active = activeStaffingCount(building);
    if (active >= required) return `${active}/${required} workers performing the building's service now`;
    if (assigned >= required) return `${assigned}/${required} assigned · ${active} currently on duty`;
    const missing = required - assigned;
    return `Closed until ${missing} more worker${missing === 1 ? '' : 's'} ${missing === 1 ? 'arrives' : 'arrive'}`;
  }
  if (isFoodStore(building, state)) {
    const visitors = peopleAtFoodStore(building, state).length;
    return visitors > 0
      ? `${visitors} citizen${visitors === 1 ? '' : 's'} routing food through it now`
      : `${storedFood(building)}/${foodCapacity(building)} rations available for physical pickup`;
  }
  return 'Benefit is active whenever the completed structure stands';
}

export function buildingUseReport(building, state = G) {
  if (!building || !state.buildings?.includes(building) || !BUILDINGS[building.type]) {
    throw new TypeError('Building use requires a live known building.');
  }
  const strategic = building.founderStockpile === true
    ? 'The opening realm lives from these physical rations; citizens eat here and recruits are provisioned from it.'
    : STRATEGIC_ROLE[building.type];
  if (!strategic) throw new Error(`Missing strategic building role for ${building.type}.`);
  return Object.freeze({
    type: building.type,
    people: peopleSummary(building, state),
    activity: activitySummary(building, state),
    strategic,
  });
}

export function verifyBuildingUseCoverage() {
  const missing = Object.keys(BUILDINGS).filter(type => !STRATEGIC_ROLE[type]);
  return Object.freeze({
    complete: missing.length === 0,
    covered: Object.keys(BUILDINGS).length - missing.length,
    total: Object.keys(BUILDINGS).length,
    missing: Object.freeze(missing),
  });
}
