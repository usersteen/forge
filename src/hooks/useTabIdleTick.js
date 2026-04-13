import { useEffect } from "react";
import useForgeStore from "../store/useForgeStore";

const TAB_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const TAB_IDLE_TICK_MS = 30 * 1000;

export default function useTabIdleTick() {
  useEffect(() => {
    const id = setInterval(() => {
      const state = useForgeStore.getState();
      if (state.demoHeatStage !== null || state.showcaseActive || state.tourActive) return;
      state.idleInactiveTabs(Date.now(), TAB_IDLE_TIMEOUT_MS);
    }, TAB_IDLE_TICK_MS);

    return () => clearInterval(id);
  }, []);
}
