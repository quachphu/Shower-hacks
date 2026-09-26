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

  const wetTex = tileTexture({ tile: '#a9c2cc', grout: '#5f7480', cells: 5 });
  const dryTex = tileTexture({ tile: '#c8c0b1', grout: '#8d8477', cells: 3 });
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
  return { group, interactables };
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

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.18), lambert(0xc3ccd1));
  shelf.position.set(-1.15, 1.18, -1.48);
  group.add(shelf);

  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 8), lambert(0xb0b8bc));
  hook.rotation.x = Math.PI / 2;
  hook.position.set(0.55, 1.62, -1.54);
  group.add(hook);

  const farShelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.035, 0.24), lambert(0xd6cdbd));
  farShelf.position.set(1.7, 1.15, 1.35);
  group.add(farShelf);
}

// Everything the crosshair can land on. userData.interact is what main.js reads.
function buildInteractables(group) {
  const list = [];
  const add = (mesh, interact) => {
    mesh.userData.interact = interact;
    group.add(mesh);
    list.push(mesh);
    return mesh;
  };

  // Knobs sit on the wet-area end wall, angled to face the player.
  const knob = (z, colour) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20), lambert(colour));
    body.rotation.z = Math.PI / 2;
    const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.055), lambert(0x1b2126));
    pointer.position.set(0.03, 0.05, 0);
    g.add(body, pointer);
    g.position.set(-1.93, 1.14, z);
    return { group: g, pointer };
  };

  const temp = knob(-0.34, 0xd8604a);
  const pres = knob(0.34, 0x4a8fd8);
  group.add(temp.group, pres.group);

  // The clickable target is an invisible slab in front of each knob — a small
  // cylinder is miserable to hit with a crosshair.
  const hit = (z, interact) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.24, 0.24),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    m.position.set(-1.9, 1.14, z);
    return add(m, interact);
  };
  hit(-0.34, { kind: 'knob', field: 'temp', label: 'Temperature' });
  hit(0.34, { kind: 'knob', field: 'pressure', label: 'Pressure' });

  const bottle = (x, colour, id, label) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.21, 14), lambert(colour));
    m.position.set(x, 1.3, -1.48);
    return add(m, { kind: 'item', id, label });
  };
  const shampoo = bottle(-1.33, 0xf2c14e, 'shampoo', 'Shampoo');
  const conditioner = bottle(-1.15, 0x7fc9a1, 'conditioner', 'Conditioner');

  const soap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.075), lambert(0xf0e6d2));
  soap.position.set(-0.97, 1.22, -1.48);
  add(soap, { kind: 'item', id: 'soap', label: 'Soap' });

  const towel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.07), lambert(0xe8746b));
  towel.position.set(0.55, 1.4, -1.5);
  add(towel, { kind: 'item', id: 'towel', label: 'Towel' });

  return { meshes: list, byId: { shampoo, conditioner, soap, towel } };
}
