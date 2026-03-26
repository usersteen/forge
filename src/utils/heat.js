export const HEAT_LABELS = ["Cold", "Warm", "Hot", "Blazing", "Inferno", "Meltdown"];
export const MAX_HEAT_STREAK = 10;

export function clampHeatStreak(streak) {
  return Math.max(0, Math.min(MAX_HEAT_STREAK, streak));
}

export function getEmberStyle(i, theme = "forge") {
  const sizeBase =
    i % 5 < 2
      ? 0.6 + ((i * 0.07) % 0.2)
      : i % 5 < 4
        ? 0.9 + ((i * 0.11) % 0.3)
        : 1.4 + ((i * 0.13) % 0.4);
  const swayBase = 8 + ((i * 7) % 17);

  if (theme === "ice") {
    return {
      "--size": Math.max(0.45, sizeBase - 0.2),
      "--sway": `${swayBase * 0.22 * (i % 2 === 0 ? 1 : -1)}px`,
      "--ice-special-play": i % 4 === 0 ? "running" : "paused",
    };
  }

  if (theme === "void") {
    const splitAngle = ((i * 47) % 360) * (Math.PI / 180);
    const splitDist = 20 + ((i * 3) % 14);
    return {
      "--size": sizeBase * 1.05,
      "--sway": `${swayBase * 1.05 * (i % 2 === 0 ? 1 : -1)}px`,
      "--void-drift": `${(12 + ((i * 7) % 18)) * (i % 3 === 0 ? -1 : 1)}px`,
      "--void-sink": `${18 + ((i * 5) % 18)}px`,
      "--void-split-a-x": `${Math.round(Math.cos(splitAngle) * splitDist)}px`,
      "--void-split-a-y": `${Math.round(Math.sin(splitAngle) * splitDist)}px`,
    };
  }

  if (theme === "grass") {
    const puffOffset = ((i * 37) % 360) * (Math.PI / 180);
    const puffDist = 14 + ((i * 3) % 8);
    const puffVars = {};
    for (let j = 0; j < 6; j++) {
      const angle = puffOffset + (j * Math.PI) / 3;
      puffVars[`--grass-puff-${j}-x`] = `${Math.round(Math.cos(angle) * puffDist)}px`;
      puffVars[`--grass-puff-${j}-y`] = `${Math.round(Math.sin(angle) * puffDist)}px`;
    }
    return {
      "--size": sizeBase * 0.95,
      "--sway": `${swayBase * 0.6 * (i % 2 === 0 ? 1 : -1)}px`,
      "--grass-drift": `${(8 + ((i * 5) % 10)) * (i % 2 === 0 ? 1 : -1)}px`,
      "--grass-special-play": i % 5 === 2 ? "running" : "paused",
      "--grass-glow-play": i % 3 === 0 ? "running" : "paused",
      ...puffVars,
    };
  }

  return {
    "--size": sizeBase,
    "--sway": `${swayBase * (i % 2 === 0 ? 1 : -1)}px`,
    "--forge-spark-play": i % 3 === 0 ? "running" : "paused",
    "--forge-spark-angle": `${(i % 2 === 0 ? 1 : -1) * (10 + ((i * 7) % 16))}deg`,
    "--forge-spark-spread": `${8 + ((i * 5) % 9)}px`,
  };
}

export function getHeatStage(streak) {
  const normalized = clampHeatStreak(streak);
  if (normalized >= 10) return 5;
  if (normalized >= 8) return 4;
  if (normalized >= 5) return 3;
  if (normalized >= 3) return 2;
  if (normalized >= 1) return 1;
  return 0;
}
