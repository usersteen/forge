import { useEffect, useRef } from "react";
import { NEW_TAB_OPTIONS } from "../data/newTabOptions";
import useEscapeKey from "../hooks/useEscapeKey";
import useServerSuggestion from "../hooks/useServerSuggestion";

export default function NewTabMenu({ x, y, rootPath, onSelect, onClose }) {
  const menuRef = useRef(null);
  const { serverSuggestion, serverExpanded, hasSubmenu, serverHint, toggleServerExpanded } =
    useServerSuggestion(rootPath);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [onClose]);

  useEscapeKey(onClose);

  const openServerTab = (launchCommand = null) => {
    onSelect({ name: "Server", type: "server", launchCommand });
    onClose();
  };

  const handleServerClick = () => {
    if (hasSubmenu) {
      toggleServerExpanded();
      return;
    }
    openServerTab();
  };

  return (
    <div ref={menuRef} className="quick-tab-menu" style={{ left: x, top: y }}>
      {NEW_TAB_OPTIONS.map((option) =>
        option.id === "server" ? (
          <div key={option.id} className="quick-tab-group">
            <button
              className="quick-tab-item"
              aria-expanded={hasSubmenu ? serverExpanded : undefined}
              onClick={handleServerClick}
            >
              <span className="quick-tab-item-row">
                <span className="quick-tab-item-label">{option.label}</span>
                {hasSubmenu ? (
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
