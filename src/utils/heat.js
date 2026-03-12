export const HEAT_COLORS = ["#475569", "#f59e0b", "#ea580c", "#dc2626", "#ef4444", "#b91c1c"];
export const HEAT_LABELS = ["Cold", "Warm", "Hot", "Blazing", "Inferno", "Meltdown"];
export const MAX_HEAT_STREAK = 10;

export function clampHeatStreak(streak) {
  return Math.max(0, Math.min(MAX_HEAT_STREAK, streak));
}

export function getEmberStyle(i) {
  const size = i % 5 < 2 ? 0.6 + (i * 0.07) % 0.2 : i % 5 < 4 ? 0.9 + (i * 0.11) % 0.3 : 1.4 + (i * 0.13) % 0.4;
  const sway = (8 + (i * 7) % 17) * (i % 2 === 0 ? 1 : -1);
  return { '--size': size, '--sway': `${sway}px` };
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
