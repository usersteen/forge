// Theme-specific particle configurations for the Canvas 2D particle engine.
// Each theme targets 10-25 active particles per location at heat 4 (parity with V1).
// Personalities: Forge=exciting/powerful, Frost=focused/sharp, Void=cool/imaginative, Spore=sweet/sour

import { hexToRGB } from './particleEngine';

// Heat colors pulled from themes.js — particles cool through each theme's palette
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

// Heat multipliers — controls how heat stage scales particle intensity
export const HEAT_MULTIPLIERS = {
  3: { rateScale: 0.4, sizeScale: 0.85, turbulenceScale: 0.7 },
  4: { rateScale: 1.0, sizeScale: 1.0, turbulenceScale: 1.0 },
  5: { rateScale: 1.5, sizeScale: 1.1, turbulenceScale: 1.2 },
};

// Base theme configs — tuned for conservative particle counts
const THEME_CONFIGS = {
  // FORGE: Exciting and powerful. Rising embers with intermittent spark bursts.
  // Embers rise from below with turbulent sway, sparks eject white-hot to orange.
  forge: {
    theme: 'forge',
    rate: 8,
    lifetime: { base: 2.0, variance: 0.5 },
    spawnArea: { xMin: 0, xMax: 1, y: 1.0, yVariance: 0, initialVy: -40 },
    initialVxSpread: 8,
    gravity: -25,
    turbulenceFrequency: 0.008, turbulenceSpeed: 0.5, turbulenceAmplitude: 14,
    windX: 0, windY: 0,
    drag: 2.0,
    colorStops: null,
    sparkColorStops: [
      { t: 0.0, r: 255, g: 255, b: 240 },  // white-hot
      { t: 0.3, r: 255, g: 220, b: 80 },   // bright yellow
      { t: 0.6, r: 255, g: 160, b: 30 },   // orange
      { t: 1.0, r: 200, g: 80,  b: 20 },   // dark orange
    ],
    sparkSizeOverLife: [
      { t: 0, value: 1.5 }, { t: 0.3, value: 1.0 }, { t: 1, value: 0.2 },
    ],
    sizeOverLife: [
      { t: 0, value: 0.8 }, { t: 0.1, value: 2.2 },
      { t: 0.5, value: 1.8 }, { t: 0.8, value: 1.0 }, { t: 1.0, value: 0.3 },
    ],
    alphaOverLife: [
      { t: 0, value: 0.0 }, { t: 0.06, value: 1.0 },
      { t: 0.5, value: 0.7 }, { t: 0.85, value: 0.25 }, { t: 1.0, value: 0.0 },
    ],
    glowRadius: 2.0,
    glowAlpha: 0.2,
  },

  // FROST: Focused and sharp. Diamond crystals drifting down with cross-sparkle highlights.
  // Slower, deliberate movement. Twinkle flashes add precision.
  ice: {
    theme: 'ice',
    rate: 5,
    lifetime: { base: 3.0, variance: 0.8 },
    spawnArea: { xMin: 0, xMax: 1, y: 0.0, yVariance: 0, initialVy: 10 },
    initialVxSpread: 5,
    gravity: 5,
    turbulenceFrequency: 0.005, turbulenceSpeed: 0.25, turbulenceAmplitude: 8,
    windX: 3, windY: 0,
    drag: 1.5,
    colorStops: null,
    sizeOverLife: [
      { t: 0, value: 0.5 }, { t: 0.2, value: 1.6 },
      { t: 0.7, value: 1.2 }, { t: 1.0, value: 0.3 },
    ],
    alphaOverLife: [
      { t: 0, value: 0.0 }, { t: 0.08, value: 0.8 },
      { t: 0.6, value: 0.45 }, { t: 1.0, value: 0.0 },
    ],
    glowRadius: 2.2,
    glowAlpha: 0.12,
  },

  // VOID: Cool and imaginative. Orbs split into two smaller ones that drift apart
  // chaotically, then rejoin. High turbulence for unpredictable movement.
  void: {
    theme: 'void',
    rate: 5,
    lifetime: { base: 3.0, variance: 0.8 },
    spawnArea: { xMin: 0.05, xMax: 0.95, y: 0.5, yVariance: 0.35, initialVy: 0 },
    initialVxSpread: 6,
    gravity: 0,
    turbulenceFrequency: 0.012, turbulenceSpeed: 0.4, turbulenceAmplitude: 22,
    windX: 0, windY: 0,
    drag: 2.8,
    colorStops: null,
    sizeOverLife: [
      { t: 0, value: 0.5 }, { t: 0.12, value: 2.4 },
      { t: 0.35, value: 1.8 }, { t: 0.55, value: 2.2 },
      { t: 0.75, value: 1.4 }, { t: 1.0, value: 0.3 },
    ],
    alphaOverLife: [
      { t: 0, value: 0.0 }, { t: 0.08, value: 0.7 },
      { t: 0.4, value: 0.5 }, { t: 0.65, value: 0.6 },
      { t: 0.85, value: 0.3 }, { t: 1.0, value: 0.0 },
    ],
    glowRadius: 2.8,
    glowAlpha: 0.25,
  },

  // SPORE: Sweet and sour. Floating fireflies with blinking glow and radial spore puffs.
  // Gentle sinusoidal wind for swaying, blink pattern in alpha for firefly effect.
  grass: {
    theme: 'grass',
    rate: 5,
    lifetime: { base: 2.8, variance: 0.8 },
    spawnArea: { xMin: 0, xMax: 1, y: 0.85, yVariance: 0.12, initialVy: -12 },
    initialVxSpread: 5,
    gravity: -6,
    turbulenceFrequency: 0.006, turbulenceSpeed: 0.3, turbulenceAmplitude: 10,
    windX: (time) => Math.sin(time * 0.7) * 4,
    windY: 0,
    drag: 2.2,
    colorStops: null,
    sizeOverLife: [
      { t: 0, value: 0.5 }, { t: 0.1, value: 1.6 },
      { t: 0.3, value: 0.7 }, { t: 0.5, value: 1.8 },
      { t: 0.7, value: 0.9 }, { t: 1.0, value: 0.3 },
    ],
    // Blinking alpha pattern: sweet (bright) and sour (dim) alternation
    alphaOverLife: [
      { t: 0, value: 0.0 }, { t: 0.06, value: 0.75 },
      { t: 0.25, value: 0.1 }, { t: 0.45, value: 0.7 },
      { t: 0.65, value: 0.12 }, { t: 0.8, value: 0.5 },
      { t: 1.0, value: 0.0 },
    ],
    glowRadius: 2.2,
    glowAlpha: 0.18,
  },
};

// Build color stops for each theme
for (const theme of Object.keys(THEME_CONFIGS)) {
  THEME_CONFIGS[theme].colorStops = buildColorStops(theme);
}

// Location-specific spawn area overrides
// These adjust spawn areas for different UI regions (header is short/wide, sidebar is tall/narrow, etc.)
const LOCATION_OVERRIDES = {
  header: {},  // default spawn areas work for header
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
