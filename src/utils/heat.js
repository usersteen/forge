export const HEAT_COLORS = ["#475569", "#f59e0b", "#ea580c", "#dc2626", "#ef4444", "#b91c1c"];
export const HEAT_LABELS = ["Cold", "Warm", "Hot", "Blazing", "Inferno", "Meltdown"];

export function getEmberStyle(i) {
  const size = i % 5 < 2 ? 0.6 + (i * 0.07) % 0.2 : i % 5 < 4 ? 0.9 + (i * 0.11) % 0.3 : 1.4 + (i * 0.13) % 0.4;
  const sway = (8 + (i * 7) % 17) * (i % 2 === 0 ? 1 : -1);
  return { '--size': size, '--sway': `${sway}px` };
}

export function getHeatStage(streak) {
  if (streak >= 10) return 5;
  if (streak >= 8) return 4;
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  if (streak >= 1) return 1;
  return 0;
}
