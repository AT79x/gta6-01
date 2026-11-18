// The city of Solmar Bay and the whole game state: seeded generation of the road
// grid, districts, buildings, parks, beach and harbour; collision helpers; and the
// factory that builds a fresh game state (player, traffic, pedestrians, parked cars,
// pickups). No drawing and no browser in here — render.js paints what this builds.
import {
  BLOCK, CAR_TYPES, COLS, PALETTE, PEDS, PITCH, ROAD, ROWS, SAND_X, SEA_X, TRAFFIC, WORLD,
} from './config.js';
import { chance, clamp, dist2, mulberry32, pick, range, rangeInt } from './random.js';

export const ROAD_VERTICAL = 0;
export const ROAD_HORIZONTAL = 1;

function roadCenters(count) {
  const centers = [];
  for (let i = 0; i <= count; i += 1) centers.push(i * PITCH + ROAD / 2);
  return centers;
}

export function createCity(seed) {
  const rng = mulberry32(seed);
  const vRoads = roadCenters(COLS);
  const hRoads = roadCenters(ROWS);
  const blocks = [];
  const buildings = [];
  const trees = [];
  const parks = [];

  function districtOf(col, row) {
    if (row === ROWS - 1 && col >= 5) return 'harbour';
    if (col >= 6) return 'beach';
    if (col >= 2 && col <= 5 && row >= 1 && row <= 3) return 'downtown';
    return 'suburbs';
  }

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const x = col * PITCH + ROAD;
      const y = row * PITCH + ROAD;
      const district = districtOf(col, row);
      const isPark = district === 'suburbs' && chance(rng, 0.22);
      const block = { col, row, x, y, w: BLOCK, h: BLOCK, district, park: isPark };
      blocks.push(block);
      if (isPark) {
        parks.push(block);
        for (let t = 0; t < 9; t += 1) {
          trees.push({ x: x + range(rng, 30, BLOCK - 30), y: y + range(rng, 30, BLOCK - 30), r: range(rng, 10, 18), palm: false });
        }
        continue;
      }
      if (district === 'beach') {
        for (let t = 0; t < 6; t += 1) {
          trees.push({ x: x + range(rng, 24, BLOCK - 24), y: y + range(rng, 24, BLOCK - 24), r: range(rng, 9, 13), palm: true });
        }
        if (chance(rng, 0.5)) {
          buildings.push({ x: x + 40, y: y + 60, w: 150, h: 110, color: pick(rng, PALETTE.houseRoof), tall: false, district });
        }
        continue;
      }
      if (district === 'harbour') {
        // Docks: long warehouses and container stacks, few tall blocks.
        const count = rangeInt(rng, 1, 2);
        for (let b = 0; b < count; b += 1) {
          buildings.push({
            x: x + 20 + b * 160, y: y + 40, w: 140, h: 200,
            color: pick(rng, ['#7b4b2a', '#5d6d7e', '#8a6d3b']), tall: false, district,
          });
        }
        continue;
      }
      const tall = district === 'downtown';
      const count = tall ? rangeInt(rng, 2, 4) : rangeInt(rng, 2, 3);
      const grid = Math.ceil(Math.sqrt(count));
      const cell = BLOCK / grid;
      for (let b = 0; b < count; b += 1) {
        const gx = b % grid;
        const gy = Math.floor(b / grid);
        const bw = cell * range(rng, 0.55, 0.8);
        const bh = cell * range(rng, 0.55, 0.8);
        buildings.push({
          x: x + gx * cell + (cell - bw) / 2,
          y: y + gy * cell + (cell - bh) / 2,
          w: bw, h: bh,
          color: tall ? pick(rng, PALETTE.buildingRoof) : pick(rng, PALETTE.houseRoof),
          tall, height: tall ? rangeInt(rng, 2, 5) : 1,
          district,
        });
      }
      if (!tall) {
        for (let t = 0; t < 3; t += 1) {
          trees.push({ x: x + range(rng, 24, BLOCK - 24), y: y + range(rng, 24, BLOCK - 24), r: range(rng, 9, 14), palm: false });
        }
      }
    }
  }

  // Named places the missions and the HUD point at.
  const plaza = { x: 3 * PITCH + ROAD + BLOCK / 2, y: 2 * PITCH + ROAD + BLOCK / 2, name: 'Marlowe Plaza' };
  const hotel = { x: 6 * PITCH + ROAD + BLOCK / 2, y: 1 * PITCH + ROAD + BLOCK / 2, name: 'The Palms Hotel' };
  const docks = { x: 6 * PITCH + ROAD + BLOCK / 2, y: 5 * PITCH + ROAD + BLOCK / 2, name: 'Harbour Docks' };
  const warehouse = { x: 5 * PITCH + ROAD + 90, y: 5 * PITCH + ROAD + 140, name: 'Old Warehouse' };
  const garage = { x: 2 * PITCH + ROAD + BLOCK / 2, y: 4 * PITCH + ROAD + BLOCK / 2, name: "Vera's Garage" };
  const marina = { x: SAND_X + 60, y: 3 * PITCH + ROAD + BLOCK / 2, name: 'Sunset Marina' };
  const beachHouse = { x: SAND_X + 60, y: 1 * PITCH + ROAD + BLOCK / 2, name: 'Beach House' };

  return {
    seed, vRoads, hRoads, blocks, buildings, trees, parks,
    width: WORLD.width, height: WORLD.height,
    plaza, hotel, docks, warehouse, garage, marina, beachHouse,
  };
}

export function isRoad(city, x, y) {
  if (x < 0 || y < 0 || x >= city.width || y >= city.height) return false;
  for (const cx of city.vRoads) if (Math.abs(x - cx) <= ROAD / 2) return true;
  for (const cy of city.hRoads) if (Math.abs(y - cy) <= ROAD / 2) return true;
  return false;
}

export function roadCenterX(city, x) {
  let best = city.vRoads[0];
  for (const cx of city.vRoads) if (Math.abs(x - cx) < Math.abs(x - best)) best = cx;
  return best;
}

export function roadCenterY(city, y) {
  let best = city.hRoads[0];
  for (const cy of city.hRoads) if (Math.abs(y - cy) < Math.abs(y - best)) best = cy;
  return best;
}

export function collidesBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function randomRoadPoint(city, rng) {
  if (chance(rng, 0.5)) {
    const cx = pick(rng, city.vRoads);
    const y = range(rng, ROAD, city.height - ROAD);
    return { x: cx, y, vertical: true };
  }
  const cy = pick(rng, city.hRoads);
  const x = range(rng, ROAD, SAND_X - ROAD);
  return { x, y: cy, vertical: false };
}

export function nearestRoadPoint(city, x, y) {
  const cx = roadCenterX(city, x);
  const cy = roadCenterY(city, y);
  if (Math.abs(x - cx) < Math.abs(y - cy)) return { x: cx, y: clamp(y, ROAD, city.height - ROAD), vertical: true };
  return { x: clamp(x, ROAD, SAND_X - ROAD), y: cy, vertical: false };
}

export function makeCar(type, x, y, angle, color) {
  const spec = CAR_TYPES[type];
  return {
    kind: 'car', type, spec,
    x, y, angle, speed: 0,
    color: color ?? pick(Math.random, spec.colors),
    health: 100, driver: null, parked: false, police: type === 'police',
    // traffic AI
    dir: 0, lane: 0, targetSpeed: 0, wait: 0, id: 0,
  };
}

export function makePed(x, y, rng, gang = false) {
  return {
    kind: 'ped', x, y, angle: range(rng, 0, Math.PI * 2),
    speed: 0, walkPhase: range(rng, 0, Math.PI * 2),
    shirt: gang ? '#c0392b' : pick(rng, ['#e74c3c', '#27ae60', '#8e44ad', '#f39c12', '#16a085', '#d35400', '#ecf0f1']),
    health: gang ? 60 : 30, gang, armed: gang, shootTimer: 0, target: null,
    state: 'walk', wait: range(rng, 0, 3),
  };
}

export function createGameState(seed) {
  const rng = mulberry32(seed);
  const city = createCity(seed);
  const start = { x: city.plaza.x, y: city.plaza.y + 120 };

  const cars = [];
  let carId = 1;
  // Parked cars along road edges.
  for (let i = 0; i < TRAFFIC.parked; i += 1) {
    const spot = randomRoadPoint(city, rng);
    const type = pick(rng, ['sedan', 'sedan', 'taxi', 'van', 'sports']);
    const angle = spot.vertical ? (chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2) : (chance(rng, 0.5) ? 0 : Math.PI);
    const offset = spot.vertical ? (chance(rng, 0.5) ? -26 : 26) : 0;
    const offsetY = spot.vertical ? 0 : (chance(rng, 0.5) ? -26 : 26);
    const car = makeCar(type, spot.x + offset, spot.y + offsetY, angle, pick(rng, CAR_TYPES[type].colors));
    car.parked = true;
    car.id = carId++;
    cars.push(car);
  }
  // Moving traffic.
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const spot = randomRoadPoint(city, rng);
    const type = pick(rng, ['sedan', 'sedan', 'sedan', 'taxi', 'van']);
    const dir = spot.vertical ? (chance(rng, 0.5) ? 0 : 2) : (chance(rng, 0.5) ? 1 : 3);
    const car = makeCar(type, spot.x, spot.y, dir * Math.PI / 2, pick(rng, CAR_TYPES[type].colors));
    car.dir = dir;
    car.speed = range(rng, 100, TRAFFIC.cruise);
    car.targetSpeed = TRAFFIC.cruise;
    car.id = carId++;
    cars.push(car);
  }

  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const spot = randomRoadPoint(city, rng);
    peds.push(makePed(spot.x + range(rng, -24, 24), spot.y + range(rng, -24, 24), rng));
  }

  const pickups = [];
  const pickupSpots = [city.plaza, city.hotel, city.docks, city.garage, city.beachHouse, city.marina];
  for (let i = 0; i < pickupSpots.length; i += 1) {
    const spot = pickupSpots[i];
    pickups.push({
      kind: i % 2 === 0 ? 'health' : 'armour',
      x: spot.x + range(rng, -60, 60), y: spot.y + range(rng, -60, 60),
      taken: false, bob: range(rng, 0, Math.PI * 2),
    });
  }
  // Ammo near the plaza.
  pickups.push({ kind: 'ammo', x: start.x + 60, y: start.y - 40, taken: false, bob: 0 });

  return {
    seed, rng, city,
    time: 0, clock: 17 * 60 + 24, // 17:24, golden hour
    cash: 120, debt: 20000,
    health: 100, armour: 0, ammo: 12,
    wanted: 0, heat: 0, lastCrime: -99,
    screen: 'title',
    player: {
      x: start.x, y: start.y, angle: -Math.PI / 2, vx: 0, vy: 0,
      onFoot: true, car: null, punchTimer: 0, shootTimer: 0, hurtTimer: 0,
    },
    cars, peds, policeCars: [], footCops: [],
    bullets: [], particles: [], pickups,
    mission: null, missionIndex: 0, side: null,
    camera: { x: start.x, y: start.y },
    stats: { kills: 0, carsStolen: 0, fares: 0, missionsDone: 0 },
    message: '', messageTimer: 0,
    policeTimer: 0, spawnTimer: 0,
    explosion: null,
    gameOver: null,
  };
}

export function playerPos(state) {
  if (!state.player.onFoot && state.player.car) return { x: state.player.car.x, y: state.player.car.y };
  return { x: state.player.x, y: state.player.y };
}

export function distanceToPlayer(state, x, y) {
  const p = playerPos(state);
  return Math.sqrt(dist2(p.x, p.y, x, y));
}

export function isInSea(city, x) {
  return x >= SEA_X;
}
