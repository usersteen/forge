import { useMemo } from "react";
import useForgeStore from "../store/useForgeStore";
import useEffectiveHeatStage from "../hooks/useEffectiveHeatStage";
import { getEmberStyle } from "../utils/heat";

// V1 CSS particle engine — span-based embers with @keyframes animations.
// Configs recovered from pre-canvas commit (ead47e9~1).

const EMBER_CONFIGS = {
  3: [15, 35, 60, 82],
  4: [5, 15, 25, 36, 47, 58, 68, 78, 88, 95],
  5: [3, 10, 17, 24, 31, 38, 45, 52, 59, 66, 73, 80, 87, 93, 97, 100],
};

const SIDEBAR_EMBER_CONFIGS = {
  4: [[12, 1.2], [42, 7.5], [70, 3.8], [28, 10.1], [85, 5.6], [55, 0.4], [20, 4.3], [65, 9.0]],
  5: [[8, 2.1], [35, 9.3], [62, 0.7], [18, 6.4], [78, 13.2], [48, 4.0], [90, 8.8], [25, 11.5], [58, 1.9], [5, 3.5], [40, 7.2], [72, 0.3], [15, 10.8], [82, 5.1]],
};

const TABBAR_EMBER_CONFIGS = {
  4: [6, 18, 30, 42, 54, 66, 78, 90],
  5: [3, 10, 17, 24, 31, 38, 45, 52, 59, 66, 73, 80, 87, 94],
};

const DOCUMENT_TAB_EMBER_CONFIGS = {
  4: [8, 22, 36, 50, 64, 78, 92],
  5: [4, 11, 18, 25, 32, 39, 46, 53, 60, 67, 74, 81, 88, 95],
};

const REPO_BROWSER_EMBER_CONFIGS = {
  4: [8, 21, 34, 47, 60, 73, 86],
  5: [4, 11, 18, 25, 32, 39, 46, 53, 60, 67, 74, 81, 88, 95],
};

const LOCATION_MAP = {
  header: { configs: EMBER_CONFIGS, className: "forge-ember", delayMod: 0.4 },
  sidebar: { configs: SIDEBAR_EMBER_CONFIGS, className: "forge-ember-tall", isTuple: true },
  tabbar: { configs: TABBAR_EMBER_CONFIGS, className: "forge-ember-wide", delayMod: 0.3 },
  documentTabs: { configs: DOCUMENT_TAB_EMBER_CONFIGS, className: "forge-ember-wide", delayMod: 0.3 },
  repoBrowser: { configs: REPO_BROWSER_EMBER_CONFIGS, className: "forge-ember-wide", delayMod: 0.3 },
};

export default function EmberLayer({ location = "header", themeOverride, heatOverride }) {
  const storeTheme = useForgeStore((s) => s.theme);
  const fxEnabled = useForgeStore((s) => s.fxEnabled);
  const storeHeat = useEffectiveHeatStage();

  const theme = themeOverride || storeTheme;
  const heatStage = heatOverride != null ? heatOverride : storeHeat;

  const active = fxEnabled && heatStage >= 3;

  const embers = useMemo(() => {
    if (!active) return null;
    const loc = LOCATION_MAP[location] || LOCATION_MAP.header;
    const positions = loc.configs[heatStage] || (heatStage > 5 ? loc.configs[5] : null);
    if (!positions) return null;

    if (loc.isTuple) {
      return positions.map(([left, delay], i) => (
        <span
          key={`e-${i}`}
          className={loc.className}
          style={{ left: `${left}%`, animationDelay: `${delay}s`, ...getEmberStyle(i, theme) }}
        />
      ));
    }

    return positions.map((left, i) => (
      <span
        key={`e-${i}`}
        className={loc.className}
        style={{ left: `${left}%`, animationDelay: `${(i * loc.delayMod) % 2}s`, ...getEmberStyle(i, theme) }}
      />
    ));
  }, [active, location, heatStage, theme]);

  if (!active) return null;

  return <div className="forge-ember-layer">{embers}</div>;
}
