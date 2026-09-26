import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createState, waterTemp, flow } from './game/state.js';
import { tick, tryEscape, scoreRun, canApply } from './game/sim.js';
import { STAGES } from './game/stages.js';
import { buildBathroom } from './world/bathroom.js';
import { buildWater, inStream } from './world/water.js';
import { createPlayer, inShower } from './core/player.js';
import { createHud } from './ui/hud.js';

// --- renderer ------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f14);
scene.fog = new THREE.Fog(0x0a0f14, 5, 13);

const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.05, 40);
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xb9ccd8, 0x2a333c, 0.5));
const ceilingLight = new THREE.PointLight(0xffeccd, 7.5, 8, 2);
ceilingLight.position.set(0.4, 2.45, 0);
const showerLight = new THREE.PointLight(0xbcdcf5, 3, 5, 2);
showerLight.position.set(-1.3, 2.3, 0);
scene.add(ceilingLight, showerLight);

const { interactables } = buildBathroom(scene);
const water = buildWater(scene);
const player = createPlayer(camera, renderer.domElement);
const hud = createHud();

// Remember where every loose object lives so restarts and drops can put it back.
const HOME = new Map(interactables.meshes.map(m => [m, m.position.clone()]));
const FAR_SHELF = new THREE.Vector3(1.7, 1.19, 1.35);

// --- run state -----------------------------------------------------------
let s = createState();
let started = false;
let heldModel = null;
const raycaster = new THREE.Raycaster();
raycaster.far = CONFIG.player.reach;
const CENTRE = new THREE.Vector2(0, 0);

player.onLockChange = (active, fallback) => {
  if (active && !started) {
    started = true;
    hud.showStart(false);
    if (fallback) hud.toast({ title: 'MOUSE NOT CAPTURED', sub: 'this viewer blocks pointer lock — look still works, Esc to stop' }, s.t);
  }
  if (!active && started && !s.finished) hud.showStart(true);
};

player.onInteract = () => {
  if (!started || s.finished) return;
  const hit = look().mesh;
  const it = hit?.userData.interact;

  if (it?.kind === 'item') {
    if (it.id === 'towel') { s.hasTowel = true; hit.visible = false; return; }
    setHeld(it.id, hit);
    return;
  }
  if (s.holding) setHeld(null);   // nothing under the crosshair: put it down
};

document.addEventListener('keydown', e => {
  if (e.code === 'KeyR' && s.finished) restart();
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- holding an item -----------------------------------------------------
function setHeld(id, mesh) {
  // Return whatever is currently in hand to its shelf.
  if (s.holding) {
    const prev = interactables.byId[s.holding];
    prev.visible = true;
    prev.position.copy(HOME.get(prev));
  }
  if (heldModel) { camera.remove(heldModel); heldModel = null; }

  s.holding = id;
  if (!id) return;

  // Clone before hiding: a clone of an invisible mesh is itself invisible.
  heldModel = mesh.clone();
  mesh.visible = false;
  heldModel.visible = true;
  heldModel.position.set(0.32, -0.3, -0.62);
  heldModel.rotation.set(0.25, 0, -0.3);
  heldModel.scale.setScalar(0.85);
  camera.add(heldModel);
}

// --- what the crosshair is on -------------------------------------------
function look() {
  raycaster.setFromCamera(CENTRE, camera);
  const hits = raycaster.intersectObjects(interactables.meshes, false);
  const mesh = hits.find(h => h.object.visible || h.object.userData.interact?.kind === 'knob')?.object;
  return { mesh, interact: mesh?.userData.interact };
}

function promptFor(it, underStream) {
  if (!it) {
    if (s.holding) {
      const a = canApply(s, underStream);
      return a.ok
        ? `Hold <b>LMB</b> to ${s.holding === 'soap' ? 'scrub' : 'squeeze'} &nbsp;·&nbsp; <b>E</b> put down`
        : a.why ? `${a.why}` : `<b>E</b> put down the ${s.holding}`;
    }
    return null;
  }
  if (it.kind === 'knob') {
    const v = it.field === 'temp' ? waterTemp(s).toFixed(1) + '°' : Math.round(s.knob.pressure) + '%';
    return `${it.label} <b>${v}</b> &nbsp;·&nbsp; <b>Scroll</b> or drag <b>LMB</b>`;
  }
  if (it.id === 'towel') return `<b>E</b> take the towel`;
  return s.holding === it.id ? `<b>E</b> put back the ${it.label}` : `<b>E</b> take the ${it.label}`;
}

// --- knobs ---------------------------------------------------------------
function turnKnob(field, notches) {
  if (!notches) return;
  const step = CONFIG.water.knobStep * notches;
  if (field === 'temp') {
    s.knob.temp = THREE.MathUtils.clamp(s.knob.temp + step, CONFIG.water.tempMin, CONFIG.water.tempMax);
  } else {
    s.knob.pressure = THREE.MathUtils.clamp(s.knob.pressure + step * 2.2, 0, 100);
  }
}

// --- the loop ------------------------------------------------------------
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  player.update(dt);
  const p = player.position;
  const underStream = inShower(p) && inStream(p.x, p.z);
  const target = look();

  // Scroll and LMB-drag both turn whatever knob the crosshair is on.
  const notches = player.takeWheel();
  const drag = player.takeDrag();
  const onKnob = target.interact?.kind === 'knob';
  if (onKnob && started && !s.finished) turnKnob(target.interact.field, notches + drag * 0.06);

  if (started && !s.finished) {
    const { event } = tick(s, dt, {
      underStream,
      faceUp: player.pitch() > 0.42,
      // Dragging a knob must not also squeeze the bottle in your other hand.
      applying: player.applying && !onKnob,
    });

    if (event) {
      hud.toast(event, s.t);
      if (event.id === 'soap') dropSoap();
      if (event.id === 'towel') interactables.byId.towel.position.copy(FAR_SHELF);
    }

    // Leaving the wet area with the routine done ends the run.
    let escapeNote = null;
    if (STAGES[s.stage]?.id === 'escape' && !inShower(p)) escapeNote = tryEscape(s);
    if (s.finished) {
      player.lockEnabled = false;
      player.release();
      hud.showResults(s, scoreRun(s));
    }

    hud.update(s, { prompt: escapeNote ?? promptFor(target.interact, underStream) });
  }

  water.update(dt, flow(s), waterTemp(s));
  showerLight.intensity = 2.2 + flow(s) * 3.4;
  renderer.render(scene, camera);
}

function dropSoap() {
  const soap = interactables.byId.soap;
  if (heldModel) { camera.remove(heldModel); heldModel = null; }
  soap.visible = true;
  soap.position.set(-1.6 + Math.random() * 1.1, 0.09, -0.5 + Math.random());
}

function restart() {
  s = createState();
  started = false;
  if (heldModel) { camera.remove(heldModel); heldModel = null; }
  for (const [mesh, home] of HOME) { mesh.visible = true; mesh.position.copy(home); }
  player.reset();
  player.lockEnabled = true;
  hud.hideResults();
  hud.showStart(true);
  hud.update(s, { prompt: null });
}

hud.update(s, { prompt: null });
requestAnimationFrame(frame);
// Exposed for live poking in the console, same as the original prototype did.
window.game = { get state() { return s; }, scoreRun, restart, player, camera, scene };
