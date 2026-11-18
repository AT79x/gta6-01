// SOLMAR BAY — tuning numbers, palette and content tables in one place.
// The game is a 2D top-down open-world crime game: an original sun-soaked coastal
// city, its own names, story, art and sounds. Nothing is borrowed from any
// commercial game.
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-bay.save.v1';

// World layout: blocks of 320px separated by 72px roads, 8 columns x 6 rows,
// plus a beach strip and sea along the east edge.
export const BLOCK = 320;
export const ROAD = 72;
export const PITCH = BLOCK + ROAD;
export const COLS = 8;
export const ROWS = 6;
export const WORLD = { width: COLS * PITCH + ROAD + 312, height: ROWS * PITCH + ROAD };
export const SEA_X = COLS * PITCH + ROAD + 112; // water starts here
export const SAND_X = COLS * PITCH + ROAD; // sand strip starts here

export const PLAYER = {
  radius: 14,
  walkSpeed: 185,
  sprintSpeed: 295,
  accel: 1400,
  healthMax: 100,
  armourMax: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.45,
};

export const CAR_TYPES = {
  sedan: { name: 'Sedan', accel: 380, topSpeed: 430, reverse: 170, turn: 2.6, grip: 6.5, length: 58, width: 30, colors: ['#c0392b', '#2e86c1', '#7d8a99', '#e8e4da'] },
  taxi: { name: 'Taxi', accel: 360, topSpeed: 410, reverse: 160, turn: 2.6, grip: 6.5, length: 58, width: 30, colors: ['#f5c518'] },
  van: { name: 'Van', accel: 260, topSpeed: 330, reverse: 140, turn: 2.1, grip: 5.5, length: 72, width: 32, colors: ['#e8e4da', '#5d6d7e', '#7b4b2a'] },
  sports: { name: 'Sports', accel: 560, topSpeed: 590, reverse: 200, turn: 3.1, grip: 7.5, length: 56, width: 30, colors: ['#f1c40f', '#8e44ad', '#111111'] },
  police: { name: 'Interceptor', accel: 520, topSpeed: 540, reverse: 190, turn: 3.0, grip: 7.2, length: 58, width: 30, colors: ['#1a1a2e'] },
};

export const TRAFFIC = { count: 26, parked: 18, minGap: 70, cruise: 150 };
export const PEDS = { count: 34, speed: 55 };
export const POLICE = { carChaseSpeed: 520, footSpeed: 205, sightRange: 620, spawnGap: 4.5 };

export const WANTED = {
  // heat thresholds for each star level (heat 0..100)
  thresholds: [0, 12, 30, 52, 74, 92],
  stealCar: 14,
  hitPed: 16,
  shoot: 10,
  kill: 18,
  decayPerSec: 2.2,
  decayDelay: 6,
};

export const WEAPONS = {
  pistol: { damage: 34, range: 420, cooldown: 0.28, ammoMax: 24, bulletSpeed: 900 },
};

export const PALETTE = {
  grass: '#5f9e4d',
  grassDark: '#548c44',
  pavement: '#9aa0a6',
  downtownGround: '#8d9299',
  sand: '#e8d39a',
  sea: '#2e7fa8',
  seaDeep: '#1f5f84',
  road: '#3a3f47',
  roadLine: '#e8d44d',
  sidewalk: '#b9bec4',
  buildingRoof: ['#b0563a', '#7a6a58', '#4a6b8a', '#8a4a5a', '#5a7a4a', '#6b5a8a', '#a87c4a'],
  houseRoof: ['#c0392b', '#2e86c1', '#e67e22', '#7d3c98', '#16a085'],
  park: '#4c8a3f',
  tree: '#2f6b2a',
  treeLight: '#4a8a3f',
  palm: '#3f8a4a',
  player: '#f2c94c',
  playerShirt: '#2e86c1',
  pedShirt: ['#e74c3c', '#27ae60', '#8e44ad', '#f39c12', '#16a085', '#d35400', '#ecf0f1'],
  gang: '#c0392b',
  cop: '#1c3d6e',
  copCar: '#1a1a2e',
  hudBg: 'rgba(12, 16, 24, 0.72)',
  hudText: '#f5f2e8',
  hudGold: '#f5c518',
  star: '#f5c518',
  starEmpty: 'rgba(245, 197, 24, 0.25)',
  marker: '#f5c518',
  health: '#3ddc5a',
  armour: '#4fc3f7',
  titleBg: '#0d1b2e',
  titleGold: '#f5c518',
  sky: '#ffd9a0',
};

export const DISTRICTS = {
  suburbs: { name: 'Palm Court', tint: '#6aa84f' },
  downtown: { name: 'Downtown', tint: '#7d8590' },
  beach: { name: 'Sunset Beach', tint: '#e8d39a' },
  harbour: { name: 'Harbour', tint: '#6b7c8a' },
  park: { name: 'Green', tint: '#4c8a3f' },
};

export const STORY = {
  city: 'Solmar Bay',
  hero: 'Rex Marlowe',
  fixer: 'Vera Kessler',
  gang: 'Crimson Vipers',
  debt: 20000,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const FONT_MONO = '"Courier New", ui-monospace, monospace';
