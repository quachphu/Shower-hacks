import * as THREE from 'three';
import { CONFIG } from '../config.js';

// --- procedural textures -------------------------------------------------
// Canvas textures keep the repo dependency-free: no image files to load or host.

function tileTexture({ tile = '#dfe7ea', grout = '#9fb0b8', size = 128, cells = 4 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = grout;
  g.fillRect(0, 0, size, size);
  const step = size / cells, gap = Math.max(2, size / 64);
  g.fillStyle = tile;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      g.fillRect(x * step + gap / 2, y * step + gap / 2, step - gap, step - gap);
    }
  }
  // A little grime so the tiles are not flat colour.
  g.fillStyle = 'rgba(0,0,0,0.045)';
  for (let i = 0; i < 260; i++) {
    g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

// --- room ----------------------------------------------------------------

export function buildBathroom(scene) {
  const R = CONFIG.room;
  const w = R.maxX - R.minX, d = R.maxZ - R.minZ, h = R.height;
  const cx = (R.minX + R.maxX) / 2, cz = (R.minZ + R.maxZ) / 2;

  const wetTex = tileTexture({ tile: '#b7d6da', grout: '#6f939b', cells: 5 });
  const dryTex = tileTexture({ tile: '#ded1c1', grout: '#a89684', cells: 3 });
  wetTex.repeat.set(3, 3);
  dryTex.repeat.set(4, 3);

  const group = new THREE.Group();
  scene.add(group);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lambert(0xffffff, { map: dryTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  group.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lambert(0xf2f4f5));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, h, cz);
  group.add(ceiling);

  // Walls, each facing into the room.
  const wallSpecs = [
    { size: [w, h], pos: [cx, h / 2, R.minZ], rot: [0, 0, 0] },
    { size: [w, h], pos: [cx, h / 2, R.maxZ], rot: [0, Math.PI, 0] },
    { size: [d, h], pos: [R.minX, h / 2, cz], rot: [0, Math.PI / 2, 0] },
    { size: [d, h], pos: [R.maxX, h / 2, cz], rot: [0, -Math.PI / 2, 0] },
  ];
  for (const s of wallSpecs) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(...s.size), lambert(0xffffff, { map: dryTex.clone() }));
    m.material.map.needsUpdate = true;
    m.position.set(...s.pos);
    m.rotation.set(...s.rot);
    group.add(m);
  }

  // The wet area: a shallow tray plus tiled walls on the two sides it touches.
  const S = CONFIG.shower;
  const sw = S.maxX - S.minX, sd = S.maxZ - S.minZ;
  const scx = (S.minX + S.maxX) / 2, scz = (S.minZ + S.maxZ) / 2;

  const tray = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.06, sd), lambert(0xffffff, { map: wetTex }));
  tray.position.set(scx, 0.03, scz);
  group.add(tray);

  const wetWalls = [
    { size: [sd, h], pos: [S.minX + 0.01, h / 2, scz], rot: [0, Math.PI / 2, 0] },
    { size: [sw, h], pos: [scx, h / 2, S.minZ + 0.01], rot: [0, 0, 0] },
    { size: [sw, h], pos: [scx, h / 2, S.maxZ - 0.01], rot: [0, Math.PI, 0] },
  ];
  for (const s of wetWalls) {
    const t = wetTex.clone(); t.needsUpdate = true; t.repeat.set(2, 3);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(...s.size), lambert(0xffffff, { map: t }));
    m.position.set(...s.pos);
    m.rotation.set(...s.rot);
    group.add(m);
  }

  // Curb you step over, and the glass screen beside it.
  const curb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, sd), lambert(0xb9c6cc));
  curb.position.set(S.maxX, 0.065, scz);
  group.add(curb);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.9),
    new THREE.MeshLambertMaterial({ color: 0xcfe8f2, transparent: true, opacity: 0.17, side: THREE.DoubleSide })
  );
  glass.position.set(S.maxX, 1.0, S.minZ + 0.55);
  glass.rotation.y = -Math.PI / 2;
  group.add(glass);

  const drain = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), lambert(0x333c40));
  drain.rotation.x = -Math.PI / 2;
  drain.position.set(CONFIG.water.streamCentre[0], 0.062, CONFIG.water.streamCentre[1]);
  group.add(drain);

  buildFixtures(group);
  const interactables = buildInteractables(group);
  const duck = buildDuck(group);
  return { group, interactables, duck };
}

// Toilet, sink and mirror. Pure set dressing, but a shower game needs a bathroom.
function buildFixtures(group) {
  const porcelain = lambert(0xf6f7f4);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.42, 16), porcelain);
  bowl.position.set(1.55, 0.21, -1.05);
  const cistern = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.18), porcelain);
  cistern.position.set(1.55, 0.67, -1.32);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 16), lambert(0xe3e6e1));
  lid.position.set(1.55, 0.44, -1.05);
  group.add(bowl, cistern, lid);

  const basin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.42), porcelain);
  basin.position.set(1.7, 0.85, 0.6);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.76, 12), porcelain);
  pedestal.position.set(1.7, 0.38, 0.6);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.7), lambert(0x9fb8c4));
  mirror.position.set(1.98, 1.55, 0.6);
  mirror.rotation.y = -Math.PI / 2;
  group.add(basin, pedestal, mirror);

  // Shower head and its arm.
  // Chrome, not white — a pale head vanishes against pale tiles.
  const [hx, hy, hz] = CONFIG.water.head;
  const chrome = lambert(0x76838c);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 10), chrome);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(hx - 0.16, hy + 0.09, hz);
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), chrome);
  elbow.position.set(hx + 0.01, hy + 0.09, hz);

  const head = new THREE.Group();
  head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.085, 22), lambert(0x8e9aa2)));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.163, 22), lambert(0x39434a));
  face.rotation.x = -Math.PI / 2;
  face.position.y = -0.044;
  head.add(face);
  head.position.set(hx, hy, hz);
  head.rotation.z = -0.3;
  group.add(arm, elbow, head);

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.035, 0.2), lambert(0xd3dbdf));
  shelf.position.set(-1.18, 1.18, -1.46);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.03, 0.016), lambert(0xb4bfc4));
  lip.position.set(-1.18, 1.2, -1.37);
  for (const dx of [-0.31, 0.31]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.05, 0.17), lambert(0xa9b4ba));
    bracket.position.set(-1.18 + dx, 1.152, -1.46);
    group.add(bracket);
  }
  group.add(shelf, lip);

  // A soft mat to land on, so stepping out isn't onto bare tile.
  const mat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.022, 0.58), lambert(0x8fbcb0));
  mat.position.set(0.32, 0.011, 0.26);
  const matTrim = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.024, 0.5), lambert(0xa7cfc4));
  matTrim.position.set(0.32, 0.013, 0.26);
  group.add(mat, matTrim);

  // A plant on the cistern. Nobody's bathroom is only fixtures.
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.048, 0.1, 14), lambert(0xd98b6a));
  pot.position.set(1.55, 0.97, -1.32);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.012, 14), lambert(0x4a3a2c));
  soil.position.set(1.55, 1.021, -1.32);
  group.add(pot, soil);
  const leafMat = lambert(0x62a86b);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), leafMat);
    leaf.scale.set(0.42, 1, 0.42);
    leaf.position.set(1.55 + Math.cos(a) * 0.036, 1.07 + (i % 3) * 0.022, -1.32 + Math.sin(a) * 0.036);
    leaf.rotation.z = Math.cos(a) * 0.5;
    leaf.rotation.x = Math.sin(a) * 0.5;
    group.add(leaf);
  }

  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 8), lambert(0xb0b8bc));
  hook.rotation.x = Math.PI / 2;
  hook.position.set(0.55, 1.62, -1.54);
  group.add(hook);

  const farShelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.035, 0.24), lambert(0xd6cdbd));
  farShelf.position.set(1.7, 1.15, 1.35);
  group.add(farShelf);
}

// Everything the crosshair can land on. Each entry is the visible object itself
// (often a Group of parts), so hiding or cloning it just works.
function buildInteractables(group) {
  const list = [];
  const add = (obj, interact) => {
    obj.userData.interact = interact;
    group.add(obj);
    list.push(obj);
    return obj;
  };

  // --- taps -------------------------------------------------------------
  const knob = (z, colour) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.062, 0.05, 22), lambert(colour));
    body.rotation.z = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.011, 8, 24), lambert(0x8e9aa2));
    rim.rotation.y = Math.PI / 2;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.014, 0.088), lambert(0x22292e));
    grip.position.x = 0.028;
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.014, 22), lambert(0x9fadb4));
    plate.rotation.z = Math.PI / 2;
    plate.position.x = -0.032;
    g.add(plate, body, rim, grip);
    g.position.set(-1.93, 1.14, z);
    return g;
  };
  const tempKnob = knob(-0.34, 0xe8785c);
  const presKnob = knob(0.34, 0x5fa8e0);
  group.add(tempKnob, presKnob);

  // A crosshair-sized slab in front of each knob; the knob itself is too small to hit.
  const hit = (z, interact) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.26),
      new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set(-1.9, 1.14, z);
    return add(m, interact);
  };
  hit(-0.34, { kind: 'knob', field: 'temp', label: 'Temperature', highlight: tempKnob });
  hit(0.34, { kind: 'knob', field: 'pressure', label: 'Pressure', highlight: presKnob });

  // --- pump bottles ------------------------------------------------------
  const bottleProfile = [
    [0, 0], [0.047, 0], [0.05, 0.012], [0.05, 0.145],
    [0.044, 0.172], [0.026, 0.192], [0.021, 0.2], [0, 0.2],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const bottle = (x, colour, id, label) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.LatheGeometry(bottleProfile, 22), lambert(colour));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.062, 22), lambert(0xf6f3ec));
    band.position.y = 0.072;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.022, 14), lambert(0x59636a));
    collar.position.y = 0.208;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.036, 12), lambert(0x6d777e));
    stem.position.y = 0.234;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0115, 0.055, 12), lambert(0x6d777e));
    spout.rotation.z = Math.PI / 2;
    spout.position.set(0.022, 0.25, 0);
    g.add(body, band, collar, stem, spout);
    g.position.set(x, 1.205, -1.46);
    return add(g, { kind: 'item', id, label });
  };
  const shampoo = bottle(-1.36, 0xf2c14e, 'shampoo', 'Shampoo');
  const conditioner = bottle(-1.18, 0x7fc9a1, 'conditioner', 'Conditioner');

  // --- soap: a rounded bar, not a brick ---------------------------------
  const soapG = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.SphereGeometry(0.058, 20, 14), lambert(0xf6ead2));
  bar.scale.set(1.05, 0.46, 0.74);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), lambert(0xfffaf0));
  shine.scale.set(1.4, 0.3, 0.8);
  shine.position.set(-0.012, 0.024, 0.008);
  soapG.add(bar, shine);
  soapG.position.set(-0.99, 1.215, -1.46);
  const soap = add(soapG, { kind: 'item', id: 'soap', label: 'Soap' });

  // --- towel, folded over its hook --------------------------------------
  const towelG = new THREE.Group();
  const hang = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.075), lambert(0xf08a7d));
  const fold = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.095), lambert(0xe2705f));
  fold.position.y = 0.2;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.079), lambert(0xfbd9c6));
  stripe.position.y = -0.09;
  towelG.add(hang, fold, stripe);
  towelG.position.set(0.55, 1.38, -1.5);
  const towel = add(towelG, { kind: 'item', id: 'towel', label: 'Towel' });

  return { meshes: list, byId: { shampoo, conditioner, soap, towel } };
}

// A rubber duck. Non-essential, but a shower without one is just a wet room.
function buildDuck(scene) {
  const g = new THREE.Group();
  const yellow = lambert(0xffd43f);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.058, 18, 14), yellow);
  body.scale.set(1, 0.86, 1.25);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), yellow);
  head.position.set(0, 0.055, -0.045);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.032, 10), lambert(0xf28c28));
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.049, -0.086);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.042, 10), yellow);
  tail.rotation.x = -0.9;
  tail.position.set(0, 0.026, 0.07);
  const eye = () => new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 6), lambert(0x201a12));
  const eyeL = eye(), eyeR = eye();
  eyeL.position.set(-0.019, 0.066, -0.068);
  eyeR.position.set(0.019, 0.066, -0.068);
  g.add(body, head, beak, tail, eyeL, eyeR);
  g.position.set(-1.78, 0.14, 0.86);
  g.rotation.y = 0.7;
  g.scale.setScalar(1.6);
  scene.add(g);
  return g;
}
