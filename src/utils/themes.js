const DEFAULT_THEME = "forge";

const HEADER_BG_OPACITY = [0, 0.06, 0.1, 0.13, 0.16, 0.2];

const THEMES = {
  forge: {
    label: "Forge",
    accentActive: "#60a5fa",
    statusStops: {
      waiting: 1,
      working: 4,
    },
    heatColors: ["#475569", "#f59e0b", "#ea580c", "#dc2626", "#ef4444", "#b91c1c"],
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
      waiting: 2,
      working: 4,
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
      waiting: 2,
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
  const resolvedTheme = getThemeConfig(theme);
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
  };
}

export { DEFAULT_THEME, THEMES };
