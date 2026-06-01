import * as THREE from "three";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  body: 0xffc800,
  black: 0x000000,
  wing: 0xffffff,
};

const STRIPE_CONFIGS = [
  { size: 0.75, z: 0.5 },
  { size: 0.825, z: 0 },
  { size: 0.75, z: -0.5 },
];

const LEG_CONFIGS = [
  { position: [0.8, -1, 0],     rotationZ: Math.PI + 0.5 },
  { position: [0.6, -1.05, 0.5],  rotationZ: Math.PI + 0.5 },
  { position: [0.6, -1.05, -0.5], rotationZ: Math.PI + 0.5 },
  { position: [-0.8, -1, 0],    rotationZ: Math.PI - 0.5 },
  { position: [-0.6, -1.05, 0.5], rotationZ: Math.PI - 0.5 },
  { position: [-0.6, -1.05, -0.5],rotationZ: Math.PI - 0.5 },
];

const WING_FLAP_SPEED = 40;
const WING_FLAP_AMPLITUDE_DEG = 20;
const BEE_SCALE = 0.2;
const EYE_OPEN_SCALE_Y = 1.2;
const EYE_CLOSED_SCALE_Y = 0.07;

// ─── Geometry Helpers ─────────────────────────────────────────────────────────

function makeCapsule(radius, height, capSegments = 8, radialSegments = 16) {
  return new THREE.CapsuleGeometry(radius, height, capSegments, radialSegments);
}

function makeSphere(radius, widthSeg = 30, heightSeg = 30) {
  return new THREE.SphereGeometry(radius, widthSeg, heightSeg);
}

function makeTorus(radius, tube, radialSeg = 50, tubularSeg = 50, arc) {
  return arc !== undefined
    ? new THREE.TorusGeometry(radius, tube, radialSeg, tubularSeg, arc)
    : new THREE.TorusGeometry(radius, tube, radialSeg, tubularSeg);
}

// ─── Material Factories ───────────────────────────────────────────────────────

function makePhong(color, options = {}) {
  return new THREE.MeshPhongMaterial({ color, shininess: 20, ...options });
}

function makeMaterials() {
  return {
    body: makePhong(COLORS.body),
    black: makePhong(COLORS.black),
    eye: makePhong(COLORS.black, { shininess: 80, specular: 0xeeeeee }),
    wing: makePhong(COLORS.wing, { shininess: 80, opacity: 0.92, transparent: true }),
  };
}

// ─── Part Builders ────────────────────────────────────────────────────────────

function buildBody(mat) {
  const body = new THREE.Mesh(makeSphere(1), mat);
  body.scale.set(1, 1, 1.2);
  return body;
}

function buildEyes(mat) {
  const eyes = [];

  for (const side of ["left", "right"]) {
    const eye = new THREE.Mesh(makeCapsule(0.12, 0.12), mat);
    eye.position.set(side === "left" ? 0.3 : -0.3, 0, 1.1);
    eye.scale.set(1, EYE_OPEN_SCALE_Y, 1);
    eye.userData.openScaleY = EYE_OPEN_SCALE_Y;
    eye.userData.baseY = 0;
    eyes.push(eye);
  }

  return eyes;
}

function buildStripes(mat) {
  return STRIPE_CONFIGS.map(({ size, z }) => {
    const stripe = new THREE.Mesh(makeTorus(size, size / 4), mat);
    stripe.position.z = z;
    return stripe;
  });
}

function buildStinger(mat) {
  const stinger = new THREE.Mesh(makeCapsule(0.05, 0.2, 5, 10), mat);
  stinger.position.set(0, 0, -1.1);
  stinger.rotation.x = -Math.PI / 2;
  return stinger;
}

function buildFace(mat) {
  const parts = [];

  const smile = new THREE.Mesh(makeTorus(0.1, 0.02, 50, 50, Math.PI), mat);
  smile.position.set(0, 0, 1.2);
  smile.rotation.z = Math.PI;
  parts.push(smile);

  const cheekGeo = makeSphere(0.02, 20, 20);
  for (const x of [0.1, -0.1]) {
    const cheek = new THREE.Mesh(cheekGeo, mat);
    cheek.position.set(x, 0, 1.2);
    parts.push(cheek);
  }

  return parts;
}

function buildWings(mat) {
  const wings = [];

  for (const side of ["left", "right"]) {
    const geo = makeCapsule(0.5, 0.3);
    geo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -0.5));

    const wing = new THREE.Mesh(geo, mat);
    const xOffset = side === "left" ? 0.8 : -0.8;
    const rotZ = THREE.MathUtils.degToRad(80);

    wing.position.set(xOffset, 1, 0.5);
    wing.scale.set(0.2, 0.8, 1);
    wing.rotation.z = side === "left" ? -rotZ : rotZ;
    wing.rotation.y = side === "left" ? Math.PI / 4 : -Math.PI / 4;
    wing.userData.baseRotationX = wing.rotation.x;
    wing.userData.side = side;

    wings.push(wing);
  }

  return wings;
}

function buildLegs(mat) {
  const geo = makeCapsule(0.05, 0.13, 4, 12);

  return LEG_CONFIGS.map(({ position, rotationZ }) => {
    const leg = new THREE.Mesh(geo, mat);
    leg.rotation.z = rotationZ;
    leg.position.set(...position);
    return leg;
  });
}

/**
 * Creates a complete bee group with animated wings and blinkable eyes.
 * @returns {{ group: THREE.Group, wings: THREE.Mesh[], eyes: THREE.Mesh[] }}
 */
export function createBee() {
  const group = new THREE.Group();
  const mats = makeMaterials();

  const body = buildBody(mats.body);
  const eyes = buildEyes(mats.eye);
  const stripes = buildStripes(mats.black);
  const stinger = buildStinger(mats.black);
  const faceParts = buildFace(mats.black);
  const wings = buildWings(mats.wing);
  const legs = buildLegs(mats.black);

  group.add(body, stinger, ...eyes, ...stripes, ...faceParts, ...wings, ...legs);
  group.scale.setScalar(BEE_SCALE);

  group.userData.theme = {
    bodyMat: mats.body,
    wingMat: mats.wing,
    bodyColorHex: COLORS.body,
    wingColorHex: COLORS.wing,
  };

  return { group, wings, eyes };
}

/**
 * Sets how closed the bee's eyes are.
 * @param {THREE.Mesh[]} eyes
 * @param {number} amount - 0 = fully open, 1 = fully closed
 */
export function setEyeClose(eyes, amount) {
  const t = THREE.MathUtils.clamp(amount, 0, 1);

  for (const eye of eyes) {
    const openY = eye.userData.openScaleY ?? EYE_OPEN_SCALE_Y;
    eye.scale.y = THREE.MathUtils.lerp(openY, EYE_CLOSED_SCALE_Y, t);
    eye.position.y = eye.userData.baseY - t * 0.04;
  }
}

/**
 * Animates wing flapping based on elapsed time.
 * @param {THREE.Mesh[]} wings
 * @param {number} time - elapsed time in seconds
 * @param {number} [speed=1] - flap speed multiplier
 */
export function animateWings(wings, time, speed = 1) {
  const flap = Math.sin(time * WING_FLAP_SPEED * speed)
    * THREE.MathUtils.degToRad(WING_FLAP_AMPLITUDE_DEG);

  for (const wing of wings) {
    wing.rotation.x = wing.userData.baseRotationX + flap;
  }
}

/**
 * Folds wings into a resting position.
 * @param {THREE.Mesh[]} wings
 */
export function foldWings(wings) {
  for (const wing of wings) {
    wing.rotation.x = THREE.MathUtils.degToRad(70);
    wing.rotation.z *= 0.85;
  }
}