import { useEffect, useRef, useState } from "react";
import { inferServerLaunch } from "../utils/devServerSuggestion";

const NEW_TAB_OPTIONS = [
  {
    id: "claude",
    label: "Claude Code",
    hint: "Run `claude` in a new terminal",
    tabOptions: {
      name: "Claude Code",
      type: "ai",
      provider: "claude",
      launchCommand: "claude",
    },
  },
  {
    id: "codex",
    label: "Codex",
    hint: "Run `codex` in a new terminal",
    tabOptions: {
      name: "Codex",
      type: "ai",
      provider: "codex",
      launchCommand: "codex",
    },
  },
  {
    id: "server",
    label: "Server",
  },
  {
    id: "blank",
    label: "Blank",
    hint: "Open a shell in the attached repo when available",
    tabOptions: {},
  },
];

export default function NewTabMenu({ x, y, rootPath, onSelect, onClose }) {
  const menuRef = useRef(null);
  const [serverExpanded, setServerExpanded] = useState(false);
  const [serverSuggestion, setServerSuggestion] = useState({
    status: rootPath ? "loading" : "idle",
    value: null,
  });

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      onClose();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    if (!rootPath) {
      setServerSuggestion({ status: "idle", value: null });
      return () => {
        cancelled = true;
      };
    }

    setServerSuggestion({ status: "loading", value: null });
    inferServerLaunch(rootPath).then((value) => {
      if (cancelled) return;
      setServerSuggestion({
        status: value ? "ready" : "idle",
        value,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  const openServerTab = (launchCommand = null) => {
    onSelect({
      name: "Server",
      type: "server",
      launchCommand,
    });
    onClose();
  };

  const handleServerClick = () => {
    if (serverSuggestion.status === "loading" || serverSuggestion.value) {
      setServerExpanded((current) => !current);
      return;
    }
    openServerTab();
  };

  const serverHint =
    serverSuggestion.status === "loading"
      ? "Inspecting the attached repo for a likely dev command"
      : serverSuggestion.value
        ? `Suggested: ${serverSuggestion.value.command}`
        : rootPath
          ? "Open a blank server tab in the attached repo"
          : "Open a blank server tab";

  return (
    <div ref={menuRef} className="quick-tab-menu" style={{ left: x, top: y }}>
      {NEW_TAB_OPTIONS.map((option) =>
        option.id === "server" ? (
          <div key={option.id} className="quick-tab-group">
            <button
              className="quick-tab-item"
              aria-expanded={serverSuggestion.status === "loading" || serverSuggestion.value ? serverExpanded : undefined}
              onClick={handleServerClick}
            >
              <span className="quick-tab-item-row">
                <span className="quick-tab-item-label">{option.label}</span>
                {serverSuggestion.status === "loading" || serverSuggestion.value ? (
                  <span className="quick-tab-item-chevron">{serverExpanded ? "−" : "+"}</span>
                ) : null}
              </span>
              <span className="quick-tab-item-hint">{serverHint}</span>
            </button>
            {serverExpanded ? (
              <div className="quick-tab-submenu">
                {serverSuggestion.value ? (
                  <button
                    className="quick-tab-subitem"
                    onClick={() => openServerTab(serverSuggestion.value.command)}
                  >
                    <span className="quick-tab-item-label">Run Suggested Command</span>
                    <span className="quick-tab-item-hint">{serverSuggestion.value.command}</span>
                    <span className="quick-tab-item-meta">{serverSuggestion.value.reason}</span>
                  </button>
                ) : (
                  <div className="quick-tab-subitem quick-tab-subitem-disabled">
                    <span className="quick-tab-item-label">Looking for a likely dev command</span>
                    <span className="quick-tab-item-hint">You can still open a blank server tab below.</span>
                  </div>
                )}
                <button className="quick-tab-subitem" onClick={() => openServerTab()}>
                  <span className="quick-tab-item-label">I&apos;ll Type the Command</span>
                  <span className="quick-tab-item-hint">Open a server tab without running anything</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            key={option.id}
            className="quick-tab-item"
            onClick={() => {
              onSelect(option.tabOptions);
              onClose();
            }}
          >
            <span className="quick-tab-item-label">{option.label}</span>
            <span className="quick-tab-item-hint">{option.hint}</span>
          </button>
        )
      )}
    </div>
  );
}
