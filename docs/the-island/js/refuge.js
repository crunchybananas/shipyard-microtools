// refuge.js — the dry room is the emotional boundary of the route.
//
// The room has one interaction grammar at both ends of the game: first the
// player makes a light there; after returning, that same light is where the
// operation chosen below becomes a commitment.  Keeping this decision pure
// prevents a prop callback from quietly becoming story authority.

const flag = (world, key) => world?.flags?.[key] === true;

export function nextRefugeAction({ world, armed = false }) {
  if (!flag(world, 'refugeLit')) return { kind: 'light-refuge' };

  if (flag(world, 'endingCommitted')) return { kind: 'complete' };

  if (flag(world, 'returned') && flag(world, 'dispositionChosen')) {
    return { kind: armed ? 'commit-ending' : 'arm-ending' };
  }

  return { kind: 'keep-light' };
}

