import * as THREE from 'three';
import { CONFIG } from '../config.js';

const KEY_FWD = ['KeyW', 'ArrowUp'], KEY_BACK = ['KeyS', 'ArrowDown'];
const KEY_LEFT = ['KeyA', 'ArrowLeft'], KEY_RIGHT = ['KeyD', 'ArrowRight'];

/**
 * First-person camera with pointer lock. Written by hand rather than pulled from
 * three's examples so the whole game stays a single CDN import.
 */
export function createPlayer(camera, dom) {
  const P = CONFIG.player;
  const SPAWN = new THREE.Vector3(1.0, P.eyeHeight, 0.45);
  const SPAWN_YAW = Math.PI * 0.46;   // facing the shower, slightly off-square
  const pos = SPAWN.clone();
  let yaw = SPAWN_YAW, pitch = 0;
  const keys = new Set();

  const state = {
    active: false,         // the game is receiving input
    fallback: false,       // running without pointer lock (embedded viewers refuse it)
    lockEnabled: true,     // false while the results screen is up
    applying: false,       // left mouse held
    wheel: 0,              // notches since last read
    dragX: 0,              // mouse-x travel while dragging, for knob turning
    onInteract: () => {},  // set by main.js
    onLockChange: () => {},
  };

  function setActive(on, fallback = false) {
    if (state.active === on && state.fallback === fallback) return;
    state.active = on;
    state.fallback = fallback;
    if (!on) { keys.clear(); state.applying = false; }
    state.onLockChange(on, fallback);
  }

  // Some contexts (iframes, embedded preview panes) refuse pointer lock outright.
  // movementX still works there, so fall back to look-without-capture rather than
  // leaving the player stuck on the start screen with no explanation.
  function requestLock() {
    // Browsers report a refusal three different ways: a thrown error, a rejected
    // promise, or a pointerlockerror event. The event can fire re-entrantly from
    // inside the call itself, so the rejection handler has to survive that.
    let r;
    try { r = dom.requestPointerLock(); }
    catch { setActive(true, true); return; }
    Promise.resolve(r).catch(() => setActive(true, true));
  }
  document.addEventListener('pointerlockerror', () => setActive(true, true));

  // Listening on the document, not the canvas: the start overlay sits on top of
  // the canvas, so "click anywhere to shower" has to mean anywhere.
  document.addEventListener('click', () => {
    if (!state.active && state.lockEnabled) requestLock();
  });

  document.addEventListener('pointerlockchange', () => {
    setActive(document.pointerLockElement === dom, false);
  });

  document.addEventListener('mousemove', e => {
    if (!state.active) return;
    if (state.applying) state.dragX += e.movementX;
    yaw -= e.movementX * P.lookSens;
    pitch -= e.movementY * P.lookSens;
    pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
  });

  document.addEventListener('mousedown', e => {
    if (state.active && e.button === 0) { state.applying = true; state.dragX = 0; }
  });
  document.addEventListener('mouseup', e => {
    if (e.button === 0) state.applying = false;
  });
  document.addEventListener('wheel', e => {
    if (state.active) { state.wheel += Math.sign(e.deltaY) * -1; e.preventDefault(); }
  }, { passive: false });

  document.addEventListener('keydown', e => {
    keys.add(e.code);
    if (e.code === 'Escape' && state.fallback) setActive(false);
    if (!state.active) return;
    if (e.code === 'KeyE') state.onInteract();
    if (e.code === 'Space') { state.applying = true; e.preventDefault(); }
  });
  document.addEventListener('keyup', e => {
    keys.delete(e.code);
    if (e.code === 'Space') state.applying = false;
  });

  const held = (list) => list.some(k => keys.has(k));
  const forward = new THREE.Vector3(), right = new THREE.Vector3();

  state.update = function update(dt) {
    let fz = (held(KEY_FWD) ? 1 : 0) - (held(KEY_BACK) ? 1 : 0);
    let rx = (held(KEY_RIGHT) ? 1 : 0) - (held(KEY_LEFT) ? 1 : 0);
    if (fz || rx) {
      const len = Math.hypot(fz, rx);
      forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      const speed = P.speed * dt / len;
      pos.addScaledVector(forward, fz * speed);
      pos.addScaledVector(right, rx * speed);
      clampToRoom(pos, P.radius);
    }
    camera.position.copy(pos);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  };

  state.release = () => { setActive(false); document.exitPointerLock(); };
  state.position = pos;
  state.pitch = () => pitch;
  state.takeWheel = () => { const w = state.wheel; state.wheel = 0; return w; };
  state.takeDrag = () => { const d = state.dragX; state.dragX = 0; return d; };
  state.setLook = (y, p) => { yaw = y; pitch = p; };
  state.reset = () => { pos.copy(SPAWN); state.setLook(SPAWN_YAW, 0); };
  return state;
}

function clampToRoom(p, r) {
  const R = CONFIG.room;
  p.x = THREE.MathUtils.clamp(p.x, R.minX + r, R.maxX - r);
  p.z = THREE.MathUtils.clamp(p.z, R.minZ + r, R.maxZ - r);
}

/** Is the player standing inside the tiled wet area? */
export function inShower(p) {
  const S = CONFIG.shower;
  return p.x >= S.minX && p.x <= S.maxX && p.z >= S.minZ && p.z <= S.maxZ;
}
