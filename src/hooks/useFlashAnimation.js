import { useCallback, useEffect, useRef } from "react";

/**
 * Triggers a CSS "flash-waiting" arrival cue when flashKey increments.
 * Returns { elementRef, handleAnimationEnd } to attach to the target element.
 */
export default function useFlashAnimation(flashKey) {
  const elementRef = useRef(null);
  const prevKey = useRef(flashKey ?? 0);

  useEffect(() => {
    const currentKey = flashKey ?? 0;
    if (currentKey > prevKey.current && elementRef.current) {
      const el = elementRef.current;
      el.classList.remove("flash-waiting");
      void el.offsetWidth;
      el.classList.add("flash-waiting");
    }
    prevKey.current = currentKey;
  }, [flashKey]);

  const handleAnimationEnd = useCallback((e) => {
    if (e.target !== e.currentTarget) return;
    if (e.animationName.startsWith("waiting-flash-")) {
      e.currentTarget.classList.remove("flash-waiting");
    }
  }, []);

  return { elementRef, handleAnimationEnd };
}
