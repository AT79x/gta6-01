// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. Screens: title, playing,
// paused, busted, wasted and story-complete. Save and load live in localStorage.
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP, STORY } from './config.js';
import { createGameState, playerPos } from './world.js';
import { createAudio } from './audio.js';
import {
  ACTION_CONFIRM, ACTION_ENTER, ACTION_MISSION, ACTION_PAUSE, ACTION_PUNCH, ACTION_TRIAL, createInput,
} from './input.js';
import {
  SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORY, SCREEN_TITLE, SCREEN_WASTED, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';
import { enterCar, exitCar, nearestCar, showMessage, updateDriving, updateParticles } from './vehicles.js';
import { updatePlayerOnFoot, updatePeds, updatePolice, updateTraffic, updateWanted } from './entities.js';
import { aimAngle, enemyShoot, punch, shootPistol, updateBullets, updatePickups } from './combat.js';
import {
  MISSION_LIST, maybeOfferTaxiFare, startMission, startTimeTrial, tryInteract, updateMission, updatePackages, updateSide,
} from './missions.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createGameState(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();
window.__game = state;
window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message));
});

function announce(message) {
  status.textContent = message;
}

function saveGame() {
  try {
    const p = playerPos(state);
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash, debt: state.debt, health: state.health, armour: state.armour,
      ammo: state.ammo, missionIndex: state.missionIndex, stats: state.stats,
      x: p.x, y: p.y, clock: state.clock, storyDone: !!state.storyDone,
    }));
    showMessage(state, 'Game saved');
    return true;
  } catch {
    showMessage(state, 'Save failed — storage is off');
    return false;
  }
}

function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

function loadGame() {
  try {
    const data = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
    if (!data) return false;
    state.cash = data.cash;
    state.debt = data.debt;
    state.health = data.health;
    state.armour = data.armour;
    state.ammo = data.ammo;
    state.missionIndex = data.missionIndex;
    state.stats = data.stats;
    state.clock = data.clock;
    state.storyDone = !!data.storyDone;
    state.player.x = data.x;
    state.player.y = data.y;
    state.player.onFoot = true;
    state.player.car = null;
    state.heat = 0;
    state.wanted = 0;
    state.policeCars = [];
    state.footCops = [];
    state.mission = null;
    state.side = null;
    return true;
  } catch {
    return false;
  }
}

function respawn() {
  state.health = 100;
  state.armour = 0;
  state.heat = 0;
  state.wanted = 0;
  state.gameOver = null;
  state.policeCars = [];
  state.footCops = [];
  state.mission = null;
  state.side = null;
  state.player.x = state.city.plaza.x;
  state.player.y = state.city.plaza.y + 120;
  state.player.onFoot = true;
  state.player.car = null;
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  state.screen = SCREEN_PLAY;
  showMessage(state, 'Back on the streets of Solmar Bay');
}

/** One fixed step of the live game. `input` may be a real input object or a shot autopilot. */
export function stepGame(input, dt) {
  state.time += dt;
  state.clock += dt * 0.5;
  if (state.messageTimer > 0) state.messageTimer -= dt;
  const player = state.player;

  if (state.screen === SCREEN_TITLE) {
    updateTraffic(state, dt);
    updatePeds(state, dt);
    updateParticles(state, dt);
    return;
  }
  if (state.screen !== SCREEN_PLAY) return;

  // --- one-shot actions ---
  const actions = input.takeActions ? input.takeActions() : 0;
  if (actions & ACTION_PAUSE) {
    state.screen = SCREEN_PAUSED;
    announce('Paused.');
    return;
  }
  if (actions & ACTION_ENTER) {
    if (player.onFoot) {
      if (!tryInteract(state)) {
        const car = nearestCar(state, player.x, player.y, 70);
        if (car) {
          enterCar(state, car);
          audio.pickup();
        }
      }
    } else {
      exitCar(state);
    }
  }
  if (actions & ACTION_MISSION) {
    if (!state.mission && state.missionIndex < MISSION_LIST.length) {
      startMission(state, state.missionIndex);
      announce(`Job started: ${MISSION_LIST[state.missionIndex].title}`);
    } else if (!state.mission) {
      showMessage(state, 'All story jobs done — the city is yours');
    }
  }
  if (actions & ACTION_TRIAL) startTimeTrial(state);
  if (actions & ACTION_PUNCH && player.onFoot) {
    const aim = aimAngle(state, renderer.screenToWorld(input.mouseX, input.mouseY));
    if (punch(state, aim)) audio.punch();
  }
  if (actions & ACTION_CONFIRM && !player.onFoot) audio.horn();

  // --- shooting (mouse) ---
  if (player.onFoot && input.takeClick && input.takeClick()) {
    const aim = aimAngle(state, renderer.screenToWorld(input.mouseX, input.mouseY));
    if (shootPistol(state, aim)) audio.shoot();
  }

  // --- movement ---
  if (player.onFoot) {
    updatePlayerOnFoot(state, input, dt);
  } else if (player.car) {
    updateDriving(state, player.car, input, dt);
    audio.setEngine(Math.abs(player.car.speed), player.car.spec.topSpeed);
  } else {
    audio.engineOff();
  }

  // --- the living city ---
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateWanted(state, dt);
  updateBullets(state, dt);
  enemyShoot(state, dt);
  updatePickups(state, dt);
  updateMission(state, dt);
  updateSide(state, dt);
  updatePackages(state, dt);
  maybeOfferTaxiFare(state, dt);
  updateParticles(state, dt);

  if (state.gameOver) {
    state.screen = state.gameOver === 'busted' ? SCREEN_BUSTED : SCREEN_WASTED;
    audio.busted();
    announce(state.gameOver === 'busted' ? 'Busted by the police.' : 'Wasted.');
    return;
  }
  if (state.storyDone && state.screen === SCREEN_PLAY) {
    state.screen = SCREEN_STORY;
    audio.missionDone();
  }

  // --- camera follows the player, smoothly ---
  const p = playerPos(state);
  const kx = 1 - Math.exp(-5 * dt);
  state.camera.x += (p.x - state.camera.x) * kx;
  state.camera.y += (p.y - state.camera.y) * kx;
  state.camera.x = Math.max(640, Math.min(state.city.width - 640, state.camera.x));
  state.camera.y = Math.max(360, Math.min(state.city.height - 360, state.camera.y));
}

function runShot(name) {
  const scene = stageShot(name, state, stepGame);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, { hasSave: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function startNewGame() {
    const fresh = createGameState(seed);
    Object.assign(state, fresh);
    state.screen = SCREEN_PLAY;
    announce(`Playing as ${STORY.hero} in ${STORY.city}. Press M for your first job.`);
  }

  function handleMenuActions() {
    const actions = input.takeActions();
    if (state.screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        startNewGame();
      } else if (input.takeClick && input.takeClick()) {
        audio.unlock();
        startNewGame();
      }
      // C loads a save from the title screen.
      return;
    }
    if (state.screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE) {
        state.screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (state.screen === SCREEN_BUSTED || state.screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) respawn();
      else if (input.takeClick && input.takeClick()) respawn();
      return;
    }
    if (state.screen === SCREEN_STORY) {
      if (actions & ACTION_CONFIRM) {
        state.screen = SCREEN_PLAY;
        state.storyDone = false;
      }
    }
  }

  // Title-screen keys handled outside the step: C continues a save, S saves in pause, Q quits.
  window.addEventListener('keydown', (event) => {
    if (state.screen === SCREEN_TITLE && event.code === 'KeyC' && hasSave()) {
      audio.unlock();
      if (loadGame()) {
        state.screen = SCREEN_PLAY;
        announce('Save loaded.');
      }
    } else if (state.screen === SCREEN_PAUSED && event.code === 'KeyS') {
      saveGame();
    } else if (state.screen === SCREEN_PAUSED && event.code === 'KeyQ') {
      state.screen = SCREEN_TITLE;
      announce('Title screen.');
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (state.screen === SCREEN_TITLE || state.screen === SCREEN_PAUSED
      || state.screen === SCREEN_BUSTED || state.screen === SCREEN_WASTED || state.screen === SCREEN_STORY) {
      handleMenuActions();
      if (state.screen === SCREEN_TITLE) {
        while (accumulator >= STEP) {
          stepGame(input, STEP);
          accumulator -= STEP;
        }
      } else {
        accumulator = 0;
      }
    } else {
      while (accumulator >= STEP) {
        stepGame(input, STEP);
        accumulator -= STEP;
      }
    }
    renderer.draw(state, state.screen, { hasSave: hasSave() });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce(`Solmar Bay. Press Enter or click to start. ${STORY.hero} owes $${STORY.debt}.`);
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
