import { useState } from "react";
import useForgeStore from "../store/useForgeStore";
import useEscapeKey from "../hooks/useEscapeKey";
import { getThemeOptions, getThemeStatusColors } from "../utils/themes";

const TABS = [
  { id: "general", label: "General" },
  { id: "heat", label: "Heat" },
];

function GeneralTab() {
  const theme = useForgeStore((s) => s.theme);
  const fxEnabled = useForgeStore((s) => s.fxEnabled);
  const soundVolume = useForgeStore((s) => s.soundVolume);
  const setTheme = useForgeStore((s) => s.setTheme);
  const setFxEnabled = useForgeStore((s) => s.setFxEnabled);
  const setSoundVolume = useForgeStore((s) => s.setSoundVolume);
  const reposRootPath = useForgeStore((s) => s.reposRootPath);
  const setReposRootPath = useForgeStore((s) => s.setReposRootPath);
  const themeOptions = getThemeOptions();

  return (
    <>
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
          Sets the color palette for status dots and the heat ramp.
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
        <span className="settings-hint">Toggles particle effects and glow animations.</span>
      </div>
      <div className="settings-row">
        <label>Sound Volume</label>
        <div className="settings-time-row">
          <input
            type="range"
            className="settings-slider"
            min={0}
            max={100}
            value={soundVolume}
            onChange={(e) => setSoundVolume(Number(e.target.value))}
          />
          <span className="settings-time-label">{soundVolume === 0 ? "Muted" : `${soundVolume}%`}</span>
        </div>
        <span className="settings-hint">Plays a sound when a tab starts waiting. Quieter for the active tab when Forge is focused.</span>
      </div>
      <div className="settings-row">
        <label>Repos Folder</label>
        <input
          className="new-project-path-input"
          type="text"
          placeholder="e.g. C:\Users\you\GitHub"
          value={reposRootPath || ""}
          onChange={(e) => setReposRootPath(e.target.value)}
        />
        <span className="settings-hint">Parent folder containing your repos. Shown as quick picks when creating a new project.</span>
      </div>
    </>
  );
}

function HeatTab() {
  const streakTimer = useForgeStore((s) => s.streakTimer);
  const cooldownTimer = useForgeStore((s) => s.cooldownTimer);
  const setStreakTimer = useForgeStore((s) => s.setStreakTimer);
  const setCooldownTimer = useForgeStore((s) => s.setCooldownTimer);
  const tabRecencyMinutes = useForgeStore((s) => s.tabRecencyMinutes);
  const setTabRecencyMinutes = useForgeStore((s) => s.setTabRecencyMinutes);

  const streakMin = Math.floor(streakTimer / 60000);
  const streakSec = Math.floor((streakTimer % 60000) / 1000);
  const cooldownMin = Math.floor(cooldownTimer / 60000);
  const cooldownSec = Math.floor((cooldownTimer % 60000) / 1000);

  const updateStreak = (min, sec) => setStreakTimer((min * 60 + sec) * 1000);
  const updateCooldown = (min, sec) => setCooldownTimer((min * 60 + sec) * 1000);

  return (
    <>
      <p className="settings-description">
        Respond to waiting tabs quickly to build heat. Keep your streak going to stay hot. Stop responding and the forge cools down.
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
        <span className="settings-hint">Time window to respond and gain a heat level</span>
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
        <span className="settings-hint">Idle time before losing one heat level</span>
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
        <span className="settings-hint">How long a waiting tab keeps its glow after your last interaction</span>
      </div>
    </>
  );
}

export default function Settings({ onClose, onOpenThemeLab }) {
  useEscapeKey(onClose);
  const [activeTab, setActiveTab] = useState("general");
  const setDemoHeatStage = useForgeStore((s) => s.setDemoHeatStage);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span>Settings</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>
        <div className="settings-tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-tab${activeTab === tab.id ? " settings-tab-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === "general" && <GeneralTab />}
        {activeTab === "heat" && <HeatTab />}
        <div className="settings-divider" />
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
