import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Round sprite for both droplets and steam. Untextured points render as hard
// squares, which reads as pixel soup once a few hundred of them are falling.
// `core` is how much of the radius stays fully opaque before it fades.
function blobTexture(core) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(core, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const DROPS = 900;
const PUFFS = 320;

export function buildWater(scene) {
  const [hx, hy, hz] = CONFIG.water.head;
  const [sx, sz] = CONFIG.water.streamCentre;
  const R = CONFIG.water.streamRadius;

  // --- falling droplets ---------------------------------------------------
  const dropPos = new Float32Array(DROPS * 3);
  const dropVel = new Float32Array(DROPS * 3);

  const respawn = (i, stagger) => {
    // Spawn in a disc at the head, aimed at the disc it lands on. The lateral
    // velocity is whatever carries it from one to the other.
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.11;
    const px = hx + Math.cos(a) * r, pz = hz + Math.sin(a) * r;
    const ta = Math.random() * Math.PI * 2;
    const tr = Math.sqrt(Math.random()) * R * 0.92;
    const fall = 0.55;                                   // seconds head -> floor
    dropPos[i * 3]     = px;
    dropPos[i * 3 + 1] = stagger ? Math.random() * hy : hy;
    dropPos[i * 3 + 2] = pz;
    dropVel[i * 3]     = (sx + Math.cos(ta) * tr - px) / fall;
    dropVel[i * 3 + 1] = -1.4;
    dropVel[i * 3 + 2] = (sz + Math.sin(ta) * tr - pz) / fall;
  };
  for (let i = 0; i < DROPS; i++) respawn(i, true);

  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
  const dropMat = new THREE.PointsMaterial({
    map: blobTexture(0.55), color: 0xbfe4f5, size: 0.02, transparent: true, opacity: 0.6,
    depthWrite: false, sizeAttenuation: true,
  });
  const drops = new THREE.Points(dropGeo, dropMat);
  scene.add(drops);

  // --- steam --------------------------------------------------------------
  const puffPos = new Float32Array(PUFFS * 3);
  const puffLife = new Float32Array(PUFFS);
  const seedPuff = (i, stagger) => {
    puffPos[i * 3]     = sx + (Math.random() - 0.5) * 1.5;
    puffPos[i * 3 + 1] = stagger ? Math.random() * 2.2 : 0.1 + Math.random() * 0.3;
    puffPos[i * 3 + 2] = sz + (Math.random() - 0.5) * 2.4;
    puffLife[i] = Math.random();
  };
  for (let i = 0; i < PUFFS; i++) seedPuff(i, true);

  const puffGeo = new THREE.BufferGeometry();
  puffGeo.setAttribute('position', new THREE.BufferAttribute(puffPos, 3));
  const puffMat = new THREE.PointsMaterial({
    map: blobTexture(0.02), color: 0xffffff, size: 0.42, transparent: true, opacity: 0,
    depthWrite: false, sizeAttenuation: true, blending: THREE.NormalBlending,
  });
  const steam = new THREE.Points(puffGeo, puffMat);
  scene.add(steam);

  const cold = new THREE.Color(0x9fd8ff), hot = new THREE.Color(0xffeade);

  return {
    /** flow 0..1, temp in degrees C */
    update(dt, flow, temp) {
      drops.visible = flow > 0.02;
      if (drops.visible) {
        const speed = 0.55 + flow * 1.35;
        for (let i = 0; i < DROPS * flow; i++) {
          dropPos[i * 3]     += dropVel[i * 3] * dt * speed;
          dropPos[i * 3 + 1] += dropVel[i * 3 + 1] * dt * speed;
          dropPos[i * 3 + 2] += dropVel[i * 3 + 2] * dt * speed;
          if (dropPos[i * 3 + 1] <= 0.07) respawn(i, false);
        }
        // Hide the droplets the current flow is not paying for.
        for (let i = Math.ceil(DROPS * flow); i < DROPS; i++) dropPos[i * 3 + 1] = -5;
        dropGeo.attributes.position.needsUpdate = true;
        dropMat.opacity = 0.25 + flow * 0.45;
        dropMat.size = 0.012 + flow * 0.016;
        dropMat.color.copy(cold).lerp(hot, THREE.MathUtils.clamp((temp - 14) / 40, 0, 1));
      }

      // Steam only exists if the water is hot and actually running.
      const target = THREE.MathUtils.clamp((temp - 34) / 16, 0, 1) * flow * 0.38;
      puffMat.opacity += (target - puffMat.opacity) * Math.min(1, dt * 1.6);
      if (puffMat.opacity > 0.01) {
        for (let i = 0; i < PUFFS; i++) {
          puffPos[i * 3 + 1] += (0.22 + puffLife[i] * 0.3) * dt;
          puffPos[i * 3]     += Math.sin(puffLife[i] * 30 + puffPos[i * 3 + 1]) * 0.06 * dt;
          if (puffPos[i * 3 + 1] > 2.5) seedPuff(i, false);
        }
        puffGeo.attributes.position.needsUpdate = true;
      }
    },
  };
}

const BUBBLES = 260;

/**
 * Soap bubbles drifting around you while you have lather on. Squeezing a bottle
 * should visibly do something in the world, not only move a bar on the HUD.
 */
export function buildFoam(scene) {
  const pos = new Float32Array(BUBBLES * 3);
  const vel = new Float32Array(BUBBLES);
  const live = new Uint8Array(BUBBLES);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: blobTexture(0.62), color: 0xf4fbff, size: 0.05, transparent: true, opacity: 0.72,
    depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  for (let i = 0; i < BUBBLES; i++) pos[i * 3 + 1] = -5;

  return {
    /** amount 0..1 of total lather on you; (px,pz) is where you are standing */
    update(dt, amount, px, pz) {
      points.visible = amount > 0.01;
      if (!points.visible) return;
      const want = Math.ceil(BUBBLES * Math.min(1, amount));
      for (let i = 0; i < BUBBLES; i++) {
        if (i >= want) { live[i] = 0; pos[i * 3 + 1] = -5; continue; }
        if (!live[i]) {
          live[i] = 1;
          const a = Math.random() * Math.PI * 2, r = 0.15 + Math.random() * 0.5;
          pos[i * 3]     = px + Math.cos(a) * r;
          pos[i * 3 + 1] = 0.15 + Math.random() * 1.5;
          pos[i * 3 + 2] = pz + Math.sin(a) * r;
          vel[i] = 0.12 + Math.random() * 0.26;
        }
        pos[i * 3 + 1] += vel[i] * dt;
        pos[i * 3]     += Math.sin(pos[i * 3 + 1] * 3 + i) * 0.09 * dt;
        if (pos[i * 3 + 1] > 2.1) live[i] = 0;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 0.3 + Math.min(1, amount) * 0.45;
    },
  };
}

/** True when a world position is standing in the falling water. */
export function inStream(x, z) {
  const [sx, sz] = CONFIG.water.streamCentre;
  return Math.hypot(x - sx, z - sz) < CONFIG.water.streamRadius;
}
