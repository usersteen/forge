import { useEffect, useRef, useState } from "react";
import useEscapeKey from "../hooks/useEscapeKey";

export default function NewProjectMenu({ x, y, onSelect, onClose }) {
  const menuRef = useRef(null);
  const [inputValue, setInputValue] = useState("");
  const [menuStyle, setMenuStyle] = useState({ left: x, top: y, opacity: 0 });

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [onClose]);

  useEscapeKey(onClose);

  // Clamp menu position to viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const margin = 8;
    const rect = menuRef.current.getBoundingClientRect();
    let nextX = x;
    let nextY = y;

    if (nextY + rect.height > window.innerHeight - margin) {
      nextY = Math.max(margin, window.innerHeight - rect.height - margin);
    }
    if (nextX + rect.width > window.innerWidth - margin) {
      nextX = Math.max(margin, nextX - rect.width - 12);
    }

    setMenuStyle({ left: nextX, top: nextY, opacity: 1 });
  }, [x, y]);

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter" && inputValue.trim()) {
      onSelect(inputValue.trim());
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className="quick-tab-menu new-project-menu"
      style={menuStyle}
    >
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
