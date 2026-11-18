// Missions and side work in Solmar Bay. Rex Marlowe, a courier, owes $20,000 to
// the fixer Vera Kessler; each story job pays the debt down. Six story missions
// plus taxi fares, street packages and a time trial. Pure logic — render.js draws
// the markers and the briefing text.
import { STORY } from './config.js';
import { dist2, pick } from './random.js';
import { makeCar, makePed, playerPos, randomRoadPoint } from './world.js';
import { addWanted, showMessage } from './vehicles.js';

export const MISSION_LIST = [
  {
    id: 'first-fare', title: 'First Fare',
    briefing: "Vera: 'Rex, the cab is waiting at the plaza. Pick up the client downtown and take them to The Palms Hotel. Drive like you mean it.'",
    reward: 300,
  },
  {
    id: 'the-package', title: 'The Package',
    briefing: "Vera: 'A sealed case is sitting at the Harbour Docks. Get it to the Beach House in 90 seconds. No questions, no stops.'",
    reward: 500,
  },
  {
    id: 'collect-debt', title: 'Collect the Debt',
    briefing: "Vera: 'Three jokers at Marlowe Plaza owe me money. Go remind them. Fists only — the plaza has eyes.'",
    reward: 700,
  },
  {
    id: 'heat-wave', title: 'Heat Wave',
    briefing: "Vera: 'The cops are on to you, Rex. Stay out of their hands for 60 seconds and the heat dies down. Run.'",
    reward: 900,
  },
  {
    id: 'warehouse-war', title: 'Warehouse War',
    briefing: "Vera: 'The Crimson Vipers moved into the Old Warehouse. Clear them out — all six. They shoot first, so bring the pistol.'",
    reward: 1500,
  },
  {
    id: 'big-score', title: 'The Big Score',
    briefing: "Vera: 'Last job. A gold sports car is parked at Sunset Marina. Take it, bring it to my garage. The whole city will be looking. Do this and the debt is gone.'",
    reward: 3000,
  },
];

function markerFor(state, step) {
  if (step.x !== undefined) return { x: step.x, y: step.y, label: step.label };
  return null;
}

export function startMission(state, index) {
  const def = MISSION_LIST[index];
  if (!def) return false;
  const city = state.city;
  const mission = { def, index, stepIndex: 0, timer: 0, passenger: false, targetCar: null, enemiesLeft: 0, steps: [] };
  if (def.id === 'first-fare') {
    const taxi = makeCar('taxi', city.plaza.x + 40, city.plaza.y + 170, -Math.PI / 2, '#f5c518');
    taxi.id = 5000 + index;
    taxi.parked = true;
    state.cars.push(taxi);
    mission.targetCar = taxi;
    mission.steps = [
      { type: 'enterCar', car: taxi, label: 'Get in the taxi' },
      { type: 'goto', x: city.plaza.x + 400, y: city.hRoads[2], radius: 60, label: 'Pick up the client' },
      { type: 'dropoff', x: city.hotel.x, y: city.hRoads[1], radius: 60, label: 'Drop the client at The Palms Hotel' },
    ];
  } else if (def.id === 'the-package') {
    mission.steps = [
      { type: 'interact', x: city.docks.x, y: city.hRoads[5], radius: 46, label: 'Pick up the package (E)' },
      { type: 'timed', x: city.beachHouse.x, y: city.beachHouse.y, radius: 60, label: 'Deliver to the Beach House', time: 90 },
    ];
  } else if (def.id === 'collect-debt') {
    mission.steps = [
      { type: 'goto', x: city.plaza.x, y: city.plaza.y, radius: 70, label: 'Go to Marlowe Plaza' },
      { type: 'defeat', count: 3, label: 'Collect from the 3 debtors', spawnAt: { x: city.plaza.x, y: city.plaza.y } },
    ];
  } else if (def.id === 'heat-wave') {
    mission.steps = [
      { type: 'survive', time: 60, label: 'Stay free for 60 seconds' },
    ];
    state.heat = 52;
    addWanted(state, 0, 'The police are after you!');
  } else if (def.id === 'warehouse-war') {
    mission.steps = [
      { type: 'goto', x: city.warehouse.x, y: city.warehouse.y, radius: 90, label: 'Go to the Old Warehouse' },
      { type: 'defeat', count: 6, label: 'Clear out the Crimson Vipers', spawnAt: city.warehouse, armed: true },
    ];
  } else if (def.id === 'big-score') {
    const gold = makeCar('sports', city.marina.x, city.marina.y, 0, '#f1c40f');
    gold.id = 5001;
    gold.parked = true;
    state.cars.push(gold);
    mission.targetCar = gold;
    mission.steps = [
      { type: 'enterCar', car: gold, label: 'Steal the gold sports car' },
      { type: 'deliverCar', car: gold, x: city.garage.x, y: city.hRoads[4], radius: 70, label: 'Deliver the car to Vera\'s Garage' },
    ];
    state.heat = 74;
    addWanted(state, 0, 'Wanted! Get the car to the garage!');
  }
  state.mission = mission;
  showMessage(state, `New job: ${def.title} — $${def.reward}`);
  return true;
}

function spawnEnemies(state, step) {
  const at = step.spawnAt;
  const spawned = [];
  for (let i = 0; i < step.count; i += 1) {
    const ped = makePed(at.x + (Math.random() - 0.5) * 160, at.y + (Math.random() - 0.5) * 160, state.rng, true);
    ped.health = step.armed ? 60 : 40;
    ped.armed = !!step.armed;
    ped.state = 'fight';
    const p = playerPos(state);
    ped.target = { x: p.x, y: p.y };
    state.peds.push(ped);
    spawned.push(ped);
  }
  step.spawned = spawned;
  step.remaining = step.count;
}

export function currentStep(state) {
  if (!state.mission) return null;
  return state.mission.steps[state.mission.stepIndex] ?? null;
}

export function missionMarker(state) {
  const step = currentStep(state);
  if (!step) return null;
  return markerFor(state, step);
}

export function missionObjectiveText(state) {
  const step = currentStep(state);
  if (!step) return '';
  if (step.type === 'defeat') {
    const left = step.spawned ? step.spawned.filter((p) => p.health > 0 && p.state !== 'down').length : step.count;
    return `${step.label} — ${left} left`;
  }
  if (step.type === 'survive') return `${step.label} — ${Math.ceil(state.mission.timer)}s`;
  if (step.type === 'timed') return `${step.label} — ${Math.ceil(step.timeLeft)}s`;
  return step.label;
}

function completeMission(state) {
  const mission = state.mission;
  const reward = mission.def.reward;
  state.cash += reward;
  state.debt = Math.max(0, state.debt - reward);
  state.stats.missionsDone += 1;
  showMessage(state, `Job done! +$${reward} — debt left $${state.debt}`);
  state.mission = null;
  state.missionIndex += 1;
  if (state.missionIndex >= MISSION_LIST.length) {
    state.storyDone = true;
    showMessage(state, 'Debt paid! Solmar Bay is yours, Rex.');
  }
}

function failMission(state, reason) {
  showMessage(state, `Job failed: ${reason}. Press M to try again.`);
  state.mission = null;
}

export function updateMission(state, dt) {
  const mission = state.mission;
  if (!mission) return;
  const step = mission.steps[mission.stepIndex];
  if (!step) {
    completeMission(state);
    return;
  }
  const p = playerPos(state);
  if (step.type === 'enterCar') {
    if (!state.player.onFoot && state.player.car === step.car) {
      mission.stepIndex += 1;
    }
    return;
  }
  if (step.type === 'goto' || step.type === 'dropoff') {
    if (dist2(p.x, p.y, step.x, step.y) < step.radius * step.radius) {
      if (step.type === 'dropoff') mission.passenger = false;
      mission.stepIndex += 1;
      if (step.type === 'goto' && mission.def.id === 'first-fare') {
        mission.passenger = true;
        showMessage(state, 'Client aboard — drive to The Palms Hotel');
      }
    }
    return;
  }
  if (step.type === 'interact') {
    if (dist2(p.x, p.y, step.x, step.y) < step.radius * step.radius) {
      step.ready = true;
    } else {
      step.ready = false;
    }
    return;
  }
  if (step.type === 'timed') {
    if (step.timeLeft === undefined) step.timeLeft = step.time;
    step.timeLeft -= dt;
    if (step.timeLeft <= 0) {
      failMission(state, 'out of time');
      return;
    }
    if (dist2(p.x, p.y, step.x, step.y) < step.radius * step.radius) {
      mission.stepIndex += 1;
    }
    return;
  }
  if (step.type === 'defeat') {
    if (!step.spawned) spawnEnemies(state, step);
    const left = step.spawned.filter((e) => e.health > 0 && e.state !== 'down').length;
    if (left === 0) mission.stepIndex += 1;
    return;
  }
  if (step.type === 'survive') {
    mission.timer += dt;
    if (state.gameOver) return;
    if (mission.timer >= step.time) {
      state.heat = 0;
      mission.stepIndex += 1;
    }
    return;
  }
  if (step.type === 'deliverCar') {
    if (!state.player.onFoot && state.player.car === step.car
      && dist2(p.x, p.y, step.x, step.y) < step.radius * step.radius) {
      mission.stepIndex += 1;
    }
    return;
  }
}

/** Pressing E near an 'interact' step completes it. */
export function tryInteract(state) {
  const step = currentStep(state);
  if (step && step.type === 'interact' && step.ready) {
    state.mission.stepIndex += 1;
    showMessage(state, 'Package secured — go!');
    return true;
  }
  return false;
}

// ---- Side activities ----

export function startTimeTrial(state) {
  if (state.side || state.mission) return false;
  const checkpoints = [];
  for (let i = 0; i < 5; i += 1) {
    const spot = randomRoadPoint(state.city, state.rng);
    checkpoints.push({ x: spot.x, y: spot.y });
  }
  state.side = { type: 'trial', checkpoints, index: 0, timeLeft: 75, reward: 400 };
  showMessage(state, 'Time trial! Hit all 5 checkpoints in 75s — $400');
  return true;
}

export function updateSide(state, dt) {
  const side = state.side;
  if (!side) return;
  const p = playerPos(state);
  if (side.type === 'trial') {
    side.timeLeft -= dt;
    if (side.timeLeft <= 0) {
      showMessage(state, 'Time trial failed — out of time');
      state.side = null;
      return;
    }
    const cp = side.checkpoints[side.index];
    if (cp && dist2(p.x, p.y, cp.x, cp.y) < 55 * 55) {
      side.index += 1;
      if (side.index >= side.checkpoints.length) {
        state.cash += side.reward;
        showMessage(state, `Time trial complete! +$${side.reward}`);
        state.side = null;
      }
    }
    return;
  }
  if (side.type === 'taxi') {
    if (side.phase === 'pickup') {
      if (dist2(p.x, p.y, side.ped.x, side.ped.y) < 50 * 50) {
        side.phase = 'dropoff';
        side.ped.state = 'riding';
        showMessage(state, 'Passenger aboard — take them to the marker');
      }
    } else if (dist2(p.x, p.y, side.dest.x, side.dest.y) < 60 * 60) {
      const fare = side.fare;
      state.cash += fare;
      state.stats.fares += 1;
      showMessage(state, `Fare complete! +$${fare}`);
      state.peds = state.peds.filter((ped) => ped !== side.ped);
      state.side = null;
    }
    return;
  }
}

export function maybeOfferTaxiFare(state, dt) {
  if (state.side || state.mission) return;
  if (!state.player.car || state.player.car.type !== 'taxi') return;
  state.taxiTimer = (state.taxiTimer ?? 14) - dt;
  if (state.taxiTimer > 0) return;
  state.taxiTimer = 22;
  const p = playerPos(state);
  let best = null;
  let bestD = Infinity;
  for (const ped of state.peds) {
    if (ped.gang || ped.state !== 'walk') continue;
    const d = dist2(p.x, p.y, ped.x, ped.y);
    if (d > 200 * 200 && d < 700 * 700 && d < bestD) {
      best = ped;
      bestD = d;
    }
  }
  if (!best) return;
  const dest = randomRoadPoint(state.city, state.rng);
  state.side = {
    type: 'taxi', phase: 'pickup', ped: best,
    dest: { x: dest.x, y: dest.y },
    fare: 40 + Math.floor(Math.random() * 5) * 10,
  };
  showMessage(state, 'Taxi fare! Pick up the passenger at the yellow marker');
}

/** Street packages: cash pickups that appear on the pavements. */
export function updatePackages(state, dt) {
  state.packageTimer = (state.packageTimer ?? 8) - dt;
  if (state.packageTimer <= 0) {
    state.packageTimer = 18;
    const active = state.pickups.filter((pk) => !pk.taken && pk.kind === 'cash').length;
    if (active < 3) {
      const spot = randomRoadPoint(state.city, state.rng);
      state.pickups.push({ kind: 'cash', x: spot.x, y: spot.y, taken: false, bob: 0 });
    }
  }
  const p = playerPos(state);
  for (const pk of state.pickups) {
    if (pk.taken || pk.kind !== 'cash') continue;
    if (dist2(p.x, p.y, pk.x, pk.y) < 30 * 30) {
      pk.taken = true;
      state.cash += 50;
      showMessage(state, 'Found a dropped package! +$50');
    }
  }
}

export { STORY, pick };
