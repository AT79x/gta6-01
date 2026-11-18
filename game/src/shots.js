// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays the
// real rules forward from a fresh city for a fixed number of steps, steered by a
// simple driving autopilot (steer toward a target point, hold the accelerator), so
// the frame is what a short game really looks like and the same seed always gives
// the same frame. No input device is needed: the autopilot is a plain object with
// the same shape as the real input.
import { SEA_X, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { startMission } from './missions.js';
import { spawnPoliceCar } from './entities.js';

const START_SECONDS = 6;
const DRIVE_SECONDS = 4.5;
const CHASE_SECONDS = 4;
const MISSION_SECONDS = 1.4;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Drive the player's car toward (tx, ty): accelerator on, steer by angle error, brake to stop near the target. */
function driveInput(state, tx, ty) {
  const car = state.player.car;
  if (!car) return { up: false, down: false, left: false, right: false, sprint: false, handbrake: false, mouseX: 640, mouseY: 360, takeActions: () => 0, takeClick: () => false };
  const desired = Math.atan2(ty - car.y, tx - car.x);
  const err = wrapAngle(desired - car.angle);
  const dist = Math.hypot(tx - car.x, ty - car.y);
  return {
    up: dist > 110, down: dist < 60,
    left: err < -0.08, right: err > 0.08,
    sprint: false, handbrake: false,
    mouseX: 640, mouseY: 360,
    takeActions: () => 0,
    takeClick: () => false,
  };
}

const IDLE_INPUT = {
  up: false, down: false, left: false, right: false, sprint: false, handbrake: false,
  mouseX: 640, mouseY: 360, takeActions: () => 0, takeClick: () => false,
};

function putPlayerInCar(state, car, x, y, angle) {
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.parked = false;
  car.speed = 0;
  state.player.onFoot = false;
  state.player.car = car;
  state.player.angle = angle;
  state.camera.x = x;
  state.camera.y = y;
}

/**
 * Set `state` to the named scene (start, play, chase or mission; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, state, stepGame) {
  const city = state.city;
  if (name !== 'play' && name !== 'chase' && name !== 'mission') {
    state.screen = SCREEN_TITLE;
    for (let i = 0; i < START_SECONDS / STEP; i += 1) stepGame(IDLE_INPUT, STEP);
    return { screen: SCREEN_TITLE };
  }

  state.screen = SCREEN_PLAY;
  if (name === 'play') {
    // Driving in traffic: take the nearest parked sedan and cruise downtown.
    let car = null;
    for (const c of state.cars) {
      if (c.parked && c.type === 'sedan') {
        car = c;
        break;
      }
    }
    if (!car) car = state.cars[0];
    const roadY = city.hRoads[2];
    putPlayerInCar(state, car, city.vRoads[2], roadY, 0);
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) {
      stepGame(driveInput(state, city.vRoads[6], roadY), STEP);
    }
    return { screen: SCREEN_PLAY };
  }

  if (name === 'chase') {
    // Police chase: a sports car at speed, wanted level 3, two interceptors behind.
    let car = null;
    for (const c of state.cars) {
      if (c.parked && c.type === 'sports') {
        car = c;
        break;
      }
    }
    if (!car) car = state.cars[0];
    const roadY = city.hRoads[3];
    putPlayerInCar(state, car, city.vRoads[3], roadY, 0);
    car.speed = 380;
    state.heat = 52;
    state.wanted = 3;
    const cop1 = spawnPoliceCar(state);
    cop1.x = city.vRoads[3] - 260;
    cop1.y = roadY + 20;
    cop1.speed = 420;
    const cop2 = spawnPoliceCar(state);
    cop2.x = city.vRoads[3] - 420;
    cop2.y = roadY - 20;
    cop2.speed = 420;
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      stepGame(driveInput(state, SEA_X - 100, roadY), STEP);
    }
    return { screen: SCREEN_PLAY };
  }

  // Mission: First Fare, client aboard, driving the taxi to The Palms Hotel.
  // The target is the road north of the hotel, not the hotel itself (cars stay on roads).
  startMission(state, 0);
  const mission = state.mission;
  mission.stepIndex = 2;
  mission.passenger = true;
  const taxi = mission.targetCar;
  const roadY = city.hRoads[1];
  putPlayerInCar(state, taxi, city.hotel.x - 700, roadY, 0);
  taxi.speed = 200;
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
    stepGame(driveInput(state, city.hotel.x, roadY), STEP);
  }
  return { screen: SCREEN_PLAY };
}
