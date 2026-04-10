import { useLayoutEffect, useRef, useState } from "react";

function getTransformOrigin(horizontal, vertical) {
  return `${horizontal === "left" ? "right" : "left"} ${vertical === "up" ? "bottom" : "top"}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function useFloatingSurfacePosition({
  x,
  y,
  deps = [],
  margin = 8,
  preferredHorizontal = "right",
  preferredVertical = "down",
}) {
  const surfaceRef = useRef(null);
  const [surfaceStyle, setSurfaceStyle] = useState({
    left: x,
    top: y,
    transformOrigin: getTransformOrigin(preferredHorizontal, preferredVertical),
  });
  const [placement, setPlacement] = useState(`${preferredVertical}-${preferredHorizontal}`);

  useLayoutEffect(() => {
    const node = surfaceRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    let nextLeft = x;
    let nextTop = y;
    let horizontal = preferredHorizontal;
    let vertical = preferredVertical;

    if (nextLeft + rect.width > window.innerWidth - margin) {
      nextLeft = Math.max(margin, window.innerWidth - rect.width - margin);
      if (nextLeft < x) horizontal = "left";
    }

    if (nextTop + rect.height > window.innerHeight - margin) {
      nextTop = Math.max(margin, window.innerHeight - rect.height - margin);
      if (nextTop < y) vertical = "up";
    }

    const anchorX = clamp(((x - nextLeft) / Math.max(rect.width, 1)) * 100, 0, 100);
    const anchorY = clamp(((y - nextTop) / Math.max(rect.height, 1)) * 100, 0, 100);

    setSurfaceStyle({
      left: nextLeft,
      top: nextTop,
      transformOrigin: `${anchorX}% ${anchorY}%`,
      "--surface-origin-x": `${anchorX}%`,
      "--surface-origin-y": `${anchorY}%`,
      "--surface-placement-origin": getTransformOrigin(horizontal, vertical),
    });
    setPlacement(`${vertical}-${horizontal}`);
  }, [margin, preferredHorizontal, preferredVertical, x, y, ...deps]);

  return { surfaceRef, surfaceStyle, placement };
}
