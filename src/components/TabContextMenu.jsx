import { useEffect, useRef } from "react";

export default function TabContextMenu({ x, y, tabType, onRename, onUpdateTab, onCloseTab, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div ref={menuRef} className="tab-context-menu" style={{ left: x, top: y }}>
      <button
        className="tab-context-item"
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        Rename Tab
      </button>
      {tabType === "server" ? (
        <button
          className="tab-context-item"
          onClick={() => {
            onUpdateTab({ type: "ai" });
            onClose();
          }}
        >
          Set as AI Terminal
        </button>
      ) : (
        <button
          className="tab-context-item"
          onClick={() => {
            onUpdateTab({ type: "server" });
            onClose();
          }}
        >
          Set as Server Terminal
        </button>
      )}
      <button
        className="tab-context-item"
        onClick={() => {
          onCloseTab();
          onClose();
        }}
      >
        Close Tab
      </button>
    </div>
  );
}
