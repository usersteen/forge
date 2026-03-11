import { useCallback, useMemo, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getCurrentWindow } from "@tauri-apps/api/window";
import useForgeStore from "../store/useForgeStore";
import useInlineRename from "../hooks/useInlineRename";
import useEffectiveHeatStage from "../hooks/useEffectiveHeatStage";
import { HEAT_COLORS, getEmberStyle } from "../utils/heat";
import Settings from "./Settings";
import InfoPanel from "./InfoPanel";

const EMBER_CONFIGS = {
  3: [15, 35, 60, 82],
  4: [5, 15, 25, 36, 47, 58, 68, 78, 88, 95],
  5: [3, 10, 17, 24, 31, 38, 45, 52, 59, 66, 73, 80, 87, 93, 97, 100],
};

// [left%, animationDelay] — hand-picked to avoid diagonal patterns
const SIDEBAR_EMBER_CONFIGS = {
  4: [
    [12, 1.2], [42, 7.5], [70, 3.8], [28, 10.1], [85, 5.6], [55, 0.4],
    [20, 4.3], [65, 9.0],
  ],
  5: [
    [8, 2.1], [35, 9.3], [62, 0.7], [18, 6.4], [78, 13.2], [48, 4.0],
    [90, 8.8], [25, 11.5], [58, 1.9], [5, 3.5], [40, 7.2],
    [72, 0.3], [15, 10.8], [82, 5.1],
  ],
};

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

  const [showSettings, setShowSettings] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const closeInfo = useCallback(() => setShowInfo(false), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);

  const heatStage = useEffectiveHeatStage();
  const logoFill = HEAT_COLORS[heatStage];
  const logoHeatClass = heatStage > 0 ? ` sidebar-logo-heat-${heatStage}` : "";

  const headerClasses = [
    "sidebar-header",
    heatStage > 0 && `forge-heat-${heatStage}`,
  ].filter(Boolean).join(" ");

  const embers = useMemo(() => {
    const positions = EMBER_CONFIGS[heatStage] || (heatStage > 5 ? EMBER_CONFIGS[5] : null);
    if (!positions) return null;
    return positions.map((left, i) => (
      <span
        key={i}
        className="forge-ember"
        style={{ left: `${left}%`, animationDelay: `${(i * 0.4) % 2}s`, ...getEmberStyle(i) }}
      />
    ));
  }, [heatStage]);

  const sidebarEmbers = useMemo(() => {
    const positions = SIDEBAR_EMBER_CONFIGS[heatStage];
    if (!positions) return null;
    return positions.map(([left, delay], i) => (
      <span
        key={`sb-${i}`}
        className="forge-ember-tall"
        style={{ left: `${left}%`, animationDelay: `${delay}s`, ...getEmberStyle(i) }}
      />
    ));
  }, [heatStage]);

  return (
    <div className="sidebar">
      <div className={headerClasses} onMouseDown={() => appWindow.startDragging()}>
        {embers}

        <div className={`sidebar-logo${logoHeatClass}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 51.59 60.7">
            <path fill={logoFill} d="M51.59.91v2.73c0,.5-.41.91-.91.91h-27.01c-.5,0-.91.41-.91.91v21.7c0,.5.41.91.91.91h10.32c.5,0,.91-.41.91-.91v-.46c0-.5.41-.91.91-.91h1.21c.5,0,.91.41.91.91v7.28c0,.5-.41.91-.91.91h-1.21c-.5,0-.91-.41-.91-.91v-.45c0-.5-.41-.91-.91-.91h-10.32c-.5,0-.91.41-.91.91v21.7c0,.5.41.91.91.91h7.28c.5,0,.91.41.91.91v2.73c0,.5-.41.91-.91.91H.91c-.5,0-.91-.41-.91-.91v-2.73c0-.5.41-.91.91-.91h4.55c2.01,0,3.64-1.63,3.64-3.64V8.19c0-2.01-1.63-3.64-3.64-3.64H.91c-.5,0-.91-.41-.91-.91V.91C0,.41.41,0,.91,0h49.77c.5,0,.91.41.91.91Z"/>
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="68 0 42.59 60.7">
            <path fill={logoFill} d="M109.68,4.55c.5,0,.91.41.91.91v49.77c0,.5-.41.91-.91.91-2.01,0-3.64,1.63-3.64,3.64,0,.5-.41.91-.91.91h-31.56c-.5,0-.91-.41-.91-.91,0-2.01-1.63-3.64-3.64-3.64-.5,0-.91-.41-.91-.91V5.46c0-.5.41-.91.91-.91,2.01,0,3.64-1.63,3.64-3.64,0-.5.41-.91.91-.91h31.56c.5,0,.91.41.91.91,0,2.01,1.63,3.64,3.64,3.64ZM96.93,55.23V5.46c0-.5-.41-.91-.91-.91h-13.35c-.5,0-.91.41-.91.91v49.77c0,.5.41.91.91.91h13.35c.5,0,.91-.41.91-.91Z"/>
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="129 0 60.01 60.7">
            <path fill={logoFill} d="M188.1,56.14c.5,0,.91.41.91.91v2.73c0,.5-.41.91-.91.91h-16.39c-.5,0-.91-.41-.91-.91,0-2.01-1.63-3.64-3.64-3.64-.5,0-.91-.41-.91-.91v-21.7c0-.5-.41-.91-.91-.91h-13.35c-.5,0-.91.41-.91.91v21.7c0,.5-.41.91-.91.91-2.01,0-3.64,1.63-3.64,3.64,0,.5-.41.91-.91.91h-16.39c-.5,0-.91-.41-.91-.91v-2.73c0-.5.41-.91.91-.91h4.55c2.01,0,3.64-1.63,3.64-3.64V8.19c0-2.01-1.63-3.64-3.64-3.64h-4.55c-.5,0-.91-.41-.91-.91V.91c0-.5.41-.91.91-.91h45.22c.5,0,.91.41.91.91,0,2.01,1.63,3.64,3.64,3.64.5,0,.91.41.91.91v21.7c0,.5-.41.91-.91.91h-2.73c-.5,0-.91.41-.91.91v2.73c0,.5.41.91.91.91h2.73c.5,0,.91.41.91.91v18.97c0,2.01,1.63,3.64,3.64,3.64h4.55ZM151.99,28.07h13.35c.5,0,.91-.41.91-.91V5.46c0-.5-.41-.91-.91-.91h-13.35c-.5,0-.91.41-.91.91v21.7c0,.5.41.91.91.91Z"/>
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="207 0 50.72 60.7">
            <path fill={logoFill} d="M257.72,28.98v2.73c0,.5-.41.91-.91.91h-7.28c-.5,0-.91.41-.91.91v21.7c0,.5-.41.91-.91.91-2.01,0-3.64,1.63-3.64,3.64,0,.5-.41.91-.91.91h-31.56c-.5,0-.91-.41-.91-.91,0-2.01-1.63-3.64-3.64-3.64-.5,0-.91-.41-.91-.91V5.46c0-.5.41-.91.91-.91,2.01,0,3.64-1.63,3.64-3.64,0-.5.41-.91.91-.91h31.56c.5,0,.91.41.91.91,0,2.01,1.63,3.64,3.64,3.64.5,0,.91.41.91.91v2.73c0,.5-.41.91-.91.91h-11.84c-.5,0-.91-.41-.91-.91v-2.73c0-.5-.41-.91-.91-.91h-13.35c-.5,0-.91.41-.91.91v49.77c0,.5.41.91.91.91h13.35c.5,0,.91-.41.91-.91v-21.7c0-.5-.41-.91-.91-.91h-7.28c-.5,0-.91-.41-.91-.91v-2.73c0-.5.41-.91.91-.91h30.04c.5,0,.91.41.91.91Z"/>
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="268 0 52 60.7">
            <path fill={logoFill} d="M291.17,5.46v21.7c0,.5.41.91.91.91h10.32c.5,0,.91-.41.91-.91v-.46c0-.5.41-.91.91-.91h1.21c.5,0,.91.41.91.91v7.28c0,.5-.41.91-.91.91h-1.21c-.5,0-.91-.41-.91-.91v-.45c0-.5-.41-.91-.91-.91h-10.32c-.5,0-.91.41-.91.91v21.7c0,.5.41.91.91.91h27.01c.5,0,.91.41.91.91v2.73c0,.5-.41.91-.91.91h-49.77c-.5,0-.91-.41-.91-.91v-2.73c0-.5.41-.91.91-.91h4.55c2.01,0,3.64-1.63,3.64-3.64V8.19c0-2.01-1.63-3.64-3.64-3.64h-4.55c-.5,0-.91-.41-.91-.91V.91c0-.5.41-.91.91-.91h49.77c.5,0,.91.41.91.91v2.73c0,.5-.41.91-.91.91h-27.01c-.5,0-.91.41-.91.91Z"/>
          </svg>
        </div>
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
      <div className="sidebar-actions">
        <button className="sidebar-action-btn" onClick={() => setShowInfo(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </button>
        <button className="sidebar-action-btn" onClick={() => setShowSettings(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
      {sidebarEmbers}

      {showInfo && <InfoPanel onClose={closeInfo} />}
      {showSettings && <Settings onClose={closeSettings} />}
    </div>
  );
}
