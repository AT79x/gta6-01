// Keyboard and pointer input. Held keys give movement and driving; one-shot
// presses (enter car, pause, mission, trial, horn, punch) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_MISSION = 8;
export const ACTION_TRIAL = 16;
export const ACTION_HORN = 32;
export const ACTION_PUNCH = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const MISSION = new Set(['KeyM']);
const TRIAL = new Set(['KeyT']);
const PUNCH = new Set(['KeyF']);

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, sprint: false };
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let clicked = false;

  function press(code, event) {
    if (UP.has(code)) held.up = true;
    else if (DOWN.has(code)) held.down = true;
    else if (LEFT.has(code)) held.left = true;
    else if (RIGHT.has(code)) held.right = true;
    else if (SPRINT.has(code)) held.sprint = true;
    else if (CONFIRM.has(code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER.has(code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (MISSION.has(code)) {
      if (!event.repeat) actions |= ACTION_MISSION;
    } else if (TRIAL.has(code)) {
      if (!event.repeat) actions |= ACTION_TRIAL;
    } else if (PUNCH.has(code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else return false;
    return true;
  }

  window.addEventListener('keydown', (event) => {
    if (press(event.code, event)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (SPRINT.has(event.code)) held.sprint = false;
  });
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.sprint = false;
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      clicked = true;
    }
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) mouseDown = false;
  });

  return {
    get up() { return held.up; },
    get down() { return held.down; },
    get left() { return held.left; },
    get right() { return held.right; },
    get sprint() { return held.sprint; },
    get handbrake() { return held.sprint; },
    get mouseX() { return mouseX; },
    get mouseY() { return mouseY; },
    get mouseDown() { return mouseDown; },
    takeClick() {
      const was = clicked;
      clicked = false;
      return was;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Simulate a key press (used by the screenshot autopilot). */
    simulate(code) {
      press(code, { repeat: false });
    },
    simulateRelease(code) {
      if (UP.has(code)) held.up = false;
      else if (DOWN.has(code)) held.down = false;
      else if (LEFT.has(code)) held.left = false;
      else if (RIGHT.has(code)) held.right = false;
      else if (SPRINT.has(code)) held.sprint = false;
    },
  };
}
