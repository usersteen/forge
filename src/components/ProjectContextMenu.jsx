import { useEffect, useRef } from "react";

export default function ProjectContextMenu({ x, y, onRename, onRemove, onClose, isGitRepo, isWorktree, onAddWorktree, onRemoveWorktree }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) onClose();
    };
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
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
        Rename Project
      </button>
      {isGitRepo && (
        <button
          className="tab-context-item"
          onClick={() => {
            onAddWorktree();
            onClose();
          }}
        >
          Add Worktree...
        </button>
      )}
      {isWorktree ? (
        <button
          className="tab-context-item"
          onClick={() => {
            onRemoveWorktree();
            onClose();
          }}
        >
          Remove Worktree
        </button>
      ) : (
        <button
          className="tab-context-item"
          onClick={() => {
            onRemove();
            onClose();
          }}
        >
          Close Project
        </button>
      )}
    </div>
  );
}
