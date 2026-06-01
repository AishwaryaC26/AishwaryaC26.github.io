import * as THREE from "three";
import { createBloomableRose } from "./lathe-rose.js";

/** Decorative pink roses along the bottom (not the main interactive flower). */
const GARDEN_SPECS = [
  {
    ndc: { x: -0.58, y: -0.94 },
    height: 0.85,
    rotY: 0.35,
    bloomDelay: 0.5,
    bloomDuration: 2.8,
    stemTheta: 0.52,
    bendScale: 1.08,
    leafCount: 2,
    bloomColor: 0xffc8e0,
  },
  {
    ndc: { x: -0.22, y: -0.97 },
    height: 0.62,
    rotY: -0.22,
    bloomDelay: 0.85,
    bloomDuration: 4.6,
    stemTheta: -0.28,
    bendScale: 0.92,
    leafCount: 1,
    bloomColor: 0xd63878,
  },
  {
    ndc: { x: 0.1, y: -0.95 },
    height: 1.0,
    rotY: 0.12,
    bloomDelay: 1.15,
    bloomDuration: 3.2,
    stemTheta: 0.18,
    bendScale: 1.15,
    leafCount: 2,
    bloomColor: 0xff9ec8,
  },
  {
    ndc: { x: 0.38, y: -0.96 },
    height: 0.69,
    rotY: -0.38,
    bloomDelay: 1.45,
    stemTheta: -0.48,
    bendScale: 1.05,
    leafCount: 1,
    bloomColor: 0xffb0d8,
  },
  {
    ndc: { x: 0.65, y: -0.93 },
    height: 1.2,
    rotY: 0.48,
    bloomDelay: 1.75,
    bloomDuration: 3.6,
    stemTheta: 0.62,
    bendScale: 0.88,
    leafCount: 2,
    bloomColor: 0xe84888,
  },
  {
    ndc: { x: 0.86, y: -0.97 },
    height: 0.55,
    rotY: -0.12,
    bloomDelay: 2.05,
    bloomDuration: 4.2,
    stemTheta: -0.12,
    bendScale: 0.95,
    leafCount: 1,
    bloomColor: 0xffd6e8,
  },
];

const _box = new THREE.Box3();
const _anchor = new THREE.Vector3();
const _target = new THREE.Vector3();
const _temp = new THREE.Vector3();
const _ndcProj = new THREE.Vector3();

function ndcToWorldAtDepth(camera, ndcX, ndcY, depthRef, out) {
  camera.updateMatrixWorld();
  const ndcZ = _ndcProj.copy(depthRef).project(camera).z;
  return out.set(ndcX, ndcY, ndcZ).unproject(camera);
}

function getStemBase(object, out) {
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  return out.set(
    (_box.min.x + _box.max.x) * 0.5,
    _box.min.y,
    (_box.min.z + _box.max.z) * 0.5,
  );
}

function scaleToHeight(object, targetHeight) {
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  const height = _box.max.y - _box.min.y;
  if (height > 0) object.scale.setScalar(targetHeight / height);
}

function layoutFlowerAtNdc(camera, group, spec, depthRef) {
  group.rotation.set(0, spec.rotY, 0);
  group.scale.setScalar(1);
  group.position.set(0, 0, 0);
  group.updateMatrixWorld(true);
  scaleToHeight(group, spec.height);

  getStemBase(group, _anchor);
  ndcToWorldAtDepth(camera, spec.ndc.x, spec.ndc.y, depthRef, _target);
  _temp.copy(_target).sub(_anchor);
  group.position.copy(_temp);
}

export function createGarden(scene, camera) {
  const plants = GARDEN_SPECS.map((spec) => {
    const plant = createBloomableRose({
      stemTheta: spec.stemTheta,
      bendScale: spec.bendScale,
      leafCount: spec.leafCount,
      bloomColor: spec.bloomColor,
      bloomDuration: spec.bloomDuration,
    });
    scene.add(plant.group);
    return { plant, spec };
  });

  return {
    plants,
    startBlooming() {
      for (const { plant, spec } of plants) {
        plant.startBloom(spec.bloomDelay);
      }
    },
    layout(depthRef) {
      for (const { plant, spec } of plants) {
        layoutFlowerAtNdc(camera, plant.group, spec, depthRef);
      }
    },
    update(now) {
      for (const { plant } of plants) plant.update(now);
    },
  };
}
