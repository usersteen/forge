import { useEffect, useState } from "react";
import useForgeStore from "../store/useForgeStore";
import useEscapeKey from "../hooks/useEscapeKey";
import { HEAT_LABELS } from "../utils/heat";
import { getThemeHeatColors } from "../utils/themes";

function ProjectsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
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

function ShortcutsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h1" /><path d="M10 8h1" /><path d="M14 8h1" /><path d="M18 8h1" />
      <path d="M6 12h1" /><path d="M18 12h1" />
      <path d="M9 16h6" />
    </svg>
  );
}

function AboutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

const INFO_CATEGORIES = [
  { id: "projects", label: "Projects", icon: ProjectsIcon },
  { id: "status", label: "Status", icon: StatusIcon },
  { id: "heat", label: "Heat", icon: HeatIcon },
  { id: "shortcuts", label: "Shortcuts", icon: ShortcutsIcon },
  { id: "about", label: "About", icon: AboutIcon },
];

function ProjectsSection() {
  return (
    <>
      <h2>Projects</h2>
      <ul>
        <li><strong>Projects</strong> live in the sidebar. Each holds its own set of terminal tabs.</li>
        <li><strong>Create</strong> a project with the <strong>+</strong> button — pick from starred repos, discovered repos in your repos folder, or paste a path</li>
        <li><strong>Rename</strong> by double-clicking, or right-click and choose Rename</li>
        <li><strong>Reorder</strong> by dragging projects up or down in the sidebar</li>
        <li><strong>Close</strong> with right-click &gt; Close Project</li>
      </ul>

      <h2>Tabs</h2>
      <ul>
        <li><strong>Tabs</strong> run across the top bar. Each tab is its own terminal session.</li>
        <li>Click <strong>+</strong> in the tab bar to create a new tab:</li>
        <li><strong>Claude</strong> — launches a Claude Code session</li>
        <li><strong>Codex</strong> — launches a Codex CLI session</li>
        <li><strong>Server</strong> — for dev servers and long-running processes (suggests a start command from package.json)</li>
        <li><strong>Preview</strong> — opens a localhost design preview with element comments</li>
        <li><strong>Blank</strong> — plain shell terminal</li>
        <li><strong>Rename</strong> by double-clicking the tab, or right-click &gt; Rename</li>
        <li><strong>Reorder</strong> by dragging tabs left or right</li>
      </ul>

      <h2>Worktrees</h2>
      <ul>
        <li><strong>Right-click</strong> a project and choose "Add Worktree" to create a git worktree</li>
        <li>Pick an existing branch or create a new one</li>
        <li>Worktrees appear nested under the parent project in the sidebar</li>
        <li>Remove a worktree by right-clicking it &gt; Remove Worktree</li>
      </ul>

      <h2>Explorer &amp; Documents</h2>
      <ul>
        <li>The <strong>project explorer</strong> shows the file tree for the active project's repo</li>
        <li>Click a file to preview it — supports markdown, text, code, and images</li>
        <li><strong>Markdown files</strong> can be edited in-place with Save/Revert</li>
        <li><strong>Star</strong> repos in the explorer to pin them as quick picks when creating projects</li>
        <li>Drag the divider between the terminal and document viewer to resize</li>
      </ul>
    </>
  );
}

function StatusSection() {
  return (
    <>
      <h2>Status Indicators</h2>
      <p>Each tab has a colored dot showing the session state:</p>
      <ul>
        <li><span className="info-dot"></span> <strong>Gray</strong> — idle, nothing running</li>
        <li><span className="info-dot working"></span> <strong>Working</strong> — the agent is actively running</li>
        <li><span className="info-dot waiting"></span> <strong>Waiting</strong> — the agent needs your input</li>
      </ul>
      <p>
        Status is detected automatically from terminal output — no setup needed.
        Works with both Claude Code and Codex sessions.
      </p>

      <h2>Utility Tabs</h2>
      <ul>
        <li><strong>Right-click</strong> any tab and choose "Set as Server Terminal" to mark it as a long-running process</li>
        <li>Server and preview tabs use compact utility markers instead of AI status colors: <span className="info-dot server-running"></span> server, <span className="info-dot preview-running"></span> preview</li>
        <li>Useful for dev servers, watchers, or any process that stays running</li>
        <li>Right-click and choose "Set as AI Terminal" to switch back</li>
      </ul>

      <h2>Notifications</h2>
      <ul>
        <li>Background tabs trigger a <strong>notification</strong> and <strong>sound</strong> when they start waiting</li>
        <li>Volume is adjustable in Settings &gt; Sound (quieter for the active tab when Forge is focused)</li>
        <li>The sidebar shows a <strong>dot summary</strong> for each project so you can scan status at a glance</li>
        <li>Status colors follow the active theme</li>
      </ul>
    </>
  );
}

function HeatInfoSection() {
  const theme = useForgeStore((s) => s.theme);
  const themeVariant = useForgeStore((s) => s.themeVariant);
  const heatColors = getThemeHeatColors(theme, themeVariant);

  return (
    <>
      <h2>The Forge Heat System</h2>
      <ul>
        <li>Respond to waiting tabs quickly to build heat across <strong>six stages</strong></li>
        <li>Keep responding fast to maintain your streak — the UI glows hotter as you climb</li>
        <li>Stop responding and the forge cools back down over time</li>
        <li>Adjust streak and cooldown timing in Settings &gt; Heat</li>
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

      <h2>Themes</h2>
      <ul>
        <li>Four themes: <strong>Forge</strong> (amber), <strong>Ice</strong> (cyan), <strong>Void</strong> (purple), <strong>Grass</strong> (green)</li>
        <li>Each theme has its own heat color ramp, status colors, glow effects, and particle style</li>
        <li>Switch themes in Settings &gt; Appearance — the chips preview each theme's colors</li>
        <li>Heat colors in the swatches above follow the active theme</li>
      </ul>

      <h2>Effects</h2>
      <ul>
        <li>Toggle particle effects and glow animations in Settings &gt; Appearance</li>
        <li>At higher heat stages, the header glows, borders warm up, and particles appear</li>
        <li>At heat stage 5, the entire UI chrome turns hot</li>
        <li>Try <strong>Demo Mode</strong> in Settings &gt; Heat to preview all stages</li>
      </ul>
    </>
  );
}

function ShortcutsSection() {
  return (
    <>
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
        <li>Right-click projects and tabs for more actions</li>
      </ul>
    </>
  );
}

function AboutSection({ onClose, onStartTour }) {
  return (
    <>
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

      <div className="info-version">Forge v{__APP_VERSION__}</div>
    </>
  );
}

const INFO_SECTIONS = {
  projects: ProjectsSection,
  status: StatusSection,
  heat: HeatInfoSection,
  shortcuts: ShortcutsSection,
  about: AboutSection,
};

export default function InfoPanel({ onClose, exiting, onExited, onStartTour }) {
  useEscapeKey(onClose);
  const [activeCategory, setActiveCategory] = useState("projects");
  const [isReady, setIsReady] = useState(false);
  const ActiveSection = INFO_SECTIONS[activeCategory];

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const overlayClassName = [
    "settings-overlay",
    "surface-overlay",
    isReady && !exiting && "modal-open",
    exiting && "modal-exiting",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={overlayClassName}
      onClick={onClose}
      onTransitionEnd={
        exiting
          ? (event) => {
              if (event.target === event.currentTarget) onExited?.();
            }
          : undefined
      }
    >
      <div className="settings-panel info-panel surface-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span>Guide</span>
          <button className="settings-close" onClick={onClose} aria-label="Close info panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="settings-body">
          <nav className="settings-nav">
            {INFO_CATEGORIES.map((cat) => (
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
            <ActiveSection onClose={onClose} onStartTour={onStartTour} />
          </div>
        </div>
      </div>
    </div>
  );
}
