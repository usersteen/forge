import { useEffect } from "react";
import useEscapeKey from "../hooks/useEscapeKey";
import useFloatingSurfacePosition from "../hooks/useFloatingSurfacePosition";
import QuickTabOptionList from "./QuickTabOptionList";

export default function NewTabMenu({
  x,
  y,
  rootPath,
  serverCommandOverride,
  onSelect,
  onClose,
  anchorRef,
  tourElevated,
  motionState = "open",
}) {
  const { surfaceRef, surfaceStyle, placement } = useFloatingSurfacePosition({
    x,
    y,
    deps: [rootPath, serverCommandOverride],
    preferredHorizontal: "right",
    preferredVertical: "down",
  });

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (anchorRef?.current?.contains(event.target)) return;
      if (surfaceRef.current?.contains(event.target)) return;
      onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [anchorRef, onClose, surfaceRef]);

  useEscapeKey(onClose);

  return (
    <div
      ref={surfaceRef}
      className={`quick-tab-menu surface-menu${tourElevated ? " tour-elevated-menu" : ""}`}
      data-motion-state={motionState}
      data-placement={placement}
      style={surfaceStyle}
    >
      <QuickTabOptionList
        rootPath={rootPath}
        serverCommandOverride={serverCommandOverride}
        onSelect={(tabOptions) => {
          onSelect(tabOptions);
          onClose();
        }}
      />
    </div>
  );
}
