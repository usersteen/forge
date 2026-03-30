import { useCallback, useEffect, useRef } from "react";
import useForgeStore from "../store/useForgeStore";

const THEME_CYCLE = ["forge", "ice", "void", "grass"];

export default function useTourDemoContent(tourActive, tourStep, stepDefs) {
  const setTabStatus = useForgeStore((s) => s.setTabStatus);
  const setDemoHeatStage = useForgeStore((s) => s.setDemoHeatStage);
  const exitDemoMode = useForgeStore((s) => s.exitDemoMode);
  const setTheme = useForgeStore((s) => s.setTheme);

  const timersRef = useRef([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) clearInterval(id);
    timersRef.current = [];
  }, []);

  // Clean up all timers when tour ends
  useEffect(() => {
    if (!tourActive) return;
    return () => {
      clearTimers();
      exitDemoMode();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActive]);

  // Run per-step demos
  useEffect(() => {
    if (!tourActive) return;
    clearTimers();

    const step = stepDefs[tourStep];
    if (!step?.demo) return;

    // Get the "Working" tab (third tab in demo group) for status cycling
    const state = useForgeStore.getState();
    const demoGroup = state.groups[0];
    const workingTab = demoGroup?.tabs[2]; // "Working" tab

    if (step.demo === "status-cycle" && workingTab) {
      // Cycle the "Working" tab between working and waiting
      let isWorking = true;
      const id = setInterval(() => {
        isWorking = !isWorking;
        setTabStatus(workingTab.id, isWorking ? "working" : "waiting");
      }, 1500);
      timersRef.current.push(id);
    }

    if (step.demo === "heat-ramp") {
      let stage = 0;
      setDemoHeatStage(stage);
      const id = setInterval(() => {
        stage += 1;
        if (stage > 5) stage = 0;
        setDemoHeatStage(stage);
      }, 2500);
      timersRef.current.push(id);
    }

    if (step.demo === "theme-cycle-hot") {
      // Set heat to max for full visual impact
      setDemoHeatStage(5);
      let idx = 0;
      const id = setInterval(() => {
        idx = (idx + 1) % THEME_CYCLE.length;
        setTheme(THEME_CYCLE[idx]);
      }, 2000);
      timersRef.current.push(id);
    }

    return () => {
      clearTimers();
      if (step.demo === "heat-ramp" || step.demo === "theme-cycle-hot") {
        exitDemoMode();
      }
      if (step.demo === "theme-cycle-hot") {
        // Restore original theme
        const originalTheme = useForgeStore.getState().tourOriginalTheme;
        if (originalTheme) setTheme(originalTheme);
      }
      if (step.demo === "status-cycle" && workingTab) {
        setTabStatus(workingTab.id, "working");
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActive, tourStep]);
}
