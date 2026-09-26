import * as THREE from 'three';
import { CONFIG } from '../config.js';
import * as sfx from '../audio/sfx.js';

// A near-black silhouette with two lit eyes. Detail is the enemy here: a shape
// you cannot quite resolve is worse than a face you can.
function buildFigure() {
  const g = new THREE.Group();
  const cloth = new THREE.MeshLambertMaterial({ color: 0x090a0d });
  const skin = new THREE.MeshLambertMaterial({ color: 0x2b2721 });
  const HEAD_Y = 1.74, HEAD_R = 0.12;

  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.37, 1.72, 16, 1, true), cloth);
  robe.position.y = 0.84;

  const hunch = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 12), cloth);
  hunch.scale.set(1, 0.78, 1.2);
  hunch.position.set(0, 1.55, 0.08);

  const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 16, 14), skin);
  head.scale.set(1, 1.16, 1);
  head.position.set(0, HEAD_Y, -0.04);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.21, 10), skin);
  nose.rotation.x = -Math.PI / 2.1;
  nose.position.set(0, HEAD_Y - 0.055, -0.175);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), skin);
  jaw.scale.set(0.9, 0.7, 0.8);
  jaw.position.set(0, HEAD_Y - 0.085, -0.075);

  // Eyes sit clear of the skull so the silhouette has two lit points in it.
  // They are the only thing you can actually resolve, which is the idea.
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd24a });
  for (const dx of [-0.045, 0.045]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.027, 10, 8), eyeMat);
    e.position.set(dx, HEAD_Y + 0.032, -0.181);
    g.add(e);
  }

  const hairMat = new THREE.MeshLambertMaterial({ color: 0x131318 });
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2;
    const strand = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.42 + Math.random() * 0.26, 5), hairMat);
    strand.position.set(Math.cos(a) * 0.095, HEAD_Y - 0.02 - Math.random() * 0.1, -0.04 + Math.sin(a) * 0.095);
    strand.rotation.z = Math.cos(a) * 0.45;
    strand.rotation.x = Math.sin(a) * 0.45 + Math.PI;
    g.add(strand);
  }

  // Arms too long by a little. Wrong on sight, without being a cartoon.
  for (const dx of [-0.28, 0.28]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.027, 1.02, 8), cloth);
    arm.position.set(dx, 1.06, -0.02);
    arm.rotation.z = dx > 0 ? -0.09 : 0.09;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin);
    hand.scale.set(1, 1.6, 0.65);
    hand.position.set(dx * 1.05, 0.55, -0.02);
    g.add(arm, hand);
  }

  g.add(robe, hunch, head, jaw, nose);
  g.visible = false;
  return { group: g, eyeMat };
}

/**
 * She wakes partway through the run, then closes the distance — but only while
 * you are not looking at her. The shower needs your eyes on knobs and bottles,
 * so every glance away is a step she takes.
 */
export function createBabaYaga(scene, camera) {
  const B = CONFIG.baba;
  const { group, eyeMat } = buildFigure();
  scene.add(group);

  const CORNER = new THREE.Vector3(1.72, 0, 1.36);
  const toPlayer = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const flat = new THREE.Vector3();

  let awake = false, stepTimer = 0, lastPhase = -1;

  const api = {
    phase: 0,          // 0 calm, 1 awake, 2 close, 3 upon you
    watched: false,
    reached: false,
    reset() {
      awake = false; api.phase = 0; api.reached = false; lastPhase = -1;
      group.visible = false;
      group.position.copy(CORNER);
      sfx.setDrone(0);
    },

    /** left 0..1 of the time limit remaining */
    update(dt, left, playerPos) {
      if (api.reached) return;

      if (!awake && left <= B.wakesAt) {
        awake = true;
        group.visible = true;
        group.position.copy(CORNER);
        sfx.creak();
        sfx.knock(3);
      }
      if (!awake) return;

      // Phase purely from the clock, so dread ramps even if she is boxed in.
      api.phase = left > 0.34 ? 1 : left > 0.14 ? 2 : 3;
      if (api.phase !== lastPhase) {
        lastPhase = api.phase;
        if (api.phase >= 2) sfx.knock(api.phase === 3 ? 5 : 2);
      }
      sfx.setDrone(0.25 + (1 - left) * 0.85);

      toPlayer.subVectors(playerPos, group.position);
      toPlayer.y = 0;
      const dist = toPlayer.length();

      // Is she in your view? Compare the camera's facing to her direction.
      camera.getWorldDirection(forward);
      flat.set(-toPlayer.x, 0, -toPlayer.z).normalize();
      forward.y = 0; forward.normalize();
      api.watched = flat.dot(forward) > B.seenDot;

      if (dist <= B.reach) { api.reached = true; return; }

      if (!api.watched) {
        const speed = B.speed + (1 - left) * (B.speedMax - B.speed);
        group.position.addScaledVector(toPlayer.normalize(), speed * dt);
        stepTimer -= dt;
        if (stepTimer <= 0) { sfx.step(); stepTimer = 0.62 - (1 - left) * 0.3; }
      }

      // Always facing you, and the eyes burn brighter the closer she gets.
      // Object3D.lookAt aims +Z at the target; her face is built on -Z.
      group.lookAt(playerPos.x, group.position.y, playerPos.z);
      group.rotateY(Math.PI);
      const near = THREE.MathUtils.clamp(1 - dist / 4, 0, 1);
      eyeMat.color.setHSL(0.11, 1, 0.5 + near * 0.32);
    },

    /** How far in, 0..1, for the HUD vignette and the heartbeat. */
    pressure(left) {
      if (!awake) return 0;
      return THREE.MathUtils.clamp((B.wakesAt - left) / B.wakesAt, 0, 1);
    },

    get position() { return group.position; },
  };

  api.reset();
  return api;
}
