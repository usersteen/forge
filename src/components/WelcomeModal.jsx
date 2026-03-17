import { useState } from "react";
import useForgeStore from "../store/useForgeStore";
import useEscapeKey from "../hooks/useEscapeKey";

export default function WelcomeModal({ onClose }) {
  useEscapeKey(onClose);
  const showWelcomeOnLaunch = useForgeStore((state) => state.showWelcomeOnLaunch);
  const setShowWelcomeOnLaunch = useForgeStore((state) => state.setShowWelcomeOnLaunch);
  const [hideOnLaunch, setHideOnLaunch] = useState(!showWelcomeOnLaunch);

  const handleHideChange = (event) => {
    const nextHideOnLaunch = event.target.checked;
    setHideOnLaunch(nextHideOnLaunch);
    setShowWelcomeOnLaunch(!nextHideOnLaunch);
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel welcome-modal" onClick={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <span>Welcome to Forge</span>
          <button type="button" className="settings-close" onClick={onClose}>
            x
          </button>
        </div>

        <p className="welcome-tagline">
          Forge is a terminal manager designed to help you cook with Claude Code and Codex.
        </p>
        <p className="welcome-copy">
          Check out <strong>Info</strong> and <strong>Settings</strong> in the bottom-left of the interface.
        </p>

        <div className="welcome-actions">
          <button type="button" className="welcome-action welcome-action-primary" onClick={onClose}>
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
