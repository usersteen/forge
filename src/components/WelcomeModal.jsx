import { useMemo, useState } from "react";
import useForgeStore from "../store/useForgeStore";
import useEscapeKey from "../hooks/useEscapeKey";
import ForgeWordmark from "./ForgeWordmark";
import ParticleLayer from "./ParticleLayer";
import { getThemeHeatColor, getThemeTokens } from "../utils/themes";

const WELCOME_HEAT = 3;

export default function WelcomeModal({ onClose, onStartTour }) {
  useEscapeKey(onClose);
  const showWelcomeOnLaunch = useForgeStore((state) => state.showWelcomeOnLaunch);
  const setShowWelcomeOnLaunch = useForgeStore((state) => state.setShowWelcomeOnLaunch);
  const reposRootPath = useForgeStore((state) => state.reposRootPath);
  const setReposRootPath = useForgeStore((state) => state.setReposRootPath);
  const theme = useForgeStore((state) => state.theme);
  const [hideOnLaunch, setHideOnLaunch] = useState(!showWelcomeOnLaunch);
  const [localPath, setLocalPath] = useState(reposRootPath || "");
  const [editing, setEditing] = useState(!reposRootPath);

  const isDirty = localPath.trim() !== (reposRootPath || "");

  const { logoFill, headerVars, modalVars } = useMemo(() => {
    const tokens = getThemeTokens(theme, WELCOME_HEAT);
    return {
      logoFill: getThemeHeatColor(theme, WELCOME_HEAT),
      headerVars: {
        "--heat-current": tokens["--heat-current"],
        "--heat-current-rgb": tokens["--heat-current-rgb"],
        "--heat-3-rgb": tokens["--heat-3-rgb"],
        "--heat-4-rgb": tokens["--heat-4-rgb"],
        "--heat-5-rgb": tokens["--heat-5-rgb"],
        "--header-glow-opacity": tokens["--header-glow-opacity"],
        "--header-glow-shadow": tokens["--header-glow-shadow"],
        "--header-glow-border": tokens["--header-glow-border"],
        "--header-bloom": tokens["--header-bloom"],
        "--header-bloom-opacity": tokens["--header-bloom-opacity"],
        "--header-bloom-blur": tokens["--header-bloom-blur"],
        "--logo-glow-filter": tokens["--logo-glow-filter"],
      },
      modalVars: {
        "--welcome-border": tokens["--heat-current"],
      },
    };
  }, [theme]);

  const commitPath = () => {
    const trimmed = localPath.trim();
    if (trimmed) {
      setReposRootPath(trimmed);
      setEditing(false);
    }
  };

  const handleHideChange = (event) => {
    const nextHideOnLaunch = event.target.checked;
    setHideOnLaunch(nextHideOnLaunch);
    setShowWelcomeOnLaunch(!nextHideOnLaunch);
  };

  const handleClose = () => {
    if (localPath.trim()) {
      setReposRootPath(localPath.trim());
    }
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={handleClose}>
      <div className="welcome-modal" style={modalVars} onClick={(event) => event.stopPropagation()}>
        <div className="welcome-header" style={headerVars}>
          <ParticleLayer location="header" heatOverride={WELCOME_HEAT} />
          <div className="welcome-wordmark">
            <ForgeWordmark fill={logoFill} />
            <span className="welcome-version">v{__APP_VERSION__}</span>
          </div>
          <button type="button" className="settings-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="welcome-body">
          <p className="welcome-tagline">
            Multi-session terminal manager for AI coding agents.
          </p>

          <div className="welcome-repos-row">
            <label className="welcome-repos-label">Repos Folder</label>
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
                <span className="welcome-repos-hint">
                  Parent folder where your repos live. Makes it quick to pick a repo when starting a new project.
                </span>
              </>
            ) : (
              <div className="welcome-repo-display">
                <span className="welcome-repo-path">{reposRootPath}</span>
                <button type="button" className="welcome-repo-change" onClick={() => setEditing(true)}>
                  Change
                </button>
              </div>
            )}
          </div>

          <div className="welcome-actions">
            {onStartTour && (
              <button
                type="button"
                className="welcome-action"
                onClick={() => {
                  if (localPath.trim()) setReposRootPath(localPath.trim());
                  onClose();
                  onStartTour();
                }}
              >
                Take a Tour
              </button>
            )}
            <button type="button" className="welcome-action welcome-action-primary" onClick={handleClose}>
              Start Using Forge
            </button>
          </div>

          <label className="welcome-checkbox">
            <input type="checkbox" checked={hideOnLaunch} onChange={handleHideChange} />
            <span>Do not show this message again</span>
          </label>
        </div>
      </div>
    </div>
  );
}
