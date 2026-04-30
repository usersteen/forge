import { useEffect, useRef, useState } from "react";
import { commitNewTab } from "../previewLauncher";
import QuickTabOptionList from "./QuickTabOptionList";

const HERO_ENTRY_ARM_DELAY_MS = 32;
const HERO_EXIT_FALLBACK_MS = 460;

export default function EmptyGroupPicker({ groupId, rootPath, serverCommandOverride }) {
  const [selectedActionId, setSelectedActionId] = useState(null);
  const [heroPhase, setHeroPhase] = useState("pre-enter");
  const entryTimerRef = useRef(null);
  const exitTimerRef = useRef(null);
  const pendingSelectionRef = useRef(null);

  useEffect(
    () => () => {
      if (entryTimerRef.current) clearTimeout(entryTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    },
    []
  );

  useEffect(() => {
    entryTimerRef.current = setTimeout(() => setHeroPhase("idle"), HERO_ENTRY_ARM_DELAY_MS);
    return () => {
      if (entryTimerRef.current) clearTimeout(entryTimerRef.current);
    };
  }, []);

  const handleHeroSelectionComplete = (actionId) => {
    const pending = pendingSelectionRef.current;
    if (!pending || pending.actionId !== actionId) return;
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    pendingSelectionRef.current = null;
    commitNewTab(groupId, pending.tabOptions);
  };

  const handleSelectIntent = (actionId, tabOptions, { heroEligible = true } = {}) => {
    if (!heroEligible) {
      commitNewTab(groupId, tabOptions);
      return;
    }

    if (selectedActionId) return;

    setSelectedActionId(actionId);
    setHeroPhase("exiting");
    pendingSelectionRef.current = { actionId, tabOptions };
    exitTimerRef.current = setTimeout(() => {
      handleHeroSelectionComplete(actionId);
    }, HERO_EXIT_FALLBACK_MS);
  };

  return (
    <div className="empty-group-picker">
      <h2 className="empty-group-picker-title">New Terminal</h2>
      <div className="empty-group-picker-options">
        <QuickTabOptionList
          rootPath={rootPath}
          serverCommandOverride={serverCommandOverride}
          variant="empty"
          heroPhase={heroPhase}
          selectedActionId={selectedActionId}
          onSelect={handleSelectIntent}
          onSelectIntent={handleSelectIntent}
          onHeroSelectionComplete={handleHeroSelectionComplete}
        />
      </div>
    </div>
  );
}
