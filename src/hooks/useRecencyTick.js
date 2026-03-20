import { useEffect, useState } from "react";

/**
 * Forces a re-render every 15s when `active` is true,
 * so recency-based visuals (hot/cold waiting dots) transition on time.
 * Returns the current timestamp (computed once per render).
 */
export default function useRecencyTick(active) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, [active]);

  return Date.now();
}
