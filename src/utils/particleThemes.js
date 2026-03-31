// Particle V3 theme configurations for the Canvas 2D engine.
// V1 = CSS spans (removed), V2 = particle-demo.html (reference), V3 = this.
// Sizes scaled to ~60% of V2 demo — demo was tuned for large preview canvas,
// production needs particles that look crisp in 36-44px header/tabbar strips.
// Personalities: Forge=exciting/powerful, Frost=focused/sharp, Void=cool/imaginative, Spore=sweet/sour

import { hexToRGB } from './particleEngine';

const HEAT_COLORS = {
  forge: ["#475569", "#f59e0b", "#ea580c", "#dc2626", "#ef4444", "#ff4d4d"],
  ice:   ["#4B6272", "#2098FF", "#00B8E0", "#00D4D4", "#70F0E8", "#D8FFFC"],
  void:  ["#3D3554", "#5855E0", "#8840E8", "#C830D0", "#F020A0", "#FF40B0"],
  grass: ["#5C553A", "#E08830", "#C8B020", "#80B830", "#40C048", "#34D058"],
};

function buildColorStops(theme) {
  const hc = HEAT_COLORS[theme];
  const c = hc.map(hexToRGB);
  return [
    { t: 0.0,  ...c[5] },
    { t: 0.15, ...c[4] },
    { t: 0.35, ...c[3] },
    { t: 0.55, ...c[2] },
    { t: 0.75, ...c[1] },
    { t: 1.0,  ...c[0] },
  ];
}

export const HEAT_MULTIPLIERS = {
  3: { rateScale: 0.4, sizeScale: 0.85, turbulenceScale: 0.7 },
  4: { rateScale: 1.0, sizeScale: 1.0, turbulenceScale: 1.0 },
  5: { rateScale: 1.5, sizeScale: 1.1, turbulenceScale: 1.2 },
};

// Target: cores ~1.5px radius peak (3px diameter), glow halo ~2.4px radius.
// This keeps particles readable for multi-color but not blobby in narrow strips.

const THEME_CONFIGS = {
  // FORGE: Rising embers with spark bursts. Multi-color cooling.
  forge: {
    theme: 'forge',
    rate: 8,
    lifetime: { base: 2.0, variance: 0.5 },
    spawnArea: { xMin: 0, xMax: 1, y: 1.0, yVariance: 0, initialVy: -50 },
    initialVxSpread: 10,
    gravity: -30,
    turbulenceFrequency: 0.008, turbulenceSpeed: 0.6, turbulenceAmplitude: 18,
    windX: 0, windY: 0,
    drag: 2.0,
    colorStops: null,
    sparkColorStops: [
      { t: 0.0, r: 255, g: 255, b: 240 },
      { t: 0.3, r: 255, g: 220, b: 80 },
      { t: 0.6, r: 255, g: 160, b: 30 },
      { t: 1.0, r: 200, g: 80,  b: 20 },
    ],
    sparkSizeOverLife: [
      { t: 0, value: 0.9 }, { t: 0.3, value: 0.6 }, { t: 1, value: 0.1 },
    ],
    sizeOverLife: [
      { t: 0, value: 0.6 }, { t: 0.12, value: 1.5 },
      { t: 0.5, value: 1.2 }, { t: 0.8, value: 0.7 }, { t: 1.0, value: 0.25 },
    ],
    alphaOverLife: [
      { t: 0, value: 0.0 }, { t: 0.06, value: 1.0 },
      { t: 0.5, value: 0.75 }, { t: 0.85, value: 0.3 }, { t: 1.0, value: 0.0 },
    ],
    glowRadius: 1.6,
    glowAlpha: 0.2,
  },

  // FROST: Diamond crystals with cross-sparkle highlights and twinkle flashes.
  ice: {
    theme: 'ice',
    rate: 5,
    lifetime: { base: 3.5, variance: 1.0 },
    spawnArea: { xMin: 0, xMax: 1, y: 0.0, yVariance: 0, initialVy: 12 },
    initialVxSpread: 6,
    gravity: 6,
    turbulenceFrequency: 0.005, turbulenceSpeed: 0.3, turbulenceAmplitude: 10,
    windX: 4, windY: 0,
    drag: 1.5,
    colorStops: null,
    sizeOverLife: [
      { t: 0, value: 0.4 }, { t: 0.2, value: 1.2 },
      { t: 0.7, value: 0.9 }, { t: 1.0, value: 0.2 },
    ],
    alphaOverLife: [
      { t: 0, value: 0.0 }, { t: 0.08, value: 0.85 },
      { t: 0.6, value: 0.5 }, { t: 1.0, value: 0.0 },
    ],
    glowRadius: 1.8,
    glowAlpha: 0.12,
  },

  // VOID: Orbs split into two, drift apart chaotically, rejoin.
  void: {
    theme: 'void',
    rate: 5,
    lifetime: { base: 3.0, variance: 0.8 },
    spawnArea: { xMin: 0.05, xMax: 0.95, y: 0.5, yVariance: 0.35, initialVy: 0 },
    initialVxSpread: 8,
    gravity: 0,
    turbulenceFrequency: 0.01, turbulenceSpeed: 0.4, turbulenceAmplitude: 20,
    windX: 0, windY: 0,
    drag: 3.0,
    colorStops: null,
    sizeOverLife: [
      { t: 0, value: 0.3 }, { t: 0.15, value: 1.5 },
      { t: 0.4, value: 0.8 }, { t: 0.6, value: 1.4 },
      { t: 0.8, value: 0.6 }, { t: 1.0, value: 0.2 },
    ],
    alphaOverLife: [
      { t: 0, value: 0.0 }, { t: 0.1, value: 0.7 },
      { t: 0.35, value: 0.25 }, { t: 0.55, value: 0.65 },
      { t: 0.8, value: 0.2 }, { t: 1.0, value: 0.0 },
    ],
    glowRadius: 1.6,
    glowAlpha: 0.15,
  },

  // SPORE: Floating fireflies with blinking glow and radial spore puffs.
  grass: {
    theme: 'grass',
    rate: 5,
    lifetime: { base: 3.0, variance: 1.0 },
    spawnArea: { xMin: 0, xMax: 1, y: 0.85, yVariance: 0.15, initialVy: -15 },
    initialVxSpread: 6,
    gravity: -8,
    turbulenceFrequency: 0.006, turbulenceSpeed: 0.35, turbulenceAmplitude: 12,
    windX: (time) => Math.sin(time * 0.7) * 5,
    windY: 0,
    drag: 2.5,
    colorStops: null,
    sizeOverLife: [
      { t: 0, value: 0.4 }, { t: 0.12, value: 1.2 },
      { t: 0.35, value: 0.5 }, { t: 0.55, value: 1.3 },
      { t: 0.75, value: 0.6 }, { t: 1.0, value: 0.2 },
    ],
    alphaOverLife: [
      { t: 0, value: 0.0 }, { t: 0.08, value: 0.8 },
      { t: 0.3, value: 0.1 }, { t: 0.5, value: 0.75 },
      { t: 0.75, value: 0.15 }, { t: 1.0, value: 0.0 },
    ],
    glowRadius: 1.8,
    glowAlpha: 0.15,
  },
};

for (const theme of Object.keys(THEME_CONFIGS)) {
  THEME_CONFIGS[theme].colorStops = buildColorStops(theme);
}

const LOCATION_OVERRIDES = {
  header: {},
  sidebar: {
    forge: { y: 0.95, yVariance: 0.05 },
    ice:   { y: 0.0, yVariance: 0 },
    void:  { y: 0.5, yVariance: 0.45 },
    grass: { y: 0.9, yVariance: 0.1 },
  },
  tabbar: {},
  repoBrowser: {
    forge: { y: 0.95, yVariance: 0.05 },
    ice:   { y: 0.0, yVariance: 0 },
    void:  { y: 0.5, yVariance: 0.4 },
    grass: { y: 0.9, yVariance: 0.1 },
  },
  documentTabs: {},
};

export function getParticleConfig(theme, location) {
  const base = THEME_CONFIGS[theme];
  if (!base) return THEME_CONFIGS.forge;

  const locOverrides = LOCATION_OVERRIDES[location];
  const themeOverrides = locOverrides && locOverrides[theme];
  if (!themeOverrides) return base;

  return {
    ...base,
    spawnArea: { ...base.spawnArea, ...themeOverrides },
  };
}

export { THEME_CONFIGS };
