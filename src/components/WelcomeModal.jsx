import { useState } from "react";
import useForgeStore from "../store/useForgeStore";
import useEscapeKey from "../hooks/useEscapeKey";

export default function WelcomeModal({ onClose, onStartTour }) {
  useEscapeKey(onClose);
  const showWelcomeOnLaunch = useForgeStore((state) => state.showWelcomeOnLaunch);
  const setShowWelcomeOnLaunch = useForgeStore((state) => state.setShowWelcomeOnLaunch);
  const reposRootPath = useForgeStore((state) => state.reposRootPath);
  const setReposRootPath = useForgeStore((state) => state.setReposRootPath);
  const [hideOnLaunch, setHideOnLaunch] = useState(!showWelcomeOnLaunch);
  const [localPath, setLocalPath] = useState(reposRootPath || "");

  const isDirty = localPath.trim() !== (reposRootPath || "");

  const commitPath = () => {
    const trimmed = localPath.trim();
    if (trimmed) setReposRootPath(trimmed);
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
      <div className="settings-panel welcome-modal" onClick={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <span>Welcome to Forge</span>
          <button type="button" className="settings-close" onClick={handleClose}>
            x
          </button>
        </div>

        <p className="welcome-tagline">
          Forge is a terminal manager designed to help you cook with Claude Code and Codex.
        </p>
        <p className="welcome-copy">
          The guided tour and Repos Folder setting are also available in Settings.
        </p>

        <div className="welcome-repos-row">
          <label className="welcome-repos-label">Repos Folder</label>
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
  );
}
