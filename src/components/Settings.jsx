import useForgeStore from "../store/useForgeStore";
import useEscapeKey from "../hooks/useEscapeKey";

export default function Settings({ onClose }) {
  useEscapeKey(onClose);
  const streakTimer = useForgeStore((s) => s.streakTimer);
  const cooldownTimer = useForgeStore((s) => s.cooldownTimer);
  const setStreakTimer = useForgeStore((s) => s.setStreakTimer);
  const setCooldownTimer = useForgeStore((s) => s.setCooldownTimer);
  const setDemoHeatStage = useForgeStore((s) => s.setDemoHeatStage);

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
          Respond to Claude fast to heat up the forge. Keep responding to hold your heat. Stop responding and the forge cools down.
        </p>
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
        <div className="settings-divider" />
        <button
          className="settings-demo-btn"
          onClick={() => { setDemoHeatStage(0); onClose(); }}
        >
          Demo Mode
        </button>
      </div>
    </div>
  );
}
