// Particle V3 theme configurations for the Canvas 2D engine.
// V1 = CSS spans (removed), V2 = particle-demo.html (reference), V3 = this.
// Sizes scaled to ~60% of V2 demo — demo was tuned for large preview canvas,
// production needs particles that look crisp in 36-44px header/tabbar strips.
// Personalities: Forge=exciting/powerful, Frost=focused/sharp, Void=cool/imaginative, Spore=sweet/sour

import { hexToRGB } from './particleEngine';
import { getThemeHeatColors } from './themes';

function buildColorStops(theme, variant = null) {
  const c = getThemeHeatColors(theme, variant).map(hexToRGB);
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

function mergeParticleConfig(base, overrides) {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    spawnArea: overrides.spawnArea ? { ...base.spawnArea, ...overrides.spawnArea } : base.spawnArea,
  };
}

// Target: cores ~1.5px radius peak (3px diameter), glow halo ~2.4px radius.
// This keeps particles readable for multi-color but not blobby in narrow strips.

const THEME_CONFIGS = {
  // FORGE: Rising embers with spark bursts, lateral sway, and heat shimmer.
  // Fast launch + high drag = hot bottom that slows as it rises.
  forge: {
    theme: 'forge',
    rate: 8,
    lifetime: { base: 2.0, variance: 0.5 },
    spawnArea: { xMin: 0, xMax: 1, y: 1.0, yVariance: 0, initialVy: -90 },
    initialVxSpread: 10,
    gravity: -25,
    turbulenceFrequency: 0.008, turbulenceSpeed: 0.6, turbulenceAmplitude: 22,
    windX: 0, windY: 0,
    drag: 3.0,
    colorStops: null,
    // V1-style lateral sway: drift right, center, drift left, slight return
    swayOverLife: [
      { t: 0.0, value: 0 }, { t: 0.15, value: 35 }, { t: 0.30, value: 40 },
      { t: 0.45, value: 0 }, { t: 0.55, value: -25 }, { t: 0.80, value: -30 },
      { t: 0.90, value: 0 }, { t: 1.0, value: 15 },
    ],
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

  // FROST: Sharp diamond crystals with halos, bloom, and rare refraction glints.
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
      { t: 0, value: 0.4 }, { t: 0.2, value: 1.4 },
      { t: 0.7, value: 1.1 }, { t: 0.85, value: 0.35 },
      { t: 0.92, value: 0.8 }, { t: 1.0, value: 0.15 },
    ],
    alphaOverLife: [
      { t: 0, value: 0.0 }, { t: 0.08, value: 0.85 },
      { t: 0.6, value: 0.5 }, { t: 0.85, value: 0.12 },
      { t: 0.92, value: 0.35 }, { t: 1.0, value: 0.0 },
    ],
    glowRadius: 1.5,
    glowAlpha: 0.10,
  },

  // VOID: Orbs split into two, drift apart chaotically, rejoin.
  // Dramatic size breathing; smooth alpha (no flash).
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
      { t: 0, value: 0.4 }, { t: 0.12, value: 2.4 },
      { t: 0.3, value: 0.8 }, { t: 0.5, value: 2.2 },
      { t: 0.7, value: 0.6 }, { t: 0.85, value: 1.6 },
      { t: 1.0, value: 0.3 },
    ],
    alphaOverLife: [
      { t: 0, value: 0.0 }, { t: 0.1, value: 0.6 },
      { t: 0.4, value: 0.5 }, { t: 0.7, value: 0.45 },
      { t: 0.9, value: 0.2 }, { t: 1.0, value: 0.0 },
    ],
    glowRadius: 2.0,
    glowAlpha: 0.18,
  },

  // SPORE: Drifting botanical spores with gentle gravity, wind gusts, and pollen dust.
  grass: {
    theme: 'grass',
    rate: 5,
    lifetime: { base: 4.0, variance: 1.5 },
    spawnArea: { xMin: 0, xMax: 1, y: 0.3, yVariance: 0.3, initialVy: -5 },
    initialVxSpread: 6,
    gravity: 3,
    turbulenceFrequency: 0.008, turbulenceSpeed: 0.35, turbulenceAmplitude: 18,
    windX: (time) => Math.sin(time * 0.5) * 8 + Math.sin(time * 1.3) * 3,
    windY: (time) => Math.sin(time * 0.3) * 2,
    drag: 1.5,
    colorStops: null,
    sizeOverLife: [
      { t: 0, value: 0.3 }, { t: 0.1, value: 1.0 },
      { t: 0.4, value: 0.8 }, { t: 0.7, value: 0.6 }, { t: 1.0, value: 0.2 },
    ],
    alphaOverLife: [
      { t: 0, value: 0.0 }, { t: 0.06, value: 0.7 },
      { t: 0.2, value: 0.45 }, { t: 0.35, value: 0.6 },
      { t: 0.5, value: 0.4 }, { t: 0.65, value: 0.55 },
      { t: 0.8, value: 0.3 }, { t: 1.0, value: 0.0 },
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
    forge: { spawnArea: { y: 0.6, yVariance: 0.4 } },
    ice:   { spawnArea: { y: 0.4, yVariance: 0.4, initialVy: 8 } },
    void:  { spawnArea: { y: 0.5, yVariance: 0.5 } },
    grass: { spawnArea: { y: 0.5, yVariance: 0.45 } },
  },
  tabbar: {},
  repoBrowser: {
    forge: { spawnArea: { y: 0.6, yVariance: 0.4 } },
    ice:   { spawnArea: { y: 0.4, yVariance: 0.4, initialVy: 8 } },
    void:  { spawnArea: { y: 0.5, yVariance: 0.5 } },
    grass: { spawnArea: { y: 0.5, yVariance: 0.45 } },
  },
  documentTabs: {},
};

export function getParticleConfig(theme, location, variant = null) {
  const base = THEME_CONFIGS[theme];
  if (!base) return { ...THEME_CONFIGS.forge, colorStops: buildColorStops('forge', variant) };

  const locOverrides = LOCATION_OVERRIDES[location];
  const themeOverrides = locOverrides && locOverrides[theme];
  const colorStops = buildColorStops(theme, variant);
  const merged = mergeParticleConfig(base, themeOverrides);
  return { ...merged, colorStops };
}

export { THEME_CONFIGS };
