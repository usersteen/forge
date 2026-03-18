import useForgeStore from "../store/useForgeStore";
import useEscapeKey from "../hooks/useEscapeKey";
import { HEAT_LABELS } from "../utils/heat";
import { getThemeHeatColors } from "../utils/themes";

export default function InfoPanel({ onClose }) {
  useEscapeKey(onClose);
  const theme = useForgeStore((s) => s.theme);
  const heatColors = getThemeHeatColors(theme);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="info-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span>About Forge</span>
          <button className="settings-close" onClick={onClose}>x</button>
        </div>
        <div className="info-content">
          <p className="info-intro">
            A terminal organizer for managing multiple sessions, grouped by project.
            Forge detects Claude Code and Codex status automatically with no special setup.
          </p>

          <h2>Getting Started</h2>
          <ul>
            <li>Each <strong>project group</strong> in the left sidebar holds its own set of terminal tabs</li>
            <li>Each <strong>tab</strong> in the top bar is a full terminal session</li>
            <li>Create a <strong>project group</strong> in the sidebar, then open terminal tabs inside it</li>
          </ul>

          <h2>Projects and Tabs</h2>
          <ul>
            <li><strong>Rename</strong> by double-clicking, or right-clicking and choosing Rename</li>
            <li><strong>Reorder</strong> by dragging groups or tabs into place</li>
            <li><strong>Delete</strong> with the x button on a group or tab</li>
          </ul>

          <h2>Server Tabs</h2>
          <ul>
            <li><strong>Right-click</strong> any tab and choose "Set as Server Terminal" to tag it as a server process</li>
            <li>Server tabs show a blue dot instead of status colors</li>
            <li>Great for dev servers, watchers, or anything that runs continuously</li>
            <li>Right-click again to switch it back to a Claude Code or Codex terminal</li>
          </ul>

          <h2>Status Indicators</h2>
          <p>Each tab has a colored dot showing the session state:</p>
          <ul>
            <li><span className="info-dot"></span> <strong>Gray</strong> = idle (nothing running)</li>
            <li><span className="info-dot working"></span> <strong>Working</strong> = the agent is actively running</li>
            <li><span className="info-dot waiting"></span> <strong>Waiting</strong> = the agent needs your input</li>
            <li><span className="info-dot server-running"></span> <strong>Blue</strong> = server (marked as a long-running process)</li>
          </ul>
          <p>
            The sidebar shows mini dots for all tabs in each group at a glance.
            You will get a notification and sound when a background tab starts waiting.
          </p>
          <p>
            Working and waiting colors shift with the active theme. The theme chips in Settings preview those status
            colors so you can see the difference before switching.
          </p>
          <p>
            AI tabs also show a small badge in the tab bar so you can tell Claude Code and Codex apart at a glance.
          </p>

          <h2>The Forge Heat System</h2>
          <ul>
            <li>Respond to waiting AI tabs quickly and the forge heats up through stages 1-5</li>
            <li>Keep a streak going to reach higher stages as the logo glows and the UI comes alive</li>
            <li>Stop responding and the forge cools back down</li>
            <li>The active theme changes the heat ramp swatches shown below</li>
            <li>Tune streak and cooldown timers in Settings</li>
            <li>Try <strong>Demo Mode</strong> in Settings to preview all heat stages</li>
          </ul>
          <div className="info-heat-preview">
            {heatColors.map((color, i) => (
              <div className="info-heat-stage" key={i}>
                <div
                  className="info-heat-swatch"
                  style={{
                    background: color,
                    boxShadow: i >= 3 ? `0 0 6px ${color}` : "none",
                  }}
                />
                <span className="info-heat-label">{HEAT_LABELS[i]}</span>
              </div>
              ))}
          </div>

          <h2>Keyboard Shortcuts</h2>
          <div className="info-shortcuts">
            <div className="info-shortcut-row"><kbd>Ctrl+Tab</kbd><span>Next tab</span></div>
            <div className="info-shortcut-row"><kbd>Ctrl+Shift+Tab</kbd><span>Previous tab</span></div>
            <div className="info-shortcut-row"><kbd>Ctrl+PageDown</kbd><span>Next group</span></div>
            <div className="info-shortcut-row"><kbd>Ctrl+PageUp</kbd><span>Previous group</span></div>
            <div className="info-shortcut-row"><kbd>Ctrl+1-9</kbd><span>Jump to tab 1-9</span></div>
            <div className="info-shortcut-row"><kbd>Ctrl+V</kbd><span>Paste into terminal</span></div>
            <div className="info-shortcut-row"><kbd>Ctrl+Enter</kbd><span>Newline without executing</span></div>
          </div>

          <h2>Tips</h2>
          <ul>
            <li>Your layout, tab names, and window position are saved automatically</li>
            <li>Each tab starts in its last working directory, even after restarting Forge</li>
            <li>Config is stored at <code>~/.forge/config.json</code></li>
          </ul>

          <div className="info-version">Forge v{__APP_VERSION__}</div>
        </div>
      </div>
    </div>
  );
}
