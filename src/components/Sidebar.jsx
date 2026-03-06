import { useCallback } from "react";
import useForgeStore from "../store/useForgeStore";
import useInlineRename from "../hooks/useInlineRename";

export default function Sidebar() {
  const groups = useForgeStore((s) => s.groups);
  const activeGroupId = useForgeStore((s) => s.activeGroupId);
  const setActiveGroup = useForgeStore((s) => s.setActiveGroup);
  const addGroup = useForgeStore((s) => s.addGroup);
  const removeGroup = useForgeStore((s) => s.removeGroup);
  const renameGroup = useForgeStore((s) => s.renameGroup);

  const onCommit = useCallback((id, name) => renameGroup(id, name), [renameGroup]);
  const { editingId, startEditing, inputProps } = useInlineRename(onCommit);

  return (
    <div className="sidebar">
      <div className="sidebar-header">Projects</div>
      <div className="sidebar-groups">
        {groups.map((group) => (
          <div
            key={group.id}
            className={`sidebar-group ${group.id === activeGroupId ? "sidebar-group-active" : ""}`}
            onClick={() => setActiveGroup(group.id)}
            onDoubleClick={() => startEditing(group.id, group.name)}
          >
            <div className="sidebar-group-info">
              {editingId === group.id ? (
                <input className="sidebar-rename-input" {...inputProps} />
              ) : (
                <span className="sidebar-group-name">{group.name}</span>
              )}
              <span className="sidebar-group-count">
                {group.tabs.length} tab{group.tabs.length !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              className="sidebar-group-close"
              onClick={(e) => {
                e.stopPropagation();
                removeGroup(group.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="sidebar-add" onClick={() => addGroup()}>
        + New Project
      </button>
    </div>
  );
}
