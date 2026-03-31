import useForgeStore from "../store/useForgeStore";
import { getThemeOptions, getThemeStatusColors, getThemeVariantKeys } from "../utils/themes";

const TIER_LABELS = ["Cold", "Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5"];

export default function DemoStrip() {
  const demoHeatStage = useForgeStore((s) => s.demoHeatStage);
  const theme = useForgeStore((s) => s.theme);
  const themeVariant = useForgeStore((s) => s.themeVariant);
  const setDemoHeatStage = useForgeStore((s) => s.setDemoHeatStage);
  const setTheme = useForgeStore((s) => s.setTheme);
  const setThemeVariant = useForgeStore((s) => s.setThemeVariant);
  const exitDemoMode = useForgeStore((s) => s.exitDemoMode);
  const themeOptions = getThemeOptions();

  const tourActive = useForgeStore((s) => s.tourActive);
  if (demoHeatStage === null || tourActive) return null;

  const variantKeys = getThemeVariantKeys(theme);
  const activeVariant = themeVariant || "v2";

  return (
    <div className="demo-strip">
      <span className="demo-strip-label">Demo Mode</span>
      <div className="demo-strip-buttons">
        {TIER_LABELS.map((label, i) => (
          <button
            type="button"
            key={i}
            className={`demo-strip-btn${demoHeatStage === i ? " demo-strip-btn-active" : ""}`}
            onClick={() => setDemoHeatStage(i)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="demo-strip-separator" />
      <span className="demo-strip-label">Theme</span>
      <div className="demo-strip-buttons">
        {themeOptions.map((option) => {
          const statusColors = getThemeStatusColors(option.value);
          return (
            <button
              type="button"
              key={option.value}
              className={`demo-strip-btn demo-strip-theme-btn${theme === option.value ? " demo-strip-btn-active" : ""}`}
              onClick={() => setTheme(option.value)}
            >
              <span className="demo-strip-theme-preview" aria-hidden="true">
                <span className="demo-strip-theme-dot" style={{ background: statusColors.waiting }} />
                <span className="demo-strip-theme-dot" style={{ background: statusColors.working }} />
              </span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
      {variantKeys && (
        <>
          <div className="demo-strip-separator" />
          <span className="demo-strip-label">Variant</span>
          <div className="demo-strip-buttons">
            {variantKeys.map((vk) => (
              <button
                type="button"
                key={vk}
                className={`demo-strip-btn${activeVariant === vk ? " demo-strip-btn-active" : ""}`}
                onClick={() => setThemeVariant(vk === "v2" ? null : vk)}
              >
                {vk}
              </button>
            ))}
          </div>
        </>
      )}
      <button className="demo-strip-exit" onClick={exitDemoMode}>Exit</button>
    </div>
  );
}
