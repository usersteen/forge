import { useEffect } from "react";
import useForgeStore from "../store/useForgeStore";

export default function useHeatTick() {
  useEffect(() => {
    const id = setInterval(() => {
      const s = useForgeStore.getState();
      if (s.streak <= 0 || !s.lastStreakTime) return;
      // Don't cool down while any tab is actively working
      const anyWorking = s.groups.some((g) => g.tabs.some((t) => t.status === "working"));
      if (anyWorking) return;
      const timeout = s.streak === 1 ? s.cooldownTimer * 5 : s.cooldownTimer;
      if (Date.now() - s.lastStreakTime > timeout) {
        s.decrementStreak();
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);
}
