import { useState } from "react";
import useForgeStore from "../store/useForgeStore";

const HEAT_LABELS = ["Cold", "Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5"];

export default function Settings({ onClose }) {
  const streakTimer = useForgeStore((s) => s.streakTimer);
  const cooldownTimer = useForgeStore((s) => s.cooldownTimer);
  const setStreakTimer = useForgeStore((s) => s.setStreakTimer);
  const setCooldownTimer = useForgeStore((s) => s.setCooldownTimer);
  const streak = useForgeStore((s) => s.streak);
  const [showDebug, setShowDebug] = useState(false);

  const setStreak = (val) => {
    useForgeStore.setState({ streak: val, lastStreakTime: Date.now() });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span>Settings</span>
          <button className="settings-close" onClick={onClose}>x</button>
        </div>
        <div className="settings-row">
          <label>Streak Timer</label>
          <div className="settings-slider-row">
            <input
              type="range"
              min={5000}
              max={30000}
              step={1000}
              value={streakTimer}
              onChange={(e) => setStreakTimer(Number(e.target.value))}
            />
            <span className="settings-value">{streakTimer / 1000}s</span>
          </div>
          <span className="settings-hint">How fast you must respond to keep the streak</span>
        </div>
        <div className="settings-row">
          <label>Cooldown Timer</label>
          <div className="settings-slider-row">
            <input
              type="range"
              min={10000}
              max={120000}
              step={5000}
              value={cooldownTimer}
              onChange={(e) => setCooldownTimer(Number(e.target.value))}
            />
            <span className="settings-value">{cooldownTimer / 1000}s</span>
          </div>
          <span className="settings-hint">Interval between each heat stage drop during cooldown</span>
        </div>
        <div className="settings-divider" />
        <button className="settings-debug-toggle" onClick={() => setShowDebug((v) => !v)}>
          {showDebug ? "Hide" : "Show"} Heat Debug
        </button>
        {showDebug && (
          <div className="heat-debug-inline">
            <div className="heat-debug-streak">
              Streak: <strong>{streak}</strong>
            </div>
            <input
              type="range"
              min={0}
              max={12}
              value={streak}
              onChange={(e) => setStreak(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <div className="heat-debug-buttons">
              {[0, 1, 3, 5, 8, 10].map((val, i) => (
                <button key={val} onClick={() => setStreak(val)}>
                  {HEAT_LABELS[i]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
