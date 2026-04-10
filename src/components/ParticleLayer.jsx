import { lazy, Suspense } from "react";
import useForgeStore from "../store/useForgeStore";
import ParticleCanvas from "./ParticleCanvas";

const EmberLayer = lazy(() => import("./EmberLayer"));

// Unified wrapper that switches between V1 (CSS spans) and V2 (Canvas 2D)
// based on the particleVersion store state. Production defaults to V2.

export default function ParticleLayer({
  location = "header",
  themeOverride,
  heatOverride,
  densityMultiplier = 1,
  sizeMultiplier = 1,
}) {
  const particleVersion = useForgeStore((s) => s.particleVersion);

  if (particleVersion === "v1") {
    return (
      <Suspense fallback={null}>
        <EmberLayer location={location} themeOverride={themeOverride} heatOverride={heatOverride} />
      </Suspense>
    );
  }

  return (
    <ParticleCanvas
      location={location}
      themeOverride={themeOverride}
      heatOverride={heatOverride}
      densityMultiplier={densityMultiplier}
      sizeMultiplier={sizeMultiplier}
    />
  );
}
