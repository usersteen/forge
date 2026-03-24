import useForgeStore from "../store/useForgeStore";
import useEscapeKey from "../hooks/useEscapeKey";
import { getThemeOptions, getThemeStatusColors } from "../utils/themes";

export default function Settings({ onClose, onOpenThemeLab }) {
  useEscapeKey(onClose);
  const streakTimer = useForgeStore((s) => s.streakTimer);
  const cooldownTimer = useForgeStore((s) => s.cooldownTimer);
  const theme = useForgeStore((s) => s.theme);
  const fxEnabled = useForgeStore((s) => s.fxEnabled);
  const setStreakTimer = useForgeStore((s) => s.setStreakTimer);
  const setCooldownTimer = useForgeStore((s) => s.setCooldownTimer);
  const setTheme = useForgeStore((s) => s.setTheme);
  const setFxEnabled = useForgeStore((s) => s.setFxEnabled);
  const tabRecencyMinutes = useForgeStore((s) => s.tabRecencyMinutes);
  const setTabRecencyMinutes = useForgeStore((s) => s.setTabRecencyMinutes);
  const setDemoHeatStage = useForgeStore((s) => s.setDemoHeatStage);
  const themeOptions = getThemeOptions();

  const streakMin = Math.floor(streakTimer / 60000);
  const streakSec = Math.floor((streakTimer % 60000) / 1000);
  const cooldownMin = Math.floor(cooldownTimer / 60000);
  const cooldownSec = Math.floor((cooldownTimer % 60000) / 1000);

  const updateStreak = (min, sec) => setStreakTimer((min * 60 + sec) * 1000);
  const updateCooldown = (min, sec) => setCooldownTimer((min * 60 + sec) * 1000);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span>Settings</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>
        <p className="settings-description">
          Respond to a waiting AI tab fast to heat up the forge. Keep responding to hold your heat. Stop responding and the forge cools down.
        </p>
        <div className="settings-row">
          <label>Theme</label>
          <div className="settings-chip-group">
            {themeOptions.map((option) => {
              const statusColors = getThemeStatusColors(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`settings-chip${theme === option.value ? " settings-chip-active" : ""}`}
                  onClick={() => setTheme(option.value)}
                >
                  <span className="settings-theme-chip-preview" aria-hidden="true">
                    <span
                      className="settings-theme-chip-dot settings-theme-chip-dot-waiting"
                      style={{ background: statusColors.waiting }}
                    />
                    <span
                      className="settings-theme-chip-dot settings-theme-chip-dot-working"
                      style={{ background: statusColors.working }}
                    />
                  </span>
                  <span className="settings-theme-chip-label">{option.label}</span>
                </button>
              );
            })}
          </div>
          <span className="settings-hint">
            Theme changes the shell heat ramp and working/waiting status-dot colors without affecting the terminal palette.
          </span>
        </div>
        <div className="settings-row">
          <label>Effects</label>
          <div className="settings-chip-group">
            <button
              type="button"
              className={`settings-chip${fxEnabled ? " settings-chip-active" : ""}`}
              onClick={() => setFxEnabled(true)}
            >
              FX On
            </button>
            <button
              type="button"
              className={`settings-chip${!fxEnabled ? " settings-chip-active" : ""}`}
              onClick={() => setFxEnabled(false)}
            >
              FX Off
            </button>
          </div>
          <span className="settings-hint">FX controls particles and glow without changing colors or heat behavior.</span>
        </div>
        <div className="settings-divider" />
        <div className="settings-row">
          <label>Streak Timer</label>
          <div className="settings-time-row">
            <input
              type="number"
              className="settings-time-input"
              min={0}
              max={9}
              value={streakMin}
              onChange={(e) => updateStreak(Math.max(0, Number(e.target.value)), streakSec)}
            />
            <span className="settings-time-label">min</span>
            <input
              type="number"
              className="settings-time-input"
              min={0}
              max={59}
              value={streakSec}
              onChange={(e) => updateStreak(streakMin, Math.min(59, Math.max(0, Number(e.target.value))))}
            />
            <span className="settings-time-label">sec</span>
          </div>
          <span className="settings-hint">Respond within this time to gain heat</span>
        </div>
        <div className="settings-row">
          <label>Cooldown Timer</label>
          <div className="settings-time-row">
            <input
              type="number"
              className="settings-time-input"
              min={0}
              max={9}
              value={cooldownMin}
              onChange={(e) => updateCooldown(Math.max(0, Number(e.target.value)), cooldownSec)}
            />
            <span className="settings-time-label">min</span>
            <input
              type="number"
              className="settings-time-input"
              min={0}
              max={59}
              value={cooldownSec}
              onChange={(e) => updateCooldown(cooldownMin, Math.min(59, Math.max(0, Number(e.target.value))))}
            />
            <span className="settings-time-label">sec</span>
          </div>
          <span className="settings-hint">After this long idle, lose one heat level</span>
        </div>
        <div className="settings-row">
          <label>Tab Recency</label>
          <div className="settings-time-row">
            <input
              type="number"
              className="settings-time-input"
              min={1}
              max={60}
              value={tabRecencyMinutes}
              onChange={(e) => setTabRecencyMinutes(Number(e.target.value))}
            />
            <span className="settings-time-label">min</span>
          </div>
          <span className="settings-hint">Waiting tabs glow for this long after last engagement</span>
        </div>
        <button
          className="settings-demo-btn"
          onClick={() => { setDemoHeatStage(0); onClose(); }}
        >
          Demo Mode
        </button>
        {onOpenThemeLab && (
          <button
            className="settings-demo-btn"
            onClick={onOpenThemeLab}
          >
            Theme Lab
          </button>
        )}
      </div>
    </div>
  );
}
