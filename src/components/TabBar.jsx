import { useCallback } from "react";
import useForgeStore from "../store/useForgeStore";
import useInlineRename from "../hooks/useInlineRename";

export default function TabBar() {
  const groups = useForgeStore((s) => s.groups);
  const activeGroupId = useForgeStore((s) => s.activeGroupId);
  const setActiveTab = useForgeStore((s) => s.setActiveTab);
  const addTab = useForgeStore((s) => s.addTab);
  const removeTab = useForgeStore((s) => s.removeTab);
  const renameTab = useForgeStore((s) => s.renameTab);

  const activeGroup = groups.find((g) => g.id === activeGroupId);

  const onCommit = useCallback(
    (id, name) => renameTab(activeGroupId, id, name),
    [renameTab, activeGroupId]
  );
  const { editingId, startEditing, inputProps } = useInlineRename(onCommit);

  if (!activeGroup) return null;

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {activeGroup.tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeGroup.activeTabId ? "tab-active" : ""}`}
            onClick={() => setActiveTab(activeGroupId, tab.id)}
            onDoubleClick={() => startEditing(tab.id, tab.name)}
          >
            {editingId === tab.id ? (
              <input className="tab-rename-input" {...inputProps} />
            ) : (
              <span className="tab-name">{tab.name}</span>
            )}
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                removeTab(activeGroupId, tab.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="tab-add" onClick={() => addTab(activeGroupId)}>
        +
      </button>
    </div>
  );
}
