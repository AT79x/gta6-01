// Drawing only: the city, its people and cars, the effects, the HUD with its
// minimap, and the title / pause / busted / wasted screens. The 1280x720 view is
// scaled to fit the window and centred. All art is drawn shapes — no images.
import { FONT, PALETTE, ROAD, SAND_X, SEA_X, VIEW } from './config.js';
import { clamp, lerp } from './random.js';
import { missionMarker, missionObjectiveText } from './missions.js';
import { playerPos } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_STORY = 'story';

const MINIMAP = { w: 210, h: 160, margin: 14 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    const key = `${size}:${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function textWidth(value, size, bold) {
    const key = `${size}:${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    return ctx.measureText(value).width;
  }

  function screenToWorld(sx, sy) {
    return { x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale };
  }

  function worldToScreen(wx, wy, cam) {
    return { x: (wx - cam.x) * view.scale + view.x + VIEW.width * view.scale / 2, y: (wy - cam.y) * view.scale + view.y + VIEW.height * view.scale / 2 };
  }

  function drawGround(state) {
    const city = state.city;
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, city.width, city.height);
    // District ground per block.
    for (const block of city.blocks) {
      if (block.park) ctx.fillStyle = PALETTE.park;
      else if (block.district === 'downtown') ctx.fillStyle = PALETTE.downtownGround;
      else if (block.district === 'beach') ctx.fillStyle = PALETTE.sand;
      else if (block.district === 'harbour') ctx.fillStyle = '#7d8894';
      else ctx.fillStyle = PALETTE.grass;
      ctx.fillRect(block.x, block.y, block.w, block.h);
    }
    // Beach sand strip and the sea.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(SAND_X, 0, SEA_X - SAND_X, city.height);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(SEA_X, 0, city.width - SEA_X, city.height);
    ctx.fillStyle = PALETTE.seaDeep;
    const wave = (state.time * 0.6) % 40;
    for (let y = 0; y < city.height; y += 80) {
      ctx.fillRect(SEA_X + 30 + ((y + wave) % 40), y, 60, 6);
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const cx of city.vRoads) ctx.fillRect(cx - ROAD / 2, 0, ROAD, city.height);
    for (const cy of city.hRoads) ctx.fillRect(0, cy - ROAD / 2, city.width, ROAD);
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const cx of city.vRoads) {
      ctx.fillRect(cx - ROAD / 2 - 8, 0, 8, city.height);
      ctx.fillRect(cx + ROAD / 2, 0, 8, city.height);
    }
    for (const cy of city.hRoads) {
      ctx.fillRect(0, cy - ROAD / 2 - 8, city.width, 8);
      ctx.fillRect(0, cy + ROAD / 2, city.width, 8);
    }
    // Lane markings.
    ctx.fillStyle = PALETTE.roadLine;
    for (const cx of city.vRoads) {
      for (let y = 20; y < city.height; y += 56) ctx.fillRect(cx - 2, y, 4, 26);
    }
    for (const cy of city.hRoads) {
      for (let x = 20; x < SAND_X; x += 56) ctx.fillRect(x, cy - 2, 26, 4);
    }
    // Crosswalks at the plaza.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 6; i += 1) ctx.fillRect(city.plaza.x - 60 + i * 22, city.plaza.y - 90, 12, 26);
  }

  function drawBuildings(state) {
    const city = state.city;
    for (const b of city.buildings) {
      // Long afternoon shadow to the east.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(b.x, b.y, b.w, 6);
      ctx.fillRect(b.x, b.y, 6, b.h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + b.w - 6, b.y, 6, b.h);
      ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
      if (b.tall) {
        // Roof details: vents and a helipad dot on the biggest towers.
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.2, b.h * 0.2);
        ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.55, b.w * 0.18, b.h * 0.18);
      }
    }
    // Trees and palms.
    for (const t of city.trees) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(t.x + 4, t.y + 4, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.palm ? PALETTE.palm : PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.treeLight;
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCarShape(car, isPlayer) {
    const spec = car.spec;
    const len = spec.length;
    const wid = spec.width;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-len / 2 + 4, -wid / 2 + 4, len, wid);
    ctx.fillStyle = car.color;
    roundRect(ctx, -len / 2, -wid / 2, len, wid, 8);
    ctx.fill();
    // Cabin and windshield.
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    roundRect(ctx, -len * 0.18, -wid / 2 + 5, len * 0.36, wid - 10, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.7)';
    ctx.fillRect(len * 0.18, -wid / 2 + 6, 5, wid - 12);
    // Headlights and tail lights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 6);
    ctx.fillRect(len / 2 - 3, wid / 2 - 9, 3, 6);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-len / 2, -wid / 2 + 3, 3, 6);
    ctx.fillRect(-len / 2, wid / 2 - 9, 3, 6);
    if (car.type === 'taxi') {
      ctx.fillStyle = '#111';
      ctx.fillRect(-8, -wid / 2 - 2, 16, 5);
      ctx.fillStyle = '#f5c518';
      text('TAXI', 0, -wid / 2 + 13, 8, '#111', 'center', true);
    }
    if (car.police) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-len * 0.3, -wid / 2 + 2, len * 0.6, 5);
      ctx.fillRect(-len * 0.3, wid / 2 - 7, len * 0.6, 5);
      const blink = Math.floor(performance.now() / 260) % 2 === 0;
      ctx.fillStyle = blink ? '#ff2d55' : '#2d7bff';
      ctx.beginPath();
      ctx.arc(-4, -wid / 2 - 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = blink ? '#2d7bff' : '#ff2d55';
      ctx.beginPath();
      ctx.arc(6, -wid / 2 - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isPlayer) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, len * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPedShape(ped, isPlayer) {
    const bob = Math.sin(ped.walkPhase || 0) * 2;
    ctx.save();
    ctx.translate(ped.x, ped.y + bob * 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    // Head.
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 6, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick.
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ped.angle) * 8, Math.sin(ped.angle) * 8);
    ctx.lineTo(Math.cos(ped.angle) * 15, Math.sin(ped.angle) * 15);
    ctx.stroke();
    if (ped.gang) {
      ctx.fillStyle = '#fff';
      text('V', 0, 4, 11, '#fff', 'center', true);
    }
    if (ped.state === 'cop') {
      ctx.fillStyle = '#fff';
      text('P', 0, 4, 10, '#fff', 'center', true);
    }
    if (ped.punching) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(Math.cos(ped.angle) * 20, Math.sin(ped.angle) * 20, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (isPlayer) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(pk.bob) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === 'health') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-11, -11, 22, 22);
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);
      } else if (pk.kind === 'armour') {
        ctx.fillStyle = '#4fc3f7';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, -6);
        ctx.lineTo(10, 4);
        ctx.lineTo(0, 12);
        ctx.lineTo(-10, 4);
        ctx.lineTo(-10, -6);
        ctx.closePath();
        ctx.fill();
      } else if (pk.kind === 'ammo') {
        ctx.fillStyle = '#f5c518';
        ctx.fillRect(-8, -4, 16, 8);
        ctx.fillStyle = '#111';
        ctx.fillRect(-5, -4, 3, 8);
        ctx.fillRect(1, -4, 3, 8);
      } else if (pk.kind === 'cash') {
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(-10, -7, 20, 14);
        ctx.fillStyle = '#fff';
        text('$', 0, 5, 13, '#fff', 'center', true);
      }
      ctx.restore();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'dust') {
        ctx.fillStyle = `rgba(210,190,160,${0.35 * a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'fire') {
        ctx.fillStyle = `rgba(255,${Math.floor(120 + 120 * a)},40,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a + 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'smoke') {
        ctx.fillStyle = `rgba(60,60,60,${0.4 * a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.4 - a * 0.4), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'flash') {
        ctx.fillStyle = `rgba(255,240,150,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.fillStyle = `rgba(255,220,80,${a})`;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      } else if (p.kind === 'blood') {
        ctx.fillStyle = `rgba(180,30,30,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'skid') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = `rgba(20,20,20,${0.35 * a})`;
        ctx.fillRect(-14, -12, 28, 4);
        ctx.fillRect(-14, 8, 28, 4);
        ctx.restore();
      }
    }
    if (state.explosion) {
      const e = state.explosion;
      const a = clamp(e.life / e.max, 0, 1);
      ctx.fillStyle = `rgba(255,180,60,${0.85 * a})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 70 * (1.3 - a * 0.3), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,90,30,${0.7 * a})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 44 * (1.3 - a * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarker(state, cam) {
    const marker = missionMarker(state);
    if (!marker) return;
    const pulse = 1 + Math.sin(state.time * 5) * 0.12;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.fillStyle = 'rgba(245,197,24,0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 22 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(0, -34 * pulse);
    ctx.lineTo(8, -18 * pulse);
    ctx.lineTo(-8, -18 * pulse);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Edge arrow when the marker is off screen.
    const sx = marker.x - cam.x + VIEW.width / 2;
    const sy = marker.y - cam.y + VIEW.height / 2;
    if (sx < 60 || sx > VIEW.width - 60 || sy < 60 || sy > VIEW.height - 60) {
      const cx = clamp(sx, 60, VIEW.width - 60);
      const cy = clamp(sy, 60, VIEW.height - 60);
      const ang = Math.atan2(sy - cy, sx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawWorld(state, cam) {
    ctx.save();
    ctx.translate(VIEW.width / 2 - cam.x, VIEW.height / 2 - cam.y);
    drawGround(state);
    drawBuildings(state);
    drawPickups(state);
    for (const car of state.cars) {
      if (!car.wrecked) drawCarShape(car, state.player.car === car);
    }
    for (const car of state.policeCars) drawCarShape(car, false);
    for (const ped of state.peds) {
      if (ped.state === 'down') {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(1.2);
        ctx.fillStyle = ped.shirt;
        ctx.fillRect(-12, -6, 24, 12);
        ctx.restore();
      } else if (ped.state !== 'riding') {
        drawPedShape(ped, false);
      }
    }
    for (const cop of state.footCops) drawPedShape(cop, false);
    for (const b of state.bullets) {
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    drawParticles(state);
    drawMarker(state, cam);
    if (state.player.onFoot) drawPedShape({ ...state.player, shirt: PALETTE.playerShirt, walkPhase: state.time * 9 }, true);
    ctx.restore();
    // Golden-hour wash.
    ctx.fillStyle = 'rgba(255,176,84,0.07)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawBar(x, y, w, h, ratio, color, label) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 4);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, x, y, Math.max(0, w * clamp(ratio, 0, 1)), h, 3);
    ctx.fill();
    text(label, x + w + 8, y + h - 2, 14, PALETTE.hudText, 'left', true);
  }

  function drawMinimap(state) {
    const x0 = VIEW.width - MINIMAP.w - MINIMAP.margin;
    const y0 = VIEW.height - MINIMAP.h - MINIMAP.margin;
    const sx = MINIMAP.w / state.city.width;
    const sy = MINIMAP.h / state.city.height;
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, x0 - 4, y0 - 4, MINIMAP.w + 8, MINIMAP.h + 8, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, MINIMAP.w, MINIMAP.h);
    ctx.clip();
    ctx.fillStyle = '#2e5d3a';
    ctx.fillRect(x0, y0, MINIMAP.w, MINIMAP.h);
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(x0 + SEA_X * sx, y0, MINIMAP.w - SEA_X * sx, MINIMAP.h);
    ctx.fillStyle = '#e8d39a';
    ctx.fillRect(x0 + SAND_X * sx, y0, (SEA_X - SAND_X) * sx, MINIMAP.h);
    ctx.fillStyle = '#c8ccd2';
    for (const cx of state.city.vRoads) ctx.fillRect(x0 + (cx - 3) * sx, y0, 6 * sx, MINIMAP.h);
    for (const cy of state.city.hRoads) ctx.fillRect(x0, y0 + (cy - 3) * sy, MINIMAP.w, 6 * sy);
    const marker = missionMarker(state);
    if (marker) {
      const pulse = 4 + Math.sin(state.time * 5) * 1.5;
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(x0 + marker.x * sx, y0 + marker.y * sy, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      ctx.fillStyle = '#d5d8dc';
      ctx.fillRect(x0 + car.x * sx - 1.5, y0 + car.y * sy - 1.5, 3, 3);
    }
    for (const car of state.policeCars) {
      ctx.fillStyle = '#ff2d55';
      ctx.beginPath();
      ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = playerPos(state);
    ctx.save();
    ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
    ctx.rotate(state.player.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 0.5, y0 - 0.5, MINIMAP.w + 1, MINIMAP.h + 1);
    text('SOLMAR BAY', x0, y0 - 8, 11, 'rgba(255,255,255,0.75)', 'left', true);
  }

  function drawHud(state) {
    // Top-left: cash, debt, clock.
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, 12, 12, 250, 64, 8);
    ctx.fill();
    text(`$${state.cash.toLocaleString('en-US')}`, 24, 40, 26, PALETTE.hudGold, 'left', true);
    const hours = Math.floor(state.clock / 60) % 24;
    const mins = Math.floor(state.clock % 60);
    text(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`, 24, 62, 16, PALETTE.hudText, 'left');
    text(`Debt $${state.debt.toLocaleString('en-US')}`, 130, 62, 14, '#ff9d9d', 'left');
    // Top-right: wanted stars.
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, VIEW.width - 12 - 190, 12, 190, 46, 8);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      text('★', VIEW.width - 24 - i * 30, 44, 26, i < state.wanted ? PALETTE.star : PALETTE.starEmpty, 'right', true);
    }
    // Mission objective, top centre.
    const objective = missionObjectiveText(state);
    if (objective) {
      const w = textWidth(objective, 16, true) + 28;
      ctx.fillStyle = PALETTE.hudBg;
      roundRect(ctx, (VIEW.width - w) / 2, 12, w, 40, 8);
      ctx.fill();
      text(`◆ ${objective}`, VIEW.width / 2, 38, 16, PALETTE.hudText, 'center', true);
    }
    // Bottom-left: health, armour, ammo.
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, 12, VIEW.height - 12 - 84, 250, 84, 8);
    ctx.fill();
    drawBar(24, VIEW.height - 82, 150, 14, state.health / 100, PALETTE.health, `${Math.ceil(state.health)}`);
    drawBar(24, VIEW.height - 58, 150, 14, state.armour / 100, PALETTE.armour, `${Math.ceil(state.armour)}`);
    text(`PISTOL  ${state.ammo}`, 24, VIEW.height - 26, 15, PALETTE.hudText, 'left', true);
    // Speed when driving.
    if (!state.player.onFoot && state.player.car) {
      const mph = Math.round(Math.abs(state.player.car.speed) * 0.12);
      text(`${mph}`, VIEW.width / 2, VIEW.height - 30, 34, PALETTE.hudText, 'center', true);
      text('mph', VIEW.width / 2 + 44, VIEW.height - 30, 15, PALETTE.hudText, 'left');
      text(state.player.car.spec.name, VIEW.width / 2, VIEW.height - 56, 14, 'rgba(255,255,255,0.7)', 'center');
    }
    // Toast message.
    if (state.messageTimer > 0) {
      const a = clamp(state.messageTimer / 0.6, 0, 1);
      ctx.globalAlpha = a;
      const w = textWidth(state.message, 17, true) + 30;
      ctx.fillStyle = PALETTE.hudBg;
      roundRect(ctx, (VIEW.width - w) / 2, 76, w, 38, 8);
      ctx.fill();
      text(state.message, VIEW.width / 2, 101, 17, PALETTE.hudText, 'center', true);
      ctx.globalAlpha = 1;
    }
    // Controls hint.
    text('WASD drive/move · E enter car · Click shoot · F punch · Shift sprint · M next job · T time trial · P pause', 14, VIEW.height - 100, 13, 'rgba(255,255,255,0.55)', 'left');
    drawMinimap(state);
  }

  function drawPanel(title, lines, prompt, accent, topY) {
    const w = 640;
    const lineH = 30;
    const h = 130 + lines.length * lineH + 74;
    const x = (VIEW.width - w) / 2;
    const y = topY !== undefined ? topY : (VIEW.height - h) / 2;
    ctx.fillStyle = 'rgba(10,14,22,0.88)';
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = accent || PALETTE.titleGold;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();
    text(title, VIEW.width / 2, y + 62, 42, accent || PALETTE.titleGold, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 118 + i * lineH, 18, PALETTE.hudText, 'center');
    }
    if (prompt) text(prompt, VIEW.width / 2, y + h - 30, 18, PALETTE.hudGold, 'center', true);
  }

  function drawTitle(state, extra) {
    drawWorld(state, { x: state.city.plaza.x, y: state.city.plaza.y });
    ctx.fillStyle = 'rgba(8,14,26,0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text('SOLMAR BAY', VIEW.width / 2, 140, 84, PALETTE.titleGold, 'center', true);
    text('A sun-soaked open-world crime story', VIEW.width / 2, 182, 24, '#fff', 'center');
    text('Rex Marlowe owes $20,000 to Vera Kessler. Drive, steal, run — and pay it back.', VIEW.width / 2, 216, 18, 'rgba(255,255,255,0.8)', 'center');
    const lines = [
      'NEW GAME — press Enter or click',
      extra.hasSave ? 'CONTINUE — press C to load your save' : '',
      'WASD / arrows — move & drive      E — enter / exit car      Mouse — aim, click — shoot',
      'F — punch      Shift — sprint / handbrake      M — next job      T — time trial      P — pause',
      'Steal cars, dodge the police, finish jobs and clear the debt.',
    ].filter((l) => l !== '');
    drawPanel('HOW TO PLAY', lines, 'Press Enter to start', PALETTE.titleGold, 248);
    text('An original game. No part of it comes from any commercial game.', VIEW.width / 2, VIEW.height - 24, 13, 'rgba(255,255,255,0.5)', 'center');
  }

  function draw(state, screen, extra) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1b2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, extra || {});
      return;
    }
    drawWorld(state, state.camera);
    if (screen === SCREEN_PLAY) {
      drawHud(state);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits for you.', `Cash $${state.cash}  ·  Jobs done ${state.stats.missionsDone} / 6`, 'S — save game      Q — quit to title'], 'Press P or Esc to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Solmar Bay PD got you.', `Cash kept: $${state.cash}`, 'The debt still stands.'], 'Press Enter to try again', '#4fc3f7');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Rex Marlowe is down.', `Cash kept: $${state.cash}`, 'The debt still stands.'], 'Press Enter to try again', '#ff5a4e');
    } else if (screen === SCREEN_STORY) {
      drawPanel('DEBT PAID', ['The gold car is in Vera\'s garage.', 'Rex Marlowe owns Solmar Bay now.', `Final cash: $${state.cash}`], 'Press Enter to keep playing', PALETTE.titleGold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld, worldToScreen, resize };
}
