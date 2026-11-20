// Car physics and stealing: arcade driving (accelerate, steer, handbrake), entering
// and leaving cars, and the damage a car takes from hard hits. Pure logic, no drawing.
import { CAR_TYPES, WANTED } from './config.js';
import { angleLerp, clamp, dist2 } from './random.js';
import { collidesBuilding, makeCar } from './world.js';

export function createCarAt(state, type, x, y, angle) {
  const car = makeCar(type, x, y, angle);
  car.id = state.cars.length + state.policeCars.length + 1000;
  state.cars.push(car);
  return car;
}

export function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of state.cars) {
    if (car.police) continue;
    const d = dist2(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Step the player out of their car beside it. */
export function exitCar(state) {
  const player = state.player;
  const car = player.car;
  if (!car) return;
  player.onFoot = true;
  player.car = null;
  player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  player.angle = car.angle;
  player.vx = 0;
  player.vy = 0;
  car.speed = 0;
}

/**
 * Enter the nearest car. Stealing a car someone is driving (traffic) or a parked
 * car that is not the player's own raises the wanted level.
 */
export function enterCar(state, car) {
  const player = state.player;
  if (!car) return false;
  const wasTraffic = !car.parked;
  if (wasTraffic && car.driver) {
    // The driver bails out and runs.
    const driver = car.driver;
    driver.x = car.x + 40;
    driver.y = car.y + 40;
    driver.state = 'flee';
    state.peds.push(driver);
    car.driver = null;
  }
  car.parked = false;
  player.onFoot = false;
  player.car = car;
  player.angle = car.angle;
  if (wasTraffic) {
    state.stats.carsStolen += 1;
    addWanted(state, WANTED.stealCar, 'Car stolen');
  } else {
    state.stats.carsStolen += 1;
    addWanted(state, WANTED.stealCar, 'Car stolen');
  }
  return true;
}

export function addWanted(state, amount, reason) {
  state.heat = clamp(state.heat + amount, 0, 100);
  state.lastCrime = state.time;
  if (reason) showMessage(state, reason);
}

export function showMessage(state, text) {
  state.message = text;
  state.messageTimer = 2.6;
}

/** Arcade driving: forward is W, brake/reverse is S, steering scales with speed. */
export function updateDriving(state, car, input, dt) {
  const spec = car.spec;
  let forward = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  let steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const handbrake = input.handbrake;

  // Touch stick: steer the car toward the pushed direction on screen.
  // Keyboard steering is relative to the car's nose, which feels inverted on
  // a phone whenever the car points down-screen, so touch overrides it.
  const touchAngle = typeof input.driveAngle === 'number' ? input.driveAngle : null;
  let touchSteering = false;
  if (touchAngle !== null) {
    touchSteering = true;
    // Pushed direction, wrapped to [-PI, PI] relative to the car's nose.
    let diff = touchAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (input.driveMag > 0.25 && Math.abs(diff) > Math.PI / 2) {
      // The stick points behind the car: reverse toward it, like S on a
      // keyboard. The nose steers opposite so the tail aims at the stick.
      // Without this, touch could never back up — and a car nose-first
      // against a wall had no way out at all.
      forward = -1;
      let revDiff = diff + Math.PI;
      while (revDiff > Math.PI) revDiff -= Math.PI * 2;
      while (revDiff < -Math.PI) revDiff += Math.PI * 2;
      steer = Math.max(-1, Math.min(1, -revDiff * 2.5));
    } else {
      forward = input.driveMag > 0.25 ? 1 : 0;
      steer = Math.max(-1, Math.min(1, diff * 2.5));
    }
  }

  if (forward > 0) car.speed += spec.accel * dt;
  else if (forward < 0) {
    if (car.speed > 30) car.speed -= spec.accel * 1.6 * dt; // brake
    else car.speed -= spec.accel * 0.6 * dt; // reverse
  } else {
    car.speed -= Math.sign(car.speed) * 140 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * 700 * dt;
    spawnSkid(state, car);
  }
  car.speed = clamp(car.speed, -spec.reverse, spec.topSpeed);
  // Steering scales with speed, but touch keeps a minimum authority: at
  // speed 0 the old code could not rotate the car at all, so a slow or
  // stopped car felt like it could not turn left/right. Keyboard is
  // untouched (its floor stays 0).
  const speedFactor = clamp(Math.abs(car.speed) / 220, touchSteering ? 0.25 : 0, 1);
  const turnRate = spec.turn * speedFactor * (car.speed < 0 ? -1 : 1) * (handbrake ? 1.5 : 1);
  car.angle += steer * turnRate * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Check the centre and both ends of the car, so its corners cannot clip a building.
  const half = spec.length / 2 - 4;
  const fx = nx + Math.cos(car.angle) * half;
  const fy = ny + Math.sin(car.angle) * half;
  const rx = nx - Math.cos(car.angle) * half;
  const ry = ny - Math.sin(car.angle) * half;
  const hit = collidesBuilding(state.city, nx, ny, 22)
    || collidesBuilding(state.city, fx, fy, 14)
    || collidesBuilding(state.city, rx, ry, 14);
  if (hit) {
    if (Math.abs(car.speed) > 240) damageCar(state, car, 12);
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.y = ny;
  }
  // Keep the car inside the city (the sea stops it at the beach).
  car.x = clamp(car.x, 40, state.city.width - 40);
  car.y = clamp(car.y, 40, state.city.height - 40);
  if (Math.abs(car.speed) > 120 && Math.random() < dt * 8) {
    state.particles.push({
      kind: 'dust', x: car.x - Math.cos(car.angle) * 26, y: car.y - Math.sin(car.angle) * 26,
      vx: 0, vy: 0, life: 0.5, max: 0.5, size: 5,
    });
  }
}

export function damageCar(state, car, amount) {
  car.health -= amount;
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true;
    explode(state, car.x, car.y);
    if (state.player.car === car) {
      exitCar(state);
      state.player.x = car.x + 50;
      state.player.y = car.y;
      hurtPlayer(state, 25, 'car');
    }
    state.cars = state.cars.filter((c) => c !== car);
  }
}

export function explode(state, x, y) {
  state.explosion = { x, y, life: 0.6, max: 0.6 };
  for (let i = 0; i < 26; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 260;
    state.particles.push({
      kind: 'fire', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.5, max: 0.9, size: 6 + Math.random() * 8,
    });
  }
  for (let i = 0; i < 14; i += 1) {
    const a = Math.random() * Math.PI * 2;
    state.particles.push({
      kind: 'smoke', x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 20,
      vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 - 20,
      life: 0.8 + Math.random() * 0.8, max: 1.6, size: 10 + Math.random() * 10,
    });
  }
}

export function spawnSkid(state, car) {
  state.particles.push({
    kind: 'skid', x: car.x, y: car.y, angle: car.angle,
    vx: 0, vy: 0, life: 1.4, max: 1.4, size: 4,
  });
}

export function hurtPlayer(state, amount, source) {
  const player = state.player;
  if (player.hurtTimer > 0) return;
  player.hurtTimer = 0.5;
  let remaining = amount;
  if (state.armour > 0) {
    const absorbed = Math.min(state.armour, remaining * 0.6);
    state.armour -= absorbed;
    remaining -= absorbed;
  }
  state.health -= remaining;
  if (state.health <= 0) {
    state.health = 0;
    state.gameOver = source === 'police' ? 'busted' : 'wasted';
    state.screen = state.gameOver;
  }
}

export function updateParticles(state, dt) {
  for (const p of state.particles) {
    p.life -= dt;
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || 0) * dt;
    if (p.vx) p.vx *= 1 - 2.4 * dt;
    if (p.vy) p.vy *= 1 - 2.4 * dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  if (state.explosion) {
    state.explosion.life -= dt;
    if (state.explosion.life <= 0) state.explosion = null;
  }
}

export { CAR_TYPES, angleLerp };
