import useForgeStore from "../store/useForgeStore";

const TIER_LABELS = ["Cold", "Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5"];

export default function DemoStrip() {
  const demoHeatStage = useForgeStore((s) => s.demoHeatStage);
  const setDemoHeatStage = useForgeStore((s) => s.setDemoHeatStage);
  const exitDemoMode = useForgeStore((s) => s.exitDemoMode);

  if (demoHeatStage === null) return null;

  return (
    <div className="demo-strip">
      <span className="demo-strip-label">Demo Mode</span>
      <div className="demo-strip-buttons">
        {TIER_LABELS.map((label, i) => (
          <button
            key={i}
            className={`demo-strip-btn${demoHeatStage === i ? " demo-strip-btn-active" : ""}`}
            onClick={() => setDemoHeatStage(i)}
          >
            {label}
          </button>
        ))}
      </div>
      <button className="demo-strip-exit" onClick={exitDemoMode}>Exit</button>
    </div>
  );
}
