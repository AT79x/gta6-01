// Combat: the pistol, bullets, punching, pickups and the wanted heat that crimes
// create. Pure logic — render.js draws the bullets and the muzzle flash.
import { PLAYER, WEAPONS, WANTED } from './config.js';
import { angleTo, dist2 } from './random.js';
import { playerPos } from './world.js';
import { addWanted, explode, hurtPlayer, showMessage } from './vehicles.js';

export function aimAngle(state, mouseWorld) {
  const p = playerPos(state);
  return angleTo(p.x, p.y, mouseWorld.x, mouseWorld.y);
}

export function shootPistol(state, angle) {
  const player = state.player;
  if (!player.onFoot || player.shootTimer > 0) return false;
  if (state.ammo <= 0) {
    showMessage(state, 'Out of ammo — find an ammo pickup');
    player.shootTimer = 0.3;
    return false;
  }
  player.shootTimer = WEAPONS.pistol.cooldown;
  state.ammo -= 1;
  const p = playerPos(state);
  const bx = p.x + Math.cos(angle) * 22;
  const by = p.y + Math.sin(angle) * 22;
  state.bullets.push({
    x: bx, y: by, angle,
    speed: WEAPONS.pistol.bulletSpeed,
    life: WEAPONS.pistol.range / WEAPONS.pistol.bulletSpeed,
    fromPlayer: true,
  });
  state.particles.push({
    kind: 'flash', x: bx, y: by, vx: 0, vy: 0, life: 0.08, max: 0.08, size: 14,
  });
  addWanted(state, WANTED.shoot, '');
  return true;
}

export function punch(state, angle) {
  const player = state.player;
  if (!player.onFoot || player.punchTimer > 0) return false;
  player.punchTimer = PLAYER.punchCooldown;
  const p = playerPos(state);
  const hx = p.x + Math.cos(angle) * PLAYER.punchRange;
  const hy = p.y + Math.sin(angle) * PLAYER.punchRange;
  let hit = false;
  for (const ped of state.peds) {
    if (ped.health <= 0 || ped.state === 'down') continue;
    if (dist2(ped.x, ped.y, hx, hy) < 30 * 30) {
      ped.health -= PLAYER.punchDamage;
      ped.state = 'fight';
      ped.target = { x: p.x, y: p.y };
      hit = true;
      if (ped.health <= 0) {
        ped.state = 'down';
        state.stats.kills += 1;
        addWanted(state, WANTED.kill, '');
      }
      break;
    }
  }
  return hit;
}

export function updateBullets(state, dt) {
  for (const b of state.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    // Hit a pedestrian or gang member.
    for (const ped of state.peds) {
      if (ped.health <= 0 || ped.state === 'down') continue;
      if (dist2(ped.x, ped.y, b.x, b.y) < 16 * 16) {
        ped.health -= WEAPONS.pistol.damage;
        b.life = 0;
        state.particles.push({ kind: 'blood', x: ped.x, y: ped.y, vx: 0, vy: 0, life: 0.4, max: 0.4, size: 8 });
        if (ped.health <= 0) {
          ped.state = 'down';
          state.stats.kills += 1;
          addWanted(state, WANTED.kill, '');
        } else {
          ped.state = 'fight';
          const p = playerPos(state);
          ped.target = { x: p.x, y: p.y };
        }
        break;
      }
    }
    if (b.life <= 0) continue;
    // Hit a foot cop.
    for (const cop of state.footCops) {
      if (dist2(cop.x, cop.y, b.x, b.y) < 16 * 16) {
        cop.health -= WEAPONS.pistol.damage;
        b.life = 0;
        if (cop.health <= 0) {
          state.footCops = state.footCops.filter((c) => c !== cop);
          state.stats.kills += 1;
          addWanted(state, WANTED.kill, '');
        }
        break;
      }
    }
    if (b.life <= 0) continue;
    // Hit the player (enemy bullets).
    if (!b.fromPlayer) {
      const p = playerPos(state);
      if (state.player.onFoot && dist2(p.x, p.y, b.x, b.y) < 16 * 16) {
        hurtPlayer(state, WEAPONS.pistol.damage * 0.6, 'gang');
        b.life = 0;
      }
    }
    if (b.life <= 0) continue;
    // Hit a car.
    const allCars = state.cars.concat(state.policeCars);
    for (const car of allCars) {
      if (car.wrecked) continue;
      const dx = b.x - car.x;
      const dy = b.y - car.y;
      const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
      const across = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along < 32 && across < 18) {
        b.life = 0;
        if (car.police) {
          car.health -= WEAPONS.pistol.damage;
          if (car.health <= 0) {
            explode(state, car.x, car.y);
            state.policeCars = state.policeCars.filter((c) => c !== car);
          }
        } else {
          car.health -= WEAPONS.pistol.damage * 0.5;
        }
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

export function enemyShoot(state, dt) {
  for (const ped of state.peds) {
    if (!ped.armed || ped.health <= 0 || ped.state === 'down') continue;
    const p = playerPos(state);
    const d2 = dist2(ped.x, ped.y, p.x, p.y);
    if (d2 > 380 * 380) continue;
    ped.shootTimer -= dt;
    if (ped.shootTimer <= 0) {
      ped.shootTimer = 0.9 + Math.random() * 0.7;
      const angle = angleTo(ped.x, ped.y, p.x, p.y) + (Math.random() - 0.5) * 0.3;
      state.bullets.push({
        x: ped.x + Math.cos(angle) * 20, y: ped.y + Math.sin(angle) * 20,
        angle, speed: WEAPONS.pistol.bulletSpeed * 0.8,
        life: 0.5, fromPlayer: false,
      });
      state.particles.push({ kind: 'flash', x: ped.x, y: ped.y, vx: 0, vy: 0, life: 0.08, max: 0.08, size: 12 });
    }
  }
}

export function updatePickups(state, dt) {
  const p = playerPos(state);
  for (const pickup of state.pickups) {
    if (pickup.taken) continue;
    pickup.bob += dt * 3;
    if (dist2(p.x, p.y, pickup.x, pickup.y) < 30 * 30) {
      pickup.taken = true;
      if (pickup.kind === 'health') {
        state.health = Math.min(100, state.health + 40);
        showMessage(state, '+40 Health');
      } else if (pickup.kind === 'armour') {
        state.armour = Math.min(100, state.armour + 50);
        showMessage(state, '+50 Armour');
      } else if (pickup.kind === 'ammo') {
        state.ammo = Math.min(WEAPONS.pistol.ammoMax, state.ammo + 12);
        showMessage(state, '+12 Pistol ammo');
      }
    }
  }
}
