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
    };
  }

  if (theme === "void") {
    return {
      "--size": sizeBase * 0.95,
      "--sway": `${swayBase * 1.05 * (i % 2 === 0 ? 1 : -1)}px`,
      "--void-drift": `${(12 + ((i * 7) % 18)) * (i % 3 === 0 ? -1 : 1)}px`,
      "--void-sink": `${18 + ((i * 5) % 18)}px`,
    };
  }

  if (theme === "grass") {
    return {
      "--size": sizeBase * 0.95,
      "--sway": `${swayBase * 1.7 * (i % 2 === 0 ? 1 : -1)}px`,
      "--grass-drift": `${(18 + ((i * 5) % 22)) * (i % 2 === 0 ? 1 : -1)}px`,
    };
  }

  return { "--size": sizeBase, "--sway": `${swayBase * (i % 2 === 0 ? 1 : -1)}px` };
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
