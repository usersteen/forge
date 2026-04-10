import { useEffect } from "react";
import useFloatingSurfacePosition from "../hooks/useFloatingSurfacePosition";

export default function ProjectContextMenu({
  x,
  y,
  onRename,
  onRemove,
  onClose,
  isGitRepo,
  isWorktree,
  onAddWorktree,
  onRemoveWorktree,
  motionState = "open",
}) {
  const { surfaceRef, surfaceStyle, placement } = useFloatingSurfacePosition({
    x,
    y,
    deps: [isGitRepo, isWorktree],
    preferredHorizontal: "right",
    preferredVertical: "down",
  });

  useEffect(() => {
    const handleClick = (event) => {
      if (surfaceRef.current?.contains(event.target)) return;
      onClose();
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
  }, [onClose, surfaceRef]);

  let actionIndex = 1;

  return (
    <div
      ref={surfaceRef}
      className="tab-context-menu surface-menu"
      data-motion-state={motionState}
      data-placement={placement}
      style={surfaceStyle}
    >
      <div className="surface-stagger" style={{ "--surface-index": 0 }}>
        <button
          className="tab-context-item"
          onClick={() => {
            onRename();
            onClose();
          }}
        >
          Rename Project
        </button>
      </div>
      {isGitRepo && (
        <div className="surface-stagger" style={{ "--surface-index": actionIndex++ }}>
          <button
            className="tab-context-item"
            onClick={() => {
              onAddWorktree();
              onClose();
            }}
          >
            Add Worktree...
          </button>
        </div>
      )}
      {isWorktree ? (
        <div className="surface-stagger" style={{ "--surface-index": actionIndex }}>
          <button
            className="tab-context-item"
            onClick={() => {
              onRemoveWorktree();
              onClose();
            }}
          >
            Remove Worktree
          </button>
        </div>
      ) : (
        <div className="surface-stagger" style={{ "--surface-index": actionIndex }}>
          <button
            className="tab-context-item"
            onClick={() => {
              onRemove();
              onClose();
            }}
          >
            Close Project
          </button>
        </div>
      )}
    </div>
  );
}
