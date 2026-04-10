import { useEffect } from "react";
import useFloatingSurfacePosition from "../hooks/useFloatingSurfacePosition";

export default function TabContextMenu({
  x,
  y,
  tabType,
  onRename,
  onUpdateTab,
  onCloseTab,
  onClose,
  motionState = "open",
}) {
  const { surfaceRef, surfaceStyle, placement } = useFloatingSurfacePosition({
    x,
    y,
    deps: [tabType],
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
          Rename Tab
        </button>
      </div>
      {tabType === "server" ? (
        <div className="surface-stagger" style={{ "--surface-index": 1 }}>
          <button
            className="tab-context-item"
            onClick={() => {
              onUpdateTab({ type: "ai" });
              onClose();
            }}
          >
            Set as AI Terminal
          </button>
        </div>
      ) : (
        <div className="surface-stagger" style={{ "--surface-index": 1 }}>
          <button
            className="tab-context-item"
            onClick={() => {
              onUpdateTab({ type: "server" });
              onClose();
            }}
          >
            Set as Server Terminal
          </button>
        </div>
      )}
      <div className="surface-stagger" style={{ "--surface-index": 2 }}>
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
    </div>
  );
}
