import { useEffect } from "react";
import useForgeStore from "../store/useForgeStore";

export default function useHeatTick() {
  useEffect(() => {
    const id = setInterval(() => {
      const s = useForgeStore.getState();
      if (s.demoHeatStage !== null) return;
      if (s.heatPauseStartedAt) return;
      if (s.streak <= 0 || !s.lastStreakTime) return;
      s.coolStreak();
    }, 1000);
    return () => clearInterval(id);
  }, []);
}
