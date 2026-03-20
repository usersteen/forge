import { useEffect, useRef, useState } from "react";
import useForgeStore from "../store/useForgeStore";

function repoNameFromPath(path) {
  return path.split(/[\\/]/).filter(Boolean).pop() || "Project";
}

export default function NewProjectMenu({ x, y, onSelect, onClose }) {
  const menuRef = useRef(null);
  const [inputValue, setInputValue] = useState("");
  const favoriteRepoPaths = useForgeStore((s) => s.favoriteRepoPaths);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      onClose();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter" && inputValue.trim()) {
      onSelect(inputValue.trim());
      onClose();
    }
  };

  return (
    <div ref={menuRef} className="quick-tab-menu new-project-menu" style={{ left: x, top: y }}>
      <div className="new-project-input-row">
        <input
          className="new-project-path-input"
          type="text"
          placeholder="Paste a repo path..."
          autoFocus
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
        />
      </div>

      {favoriteRepoPaths.length > 0 && (
        <>
          <div className="new-project-divider" />
          <div className="new-project-section-label">Starred Repos</div>
          <div className="new-project-starred-list">
            {favoriteRepoPaths.map((path) => (
              <button
                key={path}
                className="quick-tab-item"
                onClick={() => {
                  onSelect(path);
                  onClose();
                }}
              >
                <span className="quick-tab-item-label">{repoNameFromPath(path)}</span>
                <span className="quick-tab-item-hint">{path}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="new-project-divider" />
      <button
        className="quick-tab-item"
        onClick={() => {
          onSelect(null);
          onClose();
        }}
      >
        <span className="quick-tab-item-label">Skip</span>
        <span className="quick-tab-item-hint">Create a blank project</span>
      </button>
    </div>
  );
}
