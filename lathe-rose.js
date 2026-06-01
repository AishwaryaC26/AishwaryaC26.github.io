import { flower3Straight } from "./lathe-lib.js";

const DEFAULT_BLOOM_DURATION = 4;

function applyBloomProgress(morphMeshes, progress) {
  const a = 0.5 * (1 - Math.cos(progress * Math.PI));
  const w0 = 4 * a * (1 - a);
  const w1 = Math.max(0, 2 * a * (a - 0.5));
  for (const m of morphMeshes) {
    m.morphTargetInfluences[0] = w0;
    m.morphTargetInfluences[1] = w1;
  }
}

export function createBloomableRose(options = {}) {
  const { bloomDuration = DEFAULT_BLOOM_DURATION, ...flowerOptions } = options;
  const rose = flower3Straight({
    name: "rose",
    col: "pink",
    stem: true,
    ...flowerOptions,
  });
  const morphMeshes = rose.userData.morphMeshes;

  for (const m of morphMeshes) {
    m.morphTargetInfluences[0] = 0;
    m.morphTargetInfluences[1] = 0;
  }

  let bloomStart = null;

  return {
    group: rose,
    startBloom(delay = 0.5) {
      bloomStart = performance.now() + delay * 1000;
    },
    update(now) {
      if (bloomStart === null) return;
      const elapsed = (now - bloomStart) / 1000;
      if (elapsed <= 0) return;
      applyBloomProgress(
        morphMeshes,
        Math.min(elapsed / bloomDuration, 1),
      );
    },
  };
}