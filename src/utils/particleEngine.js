// Particle Engine V3 — Canvas 2D with object pooling and force-based physics
// V1 = CSS span-based (global.css keyframes), V2 = canvas demo (particle-demo.html)
// V3 = production canvas integration with conservative tuning for V1 parity

// ============================================================
// SIMPLEX NOISE 2D (Stefan Gustavson, public domain)
// ============================================================
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const grad3 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
const perm = new Uint8Array(512);
const permMod8 = new Uint8Array(512);

const p = new Uint8Array(256);
for (let i = 0; i < 256; i++) p[i] = i;
for (let i = 255; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [p[i], p[j]] = [p[j], p[i]];
}
for (let i = 0; i < 512; i++) {
  perm[i] = p[i & 255];
  permMod8[i] = perm[i] % 8;
}

function noise2D(x, y) {
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t), y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  const ii = i & 255, jj = j & 255;

  let n0 = 0, n1 = 0, n2 = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) { t0 *= t0; const g = grad3[permMod8[ii + perm[jj]]]; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) { t1 *= t1; const g = grad3[permMod8[ii + i1 + perm[jj + j1]]]; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) { t2 *= t2; const g = grad3[permMod8[ii + 1 + perm[jj + 1]]]; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }

  return 70 * (n0 + n1 + n2);
}

// ============================================================
// INTERPOLATION HELPERS
// ============================================================
export function lerpStops(stops, t) {
  t = Math.max(0, Math.min(1, t));
  if (t <= stops[0].t) return stops[0].value;
  if (t >= stops[stops.length - 1].t) return stops[stops.length - 1].value;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].t) {
      const f = (t - stops[i - 1].t) / (stops[i].t - stops[i - 1].t);
      return stops[i - 1].value + f * (stops[i].value - stops[i - 1].value);
    }
  }
  return stops[stops.length - 1].value;
}

export function lerpColorStops(stops, t) {
  t = Math.max(0, Math.min(1, t));
  if (t <= stops[0].t) return { r: stops[0].r, g: stops[0].g, b: stops[0].b };
  if (t >= stops[stops.length - 1].t) {
    const s = stops[stops.length - 1];
    return { r: s.r, g: s.g, b: s.b };
  }
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].t) {
      const f = (t - stops[i - 1].t) / (stops[i].t - stops[i - 1].t);
      const a = stops[i - 1], b = stops[i];
      return {
        r: Math.round(a.r + f * (b.r - a.r)),
        g: Math.round(a.g + f * (b.g - a.g)),
        b: Math.round(a.b + f * (b.b - a.b)),
      };
    }
  }
  const s = stops[stops.length - 1];
  return { r: s.r, g: s.g, b: s.b };
}

export function hexToRGB(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// ============================================================
// PARTICLE POOL
// ============================================================
class ParticlePool {
  constructor(max) {
    this.max = max;
    this.particles = [];
    this.cursor = 0;
    for (let i = 0; i < max; i++) {
      this.particles.push({
        active: false,
        x: 0, y: 0, vx: 0, vy: 0,
        age: 0, lifetime: 0,
        size: 0, baseSize: 0,
        r: 0, g: 0, b: 0, alpha: 0,
        rgbStr: 'rgb(0,0,0)',
        seed: 0,
        type: 'core',
        parentSeed: -1,
        phase: 0,
        splitAngle: 0,
        splitDist: 0,
        hasGhost: false,
        swaySign: 1,
        prevX: 0, prevY: 0,
        prev2X: 0, prev2Y: 0,
        glintTimer: 0,
      });
    }
  }

  spawn() {
    const start = this.cursor;
    for (let i = 0; i < this.max; i++) {
      const idx = (start + i) % this.max;
      if (!this.particles[idx].active) {
        this.cursor = (idx + 1) % this.max;
        this.particles[idx].active = true;
        this.particles[idx].hasGhost = false;
        return this.particles[idx];
      }
    }
    return null;
  }

  clear() {
    for (let i = 0; i < this.max; i++) this.particles[i].active = false;
  }

  get activeCount() {
    let c = 0;
    for (let i = 0; i < this.max; i++) if (this.particles[i].active) c++;
    return c;
  }
}

// ============================================================
// EMITTER
// ============================================================
export class Emitter {
  constructor(config, poolSize) {
    this.config = config;
    this.pool = new ParticlePool(poolSize);
    this.accumulator = 0;
    this.time = 0;
    this._gustTimer = 0;
    this._gustActive = 0;
    this._gustDir = 0;
    this._pollenAccum = 0;
  }

  update(dt, w, h, heatMult) {
    this.time += dt;
    const cfg = this.config;
    const rate = cfg.rate * (heatMult.rateScale || 1);
    const sizeScale = heatMult.sizeScale || 1;
    const turbScale = heatMult.turbulenceScale || 1;
    this._childScale = heatMult.childScale != null ? heatMult.childScale : 1;
    const theme = cfg.theme;

    // Emit core particles
    this.accumulator += rate * dt;
    while (this.accumulator >= 1) {
      this.accumulator -= 1;
      const p = this.pool.spawn();
      if (!p) break;
      this._initCore(p, cfg, w, h, sizeScale);
    }

    // Grass: pollen dust (ambient background particles)
    if (theme === 'grass') {
      this._pollenAccum += 3 * dt;
      while (this._pollenAccum >= 1) {
        this._pollenAccum -= 1;
        const pp = this.pool.spawn();
        if (!pp) break;
        pp.type = 'pollen';
        pp.x = Math.random() * w;
        pp.y = Math.random() * h;
        pp.vx = (Math.random() - 0.5) * 3;
        pp.vy = 0.5 + Math.random();
        pp.age = 0;
        pp.lifetime = 5 + Math.random() * 3;
        pp.seed = Math.random() * 1000;
        pp.size = 0.4 + Math.random() * 0.3;
        pp.baseSize = pp.size;
        pp.alpha = 0;
        const col = lerpColorStops(cfg.colorStops, 0.7);
        pp.r = col.r; pp.g = col.g; pp.b = col.b;
      }
    }

    // Grass: wind gusts (periodic burst affecting all particles)
    if (theme === 'grass') {
      if (!this._gustTimer) this._gustTimer = 2 + Math.random() * 3;
      this._gustTimer -= dt;
      if (this._gustTimer <= 0) {
        this._gustActive = 0.3 + Math.random() * 0.2;
        this._gustDir = (Math.random() - 0.5) * 40;
        this._gustTimer = 4 + Math.random() * 3;
      }
      if (this._gustActive > 0) this._gustActive -= dt;
    }

    // Update all particles
    const turbAmp = cfg.turbulenceAmplitude * turbScale;
    const turbFreq = cfg.turbulenceFrequency;
    const turbSpeed = cfg.turbulenceSpeed;
    const gravStr = cfg.gravity;
    const dragVal = cfg.drag;
    const windX = typeof cfg.windX === 'function' ? cfg.windX(this.time) : (cfg.windX || 0);
    const windY = typeof cfg.windY === 'function' ? cfg.windY(this.time) : (cfg.windY || 0);

    for (let i = 0; i < this.pool.max; i++) {
      const p = this.pool.particles[i];
      if (!p.active) continue;

      p.age += dt;
      if (p.age >= p.lifetime) {
        p.active = false;
        continue;
      }

      const t = p.age / p.lifetime;

      if (p.type === 'core') {
        // Standard physics
        p.vy += gravStr * dt;
        if (turbAmp > 0) {
          p.vx += noise2D(p.x * turbFreq + p.seed, this.time * turbSpeed) * turbAmp * dt;
          p.vy += noise2D(p.y * turbFreq + p.seed + 100, this.time * turbSpeed) * turbAmp * dt;
        }
        // Sway (forge V1-style lateral drift)
        if (cfg.swayOverLife) {
          p.vx += lerpStops(cfg.swayOverLife, t) * p.swaySign * dt;
        }
        p.vx += windX * dt;
        p.vy += windY * dt;
        // Wind gusts (grass theme)
        if (this._gustActive > 0) {
          p.vx += this._gustDir * dt;
        }
        const df = Math.max(0, 1 - dragVal * dt);
        p.vx *= df;
        p.vy *= df;
        // Save previous position for trails
        p.prev2X = p.prevX; p.prev2Y = p.prevY;
        p.prevX = p.x; p.prevY = p.y;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Out of bounds
        if (p.x < -30 || p.x > w + 30 || p.y < -50 || p.y > h + 30) {
          p.active = false;
          continue;
        }

        // Color/size/alpha
        const col = lerpColorStops(cfg.colorStops, t);
        p.r = col.r; p.g = col.g; p.b = col.b;
        p.baseSize = lerpStops(cfg.sizeOverLife, t) * sizeScale;
        // Shrink core when it has an active ghost child
        p.size = p.hasGhost ? p.baseSize * 0.6 : p.baseSize;
        p.alpha = lerpStops(cfg.alphaOverLife, t);

        // Ice frost bloom: color shifts toward white near end of life
        if (theme === 'ice' && t > 0.85) {
          const bloomF = Math.sin(((t - 0.85) / 0.15) * Math.PI) * 0.6;
          p.r = Math.round(p.r + (220 - p.r) * bloomF);
          p.g = Math.round(p.g + (240 - p.g) * bloomF);
          p.b = Math.round(p.b + (255 - p.b) * bloomF);
        }
        // Ice refraction glint: rare bright white flash
        if (theme === 'ice') {
          if (p.glintTimer > 0) {
            p.glintTimer -= dt;
            p.r = 255; p.g = 255; p.b = 255;
            p.alpha = Math.min(1.0, p.alpha + 0.5);
          } else if (t > 0.25 && t < 0.55 && Math.random() < 0.004) {
            p.glintTimer = 0.06;
          }
        }
        // Void gravitational lensing + size sync
        if (theme === 'void') {
          for (let j = i + 1; j < this.pool.max; j++) {
            const q = this.pool.particles[j];
            if (!q.active || q.type !== 'core') continue;
            const dx = q.x - p.x, dy = q.y - p.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < 900 && distSq > 4) {
              const dist = Math.sqrt(distSq);
              const force = 2.5 / dist;
              const fx = (dx / dist) * force * dt;
              const fy = (dy / dist) * force * dt;
              p.vx += fx; p.vy += fy;
              q.vx -= fx; q.vy -= fy;
              // Size sync: nearby orbs nudge sizes toward each other
              if (distSq < 400) {
                const avgSize = (p.size + q.size) * 0.5;
                p.size += (avgSize - p.size) * 0.3 * dt;
                q.size += (avgSize - q.size) * 0.3 * dt;
              }
            }
          }
        }
        // Grass settling: particles near bottom slow down and fade
        if (theme === 'grass' && p.y > h * 0.9) {
          const settleF = Math.max(0, 1 - 5.0 * dt);
          p.vx *= settleF; p.vy *= settleF;
          p.alpha *= 0.97;
        }

        // Theme-specific child spawning
        if (theme === 'forge') this._updateForgeSparks(p, dt, t, cfg);
        else if (theme === 'void') this._updateVoidSplit(p, dt, t, cfg);
        else if (theme === 'grass') this._updateGrassSpores(p, dt, t, cfg);
      }
      else if (p.type === 'spark') {
        this._updateSpark(p, dt, t, cfg, sizeScale);
      }
      else if (p.type === 'ghost') {
        this._updateGhost(p, dt, t, cfg, sizeScale);
      }
      else if (p.type === 'spore') {
        this._updateSpore(p, dt, t, cfg, sizeScale);
      }
      else if (p.type === 'twinkle') {
        this._updateTwinkle(p, dt, t, cfg, sizeScale);
      }
      else if (p.type === 'halo') {
        this._updateHalo(p, dt, t, cfg, sizeScale);
      }
      else if (p.type === 'pollen') {
        p.vy += 0.5 * dt;
        p.vx += noise2D(p.x * 0.005 + p.seed, this.time * 0.2) * 3 * dt;
        const pollenDf = Math.max(0, 1 - 0.5 * dt);
        p.vx *= pollenDf; p.vy *= pollenDf;
        if (this._gustActive > 0) p.vx += this._gustDir * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.alpha = lerpStops([
          { t: 0, value: 0 }, { t: 0.1, value: 0.25 },
          { t: 0.5, value: 0.3 }, { t: 0.9, value: 0.15 }, { t: 1, value: 0 },
        ], t);
      }
    }
  }

  _initCore(p, cfg, w, h, sizeScale) {
    const spawn = cfg.spawnArea;
    p.type = 'core';
    p.x = (spawn.xMin + Math.random() * (spawn.xMax - spawn.xMin)) * w;
    const yBase = spawn.y * h;
    const yVar = (spawn.yVariance || 0) * h;
    p.y = yBase + (Math.random() - 0.5) * 2 * yVar;
    p.vx = (Math.random() - 0.5) * (cfg.initialVxSpread || 10);
    p.vy = spawn.initialVy;
    p.age = 0;
    p.lifetime = cfg.lifetime.base + (Math.random() - 0.5) * 2 * cfg.lifetime.variance;
    p.seed = Math.random() * 1000;
    p.phase = Math.random() * Math.PI * 2;
    p.splitAngle = Math.random() * Math.PI * 2;
    p.splitDist = 15 + Math.random() * 15;
    p.size = 0;
    p.baseSize = 0;
    p.alpha = 0;
    p.parentSeed = -1;
    p.hasGhost = false;
    p.swaySign = (p.seed > 500) ? 1 : -1;
    p.prevX = p.x; p.prevY = p.y;
    p.prev2X = p.x; p.prev2Y = p.y;
    p.glintTimer = 0;
  }

  // -- FORGE: Sparks fly off embers --
  _updateForgeSparks(p, dt, t, cfg) {
    if (this._childScale <= 0) return;
    const burstWindows = [{ start: 0.12, end: 0.16 }, { start: 0.45, end: 0.49 }];
    for (const burst of burstWindows) {
      const prevT = (p.age - dt) / p.lifetime;
      if (prevT < burst.start && t >= burst.start && Math.random() < 0.15 * this._childScale) {
        const count = 1 + Math.floor(Math.random() * 2);
        for (let s = 0; s < count; s++) {
          const sp = this.pool.spawn();
          if (!sp) break;
          sp.type = 'spark';
          sp.x = p.x;
          sp.y = p.y;
          const angle = Math.random() * Math.PI * 2;
          const speed = 30 + Math.random() * 50;
          sp.vx = Math.cos(angle) * speed;
          sp.vy = Math.sin(angle) * speed - 20;
          sp.age = 0;
          sp.lifetime = 0.2 + Math.random() * 0.3;
          sp.seed = p.seed;
          sp.size = 0.9;
          sp.baseSize = 0.9;
          sp.alpha = 1;
          sp.r = 255; sp.g = 220; sp.b = 80;
          sp.prevX = sp.x; sp.prevY = sp.y;
          sp.prev2X = sp.x; sp.prev2Y = sp.y;
        }
      }
    }
  }

  _updateSpark(p, dt, t, cfg, sizeScale) {
    p.vx *= Math.max(0, 1 - 4.0 * dt);
    p.vy *= Math.max(0, 1 - 4.0 * dt);
    p.vy += 10 * dt;
    p.prev2X = p.prevX; p.prev2Y = p.prevY;
    p.prevX = p.x; p.prevY = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.alpha = (1 - t) * (1 - t);
    p.size = lerpStops(cfg.sparkSizeOverLife || [{ t: 0, value: 0.9 }, { t: 1, value: 0.1 }], t) * sizeScale;
    const sc = lerpColorStops(cfg.sparkColorStops || cfg.colorStops, t);
    p.r = sc.r; p.g = sc.g; p.b = sc.b;
  }

  // -- VOID: Orb splits into two smaller ones, they drift apart chaotically, then rejoin --
  _updateVoidSplit(p, dt, t, cfg) {
    if (this._childScale <= 0) return;
    const splitWindows = [{ start: 0.18, end: 0.22 }, { start: 0.55, end: 0.59 }];
    for (const burst of splitWindows) {
      const prevT = (p.age - dt) / p.lifetime;
      if (prevT < burst.start && t >= burst.start && Math.random() < 0.45 * this._childScale) {
        const gp = this.pool.spawn();
        if (!gp) break;
        gp.type = 'ghost';
        gp.parentSeed = p.seed;
        gp.x = p.x;
        gp.y = p.y;
        gp.age = 0;
        gp.lifetime = 0.8 + Math.random() * 0.5;
        gp.seed = p.seed + 500 + Math.random() * 100;
        gp.splitAngle = p.splitAngle + Math.random() * Math.PI;
        gp.splitDist = p.splitDist * (0.5 + Math.random() * 0.5);
        gp.phase = Math.random() * Math.PI * 2;
        const ejectSpeed = 20 + Math.random() * 25;
        gp.vx = Math.cos(gp.splitAngle) * ejectSpeed;
        gp.vy = Math.sin(gp.splitAngle) * ejectSpeed;
        gp.size = p.baseSize * 0.6;
        gp.baseSize = p.baseSize * 0.6;
        gp.alpha = 0;
        gp.r = p.r; gp.g = p.g; gp.b = p.b;
        p.hasGhost = true;
      }
    }
  }

  _updateGhost(p, dt, t, cfg, sizeScale) {
    let parent = null;
    for (let j = 0; j < this.pool.max; j++) {
      const c = this.pool.particles[j];
      if (c.active && c.type === 'core' && c.seed === p.parentSeed) {
        parent = c;
        break;
      }
    }

    const turbAmp = cfg.turbulenceAmplitude * 1.5;
    const turbFreq = cfg.turbulenceFrequency * 1.2;
    p.vx += noise2D(p.x * turbFreq + p.seed, this.time * cfg.turbulenceSpeed * 1.3) * turbAmp * dt;
    p.vy += noise2D(p.y * turbFreq + p.seed + 100, this.time * cfg.turbulenceSpeed * 1.3) * turbAmp * dt;

    if (parent) {
      const dx = parent.x - p.x;
      const dy = parent.y - p.y;
      const springStrength = lerpStops([
        { t: 0, value: -2 },
        { t: 0.25, value: 0 },
        { t: 0.5, value: 3 },
        { t: 0.8, value: 12 },
        { t: 1.0, value: 20 },
      ], t);
      p.vx += dx * springStrength * dt;
      p.vy += dy * springStrength * dt;
    }

    const df = Math.max(0, 1 - cfg.drag * 0.8 * dt);
    p.vx *= df;
    p.vy *= df;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const col = lerpColorStops(cfg.colorStops, t * 0.6);
    p.r = col.r; p.g = col.g; p.b = col.b;

    p.alpha = lerpStops([
      { t: 0, value: 0 }, { t: 0.08, value: 0.75 },
      { t: 0.4, value: 0.65 }, { t: 0.75, value: 0.45 }, { t: 1, value: 0 },
    ], t);

    p.size = lerpStops([
      { t: 0, value: 0.3 }, { t: 0.1, value: 1.1 },
      { t: 0.5, value: 0.8 }, { t: 0.85, value: 0.5 }, { t: 1, value: 0.15 },
    ], t) * sizeScale * 0.65;

    if (t >= 0.98 && parent) {
      parent.hasGhost = false;
    }
  }

  // -- GRASS/SPORE: Sporadic radial spore puffs with gravity --
  _updateGrassSpores(p, dt, t, cfg) {
    if (this._childScale <= 0) return;
    const burstWindows = [{ start: 0.30, end: 0.34 }];
    for (const burst of burstWindows) {
      const prevT = (p.age - dt) / p.lifetime;
      if (prevT < burst.start && t >= burst.start && Math.random() < 0.12 * this._childScale) {
        const count = 7 + Math.floor(Math.random() * 2);
        const baseAngle = Math.random() * Math.PI * 2;
        for (let s = 0; s < count; s++) {
          const sp = this.pool.spawn();
          if (!sp) break;
          sp.type = 'spore';
          sp.x = p.x;
          sp.y = p.y;
          const angle = baseAngle + (s / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
          const speed = 15 + Math.random() * 25;
          sp.vx = Math.cos(angle) * speed;
          sp.vy = Math.sin(angle) * speed;
          sp.age = 0;
          sp.lifetime = 1.2 + Math.random() * 1.0;
          sp.seed = p.seed + s;
          sp.size = 0.8;
          sp.baseSize = 0.8;
          sp.alpha = 0;
          sp.r = p.r; sp.g = p.g; sp.b = p.b;
        }
      }
    }
  }

  _updateSpore(p, dt, t, cfg, sizeScale) {
    p.vx *= Math.max(0, 1 - 1.2 * dt);
    p.vy *= Math.max(0, 1 - 1.2 * dt);
    p.vy += 15 * dt;  // strong downward gravity
    p.vx += Math.sin(this.time * 0.5) * 2 * dt;
    if (this._gustActive > 0) p.vx += this._gustDir * 0.5 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const col = lerpColorStops(cfg.colorStops, t * 0.5);
    p.r = col.r; p.g = col.g; p.b = col.b;
    p.alpha = lerpStops([
      { t: 0, value: 0 }, { t: 0.08, value: 0.85 },
      { t: 0.4, value: 0.6 }, { t: 1, value: 0 },
    ], t);
    p.size = lerpStops([
      { t: 0, value: 0.5 }, { t: 0.15, value: 1.0 },
      { t: 0.5, value: 0.7 }, { t: 1, value: 0.2 },
    ], t) * sizeScale * 0.6;
  }

  _updateTwinkle(p, dt, t, cfg, sizeScale) {
    for (let j = 0; j < this.pool.max; j++) {
      const c = this.pool.particles[j];
      if (c.active && c.type === 'core' && c.seed === p.parentSeed) {
        p.x = c.x + Math.sin(p.phase + p.age * 3) * 2;
        p.y = c.y + Math.cos(p.phase + p.age * 2.5) * 2;
        break;
      }
    }
    // Rhythmic sine pulse (1.5 Hz, smooth)
    const flash = 0.5 + 0.5 * Math.sin((p.age * 1.5 + p.phase) * Math.PI * 2);
    p.alpha = flash * 0.8 * (1 - t);
    p.size = (0.6 + flash * 1.0) * sizeScale;
    p.r = 255; p.g = 255; p.b = 255;
  }

  // -- ICE: Expanding halo ring on sparkle --
  _updateHalo(p, dt, t, cfg, sizeScale) {
    let found = false;
    for (let j = 0; j < this.pool.max; j++) {
      const c = this.pool.particles[j];
      if (c.active && c.type === 'core' && c.seed === p.parentSeed) {
        p.x = c.x; p.y = c.y;
        found = true;
        break;
      }
    }
    if (!found) { p.active = false; return; }
    p.size = lerpStops([
      { t: 0, value: 0.5 }, { t: 0.32, value: 2.8 },
      { t: 0.5, value: 4.8 }, { t: 1.0, value: 5.5 },
    ], t) * sizeScale;
    p.alpha = lerpStops([
      { t: 0, value: 0 }, { t: 0.18, value: 0 }, { t: 0.32, value: 0.45 },
      { t: 0.5, value: 0.15 }, { t: 1.0, value: 0 },
    ], t);
    p.r = 200; p.g = 240; p.b = 255;
  }

  // Pre-render: sync cached RGB strings to avoid per-particle template allocation in render loop
  _syncRgbStrings() {
    for (let i = 0; i < this.pool.max; i++) {
      const p = this.pool.particles[i];
      if (!p.active || p.alpha < 0.01) continue;
      p.rgbStr = `rgb(${p.r},${p.g},${p.b})`;
    }
  }

  // ============================================================
  // RENDERING
  // ============================================================
  render(ctx, w, h) {
    const cfg = this.config;
    const glowR = cfg.glowRadius || 2.0;
    const glowA = cfg.glowAlpha || 0.25;
    const theme = cfg.theme;

    this._syncRgbStrings();
    ctx.globalCompositeOperation = 'lighter';

    // Forge ember trail pass (behind glow)
    if (theme === 'forge') {
      for (let i = 0; i < this.pool.max; i++) {
        const p = this.pool.particles[i];
        if (!p.active || p.alpha < 0.01 || p.type !== 'core') continue;
        ctx.globalAlpha = p.alpha * glowA * 0.4;
        ctx.fillStyle = p.rgbStr;
        ctx.beginPath();
        ctx.arc(p.prevX, p.prevY, Math.max(0.3, p.size * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Glow pass
    if (glowR > 0 && glowA > 0) {
      for (let i = 0; i < this.pool.max; i++) {
        const p = this.pool.particles[i];
        if (!p.active || p.alpha < 0.01 || p.type === 'pollen') continue;
        ctx.globalAlpha = p.alpha * glowA;
        ctx.fillStyle = p.rgbStr;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * glowR), 0, Math.PI * 2);
        ctx.fill();
        // Forge heat shimmer: oscillating wide glow on bright embers
        if (theme === 'forge' && p.type === 'core' && p.alpha > 0.5) {
          const shimmerR = p.size * (2.5 + Math.sin(this.time * 3 + p.seed) * 1.5);
          ctx.globalAlpha = 0.04;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1, shimmerR), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Core pass — shape varies by theme and particle type
    for (let i = 0; i < this.pool.max; i++) {
      const p = this.pool.particles[i];
      if (!p.active || p.alpha < 0.01) continue;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.rgbStr;

      if (theme === 'ice' && p.type === 'core') {
        this._drawDiamond(ctx, p.x, p.y, p.size);
        if (p.alpha > 0.3) {
          ctx.globalAlpha = p.alpha * 0.5;
          ctx.fillStyle = 'rgb(255,255,255)';
          const arm = p.size * 1.8;
          ctx.fillRect(p.x - 0.25, p.y - arm, 0.5, arm * 2);
          ctx.fillRect(p.x - arm, p.y - 0.25, arm * 2, 0.5);
        }
      }
      else if (theme === 'void' && p.type === 'ghost') {
        ctx.globalAlpha = p.alpha * 0.8;
        ctx.strokeStyle = p.rgbStr;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * 1.3), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = `rgb(${Math.min(255, p.r + 60)},${Math.min(255, p.g + 60)},${Math.min(255, p.b + 60)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.3, p.size * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      else if (p.type === 'twinkle') {
        this._drawStar4(ctx, p.x, p.y, p.size);
      }
      else if (p.type === 'halo') {
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = p.rgbStr;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
        ctx.stroke();
      }
      else if (p.type === 'spark') {
        // Spark trails: ghost positions behind the spark
        ctx.globalAlpha = p.alpha * 0.2;
        ctx.beginPath();
        ctx.arc(p.prev2X, p.prev2Y, Math.max(0.2, p.size * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = p.alpha * 0.5;
        ctx.beginPath();
        ctx.arc(p.prevX, p.prevY, Math.max(0.2, p.size * 0.7), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.3, p.size), 0, Math.PI * 2);
        ctx.fill();
      }
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.3, p.size), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  _drawDiamond(ctx, x, y, size) {
    const s = Math.max(0.5, size);
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.7, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.7, y);
    ctx.closePath();
    ctx.fill();
  }

  _drawStar4(ctx, x, y, size) {
    const outer = Math.max(0.5, size);
    const inner = outer * 0.3;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}

// ============================================================
// ICE EMITTER (extends Emitter with twinkle + halo spawning)
// ============================================================
export class IceEmitter extends Emitter {
  update(dt, w, h, heatMult) {
    super.update(dt, w, h, heatMult);
    if (this._childScale <= 0) return;
    const sizeScale = heatMult.sizeScale || 1;

    for (let i = 0; i < this.pool.max; i++) {
      const p = this.pool.particles[i];
      if (!p.active || p.type !== 'core') continue;
      const t = p.age / p.lifetime;
      const prevT = (p.age - dt) / p.lifetime;

      const twinkleWindows = [{ start: 0.15, end: 0.19 }, { start: 0.55, end: 0.59 }];
      for (const tw of twinkleWindows) {
        if (prevT < tw.start && t >= tw.start && Math.random() < 0.25) {
          const tp = this.pool.spawn();
          if (!tp) break;
          tp.type = 'twinkle';
          tp.parentSeed = p.seed;
          tp.x = p.x; tp.y = p.y;
          tp.vx = 0; tp.vy = 0;
          tp.age = 0;
          tp.lifetime = 0.5 + Math.random() * 0.4;
          tp.seed = p.seed;
          tp.phase = Math.random() * Math.PI * 2;
          tp.size = 0.9 * sizeScale;
          tp.baseSize = 0.9 * sizeScale;
          tp.alpha = 0;
          tp.r = 255; tp.g = 255; tp.b = 255;
          // Spawn halo ring alongside twinkle
          const hp = this.pool.spawn();
          if (hp) {
            hp.type = 'halo';
            hp.parentSeed = p.seed;
            hp.x = p.x; hp.y = p.y;
            hp.vx = 0; hp.vy = 0;
            hp.age = 0;
            hp.lifetime = 0.8 + Math.random() * 0.3;
            hp.seed = p.seed;
            hp.size = 0.5; hp.baseSize = 0.5;
            hp.alpha = 0;
            hp.r = 200; hp.g = 240; hp.b = 255;
          }
        }
      }
    }
  }
}
