export const HEAT_COLORS = ["#475569", "#f59e0b", "#ea580c", "#dc2626", "#ef4444", "#b91c1c"];

export function getHeatStage(streak) {
  if (streak >= 10) return 5;
  if (streak >= 8) return 4;
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  if (streak >= 1) return 1;
  return 0;
}
