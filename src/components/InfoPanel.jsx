import useForgeStore from "../store/useForgeStore";
import useEscapeKey from "../hooks/useEscapeKey";
import { HEAT_LABELS } from "../utils/heat";
import { getThemeHeatColors } from "../utils/themes";

export default function InfoPanel({ onClose, onStartTour }) {
  useEscapeKey(onClose);
  const theme = useForgeStore((s) => s.theme);
  const themeVariant = useForgeStore((s) => s.themeVariant);
  const heatColors = getThemeHeatColors(theme, themeVariant);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="info-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span>About Forge</span>
          <button className="settings-close" onClick={onClose}>x</button>
        </div>
        <div className="info-content">
          <p className="info-intro">
            A terminal manager for running multiple Claude Code and Codex sessions, organized by project.
            Status detection works automatically — no setup needed.
          </p>

          {onStartTour && (
            <button
              type="button"
              className="info-tour-link"
              onClick={() => { onClose(); onStartTour(); }}
            >
              Take the guided tour
            </button>
          )}

          <h2>Projects and Tabs</h2>
          <ul>
            <li><strong>Projects</strong> live in the sidebar. Each project holds its own set of terminal tabs.</li>
            <li><strong>Tabs</strong> run across the top bar. Each tab is its own terminal session.</li>
            <li><strong>Rename</strong> by double-clicking a project or tab, or right-click and choose Rename</li>
            <li><strong>Reorder</strong> by dragging projects or tabs into place</li>
            <li><strong>Close</strong> with the x button</li>
          </ul>

          <h2>Server Tabs</h2>
          <ul>
            <li><strong>Right-click</strong> any tab and choose "Set as Server Terminal" to mark it as a long-running process</li>
            <li>Server tabs show a blue dot instead of AI status colors</li>
            <li>Useful for dev servers, watchers, or any process that stays running</li>
            <li>Right-click and choose "Set as AI Terminal" to switch it back</li>
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
            The sidebar shows a dot summary for each project so you can scan status at a glance.
            Background tabs trigger a notification and sound when they start waiting.
          </p>
          <p>
            Status colors follow the active theme. The theme chips in Settings preview each
            theme's colors before you switch.
          </p>

          <h2>The Forge Heat System</h2>
          <ul>
            <li>Respond to waiting tabs quickly to build heat across six stages</li>
            <li>Keep responding fast to maintain your streak — the UI glows hotter as you climb</li>
            <li>Stop responding and the forge cools back down over time</li>
            <li>Heat colors follow the active theme — the swatches below show the current ramp</li>
            <li>Adjust streak and cooldown timing in Settings &gt; Heat</li>
            <li>Try <strong>Demo Mode</strong> in Settings to preview all stages</li>
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
            <li>Layout, tab names, and window position save automatically</li>
            <li>Each tab restarts in its last working directory</li>
            <li>All config is stored at <code>~/.forge/config.json</code></li>
          </ul>

          <div className="info-version">Forge v{__APP_VERSION__}</div>
        </div>
      </div>
    </div>
  );
}
