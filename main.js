import "./theme.js";
import * as THREE from "three";
import { applyFlowerTheme, applyBeeTheme } from "./scene-theme.js";
import { createBee, animateWings, foldWings, setEyeClose } from "./bee.js";
import { createSparkleTrail } from "./sparkles.js";
import { createBloomableRose} from "./lathe-rose.js";
import { createGarden } from "./garden.js";

// Scene setup
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
camera.position.set(0, 0, 5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("bg"),
  antialias: true,
  alpha: true,
});
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
camera.updateProjectionMatrix();

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffc8dd, 2.0);
dirLight.position.set(2, 4, 3);
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0xb8d4ff, 1.0);
fillLight.position.set(-2, -1, 2);
scene.add(fillLight);

function applySceneTheme(isDark) {
  if (isDark) {
    ambientLight.intensity = 1.2;
    dirLight.color.setHex(0xffc0d8);
    dirLight.intensity = 1.35;
    fillLight.color.setHex(0x9ab0d0);
    fillLight.intensity = 0.75;
  } else {
    ambientLight.intensity = 1.5;
    dirLight.color.setHex(0xffc8dd);
    dirLight.intensity = 2.0;
    fillLight.color.setHex(0xb8d4ff);
    fillLight.intensity = 1.0;
  }

  if (latheRose) applyFlowerTheme(latheRose.group, isDark);
  if (garden) {
    for (const { plant } of garden.plants) {
      applyFlowerTheme(plant.group, isDark);
    }
  }
  if (beeGroup) applyBeeTheme(beeGroup, isDark);
  sparkles.setTheme(isDark);
}

window.addEventListener("themechange", (e) => {
  applySceneTheme(e.detail.isDark);
});

let latheRose = null;
let garden = null;
let beeGroup = null;
let beeWings = [];
let beeEyes = [];
let sleepStartTime = 0;
let zzzShown = false;
const EYE_CLOSE_DELAY = 1;
const EYE_CLOSE_DURATION = 0.3;
const sparkles = createSparkleTrail(scene);
const lastBeePos = new THREE.Vector3();
const beeVelocity = new THREE.Vector3();

const LAYOUT = {
  roseNdc: { x: -0.88, y: -0.92 },
  roseHeight: 1.35,
  beeStartNdc: { x: 0.88, y: 0.88 },
  beeSize: 0.13,
  textLoopNdc: { x: 0, y: 0 },
  textLoopRadiusNdc: 0.42,
};

let beeRefDistance = 5;

const flight = {
  start: new THREE.Vector3(),
  end: new THREE.Vector3(),
  loopCenter: new THREE.Vector3(),
  loopRadiusX: 0,
  loopRadiusY: 0,
  loopJoinAngle: 0,
  loopExitAngle: 0,
  loopSweep: 0,
  approachShare: 0.14,
  approachCurve: null,
  landingCurve: null,
  arcLengths: null,
  arcSampleCount: 0,
  totalArcLength: 0,
  wingLoopEndT: 0.72,
  curve: null,
  loopEnd: 0.72,
  startTime: 0,
  duration: 5.4,
};

const _smoothFacing = new THREE.Vector3(0, 0, 1);
const _loopPt = new THREE.Vector3();
const _tangent = new THREE.Vector3();

let phase = "loading";
let animTime = 0;
let lastFrameTime = performance.now();

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _target = new THREE.Vector3();
const _anchor = new THREE.Vector3();
const _look = new THREE.Vector3();
const _tempA = new THREE.Vector3();
const _tempB = new THREE.Vector3();
const _ndcProj = new THREE.Vector3();
const _bestNdc = new THREE.Vector2();
const _zzzWorld = new THREE.Vector3();
const zzzEl = document.getElementById("zzz");
const contentEl = document.querySelector(".content");
const TEXT_LOOP_PAD_PX = 34;
/** Push the left arc outward in screen space (applied directly on the loop path). */
const TEXT_LOOP_LEFT_SCREEN_OFFSET_PX = 82;
/** Bee path follows the mesh center — pad in screen px before world conversion. */
const BEE_ORBIT_RADIUS_PX = 16;
/** Keep the orbit inside the viewport. */
const VIEWPORT_ORBIT_PAD_PX = 32;
const LOOP_ORBIT_SCALE = 1.06;
let textLoopRect = null;

/** Map screen NDC (x,y) to world space at the same depth as `depthRef`. */
function ndcToWorldAtDepth(ndcX, ndcY, depthRef, out) {
  camera.updateMatrixWorld();
  const ndcZ = _ndcProj.copy(depthRef).project(camera).z;
  return out.set(ndcX, ndcY, ndcZ).unproject(camera);
}

function getWorldBox(object) {
  object.updateMatrixWorld(true);
  return _box.setFromObject(object);
}

const _boxCorners = [
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
];

function bboxCornerScreen(box, anchor, out) {
  camera.updateMatrixWorld();
  const { min, max } = box;
  const xs = [min.x, max.x];
  const ys = [min.y, max.y];
  const zs = [min.z, max.z];
  let i = 0;
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        _boxCorners[i++].set(x, y, z);
      }
    }
  }

  let best = _boxCorners[0];
  _ndcProj.copy(best).project(camera);
  _bestNdc.set(_ndcProj.x, _ndcProj.y);

  for (let j = 1; j < 8; j++) {
    const p = _boxCorners[j];
    _ndcProj.copy(p).project(camera);
    const better =
      anchor === "bottom-left"
        ? _ndcProj.x < _bestNdc.x ||
          (Math.abs(_ndcProj.x - _bestNdc.x) < 1e-4 && _ndcProj.y < _bestNdc.y)
        : anchor === "bottom-right"
          ? _ndcProj.x > _bestNdc.x ||
            (Math.abs(_ndcProj.x - _bestNdc.x) < 1e-4 && _ndcProj.y < _bestNdc.y)
          : anchor === "top-right"
            ? _ndcProj.x > _bestNdc.x ||
              (Math.abs(_ndcProj.x - _bestNdc.x) < 1e-4 && _ndcProj.y > _bestNdc.y)
            : _ndcProj.y < _bestNdc.y ||
              (Math.abs(_ndcProj.y - _bestNdc.y) < 1e-4 && _ndcProj.x < _bestNdc.x);
    if (better) {
      best = p;
      _bestNdc.set(_ndcProj.x, _ndcProj.y);
    }
  }

  return out.copy(best);
}

function scaleToHeight(object, targetHeight) {
  const box = getWorldBox(object);
  const height = box.max.y - box.min.y;
  if (height > 0) object.scale.setScalar(targetHeight / height);
}

function getStemBase(object, out) {
  const box = getWorldBox(object);
  return out.set(
    (box.min.x + box.max.x) * 0.5,
    box.min.y,
    (box.min.z + box.max.z) * 0.5,
  );
}

function pinWorldPointToNdc(worldPoint, ndcX, ndcY, deltaOut) {
  ndcToWorldAtDepth(ndcX, ndcY, worldPoint, _target);
  return deltaOut.copy(_target).sub(worldPoint);
}

const SWAY = {
  zAmp: 0.024,
  xAmp: 0.011,
  zSpeed: 1.1,
  xSpeed: 0.85,
};

function initFlowerSway(group) {
  if (group.userData.swayPhase == null) {
    group.userData.swayPhase = Math.random() * Math.PI * 2;
  }
}

function saveFlowerSwayBase(group) {
  initFlowerSway(group);
  group.userData.swayBase = {
    x: group.rotation.x,
    y: group.rotation.y,
    z: group.rotation.z,
  };
}

function updateFlowerSway(group, timeSec) {
  const base = group.userData.swayBase;
  const phase = group.userData.swayPhase ?? 0;
  if (!base) return;
  group.rotation.x =
    base.x + Math.sin(timeSec * SWAY.xSpeed + phase) * SWAY.xAmp;
  group.rotation.y = base.y;
  group.rotation.z =
    base.z + Math.sin(timeSec * SWAY.zSpeed + phase * 1.17) * SWAY.zAmp;
}

function layoutRose() {
  if (!latheRose) return;
  const g = latheRose.group;
  const morphMeshes = g.userData.morphMeshes;
  const savedMorph = morphMeshes.map((m) => m.morphTargetInfluences.slice());

  g.rotation.set(0, 0.45, 0);
  g.scale.setScalar(1);
  g.position.set(0, 0, 0);
  g.updateMatrixWorld(true);

  for (const m of morphMeshes) {
    m.morphTargetInfluences[0] = 0;
    m.morphTargetInfluences[1] = 1;
  }
  g.updateMatrixWorld(true);
  scaleToHeight(g, LAYOUT.roseHeight);

  morphMeshes.forEach((m, i) => {
    m.morphTargetInfluences[0] = savedMorph[i][0];
    m.morphTargetInfluences[1] = savedMorph[i][1];
  });
  g.updateMatrixWorld(true);

  getStemBase(g, _anchor);
  pinWorldPointToNdc(_anchor, LAYOUT.roseNdc.x, LAYOUT.roseNdc.y, _tempA);
  g.position.copy(_tempA);

  if (garden) {
    getStemBase(g, _anchor);
    garden.layout(_anchor);
    for (const { plant } of garden.plants) {
      saveFlowerSwayBase(plant.group);
    }
  }

  saveFlowerSwayBase(g);
}

function getFlowerLandingSpot(out) {
  const box = getWorldBox(latheRose.group);
  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  return out.set(cx, box.max.y + 0.05, cz);
}

function worldRadiusFromNdc(ndcX, ndcY, ndcRadius, depthRef) {
  ndcToWorldAtDepth(ndcX, ndcY, depthRef, _anchor);
  ndcToWorldAtDepth(ndcX + ndcRadius, ndcY, depthRef, _target);
  return _anchor.distanceTo(_target);
}

function screenToNdc(screenX, screenY, out = _bestNdc) {
  out.x = (screenX / window.innerWidth) * 2 - 1;
  out.y = -(screenY / window.innerHeight) * 2 + 1;
  return out;
}

function screenToWorldAtDepth(screenX, screenY, depthRef, out) {
  screenToNdc(screenX, screenY, _bestNdc);
  return ndcToWorldAtDepth(_bestNdc.x, _bestNdc.y, depthRef, out);
}

/** Cache `.content` screen bounds for the bee orbit (world-space ellipse). */
function computeTextLoopFromContent() {
  if (!contentEl) return false;

  const rect = contentEl.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;

  const pad = TEXT_LOOP_PAD_PX;
  textLoopRect = {
    rect,
    pad,
    cx: rect.left + rect.width * 0.5,
    cy: rect.top + rect.height * 0.5,
  };
  return true;
}

function setupTextLoopOrbit(depthRef) {
  if (!textLoopRect) return false;

  const { rect, pad, cx, cy } = textLoopRect;

  const hw = rect.width * 0.5;
  const hh = rect.height * 0.5;

  let rXPx = hw + pad + BEE_ORBIT_RADIUS_PX;
  let rYPx = hh + pad + BEE_ORBIT_RADIUS_PX;

  rXPx = Math.min(rXPx, cx - VIEWPORT_ORBIT_PAD_PX, window.innerWidth - cx - VIEWPORT_ORBIT_PAD_PX);
  rYPx = Math.min(rYPx, cy - VIEWPORT_ORBIT_PAD_PX, window.innerHeight - cy - VIEWPORT_ORBIT_PAD_PX);

  screenToWorldAtDepth(cx, cy, depthRef, flight.loopCenter);
  screenToWorldAtDepth(cx + rXPx, cy, depthRef, _tempA);
  screenToWorldAtDepth(cx, cy + rYPx, depthRef, _tempB);
  flight.loopRadiusX = flight.loopCenter.distanceTo(_tempA) * LOOP_ORBIT_SCALE;
  flight.loopRadiusY = flight.loopCenter.distanceTo(_tempB) * LOOP_ORBIT_SCALE;

  screenToWorldAtDepth(rect.right + pad, rect.top - pad, depthRef, _tempA);
  flight.loopJoinAngle = Math.atan2(
    _tempA.y - flight.loopCenter.y,
    _tempA.x - flight.loopCenter.x,
  );

  screenToWorldAtDepth(cx, rect.bottom + pad, depthRef, _tempA);
  flight.loopExitAngle = Math.atan2(
    _tempA.y - flight.loopCenter.y,
    _tempA.x - flight.loopCenter.x,
  );

  return true;
}

function loopPointAt(angle, out, depthRef = flight.end) {
  const c = flight.loopCenter;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  out.set(
    c.x + flight.loopRadiusX * cosA,
    c.y + flight.loopRadiusY * sinA,
    c.z,
  );

  const leftWeight = cosA < 0 ? 0.5 * (1 - cosA) : 0;
  if (leftWeight < 1e-4) return out;

  _ndcProj.copy(out).project(camera);
  const sx = (_ndcProj.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-_ndcProj.y * 0.5 + 0.5) * window.innerHeight;
  const offsetPx = TEXT_LOOP_LEFT_SCREEN_OFFSET_PX * leftWeight;
  return screenToWorldAtDepth(sx - offsetPx, sy, depthRef, out);
}

function buildFlightPath() {
  loopPointAt(flight.loopJoinAngle, _loopPt);
  _tempB.lerpVectors(flight.start, _loopPt, 0.55);
  flight.approachCurve = new THREE.CatmullRomCurve3(
    [flight.start.clone(), _tempB.clone(), _loopPt.clone()],
    false,
    "centripetal",
    0.5,
  );

  loopPointAt(flight.loopJoinAngle - flight.loopSweep, _loopPt);
  _tempA.lerpVectors(_loopPt, flight.end, 0.42);
  flight.landingCurve = new THREE.CatmullRomCurve3(
    [_loopPt.clone(), _tempA.clone(), flight.end.clone()],
    false,
    "centripetal",
    0.5,
  );

  flight.curve = null;
  buildArcLengthTable();
}

function sampleFlightPathParam(u, out) {
  if (u <= 0) return out.copy(flight.start);

  const tApproach = flight.approachShare;
  const tLoopEnd = flight.loopEnd;

  if (flight.approachCurve && u < tApproach) {
    return flight.approachCurve.getPointAt(u / tApproach, out);
  }
  if (u < tLoopEnd) {
    const segU = (u - tApproach) / (tLoopEnd - tApproach);
    const angle = flight.loopJoinAngle - flight.loopSweep * segU;
    return loopPointAt(angle, out);
  }
  if (flight.landingCurve) {
    return flight.landingCurve.getPointAt((u - tLoopEnd) / (1 - tLoopEnd), out);
  }
  return out.copy(flight.end);
}

function buildArcLengthTable() {
  const samples = 320;
  const lengths = [0];
  sampleFlightPathParam(0, _tempA);

  for (let i = 1; i <= samples; i++) {
    sampleFlightPathParam(i / samples, _tempB);
    lengths.push(lengths[i - 1] + _tempA.distanceTo(_tempB));
    _tempA.copy(_tempB);
  }

  flight.arcSampleCount = samples;
  flight.arcLengths = lengths;
  flight.totalArcLength = lengths[samples];

  const loopEndLen = arcLengthAtParam(flight.loopEnd);
  flight.wingLoopEndT =
    flight.totalArcLength > 0 ? loopEndLen / flight.totalArcLength : flight.loopEnd;
}

function arcLengthAtParam(u) {
  if (!flight.arcLengths) return 0;
  const samples = flight.arcSampleCount;
  const idx = Math.min(Math.max(u, 0), 1) * samples;
  const i = Math.min(Math.floor(idx), samples - 1);
  const frac = idx - i;
  const len0 = flight.arcLengths[i];
  const len1 = flight.arcLengths[i + 1];
  return len0 + frac * (len1 - len0);
}

function sampleFlightPath(t, out) {
  if (t <= 0) return out.copy(flight.start);
  if (
    t >= 1 ||
    !flight.arcLengths ||
    flight.totalArcLength <= 0
  ) {
    return sampleFlightPathParam(1, out);
  }

  const targetLen = t * flight.totalArcLength;
  const lengths = flight.arcLengths;
  const samples = flight.arcSampleCount;

  let lo = 0;
  let hi = samples;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid] < targetLen) lo = mid + 1;
    else hi = mid;
  }

  const i = Math.max(1, Math.min(lo, samples));
  const len0 = lengths[i - 1];
  const len1 = lengths[i];
  const segT = len1 > len0 ? (targetLen - len0) / (len1 - len0) : 0;
  const u = ((i - 1) + segT) / samples;
  return sampleFlightPathParam(u, out);
}

function sampleFlightTangent(t, out) {
  const dt = 0.004;
  const t0 = Math.max(t - dt, 0);
  const t1 = Math.min(t + dt, 1);
  sampleFlightPath(t0, _tempA);
  sampleFlightPath(t1, _tempB);
  return out.copy(_tempB).sub(_tempA);
}

function alignBeeToPathDirection() {
  _look.copy(beeGroup.position).add(_smoothFacing);
  beeGroup.lookAt(_look);
}

function updateBeeFacing(progress, dt) {
  sampleFlightTangent(Math.min(progress, 0.999), _tangent);
  if (_tangent.lengthSq() < 1e-8) return;
  _tangent.normalize();
  const blend = 1 - Math.pow(0.018, dt * 60);
  _smoothFacing.lerp(_tangent, blend);
  alignBeeToPathDirection();
}

function updateBeeScreenScale() {
  if (!beeGroup) return;
  const dist = beeGroup.position.distanceTo(camera.position);
  beeGroup.scale.setScalar((dist / beeRefDistance) * LAYOUT.beeSize);
}

function refreshFlightPath() {
  getFlowerLandingSpot(flight.end);
  beeRefDistance = flight.end.distanceTo(camera.position);

  computeTextLoopFromContent();

  beeGroup.position.set(0, 0, 0);
  beeGroup.rotation.set(0, 0, 0);
  beeGroup.scale.setScalar(LAYOUT.beeSize);

  ndcToWorldAtDepth(
    LAYOUT.beeStartNdc.x,
    LAYOUT.beeStartNdc.y,
    flight.end,
    _target,
  );
  const box = getWorldBox(beeGroup);
  bboxCornerScreen(box, "top-right", _anchor);
  _tempA.copy(_target).sub(_anchor);
  beeGroup.position.copy(_tempA);
  flight.start.copy(beeGroup.position);

  if (!setupTextLoopOrbit(flight.end)) {
    ndcToWorldAtDepth(
      LAYOUT.textLoopNdc.x,
      LAYOUT.textLoopNdc.y,
      flight.end,
      flight.loopCenter,
    );
    flight.loopRadiusX = flight.loopRadiusY = worldRadiusFromNdc(
      LAYOUT.textLoopNdc.x,
      LAYOUT.textLoopNdc.y,
      LAYOUT.textLoopRadiusNdc,
      flight.end,
    );
    flight.loopJoinAngle = Math.PI / 4;
    flight.loopExitAngle = -Math.PI / 2;
  }

  let sweep = flight.loopJoinAngle - flight.loopExitAngle;
  while (sweep <= 0) sweep += Math.PI * 2;
  if (sweep < Math.PI * 2) sweep += Math.PI * 2;
  flight.loopSweep = sweep;

  buildFlightPath();
}

function beginFlight() {
  beeGroup.visible = true;
  refreshFlightPath();
  beeGroup.position.copy(flight.start);
  updateBeeScreenScale();
  sampleFlightTangent(0.001, _smoothFacing);
  if (_smoothFacing.lengthSq() > 1e-8) _smoothFacing.normalize();
  alignBeeToPathDirection();
  lastBeePos.copy(flight.start);
  sparkles.reset();
  flight.startTime = performance.now();
  phase = "flying";
}

function updateZzzPosition() {
  if (!zzzEl || !beeGroup) return;
  beeGroup.updateMatrixWorld(true);
  _zzzWorld.set(0.58, 0.78, 0.12);
  beeGroup.localToWorld(_zzzWorld);
  _ndcProj.copy(_zzzWorld).project(camera);
  const x = (_ndcProj.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-_ndcProj.y * 0.5 + 0.5) * window.innerHeight;
  zzzEl.style.left = `${x}px`;
  zzzEl.style.top = `${y}px`;
}

function showZzz() {
  updateZzzPosition();
  zzzEl?.classList.add("visible");
}

function startScene() {
  if (!latheRose || !beeGroup || phase !== "loading") return;
  phase = "starting";
  layoutRose();
  latheRose.group.visible = true;
  latheRose.startBloom(0.6);
  garden.startBlooming();
  requestAnimationFrame(() => {
    layoutRose();
    requestAnimationFrame(() => {
      beginFlight();
    });
  });
}

latheRose = createBloomableRose();
initFlowerSway(latheRose.group);
scene.add(latheRose.group);

garden = createGarden(scene, camera);
for (const { plant } of garden.plants) {
  initFlowerSway(plant.group);
}
layoutRose();

const { group, wings, eyes } = createBee();
beeGroup = group;
beeWings = wings;
beeEyes = eyes;
beeGroup.visible = false;
scene.add(beeGroup);

applySceneTheme(document.documentElement.classList.contains("dark"));

startScene();

function animate(now) {
  requestAnimationFrame(animate);

  const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;
  animTime += dt;

  if (phase === "intro") {
    applySunrise(0);
    const introElapsed = (now - introStartTime) / 1000;
    if (introElapsed >= INTRO_HOLD) beginSunrise();
  } else if (phase === "sunrise") {
    const sunriseT = Math.min(
      (now - sunriseStartTime) / 1000 / SUNRISE_DURATION,
      1,
    );
    applySunrise(sunriseT);
    if (sunriseT >= 1) {
      if (!dayBegun) {
        dayBegun = true;
        beginDay();
      }
      startScene();
    }
  } else if (phase === "flying") {
    const elapsed = (now - flight.startTime) / 1000;
    const progress = Math.min(elapsed / flight.duration, 1);

    sampleFlightPath(progress, beeGroup.position);
    updateBeeScreenScale();
    updateBeeFacing(progress, dt);

    const wingSpeed = progress < flight.wingLoopEndT ? 1.15 : 0.75;
    animateWings(beeWings, animTime, wingSpeed);

    if (dt > 0) {
      beeVelocity.copy(beeGroup.position).sub(lastBeePos).divideScalar(dt);
      lastBeePos.copy(beeGroup.position);
    }
    sparkles.emit(beeGroup.position, beeVelocity, dt);

    if (progress >= 1) {
      phase = "sleeping";
      sleepStartTime = now;
      foldWings(beeWings);
      setEyeClose(beeEyes, 0);
      beeGroup.rotation.set(0.15, 0.4, 0.35);
      updateBeeScreenScale();
    }
  } else if (phase === "sleeping" && beeGroup && latheRose) {
    getFlowerLandingSpot(beeGroup.position);
    beeGroup.position.y += Math.sin(animTime * 1.5) * 0.012;
    updateBeeScreenScale();
    beeGroup.rotation.z = 0.35 + Math.sin(animTime * 0.8) * 0.03;

    const sleepElapsed = (now - sleepStartTime) / 1000;
    if (sleepElapsed >= EYE_CLOSE_DELAY) {
      const closeT = Math.min(
        (sleepElapsed - EYE_CLOSE_DELAY) / EYE_CLOSE_DURATION,
        1,
      );
      const eased = closeT * closeT * (3 - 2 * closeT);
      setEyeClose(beeEyes, eased);
      if (closeT >= 1 && !zzzShown) {
        zzzShown = true;
        showZzz();
      }
    }

    if (zzzShown) updateZzzPosition();
  }

  sparkles.update(dt);
  if (latheRose) {
    latheRose.update(now);
    updateFlowerSway(latheRose.group, animTime);
  }
  if (garden) {
    garden.update(now);
    for (const { plant } of garden.plants) {
      updateFlowerSway(plant.group, animTime);
    }
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  renderer.setSize(window.innerWidth, window.innerHeight);
  lastFrameTime = performance.now();

  layoutRose();

  if (phase === "sleeping" && beeGroup && latheRose) {
    getFlowerLandingSpot(beeGroup.position);
    updateBeeScreenScale();
    if (zzzShown) updateZzzPosition();
  } else if (phase === "flying" && beeGroup && latheRose) {
    const elapsed = (performance.now() - flight.startTime) / 1000;
    const progress = Math.min(elapsed / flight.duration, 1);
    refreshFlightPath();
    sampleFlightPath(progress, beeGroup.position);
    updateBeeFacing(progress, 1 / 60);
    updateBeeScreenScale();
  }
});
