import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const IDENTITY_LAYOUT_TRANSFORM = "translate3d(0px, 0px, 0px) scale(1, 1)";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function usePresenceList(items, { exitDuration = 140, enterDelay = 32, resetKey } = {}) {
  const [renderedItems, setRenderedItems] = useState(() =>
    items.map((item) => ({ key: item.id, item, phase: "present" }))
  );
  const enterFrameRef = useRef(null);
  const enterTimerRef = useRef(null);
  const exitTimersRef = useRef(new Map());
  const initializedRef = useRef(false);
  const resetKeyRef = useRef(resetKey);

  const clearExitTimer = useCallback((key) => {
    const timer = exitTimersRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      exitTimersRef.current.delete(key);
    }
  }, []);

  const clearScheduled = useCallback(() => {
    if (enterFrameRef.current) {
      cancelAnimationFrame(enterFrameRef.current);
      enterFrameRef.current = null;
    }
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }
    exitTimersRef.current.forEach((timer) => clearTimeout(timer));
    exitTimersRef.current.clear();
  }, []);

  useEffect(() => () => clearScheduled(), [clearScheduled]);

  useEffect(() => {
    if (resetKeyRef.current === resetKey) return;
    resetKeyRef.current = resetKey;
    clearScheduled();
    initializedRef.current = true;
    setRenderedItems(items.map((item) => ({ key: item.id, item, phase: "present" })));
  }, [clearScheduled, items, resetKey]);

  useEffect(() => {
    setRenderedItems((current) => {
      if (!initializedRef.current && current.length === 0) {
        initializedRef.current = true;
        return items.map((item) => ({ key: item.id, item, phase: "present" }));
      }

      const currentByKey = new Map(current.map((entry) => [entry.key, entry]));
      const nextKeys = items.map((item) => item.id);
      const nextKeySet = new Set(nextKeys);
      const currentVisibleKeys = current.filter((entry) => entry.phase !== "exiting").map((entry) => entry.key);
      const sameMembers =
        currentVisibleKeys.length === nextKeys.length &&
        currentVisibleKeys.every((key) => nextKeySet.has(key)) &&
        nextKeys.every((key) => currentByKey.has(key));

      if (sameMembers && current.every((entry) => entry.phase !== "exiting")) {
        initializedRef.current = true;
        return items.map((item) => {
          const existing = currentByKey.get(item.id);
          return existing ? { ...existing, item } : { key: item.id, item, phase: "present" };
        });
      }

      const nextEntries = items.map((item) => {
        clearExitTimer(item.id);
        const existing = currentByKey.get(item.id);
        if (!existing) {
          return {
            key: item.id,
            item,
            phase: initializedRef.current ? "entering" : "present",
          };
        }
        return {
          ...existing,
          item,
          phase: existing.phase === "exiting" ? "present" : existing.phase,
        };
      });

      current.forEach((entry, index) => {
        if (nextKeySet.has(entry.key)) return;

        if (!exitTimersRef.current.has(entry.key)) {
          const timer = setTimeout(() => {
            exitTimersRef.current.delete(entry.key);
            setRenderedItems((visible) => visible.filter((candidate) => candidate.key !== entry.key));
          }, exitDuration);
          exitTimersRef.current.set(entry.key, timer);
        }

        nextEntries.splice(Math.min(index, nextEntries.length), 0, {
          ...entry,
          phase: "exiting",
        });
      });

      initializedRef.current = true;
      return nextEntries;
    });
  }, [clearExitTimer, exitDuration, items]);

  useEffect(() => {
    const hasEntering = renderedItems.some((entry) => entry.phase === "entering");
    if (!hasEntering) return;

    enterFrameRef.current = requestAnimationFrame(() => {
      enterTimerRef.current = setTimeout(() => {
        setRenderedItems((current) =>
          current.map((entry) =>
            entry.phase === "entering" ? { ...entry, phase: "present" } : entry
          )
        );
      }, enterDelay);
    });

    return () => {
      if (enterFrameRef.current) {
        cancelAnimationFrame(enterFrameRef.current);
        enterFrameRef.current = null;
      }
      if (enterTimerRef.current) {
        clearTimeout(enterTimerRef.current);
        enterTimerRef.current = null;
      }
    };
  }, [enterDelay, renderedItems]);

  return renderedItems;
}

export function useListFlipMotion(items, { transformVar, includeScale = false } = {}) {
  const nodesRef = useRef(new Map());
  const previousRectsRef = useRef(new Map());
  const frameIdsRef = useRef([]);

  const registerNode = useCallback((key, node) => {
    if (node) {
      nodesRef.current.set(key, node);
      return;
    }
    nodesRef.current.delete(key);
  }, []);

  useEffect(
    () => () => {
      frameIdsRef.current.forEach((frameId) => cancelAnimationFrame(frameId));
      frameIdsRef.current = [];
    },
    []
  );

  useLayoutEffect(() => {
    frameIdsRef.current.forEach((frameId) => cancelAnimationFrame(frameId));
    frameIdsRef.current = [];

    const nextRects = new Map();
    const reducedMotion = prefersReducedMotion();

    items.forEach((entry) => {
      const node = nodesRef.current.get(entry.key);
      if (!node) return;

      const rect = node.getBoundingClientRect();
      nextRects.set(entry.key, rect);

      if (reducedMotion) {
        node.style.setProperty(transformVar, IDENTITY_LAYOUT_TRANSFORM);
        return;
      }

      const previousRect = previousRectsRef.current.get(entry.key);
      if (!previousRect || entry.phase !== "present") {
        return;
      }

      const deltaX = previousRect.left - rect.left;
      const deltaY = previousRect.top - rect.top;
      const scaleX = includeScale && rect.width > 0 ? previousRect.width / rect.width : 1;
      const scaleY = includeScale && rect.height > 0 ? previousRect.height / rect.height : 1;
      const moved =
        Math.abs(deltaX) > 0.5 ||
        Math.abs(deltaY) > 0.5 ||
        Math.abs(scaleX - 1) > 0.01 ||
        Math.abs(scaleY - 1) > 0.01;

      if (!moved) {
        node.style.setProperty(transformVar, IDENTITY_LAYOUT_TRANSFORM);
        return;
      }

      node.style.setProperty(
        transformVar,
        `translate3d(${deltaX}px, ${deltaY}px, 0px) scale(${scaleX}, ${scaleY})`
      );
      node.getBoundingClientRect();

      const frameId = requestAnimationFrame(() => {
        const activeNode = nodesRef.current.get(entry.key);
        if (!activeNode) return;
        activeNode.style.setProperty(transformVar, IDENTITY_LAYOUT_TRANSFORM);
      });

      frameIdsRef.current.push(frameId);
    });

    previousRectsRef.current = nextRects;
  }, [includeScale, items, transformVar]);

  return registerNode;
}

export function useAutoHeightTransition(changeKey, { duration = 180, easing = "var(--motion-deploy)" } = {}) {
  const elementRef = useRef(null);
  const previousHeightRef = useRef(null);
  const cleanupTimerRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(
    () => () => {
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    },
    []
  );

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const nextHeight = element.scrollHeight;
    const previousHeight = previousHeightRef.current;
    previousHeightRef.current = nextHeight;
    if (prefersReducedMotion()) {
      element.style.height = "";
      element.style.overflow = "";
      element.style.transition = "";
      return;
    }

    if (previousHeight === null || Math.abs(previousHeight - nextHeight) < 1) {
      return;
    }

    element.style.height = `${previousHeight}px`;
    element.style.overflow = "hidden";
    element.style.transition = `height ${duration}ms ${easing}`;
    element.getBoundingClientRect();

    frameRef.current = requestAnimationFrame(() => {
      element.style.height = `${nextHeight}px`;
    });

    cleanupTimerRef.current = setTimeout(() => {
      if (!elementRef.current) return;
      elementRef.current.style.height = "";
      elementRef.current.style.overflow = "";
      elementRef.current.style.transition = "";
    }, duration + 40);
  }, [changeKey, duration, easing]);

  return elementRef;
}
