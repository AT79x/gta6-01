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
  // Touch driving: the stick's screen-space angle (null when centred) so the
  // car steers toward the pushed direction instead of relative to its nose.
  let driveAngle = null;
  let driveMag = 0;
  // World zoom: pinch on the canvas or the + / − buttons change it.
  let zoom = (('ontouchstart' in window) || navigator.maxTouchPoints > 0)
    && window.innerHeight > window.innerWidth ? 1.5 : 1;
  const clampZoom = (z) => Math.max(0.7, Math.min(2.8, z));
  const pointers = new Map();
  let pinchDist = 0;
  function pinchZoom() {
    const pts = [...pointers.values()];
    if (pts.length < 2) return;
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (pinchDist > 0 && d > 0) zoom = clampZoom(zoom * (d / pinchDist));
    pinchDist = d;
  }

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
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        pinchZoom();
        return;
      }
    }
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    // A second finger starts a pinch: stop shooting and let it zoom instead.
    if (pointers.size >= 2) {
      mouseDown = false;
      pinchDist = 0;
      pinchZoom();
      return;
    }
    if (event.button === 0) {
      mouseDown = true;
      clicked = true;
    }
  });
  window.addEventListener('pointerup', (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (event.button === 0) mouseDown = false;
  });
  window.addEventListener('pointercancel', (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    mouseDown = false;
  });

  // --- Touch controls (phones/tablets): a virtual stick for movement and
  // on-screen buttons for the actions a keyboard would give. Only wired when
  // the device actually has touch, so desktop play and the deterministic
  // screenshots stay clean. The 2D game has no reload key: ammo comes from
  // pickups you walk to, which is exactly what the stick makes possible.
  const touchUI = document.getElementById('touch-ui');
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0
    || window.matchMedia('(pointer: coarse)').matches;
  if (touchUI && isTouch) {
    document.body.classList.add('touch');
    const stick = document.getElementById('stick');
    const knob = document.getElementById('stick-knob');
    let stickId = null;
    let moveAngle = -Math.PI / 2;
    let lastAimAt = 0;
    let fireTimer = null;

    const stickCenter = () => {
      const r = stick.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    function setStick(dx, dy) {
      const len = Math.hypot(dx, dy);
      const dead = 10;
      const nx = len > 0 ? dx / len : 0;
      const ny = len > 0 ? dy / len : 0;
      const mag = Math.min(1, Math.max(0, (len - dead) / 40));
      held.up = mag > 0.25 && ny < -0.35;
      held.down = mag > 0.25 && ny > 0.35;
      held.left = mag > 0.25 && nx < -0.35;
      held.right = mag > 0.25 && nx > 0.35;
      if (mag > 0.25) {
        moveAngle = Math.atan2(dy, dx);
        driveAngle = moveAngle;
        driveMag = mag;
      } else {
        driveAngle = null;
        driveMag = 0;
      }
      knob.style.transform = `translate(${nx * 34 * mag}px, ${ny * 34 * mag}px)`;
    }
    function clearStick() {
      held.up = false;
      held.down = false;
      held.left = false;
      held.right = false;
      driveAngle = null;
      driveMag = 0;
      knob.style.transform = '';
      stickId = null;
    }
    stick.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      stick.setPointerCapture(event.pointerId);
      stickId = event.pointerId;
      const c = stickCenter();
      setStick(event.clientX - c.x, event.clientY - c.y);
    });
    stick.addEventListener('pointermove', (event) => {
      if (event.pointerId !== stickId) return;
      const c = stickCenter();
      setStick(event.clientX - c.x, event.clientY - c.y);
    });
    const endStick = (event) => {
      if (event.pointerId === stickId) clearStick();
    };
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);
    // If the browser drops pointer capture (system gesture, notification
    // shade, palm rejection), no pointerup/pointercancel reaches the stick
    // and the car would keep driving by itself with no finger down: clear
    // on capture loss too, and on any pointerup/cancel for this pointer
    // that reaches the window instead of the stick.
    stick.addEventListener('lostpointercapture', endStick);
    window.addEventListener('pointerup', (event) => {
      if (event.pointerId === stickId) clearStick();
    });
    window.addEventListener('pointercancel', (event) => {
      if (event.pointerId === stickId) clearStick();
    });

    // Canvas taps still aim (and shoot once) exactly as before.
    canvas.addEventListener('pointerdown', () => {
      lastAimAt = performance.now();
    });

    function aimFromStick() {
      // No recent tap: aim where the stick points (straight up by default).
      const rect = canvas.getBoundingClientRect();
      mouseX = rect.width / 2 + Math.cos(moveAngle) * 140;
      mouseY = rect.height / 2 + Math.sin(moveAngle) * 140;
    }
    function pressButton(id, down, up) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        down();
      });
      el.addEventListener('pointerup', (event) => {
        event.preventDefault();
        if (up) up();
      });
      el.addEventListener('pointercancel', () => {
        if (up) up();
      });
      el.addEventListener('pointerleave', () => {
        if (up) up();
      });
    }
    // Hold TEMBAK to keep firing: the loop takes one click per shot, so the
    // button re-arms a click every 140 ms while held.
    pressButton('btn-fire', () => {
      if (performance.now() - lastAimAt > 4000) aimFromStick();
      mouseDown = true;
      clicked = true;
      if (fireTimer) clearInterval(fireTimer);
      fireTimer = setInterval(() => {
        clicked = true;
      }, 140);
    }, () => {
      mouseDown = false;
      if (fireTimer) {
        clearInterval(fireTimer);
        fireTimer = null;
      }
    });
    pressButton('btn-enter', () => {
      actions |= ACTION_ENTER;
    });
    pressButton('btn-mission', () => {
      actions |= ACTION_MISSION;
    });
    pressButton('btn-punch', () => {
      actions |= ACTION_PUNCH;
    });
    pressButton('btn-pause', () => {
      actions |= ACTION_PAUSE;
    });
    pressButton('btn-sprint', () => {
      held.sprint = true;
    }, () => {
      held.sprint = false;
    });
    pressButton('btn-zoom-in', () => {
      zoom = clampZoom(zoom * 1.25);
    });
    pressButton('btn-zoom-out', () => {
      zoom = clampZoom(zoom / 1.25);
    });
    touchUI.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('blur', () => {
      clearStick();
      held.sprint = false;
      mouseDown = false;
      if (fireTimer) {
        clearInterval(fireTimer);
        fireTimer = null;
      }
    });
  }

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
    get driveAngle() { return driveAngle; },
    get driveMag() { return driveMag; },
    get zoom() { return zoom; },
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
