// One physical camera and anchor for every housing tier and installation step.
export const HOUSE_PROFILE = 'carpentered-homes-v1';
export const HOUSE_STEPS = ['Setting out', 'Footings', 'Stone plinth', 'Floor joists',
  'Uprights', 'Wall frames', 'Lower infill', 'Upper infill', 'Gables', 'Roof trusses',
  'Roof battens', 'Eaves', 'Roof covering', 'Ridge and chimney', 'Joinery', 'Complete'];
export const HOUSE_VARIANTS = ['Reed', 'Slate', 'Clay'];
export const HOUSE_ANCHOR = {x: .5, y: .78};
export const HOUSE_CAMERA = {width: 512, height: 640, viewHeight: 11.1, elevation: 30};
export const HOUSE_CELL = {width: 128, height: 160, worldWidth: 112, worldHeight: 140};
export const HOUSE_GROUND_CELL = {width: 64, height: 80};
export const HOUSE_MAPS = {
  complete: {width: 128, height: 160, columns: 3, rows: 4},
  construction: {width: 64, height: 80, columns: 15, rows: 12},
  ground: {width: 64, height: 80, columns: 16, rows: 12},
  emission: {width: 256, height: 320, columns: 3, rows: 4},
  spill: {width: 128, height: 160, columns: 3, rows: 4},
};
export const HOUSE_ROWS = 12;
export const houseRow = (variant, tier) => (tier - 1) * 3 + variant;
export const houseStep = progress => progress >= 1 ? 15 : Math.min(14, Math.max(0, Math.floor((progress || 0) * 15)));
