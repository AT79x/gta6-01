// The living city: the player on foot, pedestrians on the pavements, traffic
// following the roads, and the police who respond to the wanted level. Pure
// logic — render.js paints the results.
import { PEDS, PLAYER, POLICE, ROAD, TRAFFIC, WANTED } from './config.js';
import { angleLerp, angleTo, clamp, dist2, pick, range } from './random.js';
import { collidesBuilding, isRoad, makeCar, makePed, nearestRoadPoint, playerPos, randomRoadPoint } from './world.js';
import { addWanted, damageCar, explode, hurtPlayer } from './vehicles.js';

const DIRS = [
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: -1 },
];

export function updatePlayerOnFoot(state, input, dt) {
  const player = state.player;
  const speed = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    player.angle = Math.atan2(my, mx);
    const nx = player.x + mx * speed * dt;
    const ny = player.y + my * speed * dt;
    if (!collidesBuilding(state.city, nx, player.y, PLAYER.radius)) player.x = nx;
    if (!collidesBuilding(state.city, player.x, ny, PLAYER.radius)) player.y = ny;
    player.vx = mx * speed;
    player.vy = my * speed;
  } else {
    player.vx = 0;
    player.vy = 0;
  }
  player.x = clamp(player.x, 20, state.city.width - 20);
  player.y = clamp(player.y, 20, state.city.height - 20);
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
}

function movePedestrian(state, ped, dt) {
  if (ped.state === 'flee') {
    const p = playerPos(state);
    const away = angleTo(p.x, p.y, ped.x, ped.y);
    ped.angle = away;
    ped.x += Math.cos(away) * 130 * dt;
    ped.y += Math.sin(away) * 130 * dt;
    ped.walkPhase += dt * 10;
    return;
  }
  if (ped.state === 'fight' && ped.target) {
    const t = ped.target;
    const d = Math.sqrt(dist2(ped.x, ped.y, t.x, t.y));
    if (d > 26) {
      const a = angleTo(ped.x, ped.y, t.x, t.y);
      ped.angle = a;
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
    } else if (ped.shootTimer <= 0) {
      ped.shootTimer = 0.9;
      ped.punching = true;
      setTimeout(() => { ped.punching = false; }, 200);
      hurtPlayer(state, ped.gang ? 9 : 5, ped.gang ? 'gang' : 'ped');
    }
    ped.shootTimer -= dt;
    return;
  }
  // Wander along the roads: keep walking, turn at intersections sometimes.
  ped.wait -= dt;
  if (ped.wait <= 0) {
    ped.wait = 1 + Math.random() * 2.5;
    if (Math.random() < 0.4) {
      const dir = Math.floor(Math.random() * 4);
      ped.angle = dir * Math.PI / 2 + (Math.random() < 0.5 ? 0 : Math.PI / 4);
    }
  }
  const nx = ped.x + Math.cos(ped.angle) * PEDS.speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * PEDS.speed * dt;
  if (isRoad(state.city, nx, ny) && !collidesBuilding(state.city, nx, ny, 10)) {
    ped.x = nx;
    ped.y = ny;
  } else {
    ped.angle += Math.PI / 2;
  }
  ped.walkPhase += dt * 8;
}

export function updatePeds(state, dt) {
  for (const ped of state.peds) movePedestrian(state, ped, dt);
  // Keep the streets populated: replace peds that wandered far away.
  if (state.peds.length < PEDS.count && Math.random() < dt * 0.5) {
    const p = playerPos(state);
    const spot = randomRoadPoint(state.city, state.rng);
    if (dist2(p.x, p.y, spot.x, spot.y) > 400 * 400) {
      state.peds.push(makePed(spot.x, spot.y, state.rng));
    }
  }
}

/** Traffic: drive along the road, slow for the car ahead, turn at junctions. */
export function updateTraffic(state, dt) {
  const cars = state.cars;
  for (const car of cars) {
    if (car.parked || car.police || car === state.player.car) continue;
    const dir = DIRS[car.dir];
    const speed = car.wait > 0 ? 0 : car.speed;
    car.wait = Math.max(0, car.wait - dt);
    // Car ahead?
    let blocked = false;
    for (const other of cars) {
      if (other === car || other.parked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * dir.dx + dy * dir.dy;
      const side = Math.abs(dx * -dir.dy + dy * dir.dx);
      if (ahead > 0 && ahead < TRAFFIC.minGap && side < 26) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      car.speed = Math.max(0, car.speed - 300 * dt);
    } else {
      car.speed += (car.targetSpeed - car.speed) * Math.min(1, 1.2 * dt);
    }
    const nx = car.x + dir.dx * speed * dt;
    const ny = car.y + dir.dy * speed * dt;
    // At an intersection, maybe turn.
    const nearX = Math.abs(nx - Math.round(nx / 392) * 392) < 30;
    const nearY = Math.abs(ny - Math.round(ny / 392) * 392) < 30;
    if ((nearX || nearY) && Math.random() < dt * 1.4) {
      const options = [0, 1, 2, 3].filter((d) => d !== (car.dir + 2) % 4);
      car.dir = pick(Math.random, options);
      car.angle = car.dir * Math.PI / 2;
    }
    car.x = clamp(nx, 30, state.city.width - 30);
    car.y = clamp(ny, 30, state.city.height - 30);
    car.angle = angleLerp(car.angle, car.dir * Math.PI / 2, Math.min(1, 6 * dt));
    // A traffic car hit by the player's car: it stops and the driver gets out.
    if (state.player.car) {
      const pc = state.player.car;
      if (dist2(car.x, car.y, pc.x, pc.y) < 55 * 55 && Math.abs(pc.speed) > 60) {
        damageCar(state, car, 20);
        car.speed = 0;
        car.wait = 2;
      }
    }
  }
  // Player car running over a pedestrian.
  if (state.player.car) {
    const pc = state.player.car;
    if (Math.abs(pc.speed) > 80) {
      for (const ped of state.peds) {
        if (ped.health <= 0) continue;
        if (dist2(ped.x, ped.y, pc.x, pc.y) < 30 * 30) {
          ped.health = 0;
          ped.state = 'down';
          addWanted(state, WANTED.hitPed, 'Pedestrian hit!');
          state.stats.kills += 1;
        }
      }
    }
  }
  state.peds = state.peds.filter((p) => p.health > 0 || p.state === 'down');
  // Downed peds fade out.
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.fade = (ped.fade ?? 0) + dt;
    }
  }
  state.peds = state.peds.filter((p) => p.state !== 'down' || (p.fade ?? 0) < 4);
}

export function wantedLevel(state) {
  let level = 0;
  for (let i = WANTED.thresholds.length - 1; i >= 0; i -= 1) {
    if (state.heat >= WANTED.thresholds[i]) {
      level = i;
      break;
    }
  }
  return level;
}

export function updateWanted(state, dt) {
  state.wanted = wantedLevel(state);
  if (state.wanted === 0) return;
  // Heat decays when no police can see the player.
  const p = playerPos(state);
  let seen = false;
  for (const cop of state.policeCars) {
    if (dist2(p.x, p.y, cop.x, cop.y) < POLICE.sightRange * POLICE.sightRange) {
      seen = true;
      break;
    }
  }
  for (const cop of state.footCops) {
    if (dist2(p.x, p.y, cop.x, cop.y) < 300 * 300) {
      seen = true;
      break;
    }
  }
  if (!seen && state.time - state.lastCrime > WANTED.decayDelay) {
    state.heat = Math.max(0, state.heat - WANTED.decayPerSec * dt);
  }
}

export function spawnPoliceCar(state) {
  const p = playerPos(state);
  const spot = randomRoadPoint(state.city, state.rng);
  const car = makeCar('police', spot.x, spot.y, 0, '#1a1a2e');
  car.id = 9000 + state.policeCars.length;
  car.speed = 0;
  car.targetSpeed = POLICE.carChaseSpeed;
  state.policeCars.push(car);
  return car;
}

export function spawnFootCop(state) {
  const p = playerPos(state);
  const spot = nearestRoadPoint(state.city, p.x + (Math.random() < 0.5 ? -260 : 260), p.y);
  const cop = makePed(spot.x, spot.y, state.rng);
  cop.shirt = '#1c3d6e';
  cop.state = 'cop';
  cop.speed = POLICE.footSpeed;
  state.footCops.push(cop);
  return cop;
}

export function updatePolice(state, dt) {
  const p = playerPos(state);
  state.policeTimer -= dt;
  if (state.wanted > 0) {
    const wantCars = Math.min(state.wanted, 3);
    if (state.policeCars.length < wantCars && state.policeTimer <= 0) {
      spawnPoliceCar(state);
      state.policeTimer = POLICE.spawnGap;
    }
    if (state.wanted >= 2 && state.footCops.length < state.wanted - 1 && state.policeTimer <= 0) {
      spawnFootCop(state);
      state.policeTimer = POLICE.spawnGap;
    }
  }
  // Police cars chase and ram.
  for (const car of state.policeCars) {
    // Keep police cars from piling onto each other.
    for (const other of state.policeCars) {
      if (other === car) continue;
      const d2 = dist2(car.x, car.y, other.x, other.y);
      if (d2 < 56 * 56 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (56 - d) / 2;
        const nx = (car.x - other.x) / d;
        const ny = (car.y - other.y) / d;
        car.x += nx * push;
        car.y += ny * push;
      }
    }
    const targetAngle = angleTo(car.x, car.y, p.x, p.y);
    car.angle = angleLerp(car.angle, targetAngle, Math.min(1, 2.2 * dt));
    const target = state.wanted > 0 ? POLICE.carChaseSpeed : 0;
    car.speed += (target - car.speed) * Math.min(1, 1.5 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!collidesBuilding(state.city, nx, ny, 26)) {
      car.x = nx;
      car.y = ny;
    } else {
      car.angle += Math.PI / 3;
    }
    // Ram the player's car.
    if (state.player.car) {
      const pc = state.player.car;
      if (dist2(car.x, car.y, pc.x, pc.y) < 52 * 52) {
        damageCar(state, pc, 6 * dt * 10);
        pc.speed *= 0.98;
        if (Math.random() < dt * 6) {
          state.particles.push({
            kind: 'spark', x: (car.x + pc.x) / 2, y: (car.y + pc.y) / 2,
            vx: 0, vy: 0, life: 0.25, max: 0.25, size: 4,
          });
        }
      }
    }
  }
  // Foot cops chase the player on foot.
  for (const cop of state.footCops) {
    const d = Math.sqrt(dist2(cop.x, cop.y, p.x, p.y));
    if (state.player.onFoot && d < 26) {
      state.gameOver = 'busted';
      state.screen = 'busted';
      return;
    }
    const a = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle = a;
    cop.x += Math.cos(a) * cop.speed * dt;
    cop.y += Math.sin(a) * cop.speed * dt;
    cop.walkPhase += dt * 9;
  }
  // Wanted drops: police give up and drive off.
  if (state.wanted === 0) {
    state.policeCars = state.policeCars.filter((c) => dist2(c.x, c.y, p.x, p.y) < 900 * 900);
    state.footCops = [];
  }
}

export function explodeNearby(state, x, y, radius, damage) {
  const p = playerPos(state);
  if (dist2(p.x, p.y, x, y) < radius * radius) hurtPlayer(state, damage, 'explosion');
  for (const ped of state.peds) {
    if (dist2(ped.x, ped.y, x, y) < radius * radius) ped.health = 0;
  }
  explode(state, x, y);
}
