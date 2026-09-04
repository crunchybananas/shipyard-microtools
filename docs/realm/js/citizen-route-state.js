// Durable citizen route cancellation shared by core policy modules.
//
// Ownership, shelter, combat and workforce code can all invalidate a route
// through this leaf without creating a dependency cycle back through the
// citizen navigation planner.

import { cancelPathfindingRequest } from './pathfinding-service.js?realm=198';

export function clearCitizenRouteState(citizen) {
  cancelPathfindingRequest(citizen._pathRequest?.requestId);
  citizen.path = null;
  citizen.pathIdx = 0;
  citizen._pathRequest = null;
  citizen._pathStartedAt = null;
  citizen._stuckTicks = 0;
}
