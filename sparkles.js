import * as THREE from "three";

function drawTaperedRay(ctx, length, width) {
  const w2 = width / 2;
  const taper = width * 0.12;
  ctx.beginPath();
  ctx.moveTo(-w2, -length);
  ctx.lineTo(w2, -length);
  ctx.lineTo(taper, 0);
  ctx.lineTo(w2, length);
  ctx.lineTo(-w2, length);
  ctx.lineTo(-taper, 0);
  ctx.closePath();
  ctx.fill();
}

function createSparkleTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);
  ctx.translate(cx, cy);

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 22);
  glow.addColorStop(0, "rgba(255, 245, 200, 0.85)");
  glow.addColorStop(1, "rgba(255, 200, 60, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();

  const rayGrad = (len) => {
    const g = ctx.createLinearGradient(0, -len, 0, len);
    g.addColorStop(0, "rgba(255, 190, 40, 0)");
    g.addColorStop(0.2, "rgba(255, 225, 130, 1)");
    g.addColorStop(0.5, "rgba(255, 255, 240, 1)");
    g.addColorStop(0.8, "rgba(255, 225, 130, 1)");
    g.addColorStop(1, "rgba(255, 190, 40, 0)");
    return g;
  };

  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);
    ctx.fillStyle = rayGrad(52);
    drawTaperedRay(ctx, 52, 7);
    ctx.restore();
  }

  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
    ctx.fillStyle = rayGrad(28);
    drawTaperedRay(ctx, 28, 3.5);
    ctx.restore();
  }

  ctx.fillStyle = "rgba(255, 255, 245, 1)";
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createSparkleTrail(scene, count = 120) {
  const texture = createSparkleTexture();
  const pool = [];

  for (let i = 0; i < count; i++) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: 0xffc42e,
      transparent: true,
      opacity: 0,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    scene.add(sprite);
    pool.push({
      sprite,
      life: 0,
      maxLife: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      spin: 0,
      baseScale: 0.04,
    });
  }

  let emitTimer = 0;
  const _offset = new THREE.Vector3();
  const _vel = new THREE.Vector3();

  function spawn(position, velocity, burst = 1) {
    for (let n = 0; n < burst; n++) {
      const p = pool.find((item) => item.life <= 0);
      if (!p) break;

      _offset.set(
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.08,
      );
      p.sprite.position.copy(position).add(_offset);

      _vel
        .copy(velocity)
        .multiplyScalar(-0.35)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.25,
            (Math.random() - 0.5) * 0.2 - 0.05,
            (Math.random() - 0.5) * 0.25,
          ),
        );
      p.vx = _vel.x;
      p.vy = _vel.y;
      p.vz = _vel.z;

      p.maxLife = 0.45 + Math.random() * 0.55;
      p.life = p.maxLife;
      p.spin = (Math.random() - 0.5) * 6;
      p.baseScale = 0.038 + Math.random() * 0.05;
      p.sprite.material.opacity = 1;
      p.sprite.visible = true;
    }
  }

  return {
    emit(position, velocity, dt) {
      emitTimer += dt;
      const rate = 0.028;
      while (emitTimer >= rate) {
        emitTimer -= rate;
        spawn(position, velocity, 2 + Math.floor(Math.random() * 2));
      }
    },

    update(dt) {
      for (const p of pool) {
        if (p.life <= 0) {
          p.sprite.visible = false;
          continue;
        }

        p.life -= dt;
        const t = Math.max(p.life / p.maxLife, 0);
        const twinkle =
          0.65 + Math.sin((p.maxLife - p.life) * 22 + p.spin) * 0.35;

        p.sprite.position.x += p.vx * dt;
        p.sprite.position.y += p.vy * dt;
        p.sprite.position.z += p.vz * dt;
        p.vx *= 0.96;
        p.vy *= 0.96 - dt * 0.08;
        p.vz *= 0.96;

        p.sprite.material.opacity = t * twinkle;
        const scale = p.baseScale * (0.5 + t * 0.9);
        p.sprite.scale.set(scale, scale, 1);
        p.sprite.material.rotation += p.spin * dt;

        if (p.life <= 0) {
          p.sprite.visible = false;
          p.sprite.material.opacity = 0;
        }
      }
    },

    reset() {
      emitTimer = 0;
      for (const p of pool) {
        p.life = 0;
        p.sprite.visible = false;
        p.sprite.material.opacity = 0;
      }
    },

    setTheme(isDark) {
      const color = isDark ? 0xf5c842 : 0xffc42e;
      for (const p of pool) {
        p.sprite.material.color.setHex(color);
      }
    },
  };
}
