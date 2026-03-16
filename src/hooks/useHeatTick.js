import { useEffect } from "react";
import useForgeStore from "../store/useForgeStore";

export default function useHeatTick() {
  useEffect(() => {
    const id = setInterval(() => {
      const s = useForgeStore.getState();
      if (s.demoHeatStage !== null) return;
      if (s.heatPauseStartedAt) return;
      if (s.streak <= 0 || !s.lastStreakTime) return;
      // Server tabs are long-running by design and should not pin the forge heat.
      const anyWorking = s.groups.some((g) => g.tabs.some((t) => t.type !== "server" && t.status === "working"));
      if (anyWorking) return;
      s.coolStreak();
    }, 1000);
    return () => clearInterval(id);
  }, []);
}
