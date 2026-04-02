import useForgeStore from "../store/useForgeStore";
import EmberLayer from "./EmberLayer";
import ParticleCanvas from "./ParticleCanvas";

// Unified wrapper that switches between V1 (CSS spans) and V2 (Canvas 2D)
// based on the particleVersion store state. Production defaults to V2.

export default function ParticleLayer({ location = "header", themeOverride, heatOverride }) {
  const particleVersion = useForgeStore((s) => s.particleVersion);

  if (particleVersion === "v1") {
    return <EmberLayer location={location} themeOverride={themeOverride} heatOverride={heatOverride} />;
  }

  return <ParticleCanvas location={location} themeOverride={themeOverride} heatOverride={heatOverride} />;
}
