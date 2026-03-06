import { useCallback } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getCurrentWindow } from "@tauri-apps/api/window";
import useForgeStore from "../store/useForgeStore";
import useInlineRename from "../hooks/useInlineRename";

const appWindow = getCurrentWindow();

function getSidebarDotClass(tab) {
  if (tab.type === "server") {
    return "server-running";
  }
  if (tab.status === "waiting") return "waiting";
  if (tab.status === "working") return "working";
  return "";
}

function getGroupPriorityClass(group) {
  const hasWaiting = group.tabs.some((t) => t.status === "waiting");
  if (hasWaiting) return "sidebar-group-waiting";
  const hasWorking = group.tabs.some((t) => t.status === "working");
  if (hasWorking) return "sidebar-group-working";
  return "";
}

function getStatusSummary(group) {
  const waiting = group.tabs.filter((t) => t.status === "waiting").length;
  const working = group.tabs.filter((t) => t.status === "working").length;
  const parts = [];
  if (waiting) parts.push(`${waiting} waiting`);
  if (working) parts.push(`${working} working`);
  return parts.length ? parts.join(", ") : `${group.tabs.length} tab${group.tabs.length !== 1 ? "s" : ""}`;
}

function SortableGroup({ group, isActive, onSelect, onDoubleClick, editingId, inputProps, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`sidebar-group ${isActive ? "sidebar-group-active" : ""} ${getGroupPriorityClass(group)}`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
    >
      <div className="sidebar-group-info">
        {editingId === group.id ? (
          <input className="sidebar-rename-input" {...inputProps} />
        ) : (
          <span className="sidebar-group-name">{group.name}</span>
        )}
        <div className="sidebar-group-dots">
          {group.tabs.map((tab) => (
            <span key={tab.id} className={`sidebar-dot ${getSidebarDotClass(tab)}`} />
          ))}
        </div>
        <span className="sidebar-group-count">{getStatusSummary(group)}</span>
      </div>
      <button
        className="sidebar-group-close"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        x
      </button>
    </div>
  );
}

export default function Sidebar() {
  const groups = useForgeStore((s) => s.groups);
  const activeGroupId = useForgeStore((s) => s.activeGroupId);
  const setActiveGroup = useForgeStore((s) => s.setActiveGroup);
  const addGroup = useForgeStore((s) => s.addGroup);
  const removeGroup = useForgeStore((s) => s.removeGroup);
  const renameGroup = useForgeStore((s) => s.renameGroup);
  const reorderGroups = useForgeStore((s) => s.reorderGroups);

  const onCommit = useCallback((id, name) => renameGroup(id, name), [renameGroup]);
  const { editingId, startEditing, inputProps } = useInlineRename(onCommit);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = groups.map((g) => g.id);
    const oldIdx = ids.indexOf(active.id);
    const newIdx = ids.indexOf(over.id);
    const newIds = [...ids];
    newIds.splice(oldIdx, 1);
    newIds.splice(newIdx, 0, active.id);
    reorderGroups(newIds);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header" onMouseDown={() => appWindow.startDragging()}>Projects</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          <div className="sidebar-groups">
            {groups.map((group) => (
              <SortableGroup
                key={group.id}
                group={group}
                isActive={group.id === activeGroupId}
                onSelect={() => setActiveGroup(group.id)}
                onDoubleClick={() => startEditing(group.id, group.name)}
                editingId={editingId}
                inputProps={inputProps}
                onRemove={() => removeGroup(group.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button className="sidebar-add" onClick={() => addGroup()}>
        + New Project
      </button>
    </div>
  );
}
