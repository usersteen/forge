const DEFAULT_THEME = "forge";

const HEADER_BG_OPACITY = [0, 0.06, 0.1, 0.13, 0.16, 0.2];

const NONE = "none";

function rgbaVar(variableName, alpha) {
  return `rgba(var(${variableName}), ${alpha})`;
}

function shadowLayer({ x = 0, y = 0, blur = 0, spread = 0, color, inset = false }) {
  return `${inset ? "inset " : ""}${x}px ${y}px ${blur}px ${spread}px ${color}`;
}

function shadowValue(layers = []) {
  return layers.length ? layers.map(shadowLayer).join(", ") : NONE;
}

function dropShadowLayer({ x = 0, y = 0, blur = 0, color }) {
  return `drop-shadow(${x}px ${y}px ${blur}px ${color})`;
}

function filterValue(layers = []) {
  return layers.length ? layers.map(dropShadowLayer).join(" ") : NONE;
}

const THEME_GLOWS = {
  forge: {
    status: {
      waiting: {
        normal: shadowValue([
          { blur: 4, color: rgbaVar("--accent-waiting-rgb", 0.7) },
          { blur: 9, color: rgbaVar("--accent-waiting-rgb", 0.22) },
        ]),
        small: shadowValue([
          { blur: 3, color: rgbaVar("--accent-waiting-rgb", 0.62) },
          { blur: 6, color: rgbaVar("--accent-waiting-rgb", 0.18) },
        ]),
      },
      working: {
        normalRest: shadowValue([
          { blur: 4, color: rgbaVar("--accent-working-rgb", 0.74) },
          { blur: 9, color: rgbaVar("--accent-working-rgb", 0.22) },
        ]),
        normalPeak: shadowValue([
          { blur: 6, color: rgbaVar("--accent-working-rgb", 0.92) },
          { blur: 13, color: rgbaVar("--accent-working-rgb", 0.34) },
          { blur: 20, color: rgbaVar("--heat-5-rgb", 0.16) },
        ]),
        smallRest: shadowValue([
          { blur: 3, color: rgbaVar("--accent-working-rgb", 0.72) },
          { blur: 7, color: rgbaVar("--accent-working-rgb", 0.2) },
        ]),
        smallPeak: shadowValue([
          { blur: 4, color: rgbaVar("--accent-working-rgb", 0.88) },
          { blur: 9, color: rgbaVar("--accent-working-rgb", 0.3) },
          { blur: 14, color: rgbaVar("--heat-5-rgb", 0.14) },
        ]),
      },
    },
    header: {
      shadows: [
        NONE,
        NONE,
        NONE,
        shadowValue([
          { blur: 7, color: rgbaVar("--heat-current-rgb", 0.16) },
        ]),
        shadowValue([
          { inset: true, spread: 1, color: rgbaVar("--heat-5-rgb", 0.6) },
          { blur: 10, color: rgbaVar("--heat-5-rgb", 0.26) },
          { blur: 20, spread: -10, color: rgbaVar("--heat-4-rgb", 0.28) },
        ]),
        shadowValue([
          { inset: true, spread: 1, color: rgbaVar("--heat-5-rgb", 0.72) },
          { blur: 12, color: rgbaVar("--heat-5-rgb", 0.34) },
          { blur: 24, spread: -10, color: rgbaVar("--heat-4-rgb", 0.32) },
        ]),
      ],
      bloom: [
        NONE,
        NONE,
        NONE,
        "radial-gradient(62% 92% at 50% 52%, rgba(var(--heat-4-rgb), 0.14) 0%, rgba(var(--heat-3-rgb), 0.09) 38%, rgba(var(--heat-3-rgb), 0) 72%)",
        "radial-gradient(68% 104% at 50% 52%, rgba(var(--heat-5-rgb), 0.18) 0%, rgba(var(--heat-4-rgb), 0.13) 34%, rgba(var(--heat-3-rgb), 0.06) 54%, rgba(var(--heat-3-rgb), 0) 78%)",
        "radial-gradient(72% 112% at 50% 50%, rgba(var(--heat-5-rgb), 0.24) 0%, rgba(var(--heat-4-rgb), 0.16) 30%, rgba(var(--heat-3-rgb), 0.08) 54%, rgba(var(--heat-3-rgb), 0) 78%)",
      ],
      bloomOpacity: ["0", "0", "0", "0.48", "0.62", "0.74"],
      bloomBlur: ["0px", "0px", "0px", "10px", "12px", "14px"],
      border: ["var(--border)", "var(--border)", "var(--border)", "var(--border)", "var(--border)", "var(--heat-5)"],
    },
    logo: {
      filters: [
        NONE,
        filterValue([
          { blur: 3, color: rgbaVar("--heat-1-rgb", 0.78) },
        ]),
        filterValue([
          { blur: 4, color: rgbaVar("--heat-2-rgb", 0.8) },
          { blur: 8, color: rgbaVar("--heat-2-rgb", 0.24) },
        ]),
        filterValue([
          { blur: 6, color: rgbaVar("--heat-3-rgb", 0.82) },
          { blur: 11, color: rgbaVar("--heat-3-rgb", 0.28) },
        ]),
        filterValue([
          { blur: 7, color: rgbaVar("--heat-4-rgb", 0.84) },
          { blur: 13, color: rgbaVar("--heat-4-rgb", 0.3) },
        ]),
        filterValue([
          { blur: 5, color: rgbaVar("--heat-5-rgb", 0.88) },
          { blur: 10, color: rgbaVar("--heat-5-rgb", 0.42) },
          { blur: 18, color: rgbaVar("--heat-4-rgb", 0.18) },
        ]),
      ],
    },
    shell: {
      tabBar: shadowValue([
        { inset: true, y: -1, blur: 0, color: rgbaVar("--heat-5-rgb", 0.16) },
        { blur: 12, spread: -4, color: rgbaVar("--heat-5-rgb", 0.24) },
        { blur: 26, spread: -16, color: rgbaVar("--heat-4-rgb", 0.2) },
      ]),
      sidebar: shadowValue([
        { inset: true, x: -1, blur: 0, color: rgbaVar("--heat-5-rgb", 0.16) },
        { blur: 14, spread: -4, color: rgbaVar("--heat-5-rgb", 0.24) },
        { blur: 30, spread: -16, color: rgbaVar("--heat-4-rgb", 0.2) },
      ]),
      main: shadowValue([
        { inset: true, spread: 1, color: rgbaVar("--heat-5-rgb", 0.14) },
        { blur: 18, spread: -14, color: rgbaVar("--heat-5-rgb", 0.18) },
      ]),
    },
  },
  ice: {
    status: {
      waiting: {
        normal: shadowValue([
          { spread: 1, color: rgbaVar("--heat-5-rgb", 0.22) },
          { blur: 4, color: rgbaVar("--accent-waiting-rgb", 0.88) },
          { blur: 10, color: rgbaVar("--heat-5-rgb", 0.3) },
        ]),
        small: shadowValue([
          { spread: 1, color: rgbaVar("--heat-5-rgb", 0.18) },
          { blur: 3, color: rgbaVar("--accent-waiting-rgb", 0.82) },
          { blur: 7, color: rgbaVar("--heat-5-rgb", 0.24) },
        ]),
      },
      working: {
        normalRest: shadowValue([
          { spread: 1, color: rgbaVar("--heat-5-rgb", 0.3) },
          { blur: 4, color: rgbaVar("--accent-working-rgb", 0.92) },
          { blur: 10, color: rgbaVar("--heat-5-rgb", 0.34) },
        ]),
        normalPeak: shadowValue([
          { spread: 1, color: rgbaVar("--heat-5-rgb", 0.42) },
          { blur: 6, color: rgbaVar("--accent-working-rgb", 0.98) },
          { blur: 12, color: rgbaVar("--heat-5-rgb", 0.5) },
          { blur: 18, color: rgbaVar("--heat-4-rgb", 0.22) },
        ]),
        smallRest: shadowValue([
          { spread: 1, color: rgbaVar("--heat-5-rgb", 0.24) },
          { blur: 3, color: rgbaVar("--accent-working-rgb", 0.88) },
          { blur: 8, color: rgbaVar("--heat-5-rgb", 0.28) },
        ]),
        smallPeak: shadowValue([
          { spread: 1, color: rgbaVar("--heat-5-rgb", 0.34) },
          { blur: 4, color: rgbaVar("--accent-working-rgb", 0.96) },
          { blur: 10, color: rgbaVar("--heat-5-rgb", 0.42) },
          { blur: 14, color: rgbaVar("--heat-4-rgb", 0.18) },
        ]),
      },
    },
    header: {
      shadows: [
        NONE,
        NONE,
        NONE,
        shadowValue([
          { spread: 1, color: rgbaVar("--heat-5-rgb", 0.14) },
          { blur: 10, color: rgbaVar("--heat-4-rgb", 0.18) },
        ]),
        shadowValue([
          { inset: true, spread: 1, color: rgbaVar("--heat-5-rgb", 0.46) },
          { blur: 8, color: rgbaVar("--heat-5-rgb", 0.28) },
          { blur: 18, spread: -10, color: rgbaVar("--heat-4-rgb", 0.22) },
        ]),
        shadowValue([
          { inset: true, spread: 1, color: rgbaVar("--heat-5-rgb", 0.58) },
          { blur: 10, color: rgbaVar("--heat-5-rgb", 0.36) },
          { blur: 22, spread: -10, color: rgbaVar("--heat-4-rgb", 0.26) },
        ]),
      ],
      bloom: [
        NONE,
        NONE,
        NONE,
        "radial-gradient(52% 74% at 50% 50%, rgba(var(--heat-5-rgb), 0.18) 0%, rgba(var(--heat-4-rgb), 0.1) 44%, rgba(var(--heat-4-rgb), 0) 72%)",
        "radial-gradient(56% 78% at 50% 50%, rgba(var(--heat-5-rgb), 0.24) 0%, rgba(var(--heat-4-rgb), 0.14) 38%, rgba(var(--heat-4-rgb), 0) 72%)",
        "radial-gradient(60% 82% at 50% 50%, rgba(var(--heat-5-rgb), 0.3) 0%, rgba(var(--heat-4-rgb), 0.18) 34%, rgba(var(--heat-4-rgb), 0.04) 52%, rgba(var(--heat-4-rgb), 0) 74%)",
      ],
      bloomOpacity: ["0", "0", "0", "0.4", "0.52", "0.64"],
      bloomBlur: ["0px", "0px", "0px", "6px", "8px", "10px"],
      border: ["var(--border)", "var(--border)", "var(--border)", "var(--border)", "var(--border)", "var(--heat-5)"],
    },
    logo: {
      filters: [
        NONE,
        filterValue([
          { blur: 3, color: rgbaVar("--heat-2-rgb", 0.72) },
        ]),
        filterValue([
          { blur: 4, color: rgbaVar("--heat-3-rgb", 0.8) },
          { blur: 8, color: rgbaVar("--heat-5-rgb", 0.18) },
        ]),
        filterValue([
          { blur: 4, color: rgbaVar("--heat-4-rgb", 0.84) },
          { blur: 9, color: rgbaVar("--heat-5-rgb", 0.28) },
        ]),
        filterValue([
          { blur: 5, color: rgbaVar("--heat-4-rgb", 0.86) },
          { blur: 11, color: rgbaVar("--heat-5-rgb", 0.36) },
        ]),
        filterValue([
          { blur: 4, color: rgbaVar("--heat-5-rgb", 0.92) },
          { blur: 8, color: rgbaVar("--heat-5-rgb", 0.5) },
          { blur: 14, color: rgbaVar("--heat-4-rgb", 0.24) },
        ]),
      ],
    },
    shell: {
      tabBar: shadowValue([
        { inset: true, y: -1, blur: 0, color: rgbaVar("--heat-5-rgb", 0.24) },
        { blur: 10, spread: -4, color: rgbaVar("--heat-5-rgb", 0.28) },
        { blur: 22, spread: -16, color: rgbaVar("--heat-4-rgb", 0.16) },
      ]),
      sidebar: shadowValue([
        { inset: true, x: -1, blur: 0, color: rgbaVar("--heat-5-rgb", 0.22) },
        { blur: 12, spread: -4, color: rgbaVar("--heat-5-rgb", 0.3) },
        { blur: 24, spread: -16, color: rgbaVar("--heat-4-rgb", 0.18) },
      ]),
      main: shadowValue([
        { inset: true, spread: 1, color: rgbaVar("--heat-5-rgb", 0.18) },
        { blur: 16, spread: -12, color: rgbaVar("--heat-5-rgb", 0.16) },
      ]),
    },
  },
  void: {
    status: {
      waiting: {
        normal: shadowValue([
          { blur: 4, color: rgbaVar("--accent-waiting-rgb", 0.78) },
          { blur: 12, color: rgbaVar("--accent-waiting-rgb", 0.18) },
          { x: 6, blur: 14, color: rgbaVar("--heat-5-rgb", 0.22) },
          { x: -4, blur: 10, color: rgbaVar("--heat-3-rgb", 0.16) },
        ]),
        small: shadowValue([
          { blur: 3, color: rgbaVar("--accent-waiting-rgb", 0.72) },
          { blur: 8, color: rgbaVar("--accent-waiting-rgb", 0.14) },
          { x: 4, blur: 10, color: rgbaVar("--heat-5-rgb", 0.16) },
        ]),
      },
      working: {
        normalRest: shadowValue([
          { blur: 5, color: rgbaVar("--accent-working-rgb", 0.82) },
          { blur: 14, color: rgbaVar("--accent-working-rgb", 0.22) },
          { x: 8, blur: 16, color: rgbaVar("--heat-5-rgb", 0.24) },
          { x: -5, blur: 11, color: rgbaVar("--heat-3-rgb", 0.18) },
        ]),
        normalPeak: shadowValue([
          { blur: 6, color: rgbaVar("--accent-working-rgb", 0.94) },
          { blur: 16, color: rgbaVar("--accent-working-rgb", 0.3) },
          { x: 10, blur: 22, color: rgbaVar("--heat-5-rgb", 0.3) },
          { x: -7, blur: 14, color: rgbaVar("--heat-3-rgb", 0.2) },
        ]),
        smallRest: shadowValue([
          { blur: 4, color: rgbaVar("--accent-working-rgb", 0.76) },
          { blur: 10, color: rgbaVar("--accent-working-rgb", 0.18) },
          { x: 5, blur: 12, color: rgbaVar("--heat-5-rgb", 0.18) },
        ]),
        smallPeak: shadowValue([
          { blur: 5, color: rgbaVar("--accent-working-rgb", 0.9) },
          { blur: 12, color: rgbaVar("--accent-working-rgb", 0.24) },
          { x: 7, blur: 16, color: rgbaVar("--heat-5-rgb", 0.24) },
          { x: -4, blur: 10, color: rgbaVar("--heat-3-rgb", 0.16) },
        ]),
      },
    },
    header: {
      shadows: [
        NONE,
        NONE,
        NONE,
        shadowValue([
          { blur: 10, color: rgbaVar("--heat-4-rgb", 0.16) },
          { x: 10, blur: 18, color: rgbaVar("--heat-5-rgb", 0.1) },
          { x: -8, blur: 14, color: rgbaVar("--heat-3-rgb", 0.1) },
        ]),
        shadowValue([
          { inset: true, spread: 1, color: rgbaVar("--heat-5-rgb", 0.34) },
          { blur: 16, color: rgbaVar("--heat-4-rgb", 0.22) },
          { x: 14, blur: 24, color: rgbaVar("--heat-5-rgb", 0.16) },
          { x: -10, blur: 18, color: rgbaVar("--heat-3-rgb", 0.14) },
        ]),
        shadowValue([
          { inset: true, spread: 1, color: rgbaVar("--heat-5-rgb", 0.44) },
          { blur: 18, color: rgbaVar("--heat-4-rgb", 0.26) },
          { x: 18, blur: 28, color: rgbaVar("--heat-5-rgb", 0.2) },
          { x: -12, blur: 22, color: rgbaVar("--heat-3-rgb", 0.16) },
        ]),
      ],
      bloom: [
        NONE,
        NONE,
        NONE,
        "radial-gradient(86% 140% at 50% 50%, rgba(var(--heat-5-rgb), 0.12) 0%, rgba(var(--heat-4-rgb), 0.1) 32%, rgba(var(--heat-3-rgb), 0) 74%), linear-gradient(90deg, rgba(var(--heat-4-rgb), 0) 0%, rgba(var(--heat-4-rgb), 0.06) 18%, rgba(var(--heat-5-rgb), 0.12) 50%, rgba(var(--heat-4-rgb), 0.06) 82%, rgba(var(--heat-4-rgb), 0) 100%)",
        "radial-gradient(92% 148% at 50% 50%, rgba(var(--heat-5-rgb), 0.16) 0%, rgba(var(--heat-4-rgb), 0.12) 30%, rgba(var(--heat-3-rgb), 0.04) 52%, rgba(var(--heat-3-rgb), 0) 76%), linear-gradient(90deg, rgba(var(--heat-4-rgb), 0) 0%, rgba(var(--heat-4-rgb), 0.08) 18%, rgba(var(--heat-5-rgb), 0.16) 50%, rgba(var(--heat-4-rgb), 0.08) 82%, rgba(var(--heat-4-rgb), 0) 100%)",
        "radial-gradient(98% 156% at 50% 50%, rgba(var(--heat-5-rgb), 0.22) 0%, rgba(var(--heat-4-rgb), 0.14) 28%, rgba(var(--heat-3-rgb), 0.06) 50%, rgba(var(--heat-3-rgb), 0) 76%), linear-gradient(90deg, rgba(var(--heat-4-rgb), 0) 0%, rgba(var(--heat-4-rgb), 0.1) 16%, rgba(var(--heat-5-rgb), 0.2) 50%, rgba(var(--heat-4-rgb), 0.1) 84%, rgba(var(--heat-4-rgb), 0) 100%)",
      ],
      bloomOpacity: ["0", "0", "0", "0.42", "0.56", "0.68"],
      bloomBlur: ["0px", "0px", "0px", "14px", "18px", "22px"],
      border: ["var(--border)", "var(--border)", "var(--border)", "var(--border)", "var(--border)", "var(--heat-5)"],
    },
    logo: {
      filters: [
        NONE,
        filterValue([
          { blur: 4, color: rgbaVar("--heat-2-rgb", 0.74) },
          { x: 5, blur: 8, color: rgbaVar("--heat-3-rgb", 0.16) },
        ]),
        filterValue([
          { blur: 5, color: rgbaVar("--heat-3-rgb", 0.82) },
          { x: 7, blur: 11, color: rgbaVar("--heat-4-rgb", 0.2) },
          { x: -5, blur: 8, color: rgbaVar("--heat-2-rgb", 0.16) },
        ]),
        filterValue([
          { blur: 6, color: rgbaVar("--heat-4-rgb", 0.82) },
          { x: 9, blur: 14, color: rgbaVar("--heat-5-rgb", 0.22) },
          { x: -6, blur: 9, color: rgbaVar("--heat-3-rgb", 0.18) },
        ]),
        filterValue([
          { blur: 7, color: rgbaVar("--heat-4-rgb", 0.88) },
          { x: 12, blur: 18, color: rgbaVar("--heat-5-rgb", 0.28) },
          { x: -8, blur: 11, color: rgbaVar("--heat-3-rgb", 0.22) },
        ]),
        filterValue([
          { blur: 6, color: rgbaVar("--heat-5-rgb", 0.88) },
          { x: 14, blur: 20, color: rgbaVar("--heat-5-rgb", 0.34) },
          { x: -9, blur: 13, color: rgbaVar("--heat-3-rgb", 0.24) },
        ]),
      ],
    },
    shell: {
      tabBar: shadowValue([
        { inset: true, y: -1, blur: 0, color: rgbaVar("--heat-5-rgb", 0.16) },
        { blur: 16, spread: -4, color: rgbaVar("--heat-4-rgb", 0.22) },
        { x: 16, blur: 24, spread: -14, color: rgbaVar("--heat-5-rgb", 0.18) },
        { x: -10, blur: 18, spread: -14, color: rgbaVar("--heat-3-rgb", 0.12) },
      ]),
      sidebar: shadowValue([
        { inset: true, x: -1, blur: 0, color: rgbaVar("--heat-5-rgb", 0.16) },
        { blur: 18, spread: -4, color: rgbaVar("--heat-4-rgb", 0.24) },
        { x: 18, blur: 28, spread: -12, color: rgbaVar("--heat-5-rgb", 0.18) },
        { x: -12, blur: 18, spread: -14, color: rgbaVar("--heat-3-rgb", 0.12) },
      ]),
      main: shadowValue([
        { inset: true, spread: 1, color: rgbaVar("--heat-5-rgb", 0.14) },
        { blur: 18, spread: -12, color: rgbaVar("--heat-4-rgb", 0.16) },
        { x: 16, blur: 26, spread: -18, color: rgbaVar("--heat-5-rgb", 0.14) },
      ]),
    },
  },
  grass: {
    status: {
      waiting: {
        normal: shadowValue([
          { blur: 4, color: rgbaVar("--accent-waiting-rgb", 0.58) },
          { blur: 10, spread: 2, color: rgbaVar("--heat-4-rgb", 0.14) },
        ]),
        small: shadowValue([
          { blur: 3, color: rgbaVar("--accent-waiting-rgb", 0.52) },
          { blur: 8, spread: 1, color: rgbaVar("--heat-4-rgb", 0.12) },
        ]),
      },
      working: {
        normalRest: shadowValue([
          { blur: 4, color: rgbaVar("--accent-working-rgb", 0.7) },
          { blur: 10, spread: 1, color: rgbaVar("--heat-4-rgb", 0.18) },
        ]),
        normalPeak: shadowValue([
          { blur: 6, color: rgbaVar("--accent-working-rgb", 0.84) },
          { blur: 14, spread: 2, color: rgbaVar("--heat-5-rgb", 0.22) },
          { blur: 24, spread: 4, color: rgbaVar("--heat-4-rgb", 0.1) },
        ]),
        smallRest: shadowValue([
          { blur: 3, color: rgbaVar("--accent-working-rgb", 0.64) },
          { blur: 8, spread: 1, color: rgbaVar("--heat-4-rgb", 0.14) },
        ]),
        smallPeak: shadowValue([
          { blur: 4, color: rgbaVar("--accent-working-rgb", 0.78) },
          { blur: 10, spread: 2, color: rgbaVar("--heat-5-rgb", 0.18) },
          { blur: 16, spread: 3, color: rgbaVar("--heat-4-rgb", 0.08) },
        ]),
      },
    },
    header: {
      shadows: [
        NONE,
        NONE,
        NONE,
        shadowValue([
          { blur: 10, color: rgbaVar("--heat-4-rgb", 0.12) },
        ]),
        shadowValue([
          { inset: true, spread: 1, color: rgbaVar("--heat-5-rgb", 0.3) },
          { blur: 14, color: rgbaVar("--heat-4-rgb", 0.16) },
          { blur: 26, spread: -10, color: rgbaVar("--heat-5-rgb", 0.1) },
        ]),
        shadowValue([
          { inset: true, spread: 1, color: rgbaVar("--heat-5-rgb", 0.38) },
          { blur: 16, color: rgbaVar("--heat-4-rgb", 0.2) },
          { blur: 30, spread: -10, color: rgbaVar("--heat-5-rgb", 0.12) },
        ]),
      ],
      bloom: [
        NONE,
        NONE,
        NONE,
        "radial-gradient(68% 96% at 50% 52%, rgba(var(--heat-5-rgb), 0.12) 0%, rgba(var(--heat-4-rgb), 0.1) 34%, rgba(var(--heat-3-rgb), 0.06) 56%, rgba(var(--heat-3-rgb), 0) 78%)",
        "radial-gradient(72% 106% at 50% 52%, rgba(var(--heat-5-rgb), 0.16) 0%, rgba(var(--heat-4-rgb), 0.12) 34%, rgba(var(--heat-3-rgb), 0.08) 56%, rgba(var(--heat-3-rgb), 0) 78%)",
        "radial-gradient(76% 114% at 50% 50%, rgba(var(--heat-5-rgb), 0.2) 0%, rgba(var(--heat-4-rgb), 0.14) 32%, rgba(var(--heat-3-rgb), 0.08) 54%, rgba(var(--heat-3-rgb), 0) 78%)",
      ],
      bloomOpacity: ["0", "0", "0", "0.46", "0.58", "0.7"],
      bloomBlur: ["0px", "0px", "0px", "12px", "16px", "18px"],
      border: ["var(--border)", "var(--border)", "var(--border)", "var(--border)", "var(--border)", "var(--heat-5)"],
    },
    logo: {
      filters: [
        NONE,
        filterValue([
          { blur: 3, color: rgbaVar("--heat-2-rgb", 0.64) },
        ]),
        filterValue([
          { blur: 5, color: rgbaVar("--heat-3-rgb", 0.72) },
          { blur: 10, color: rgbaVar("--heat-4-rgb", 0.12) },
        ]),
        filterValue([
          { blur: 6, color: rgbaVar("--heat-3-rgb", 0.8) },
          { blur: 12, color: rgbaVar("--heat-4-rgb", 0.18) },
        ]),
        filterValue([
          { blur: 6, color: rgbaVar("--heat-4-rgb", 0.84) },
          { blur: 14, color: rgbaVar("--heat-5-rgb", 0.22) },
        ]),
        filterValue([
          { blur: 7, color: rgbaVar("--heat-5-rgb", 0.78) },
          { blur: 16, color: rgbaVar("--heat-4-rgb", 0.26) },
          { blur: 24, color: rgbaVar("--heat-3-rgb", 0.1) },
        ]),
      ],
    },
    shell: {
      tabBar: shadowValue([
        { inset: true, y: -1, blur: 0, color: rgbaVar("--heat-5-rgb", 0.12) },
        { blur: 14, spread: -4, color: rgbaVar("--heat-4-rgb", 0.16) },
        { blur: 28, spread: -12, color: rgbaVar("--heat-5-rgb", 0.1) },
      ]),
      sidebar: shadowValue([
        { inset: true, x: -1, blur: 0, color: rgbaVar("--heat-5-rgb", 0.12) },
        { blur: 16, spread: -4, color: rgbaVar("--heat-4-rgb", 0.18) },
        { blur: 32, spread: -12, color: rgbaVar("--heat-5-rgb", 0.1) },
      ]),
      main: shadowValue([
        { inset: true, spread: 1, color: rgbaVar("--heat-5-rgb", 0.1) },
        { blur: 18, spread: -12, color: rgbaVar("--heat-4-rgb", 0.12) },
      ]),
    },
  },
};

const THEMES = {
  forge: {
    label: "Forge",
    accentActive: "#60a5fa",
    statusStops: {
      waiting: 1,
      working: 5,
    },
    heatColors: ["#475569", "#f59e0b", "#ea580c", "#dc2626", "#ef4444", "#ff4d4d"],
    backgrounds: [
      { bgDeep: "#080c14", bgSidebar: "#0a0f1a", bgActive: "#111b2e", border: "#1e293b" },
      { bgDeep: "#0a0c12", bgSidebar: "#0d1018", bgActive: "#151a28", border: "#25293a" },
      { bgDeep: "#0c0b10", bgSidebar: "#100e16", bgActive: "#1a1520", border: "#2e2535" },
      { bgDeep: "#0e0a0a", bgSidebar: "#120d0c", bgActive: "#1e1412", border: "#352220" },
      { bgDeep: "#100808", bgSidebar: "#140b0a", bgActive: "#22120f", border: "#3a1e1a" },
      { bgDeep: "#120606", bgSidebar: "#180808", bgActive: "#28100e", border: "#401815" },
    ],
  },
  ice: {
    label: "Ice",
    accentActive: "#5ccaf4",
    statusStops: {
      waiting: 2,
      working: 5,
    },
    heatColors: ["#53667d", "#4d82b8", "#1fd6ff", "#74ecff", "#c4f7ff", "#f2feff"],
    backgrounds: [
      { bgDeep: "#08111a", bgSidebar: "#0b1621", bgActive: "#112030", border: "#1e3143" },
      { bgDeep: "#08121c", bgSidebar: "#0c1824", bgActive: "#122333", border: "#21384a" },
      { bgDeep: "#08151f", bgSidebar: "#0d1b28", bgActive: "#142738", border: "#264253" },
      { bgDeep: "#081821", bgSidebar: "#0f1f2d", bgActive: "#172d3d", border: "#2d4b5b" },
      { bgDeep: "#081a24", bgSidebar: "#112332", bgActive: "#1a3344", border: "#365768" },
      { bgDeep: "#091d28", bgSidebar: "#142838", bgActive: "#1d394d", border: "#426476" },
    ],
  },
  void: {
    label: "Void",
    accentActive: "#8c6bff",
    statusStops: {
      waiting: 3,
      working: 5,
    },
    heatColors: ["#534d63", "#46508a", "#9365ff", "#c257ff", "#ff4fe0", "#ff9ae8"],
    backgrounds: [
      { bgDeep: "#08070c", bgSidebar: "#0b0911", bgActive: "#12101a", border: "#201b2b" },
      { bgDeep: "#09080e", bgSidebar: "#0d0a13", bgActive: "#15121e", border: "#272033" },
      { bgDeep: "#0a0810", bgSidebar: "#0f0b16", bgActive: "#181321", border: "#30253d" },
      { bgDeep: "#0b0812", bgSidebar: "#120d1a", bgActive: "#1c1528", border: "#3b2b4a" },
      { bgDeep: "#0c0915", bgSidebar: "#150f1f", bgActive: "#21192f", border: "#4b315e" },
      { bgDeep: "#0d0a18", bgSidebar: "#181223", bgActive: "#271d37", border: "#5b3971" },
    ],
  },
  grass: {
    label: "Grass",
    accentActive: "#6bcf63",
    statusStops: {
      waiting: 3,
      working: 5,
    },
    heatColors: ["#4d563f", "#667b29", "#4baa3c", "#78d63a", "#b7ef45", "#ecff87"],
    backgrounds: [
      { bgDeep: "#08100b", bgSidebar: "#0b150e", bgActive: "#111f15", border: "#1f3022" },
      { bgDeep: "#09120c", bgSidebar: "#0c180f", bgActive: "#132316", border: "#223724" },
      { bgDeep: "#0a140d", bgSidebar: "#0e1b11", bgActive: "#162917", border: "#274129" },
      { bgDeep: "#0b160e", bgSidebar: "#101f13", bgActive: "#1a2f1a", border: "#2e4d2f" },
      { bgDeep: "#0c180f", bgSidebar: "#122416", bgActive: "#1d351d", border: "#356036" },
      { bgDeep: "#0d1b11", bgSidebar: "#152a18", bgActive: "#223d21", border: "#3e7740" },
    ],
  },
};

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3
    ? value.split("").map((char) => `${char}${char}`).join("")
    : value;
  const intValue = Number.parseInt(normalized, 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `${r}, ${g}, ${b}`;
}

export function normalizeTheme(value) {
  return Object.prototype.hasOwnProperty.call(THEMES, value) ? value : DEFAULT_THEME;
}

export function getThemeConfig(theme) {
  return THEMES[normalizeTheme(theme)];
}

export function getThemeHeatColors(theme) {
  return getThemeConfig(theme).heatColors;
}

export function getThemeStatusColors(theme) {
  const resolvedTheme = getThemeConfig(theme);
  const heatColors = resolvedTheme.heatColors;
  return {
    waiting: heatColors[resolvedTheme.statusStops.waiting],
    working: heatColors[resolvedTheme.statusStops.working],
  };
}

export function getThemeHeatColor(theme, heatStage) {
  const colors = getThemeHeatColors(theme);
  return colors[Math.max(0, Math.min(colors.length - 1, heatStage))];
}

export function getThemeOptions() {
  return Object.entries(THEMES).map(([value, entry]) => ({
    value,
    label: entry.label,
  }));
}

export function getThemeTokens(theme, heatStage) {
  const resolvedThemeName = normalizeTheme(theme);
  const resolvedTheme = THEMES[resolvedThemeName];
  const glow = THEME_GLOWS[resolvedThemeName];
  const resolvedHeatStage = Math.max(0, Math.min(resolvedTheme.backgrounds.length - 1, heatStage));
  const heatColors = resolvedTheme.heatColors;
  const statusStops = resolvedTheme.statusStops;
  const background = resolvedTheme.backgrounds[resolvedHeatStage];
  const waitingColor = heatColors[statusStops.waiting];
  const workingColor = heatColors[statusStops.working];

  return {
    "--bg-deep": background.bgDeep,
    "--bg-sidebar": background.bgSidebar,
    "--bg-active": background.bgActive,
    "--border": background.border,
    "--accent-active": resolvedTheme.accentActive,
    "--accent-active-rgb": hexToRgb(resolvedTheme.accentActive),
    "--accent-idle": "#64748b",
    "--accent-idle-rgb": "100, 116, 139",
    "--accent-working": workingColor,
    "--accent-working-rgb": hexToRgb(workingColor),
    "--accent-waiting": waitingColor,
    "--accent-waiting-rgb": hexToRgb(waitingColor),
    "--accent-server": "#3b82f6",
    "--accent-server-rgb": "59, 130, 246",
    "--heat-0": heatColors[0],
    "--heat-0-rgb": hexToRgb(heatColors[0]),
    "--heat-1": heatColors[1],
    "--heat-1-rgb": hexToRgb(heatColors[1]),
    "--heat-2": heatColors[2],
    "--heat-2-rgb": hexToRgb(heatColors[2]),
    "--heat-3": heatColors[3],
    "--heat-3-rgb": hexToRgb(heatColors[3]),
    "--heat-4": heatColors[4],
    "--heat-4-rgb": hexToRgb(heatColors[4]),
    "--heat-5": heatColors[5],
    "--heat-5-rgb": hexToRgb(heatColors[5]),
    "--heat-current": heatColors[resolvedHeatStage],
    "--heat-current-rgb": hexToRgb(heatColors[resolvedHeatStage]),
    "--header-glow-opacity": `${HEADER_BG_OPACITY[resolvedHeatStage]}`,
    "--status-waiting-glow": glow.status.waiting.normal,
    "--status-waiting-small-glow": glow.status.waiting.small,
    "--status-working-glow-rest": glow.status.working.normalRest,
    "--status-working-glow-peak": glow.status.working.normalPeak,
    "--status-working-small-rest": glow.status.working.smallRest,
    "--status-working-small-peak": glow.status.working.smallPeak,
    "--header-glow-shadow": glow.header.shadows[resolvedHeatStage],
    "--header-glow-border": glow.header.border[resolvedHeatStage],
    "--header-bloom": glow.header.bloom[resolvedHeatStage],
    "--header-bloom-opacity": glow.header.bloomOpacity[resolvedHeatStage],
    "--header-bloom-blur": glow.header.bloomBlur[resolvedHeatStage],
    "--logo-glow-filter": glow.logo.filters[resolvedHeatStage],
    "--shell-glow-tabbar": glow.shell.tabBar,
    "--shell-glow-sidebar": glow.shell.sidebar,
    "--shell-glow-main": glow.shell.main,
  };
}

export { DEFAULT_THEME, THEMES };
