import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getCurrentWindow } from "@tauri-apps/api/window";
import useForgeStore from "../store/useForgeStore";
import useInlineRename from "../hooks/useInlineRename";
import useEffectiveHeatStage from "../hooks/useEffectiveHeatStage";
import { getEmberStyle } from "../utils/heat";
import useRecencyTick from "../hooks/useRecencyTick";
import { getThemeHeatColor } from "../utils/themes";
import ForgeWordmark from "./ForgeWordmark";
import ProjectContextMenu from "./ProjectContextMenu";
import Settings from "./Settings";
import InfoPanel from "./InfoPanel";
const ThemeLab = import.meta.env.DEV ? lazy(() => import("./ThemeLab")) : null;
import NewProjectMenu from "./NewProjectMenu";
import WelcomeModal from "./WelcomeModal";

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

function getSidebarDotClass(tab, isRecent) {
  if (tab.type === "server") {
    return "server-running";
  }
  if (tab.status === "waiting") {
    return isRecent ? "waiting waiting-hot" : "waiting waiting-cold";
  }
  if (tab.status === "working") return "working";
  return "";
}

function getGroupPriorityClass(group) {
  const interactiveTabs = group.tabs.filter((t) => t.type !== "server");
  const hasWaiting = interactiveTabs.some((t) => t.status === "waiting");
  if (hasWaiting) return "sidebar-group-waiting";
  const hasWorking = interactiveTabs.some((t) => t.status === "working");
  if (hasWorking) return "sidebar-group-working";
  return "";
}

function SortableGroup({ group, isActive, now, recencyThreshold, onSelect, onDoubleClick, onContextMenu, editingId, inputProps, onRemove }) {
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
      onContextMenu={onContextMenu}
    >
      <div className="sidebar-group-info">
        {editingId === group.id ? (
          <input className="sidebar-rename-input" {...inputProps} />
        ) : (
          <div className="sidebar-group-title-row">
            <span className="sidebar-group-name">{group.name}</span>
          </div>
        )}
        <div className="sidebar-group-dots">
          {group.tabs.map((tab) => (
            <span key={tab.id} className={`sidebar-dot ${getSidebarDotClass(tab, tab.lastEngagedAt && now - tab.lastEngagedAt < recencyThreshold)}`} />
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
        onContextMenu={(e) => e.stopPropagation()}
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
  const theme = useForgeStore((s) => s.theme);
  const fxEnabled = useForgeStore((s) => s.fxEnabled);
  const configLoaded = useForgeStore((s) => s.configLoaded);
  const showWelcomeOnLaunch = useForgeStore((s) => s.showWelcomeOnLaunch);
  const tabRecencyMinutes = useForgeStore((s) => s.tabRecencyMinutes);

  const hasWaitingTabs = groups.some((g) => g.tabs.some((t) => t.status === "waiting"));
  const now = useRecencyTick(hasWaitingTabs);
  const recencyThreshold = tabRecencyMinutes * 60000;

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
  const [showWelcome, setShowWelcome] = useState(false);
  const [showThemeLab, setShowThemeLab] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [newProjectMenu, setNewProjectMenu] = useState(null);
  const newProjectBtnRef = useRef(null);
  const closeInfo = useCallback(() => setShowInfo(false), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  const openInfo = useCallback(() => setShowInfo(true), []);
  const openSettings = useCallback(() => setShowSettings(true), []);
  const closeWelcome = useCallback(() => setShowWelcome(false), []);
  const closeNewProjectMenu = useCallback(() => setNewProjectMenu(null), []);

  const heatStage = useEffectiveHeatStage();
  const logoFill = getThemeHeatColor(theme, heatStage);
  const logoHeatClass = heatStage > 0 ? ` sidebar-logo-heat-${heatStage}` : "";

  const headerClasses = [
    "sidebar-header",
    heatStage > 0 && `forge-heat-${heatStage}`,
  ].filter(Boolean).join(" ");

  const embers = useMemo(() => {
    if (!fxEnabled) return null;
    const positions = EMBER_CONFIGS[heatStage] || (heatStage > 5 ? EMBER_CONFIGS[5] : null);
    if (!positions) return null;
    return positions.map((left, i) => (
      <span
        key={i}
        className="forge-ember"
        style={{ left: `${left}%`, animationDelay: `${(i * 0.4) % 2}s`, ...getEmberStyle(i, theme) }}
      />
    ));
  }, [fxEnabled, heatStage, theme]);

  const sidebarEmbers = useMemo(() => {
    if (!fxEnabled) return null;
    const positions = SIDEBAR_EMBER_CONFIGS[heatStage];
    if (!positions) return null;
    return positions.map(([left, delay], i) => (
      <span
        key={`sb-${i}`}
        className="forge-ember-tall"
        style={{ left: `${left}%`, animationDelay: `${delay}s`, ...getEmberStyle(i, theme) }}
      />
    ));
  }, [fxEnabled, heatStage, theme]);

  useEffect(() => {
    if (!configLoaded || !showWelcomeOnLaunch) return;
    setShowWelcome(true);
  }, [configLoaded, showWelcomeOnLaunch]);

  useEffect(() => {
    setContextMenu(null);
  }, [activeGroupId]);

  return (
    <div className="sidebar">
      <div className={headerClasses} onMouseDown={() => appWindow.startDragging()}>
        {embers ? <div className="forge-ember-layer forge-ember-layer-header">{embers}</div> : null}

        <div className={`sidebar-logo${logoHeatClass}`}>
          <ForgeWordmark fill={logoFill} />
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
                now={now}
                recencyThreshold={recencyThreshold}
                onSelect={() => setActiveGroup(group.id)}
                onDoubleClick={() => startEditing(group.id, group.name)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setActiveGroup(group.id);
                  setContextMenu({
                    groupId: group.id,
                    groupName: group.name,
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
                editingId={editingId}
                inputProps={inputProps}
                onRemove={() => removeGroup(group.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        ref={newProjectBtnRef}
        className="sidebar-add"
        onClick={() => {
          const rect = newProjectBtnRef.current.getBoundingClientRect();
          setNewProjectMenu({ x: rect.right + 6, y: rect.top });
        }}
      >
        + New Project
      </button>
      <div className="sidebar-actions">
        <button
          className={`sidebar-action-btn ${showWelcome ? "sidebar-action-btn-highlighted" : ""}`}
          onClick={openInfo}
          aria-label="Open Forge info"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </button>
        <button
          className={`sidebar-action-btn ${showWelcome ? "sidebar-action-btn-highlighted" : ""}`}
          onClick={openSettings}
          aria-label="Open Forge settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
      {sidebarEmbers ? <div className="forge-ember-layer forge-ember-layer-sidebar">{sidebarEmbers}</div> : null}

      {newProjectMenu && (
        <NewProjectMenu
          x={newProjectMenu.x}
          y={newProjectMenu.y}
          onSelect={(path) => {
            if (path) {
              addGroup(undefined, { rootPath: path });
            } else {
              addGroup();
            }
          }}
          onClose={closeNewProjectMenu}
        />
      )}
      {showWelcome && <WelcomeModal onClose={closeWelcome} />}
      {showInfo && <InfoPanel onClose={closeInfo} />}
      {showSettings && <Settings onClose={closeSettings} onOpenThemeLab={ThemeLab ? () => { setShowSettings(false); setShowThemeLab(true); } : undefined} />}
      {showThemeLab && ThemeLab && (
        <Suspense fallback={null}>
          <ThemeLab onClose={() => setShowThemeLab(false)} />
        </Suspense>
      )}
      {contextMenu && (
        <ProjectContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onRename={() => startEditing(contextMenu.groupId, contextMenu.groupName)}
          onRemove={() => removeGroup(contextMenu.groupId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
