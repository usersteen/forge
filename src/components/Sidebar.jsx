import { useCallback, useMemo, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getCurrentWindow } from "@tauri-apps/api/window";
import useForgeStore from "../store/useForgeStore";
import useInlineRename from "../hooks/useInlineRename";
import Settings from "./Settings";

const HEAT_COLORS = ["#475569", "#f59e0b", "#ea580c", "#dc2626", "#ef4444", "#b91c1c"];

const EMBER_CONFIGS = {
  3: [30, 65],
  4: [20, 40, 60, 80],
  5: [10, 25, 40, 55, 70, 85],
};

function getHeatStage(streak) {
  if (streak >= 10) return 5;
  if (streak >= 8) return 4;
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  if (streak >= 1) return 1;
  return 0;
}

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

  const streak = useForgeStore((s) => s.streak);
  const [showSettings, setShowSettings] = useState(false);

  const heatStage = getHeatStage(streak);
  const logoFill = heatStage > 0 ? HEAT_COLORS[heatStage] : "#475569";
  const logoClass = `sidebar-logo${heatStage > 0 ? ` sidebar-logo-heat-${heatStage}` : ""}`;

  const headerClasses = [
    "sidebar-header",
    heatStage > 0 && `forge-heat-${heatStage}`,
    heatStage >= 5 && "forge-shake",
  ].filter(Boolean).join(" ");

  const embers = useMemo(() => {
    const positions = EMBER_CONFIGS[heatStage] || (heatStage > 5 ? EMBER_CONFIGS[5] : null);
    if (!positions) return null;
    return positions.map((left, i) => (
      <span
        key={i}
        className="forge-ember"
        style={{ left: `${left}%`, animationDelay: `${(i * 0.4) % 2}s` }}
      />
    ));
  }, [heatStage]);

  return (
    <div className="sidebar">
      <div className={headerClasses} onMouseDown={() => appWindow.startDragging()}>
        {embers}
        <svg className={logoClass} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 60.7">
          <path fill={logoFill} d="M51.59.91v2.73c0,.5-.41.91-.91.91h-27.01c-.5,0-.91.41-.91.91v21.7c0,.5.41.91.91.91h10.32c.5,0,.91-.41.91-.91v-.46c0-.5.41-.91.91-.91h1.21c.5,0,.91.41.91.91v7.28c0,.5-.41.91-.91.91h-1.21c-.5,0-.91-.41-.91-.91v-.45c0-.5-.41-.91-.91-.91h-10.32c-.5,0-.91.41-.91.91v21.7c0,.5.41.91.91.91h7.28c.5,0,.91.41.91.91v2.73c0,.5-.41.91-.91.91H.91c-.5,0-.91-.41-.91-.91v-2.73c0-.5.41-.91.91-.91h4.55c2.01,0,3.64-1.63,3.64-3.64V8.19c0-2.01-1.63-3.64-3.64-3.64H.91c-.5,0-.91-.41-.91-.91V.91C0,.41.41,0,.91,0h49.77c.5,0,.91.41.91.91Z"/>
          <path fill={logoFill} d="M109.68,4.55c.5,0,.91.41.91.91v49.77c0,.5-.41.91-.91.91-2.01,0-3.64,1.63-3.64,3.64,0,.5-.41.91-.91.91h-31.56c-.5,0-.91-.41-.91-.91,0-2.01-1.63-3.64-3.64-3.64-.5,0-.91-.41-.91-.91V5.46c0-.5.41-.91.91-.91,2.01,0,3.64-1.63,3.64-3.64,0-.5.41-.91.91-.91h31.56c.5,0,.91.41.91.91,0,2.01,1.63,3.64,3.64,3.64ZM96.93,55.23V5.46c0-.5-.41-.91-.91-.91h-13.35c-.5,0-.91.41-.91.91v49.77c0,.5.41.91.91.91h13.35c.5,0,.91-.41.91-.91Z"/>
          <path fill={logoFill} d="M188.1,56.14c.5,0,.91.41.91.91v2.73c0,.5-.41.91-.91.91h-16.39c-.5,0-.91-.41-.91-.91,0-2.01-1.63-3.64-3.64-3.64-.5,0-.91-.41-.91-.91v-21.7c0-.5-.41-.91-.91-.91h-13.35c-.5,0-.91.41-.91.91v21.7c0,.5-.41.91-.91.91-2.01,0-3.64,1.63-3.64,3.64,0,.5-.41.91-.91.91h-16.39c-.5,0-.91-.41-.91-.91v-2.73c0-.5.41-.91.91-.91h4.55c2.01,0,3.64-1.63,3.64-3.64V8.19c0-2.01-1.63-3.64-3.64-3.64h-4.55c-.5,0-.91-.41-.91-.91V.91c0-.5.41-.91.91-.91h45.22c.5,0,.91.41.91.91,0,2.01,1.63,3.64,3.64,3.64.5,0,.91.41.91.91v21.7c0,.5-.41.91-.91.91h-2.73c-.5,0-.91.41-.91.91v2.73c0,.5.41.91.91.91h2.73c.5,0,.91.41.91.91v18.97c0,2.01,1.63,3.64,3.64,3.64h4.55ZM151.99,28.07h13.35c.5,0,.91-.41.91-.91V5.46c0-.5-.41-.91-.91-.91h-13.35c-.5,0-.91.41-.91.91v21.7c0,.5.41.91.91.91Z"/>
          <path fill={logoFill} d="M257.72,28.98v2.73c0,.5-.41.91-.91.91h-7.28c-.5,0-.91.41-.91.91v21.7c0,.5-.41.91-.91.91-2.01,0-3.64,1.63-3.64,3.64,0,.5-.41.91-.91.91h-31.56c-.5,0-.91-.41-.91-.91,0-2.01-1.63-3.64-3.64-3.64-.5,0-.91-.41-.91-.91V5.46c0-.5.41-.91.91-.91,2.01,0,3.64-1.63,3.64-3.64,0-.5.41-.91.91-.91h31.56c.5,0,.91.41.91.91,0,2.01,1.63,3.64,3.64,3.64.5,0,.91.41.91.91v2.73c0,.5-.41.91-.91.91h-11.84c-.5,0-.91-.41-.91-.91v-2.73c0-.5-.41-.91-.91-.91h-13.35c-.5,0-.91.41-.91.91v49.77c0,.5.41.91.91.91h13.35c.5,0,.91-.41.91-.91v-21.7c0-.5-.41-.91-.91-.91h-7.28c-.5,0-.91-.41-.91-.91v-2.73c0-.5.41-.91.91-.91h30.04c.5,0,.91.41.91.91Z"/>
          <path fill={logoFill} d="M291.17,5.46v21.7c0,.5.41.91.91.91h10.32c.5,0,.91-.41.91-.91v-.46c0-.5.41-.91.91-.91h1.21c.5,0,.91.41.91.91v7.28c0,.5-.41.91-.91.91h-1.21c-.5,0-.91-.41-.91-.91v-.45c0-.5-.41-.91-.91-.91h-10.32c-.5,0-.91.41-.91.91v21.7c0,.5.41.91.91.91h27.01c.5,0,.91.41.91.91v2.73c0,.5-.41.91-.91.91h-49.77c-.5,0-.91-.41-.91-.91v-2.73c0-.5.41-.91.91-.91h4.55c2.01,0,3.64-1.63,3.64-3.64V8.19c0-2.01-1.63-3.64-3.64-3.64h-4.55c-.5,0-.91-.41-.91-.91V.91c0-.5.41-.91.91-.91h49.77c.5,0,.91.41.91.91v2.73c0,.5-.41.91-.91.91h-27.01c-.5,0-.91.41-.91.91Z"/>
        </svg>
      </div>
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
      <button className="sidebar-settings" onClick={() => setShowSettings(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
