export const BUILDER_DIRECTIONS=Object.freeze(['s','se','e','ne','n','nw','w','sw']);
export const BUILDER_ACTIONS=Object.freeze({
  walk:{clip:'Builder_Walk',frames:24,duration:1.0666667222976685},
  idle:{clip:'Builder_Rest',frames:24,duration:4},
  work:{clip:'Builder_Hammer',frames:24,duration:1.6},
  carry:{clip:'Builder_Carry',frames:24,duration:1.0666667222976685},
});
export const BUILDER_ANCHOR=Object.freeze({x:.5,y:.86});
export const BUILDER_TIERS=Object.freeze([{size:64,height:84},{size:128,height:168}]);
