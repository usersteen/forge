import { HEAT_COLORS, HEAT_LABELS } from "../utils/heat";
import useEscapeKey from "../hooks/useEscapeKey";

export default function InfoPanel({ onClose }) {
  useEscapeKey(onClose);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="info-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span>About Forge</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>
        <div className="info-content">
          <p className="info-intro">
            A terminal organizer for managing multiple sessions, grouped by project.
            Forge detects Claude Code's status automatically — no special setup needed.
          </p>

          <h2>Getting Started</h2>
          <ul>
            <li>Each <strong>project group</strong> (left sidebar) holds its own set of terminal tabs</li>
            <li>Each <strong>tab</strong> (top bar) is a full terminal session</li>
            <li>Create a <strong>project group</strong> in the sidebar, then open terminal tabs inside it</li>
          </ul>

          <h2>Projects & Tabs</h2>
          <ul>
            <li><strong>Rename</strong> — double-click any group or tab name to edit it</li>
            <li><strong>Reorder</strong> — drag groups or tabs to rearrange them</li>
            <li><strong>Delete</strong> — click the × on a group or tab to remove it</li>
          </ul>

          <h2>Server Tabs</h2>
          <ul>
            <li><strong>Right-click</strong> any tab → "Mark as Server" to tag it as a server process</li>
            <li>Server tabs show a blue dot instead of status colors</li>
            <li>Great for dev servers, watchers, or anything that runs continuously</li>
            <li>Right-click again to switch it back to a normal Claude tab</li>
          </ul>

          <h2>Status Indicators</h2>
          <p>Each tab has a colored dot showing the session's state:</p>
          <ul>
            <li><span className="info-dot"></span> <strong>Gray</strong> = idle (nothing running)</li>
            <li><span className="info-dot working"></span> <strong>Red</strong> (pulsing) = working (Claude is thinking)</li>
            <li><span className="info-dot waiting"></span> <strong>Orange</strong> (glowing) = waiting (Claude needs your input)</li>
            <li><span className="info-dot server-running"></span> <strong>Blue</strong> = server (marked as a long-running process)</li>
          </ul>
          <p>The sidebar shows mini dots for all tabs in each group at a glance.
             You'll get a notification + sound when a background tab starts waiting.</p>

          <h2>Keyboard Shortcuts</h2>
          <div className="info-shortcuts">
            <div className="info-shortcut-row"><kbd>Ctrl+Tab</kbd><span>Next tab</span></div>
            <div className="info-shortcut-row"><kbd>Ctrl+Shift+Tab</kbd><span>Previous tab</span></div>
            <div className="info-shortcut-row"><kbd>Ctrl+PageDown</kbd><span>Next group</span></div>
            <div className="info-shortcut-row"><kbd>Ctrl+PageUp</kbd><span>Previous group</span></div>
            <div className="info-shortcut-row"><kbd>Ctrl+1–9</kbd><span>Jump to tab 1–9</span></div>
            <div className="info-shortcut-row"><kbd>Ctrl+V</kbd><span>Paste into terminal</span></div>
            <div className="info-shortcut-row"><kbd>Ctrl+Enter</kbd><span>Newline without executing</span></div>
          </div>

          <h2>The Forge Heat System</h2>
          <ul>
            <li>Respond to Claude quickly and the forge heats up (stages 1–5)</li>
            <li>Keep a streak going to reach higher stages — the logo glows,
                embers rise, and the UI comes alive</li>
            <li>Stop responding and the forge cools back down</li>
            <li>Tune streak and cooldown timers in ⚙ Settings</li>
            <li>Try <strong>Demo Mode</strong> in Settings to preview all heat stages</li>
          </ul>
          <div className="info-heat-preview">
            {HEAT_COLORS.map((color, i) => (
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
