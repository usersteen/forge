import { useRef, useEffect } from "react";
import useForgeStore from "../store/useForgeStore";
import useEffectiveHeatStage from "../hooks/useEffectiveHeatStage";
import { Emitter, IceEmitter } from "../utils/particleEngine";
import { getParticleConfig, HEAT_MULTIPLIERS } from "../utils/particleThemes";
import EmberLayer from "./EmberLayer";

function createEmitter(config, poolSize) {
  if (config.theme === "ice") return new IceEmitter(config, poolSize);
  return new Emitter(config, poolSize);
}

export default function ParticleCanvas({ location = "header", themeOverride, heatOverride }) {
  const canvasRef = useRef(null);
  const emitterRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const heatRef = useRef(0);
  const locationRef = useRef(location);

  const storeTheme = useForgeStore((s) => s.theme);
  const particleVersion = useForgeStore((s) => s.particleVersion);
  const fxEnabled = useForgeStore((s) => s.fxEnabled);
  const storeHeat = useEffectiveHeatStage();

  const theme = themeOverride || storeTheme;
  const effectiveHeatStage = heatOverride != null ? heatOverride : storeHeat;
  heatRef.current = effectiveHeatStage;
  locationRef.current = location;

  const active = fxEnabled && effectiveHeatStage >= 3;

  // Rebuild emitter on theme change
  useEffect(() => {
    if (!active) return;
    const config = getParticleConfig(theme, location);
    emitterRef.current = createEmitter(config, 200);
  }, [theme, location, active]);

  // Track parent size via ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!parent) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        sizeRef.current = { w: Math.round(width), h: Math.round(height) };
      }
    });
    observer.observe(parent);
    // Initialize immediately
    const rect = parent.getBoundingClientRect();
    sizeRef.current = { w: Math.round(rect.width), h: Math.round(rect.height) };

    return () => observer.disconnect();
  }, [active]);

  // RAF loop
  useEffect(() => {
    if (!active) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    lastTimeRef.current = performance.now();

    function animate(timestamp) {
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const emitter = emitterRef.current;
      if (!emitter) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const { w, h } = sizeRef.current;
      if (w > 0 && h > 0) {
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        ctx.clearRect(0, 0, w, h);

        const heat = heatRef.current;
        const baseMult = HEAT_MULTIPLIERS[heat] || HEAT_MULTIPLIERS[4];
        // Child effects (sparks, ghosts, spores, twinkles):
        // Heat 3: none anywhere
        // Heat 4: header only
        // Heat 5: everywhere
        const isHeader = locationRef.current === "header";
        const childScale = heat >= 5 ? 1.0 : (heat >= 4 && isHeader) ? 1.0 : 0;
        const mult = { ...baseMult, childScale };
        emitter.update(dt, w, h, mult);
        emitter.render(ctx, w, h);
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active]);

  if (!active) return null;
  if (particleVersion === "v1") {
    return <EmberLayer location={location} themeOverride={themeOverride} heatOverride={heatOverride} />;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
