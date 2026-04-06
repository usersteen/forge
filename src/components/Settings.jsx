import { useState } from "react";
import useForgeStore from "../store/useForgeStore";
import useEscapeKey from "../hooks/useEscapeKey";
import { getThemeOptions, getThemeStatusColors } from "../utils/themes";

function AppearanceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 3h-4a2 2 0 0 0-2 2v12a4 4 0 0 0 8 0V5a2 2 0 0 0-2-2z" />
      <path d="M13 7.35l-2-2a2 2 0 0 0-2.828 0L5.344 8.178a2 2 0 0 0 0 2.828l9 9" />
      <path d="M7.3 13H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h12" />
      <path d="M17 17h.01" />
    </svg>
  );
}

function SoundIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 3 9 3 15 6 15 11 19 11 5" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function HeatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 10.941C14.333 7.633 12.167 3.118 11 2c0 3.395-2.235 5.299-3.667 6.706C5.903 10.114 5 12 5 14.294 5 17.998 8.134 21 12 21s7-3.002 7-6.706c0-1.712-1.232-4.403-2.333-5.588-2.084 3.353-3.257 3.353-4.667 2.235z" />
    </svg>
  );
}

function PathsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9z" />
    </svg>
  );
}

const CATEGORIES = [
  { id: "appearance", label: "Appearance", icon: AppearanceIcon },
  { id: "sound", label: "Sound", icon: SoundIcon },
  { id: "heat", label: "Heat", icon: HeatIcon },
  { id: "paths", label: "Paths", icon: PathsIcon },
];

function AppearanceSection() {
  const theme = useForgeStore((s) => s.theme);
  const fxEnabled = useForgeStore((s) => s.fxEnabled);
  const setTheme = useForgeStore((s) => s.setTheme);
  const setFxEnabled = useForgeStore((s) => s.setFxEnabled);
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
          Sets the color palette for status dots, effects, and the heat ramp.
        </span>
      </div>
      <div className="settings-row-inline">
        <div>
          <label>Effects</label>
          <span className="settings-hint">Particle effects and glow animations.</span>
        </div>
        <button
          type="button"
          className={`settings-toggle${fxEnabled ? " settings-toggle-on" : ""}`}
          onClick={() => setFxEnabled(!fxEnabled)}
          aria-label={fxEnabled ? "Disable effects" : "Enable effects"}
        />
      </div>
    </>
  );
}

function SoundSection() {
  const soundVolume = useForgeStore((s) => s.soundVolume);
  const setSoundVolume = useForgeStore((s) => s.setSoundVolume);

  return (
    <>
      <div className="settings-row">
        <label>Volume</label>
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
    </>
  );
}

function HeatSection() {
  const storeStreakTimer = useForgeStore((s) => s.streakTimer);
  const storeCooldownTimer = useForgeStore((s) => s.cooldownTimer);
  const storeTabRecency = useForgeStore((s) => s.tabRecencyMinutes);
  const setStreakTimer = useForgeStore((s) => s.setStreakTimer);
  const setCooldownTimer = useForgeStore((s) => s.setCooldownTimer);
  const setTabRecencyMinutes = useForgeStore((s) => s.setTabRecencyMinutes);

  const [localStreak, setLocalStreak] = useState(storeStreakTimer);
  const [localCooldown, setLocalCooldown] = useState(storeCooldownTimer);
  const [localRecency, setLocalRecency] = useState(storeTabRecency);

  const isDirty =
    localStreak !== storeStreakTimer ||
    localCooldown !== storeCooldownTimer ||
    localRecency !== storeTabRecency;

  const save = () => {
    setStreakTimer(localStreak);
    setCooldownTimer(localCooldown);
    setTabRecencyMinutes(localRecency);
  };

  const streakMin = Math.floor(localStreak / 60000);
  const streakSec = Math.floor((localStreak % 60000) / 1000);
  const cooldownMin = Math.floor(localCooldown / 60000);
  const cooldownSec = Math.floor((localCooldown % 60000) / 1000);

  const updateStreak = (min, sec) => setLocalStreak((min * 60 + sec) * 1000);
  const updateCooldown = (min, sec) => setLocalCooldown((min * 60 + sec) * 1000);

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
            value={localRecency}
            onChange={(e) => setLocalRecency(Number(e.target.value))}
          />
          <span className="settings-time-label">min</span>
        </div>
        <span className="settings-hint">How long a waiting tab keeps its glow after your last interaction</span>
      </div>
      <button
        type="button"
        className="settings-path-save"
        onClick={save}
        disabled={!isDirty}
      >
        {isDirty ? "Save" : "Saved"}
      </button>
    </>
  );
}

function PathsSection() {
  const reposRootPath = useForgeStore((s) => s.reposRootPath);
  const setReposRootPath = useForgeStore((s) => s.setReposRootPath);
  const [localPath, setLocalPath] = useState(reposRootPath || "");
  const [editing, setEditing] = useState(!reposRootPath);
  const isDirty = localPath.trim() !== (reposRootPath || "");

  const commitPath = () => {
    const trimmed = localPath.trim();
    if (trimmed) {
      setReposRootPath(trimmed);
      setEditing(false);
    } else {
      setReposRootPath(null);
    }
  };

  return (
    <>
      <div className="settings-row">
        <label>Repos Folder</label>
        {editing ? (
          <>
            <div className="settings-path-row">
              <input
                className="new-project-path-input"
                type="text"
                placeholder="e.g. C:\Users\you\GitHub"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitPath(); }}
              />
              <button
                type="button"
                className="settings-path-save"
                onClick={commitPath}
                disabled={!isDirty}
              >
                {isDirty ? "Save" : "Saved"}
              </button>
            </div>
          </>
        ) : (
          <div className="welcome-repo-display">
            <span className="welcome-repo-path">{reposRootPath}</span>
            <button type="button" className="welcome-repo-change" onClick={() => setEditing(true)}>
              Change
            </button>
          </div>
        )}
        <span className="settings-hint">Parent folder containing your repos. Shown as quick picks when creating a new project.</span>
      </div>
    </>
  );
}

const SECTIONS = {
  appearance: AppearanceSection,
  sound: SoundSection,
  heat: HeatSection,
  paths: PathsSection,
};

export default function Settings({ onClose }) {
  useEscapeKey(onClose);
  const [activeCategory, setActiveCategory] = useState("appearance");
  const ActiveSection = SECTIONS[activeCategory];

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span>Settings</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>
        <div className="settings-body">
          <nav className="settings-nav">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`settings-nav-btn${activeCategory === cat.id ? " settings-nav-btn-active" : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span className="settings-nav-icon" aria-hidden="true">
                  <cat.icon />
                </span>
                <span>{cat.label}</span>
              </button>
            ))}
          </nav>
          <div className="settings-content">
            <ActiveSection />
          </div>
        </div>
      </div>
    </div>
  );
}
