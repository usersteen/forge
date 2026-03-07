import { useEffect } from "react";
import useForgeStore from "../store/useForgeStore";

export default function useHeatTick() {
  useEffect(() => {
    const id = setInterval(() => {
      const s = useForgeStore.getState();
      if (s.streak <= 0 || !s.lastStreakTime) return;
      const anyWaiting = s.groups.some((g) => g.tabs.some((t) => t.waitingSince));
      if (anyWaiting) return;
      if (Date.now() - s.lastStreakTime > s.cooldownTimer) {
        s.decrementStreak();
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);
}
