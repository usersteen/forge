import { useCallback, useEffect, useRef, useState } from "react";

export default function useAnimatedSurface(exitDuration = 140) {
  const [surface, setSurface] = useState(null);
  const frameRef = useRef(null);
  const exitTimerRef = useRef(null);
  const motionKeyRef = useRef(0);

  const clearScheduled = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearScheduled(), [clearScheduled]);

  const showSurface = useCallback(
    (payload = {}) => {
      clearScheduled();
      const motionKey = motionKeyRef.current + 1;
      motionKeyRef.current = motionKey;
      setSurface({ ...payload, motionKey, motionState: "entering" });
      frameRef.current = requestAnimationFrame(() => {
        setSurface((current) =>
          current?.motionKey === motionKey ? { ...current, motionState: "open" } : current
        );
      });
    },
    [clearScheduled]
  );

  const hideSurface = useCallback(
    ({ immediate = false } = {}) => {
      clearScheduled();
      if (immediate) {
        setSurface(null);
        return;
      }

      setSurface((current) => {
        if (!current || current.motionState === "closing") return current;
        const closingSurface = { ...current, motionState: "closing" };
        exitTimerRef.current = setTimeout(() => {
          setSurface((active) =>
            active?.motionKey === closingSurface.motionKey ? null : active
          );
        }, exitDuration);
        return closingSurface;
      });
    },
    [clearScheduled, exitDuration]
  );

  return {
    surface,
    isOpen: Boolean(surface) && surface.motionState !== "closing",
    showSurface,
    hideSurface,
    clearSurface: useCallback(() => hideSurface({ immediate: true }), [hideSurface]),
  };
}
