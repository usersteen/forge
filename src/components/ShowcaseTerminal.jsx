import useForgeStore from "../store/useForgeStore";

function toneClass(tone) {
  switch (tone) {
    case "section":
      return "showcase-terminal-line-section";
    case "working":
      return "showcase-terminal-line-working";
    case "waiting":
      return "showcase-terminal-line-waiting";
    case "success":
      return "showcase-terminal-line-success";
    case "muted":
      return "showcase-terminal-line-muted";
    case "dim":
      return "showcase-terminal-line-dim";
    default:
      return "";
  }
}

export default function ShowcaseTerminal({ tabId, isActive }) {
  const terminalScreensByTab = useForgeStore((state) => state.showcaseTerminalScreensByTab);
  const screen = terminalScreensByTab[tabId];

  if (!screen) {
    return null;
  }

  return (
    <div
      className="terminal-shell showcase-terminal-shell"
      style={{
        visibility: isActive ? "visible" : "hidden",
        zIndex: isActive ? 1 : 0,
      }}
    >
      <div className="showcase-terminal-meta">
        <span className="showcase-terminal-badge">{screen.sessionLabel}</span>
        <span className="showcase-terminal-path">{screen.pathLabel}</span>
      </div>
      <div className="showcase-terminal-body">
        <div className="showcase-terminal-command">
          <span className="showcase-terminal-prompt">PS</span>
          <span className="showcase-terminal-command-text">{screen.command}</span>
        </div>
        <div className="showcase-terminal-lines">
          {screen.lines.map((line, index) => (
            <div key={`${tabId}-${index}`} className={`showcase-terminal-line ${toneClass(line.tone)}`}>
              {line.text}
            </div>
          ))}
        </div>
      </div>
      {screen.footer ? <div className="showcase-terminal-footer">{screen.footer}</div> : null}
    </div>
  );
}
