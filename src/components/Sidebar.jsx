import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getCurrentWindow } from "@tauri-apps/api/window";
import useForgeStore, { hasWorktreeChildren, removeWorktreeGroup } from "../store/useForgeStore";
import AddWorktreeDialog from "./AddWorktreeDialog";
import useInlineRename from "../hooks/useInlineRename";
import useEffectiveHeatStage from "../hooks/useEffectiveHeatStage";
import useFlashAnimation from "../hooks/useFlashAnimation";
import ParticleLayer from "./ParticleLayer";
import useRecencyTick from "../hooks/useRecencyTick";
import { getThemeHeatColor } from "../utils/themes";
import ForgeWordmark from "./ForgeWordmark";
import ProjectContextMenu from "./ProjectContextMenu";
import Settings from "./Settings";
import InfoPanel from "./InfoPanel";
const ThemeLab = import.meta.env.DEV ? lazy(() => import("./ThemeLab")) : null;
import NewProjectMenu from "./NewProjectMenu";
import WelcomeModal from "./WelcomeModal";
import GuidedTour from "./GuidedTour";


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

function computeSidebarItems(groups) {
  const childrenByParent = new Map();
  const childIds = new Set();
  for (const g of groups) {
    if (g.worktreeParentId) {
      childIds.add(g.id);
      if (!childrenByParent.has(g.worktreeParentId)) childrenByParent.set(g.worktreeParentId, []);
      childrenByParent.get(g.worktreeParentId).push(g);
    }
  }

  const items = [];
  for (const g of groups) {
    if (childIds.has(g.id)) continue;
    const children = childrenByParent.get(g.id);
    if (children?.length) {
      items.push({ type: "cluster", parent: g, children });
    } else {
      items.push({ type: "standalone", group: g });
    }
  }
  return items;
}

function getGroupPriorityClass(group) {
  const interactiveTabs = group.tabs.filter((t) => t.type !== "server");
  const hasWaiting = interactiveTabs.some((t) => t.status === "waiting");
  if (hasWaiting) return "sidebar-group-waiting";
  const hasWorking = interactiveTabs.some((t) => t.status === "working");
  if (hasWorking) return "sidebar-group-working";
  return "";
}

function SortableGroup({ group, isActive, now, recencyThreshold, onSelect, onDoubleClick, onContextMenu, editingId, inputProps, onRemove, branchName }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const { elementRef: groupRef, handleAnimationEnd } = useFlashAnimation(group.waitingFlashKey);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={(node) => { setNodeRef(node); groupRef.current = node; }}
      style={style}
      {...attributes}
      {...listeners}
      className={`sidebar-group ${isActive ? "sidebar-group-active" : ""} ${getGroupPriorityClass(group)}`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="sidebar-group-info">
        {editingId === group.id ? (
          <input className="sidebar-rename-input" {...inputProps} />
        ) : (
          <>
            <div className="sidebar-group-title-row">
              <span className="sidebar-group-name">{group.name}</span>
            </div>
            {branchName && <div className="sidebar-branch-label">{branchName}</div>}
          </>
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
  const setDemoHeatStage = useForgeStore((s) => s.setDemoHeatStage);

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
  const [settingsExiting, setSettingsExiting] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [infoExiting, setInfoExiting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showThemeLab, setShowThemeLab] = useState(false);
  const tourActive = useForgeStore((s) => s.tourActive);
  const tourExpandedPanel = useForgeStore((s) => s.tourExpandedPanel);
  const storeTourStart = useForgeStore((s) => s.startTour);
  const storeTourEnd = useForgeStore((s) => s.endTour);
  const [contextMenu, setContextMenu] = useState(null);
  const [worktreeDialog, setWorktreeDialog] = useState(null);
  const [newProjectMenu, setNewProjectMenu] = useState(null);
  const newProjectBtnRef = useRef(null);
  const closeInfo = useCallback(() => setInfoExiting(true), []);
  const closeSettings = useCallback(() => setSettingsExiting(true), []);
  const onInfoExited = useCallback(() => { setInfoExiting(false); setShowInfo(false); }, []);
  const onSettingsExited = useCallback(() => { setSettingsExiting(false); setShowSettings(false); }, []);
  const openInfo = useCallback(() => setShowInfo(true), []);
  const openSettings = useCallback(() => setShowSettings(true), []);
  const closeWelcome = useCallback(() => setShowWelcome(false), []);
  const closeNewProjectMenu = useCallback(() => setNewProjectMenu(null), []);
  const startTour = useCallback(() => {
    setShowWelcome(false);
    setShowInfo(false);
    setShowSettings(false);
    setShowThemeLab(false);
    storeTourStart();
  }, [storeTourStart]);
  const closeTour = useCallback(() => storeTourEnd(), [storeTourEnd]);

  const heatStage = useEffectiveHeatStage();
  const logoFill = getThemeHeatColor(theme, heatStage);
  const logoHeatClass = heatStage > 0 ? ` sidebar-logo-heat-${heatStage}` : "";

  const headerClasses = [
    "sidebar-header",
    heatStage > 0 && `forge-heat-${heatStage}`,
  ].filter(Boolean).join(" ");


  useEffect(() => {
    if (!configLoaded) return;
    if (import.meta.env.DEV || showWelcomeOnLaunch) setShowWelcome(true);
  }, [configLoaded, showWelcomeOnLaunch]);

  // Sync tour-driven panel expansion
  useEffect(() => {
    if (!tourActive) {
      setShowSettings(false);
      setShowInfo(false);
      setNewProjectMenu(null);
      return;
    }
    setShowSettings(tourExpandedPanel === "settings");
    setShowInfo(tourExpandedPanel === "info");
    if (tourExpandedPanel === "new-project-menu" && newProjectBtnRef.current) {
      const rect = newProjectBtnRef.current.getBoundingClientRect();
      setNewProjectMenu({ x: rect.right + 6, y: rect.top });
    } else {
      setNewProjectMenu(null);
    }
  }, [tourActive, tourExpandedPanel]);

  useEffect(() => {
    setContextMenu(null);
  }, [activeGroupId]);

  const NOOP = useCallback(() => {}, []);

  return (
    <div className="sidebar" data-tour="sidebar">
      <div className={headerClasses} data-tour="sidebar-header" onMouseDown={() => appWindow.startDragging()}>
        <ParticleLayer location="header" />

        <div className={`sidebar-logo${logoHeatClass}`}>
          <ForgeWordmark fill={logoFill} />
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          <div className="sidebar-groups" data-tour="sidebar-groups">
            {computeSidebarItems(groups).map((item) => {
              const renderGroup = (group, branchName) => (
                <SortableGroup
                  key={group.id}
                  group={group}
                  isActive={group.id === activeGroupId}
                  now={now}
                  recencyThreshold={recencyThreshold}
                  branchName={branchName}
                  onSelect={() => setActiveGroup(group.id)}
                  onDoubleClick={() => startEditing(group.id, group.name)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setActiveGroup(group.id);
                    setContextMenu({
                      groupId: group.id,
                      groupName: group.name,
                      gitBranch: group.gitBranch,
                      worktreeParentId: group.worktreeParentId,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                  editingId={editingId}
                  inputProps={inputProps}
                  onRemove={() => removeGroup(group.id)}
                />
              );

              if (item.type === "cluster") {
                return (
                  <div key={item.parent.id} className="sidebar-worktree-cluster">
                    {renderGroup(item.parent, item.parent.gitBranch)}
                    {item.children.map((child) => (
                      <div key={child.id} className="sidebar-worktree-child">
                        {renderGroup(child, child.gitBranch)}
                      </div>
                    ))}
                  </div>
                );
              }
              return renderGroup(item.group, null);
            })}
          </div>
        </SortableContext>
      </DndContext>
      <button
        ref={newProjectBtnRef}
        className="sidebar-add"
        data-tour="new-project"
        onClick={() => {
          const rect = newProjectBtnRef.current.getBoundingClientRect();
          setNewProjectMenu({ x: rect.right + 6, y: rect.top });
        }}
      >
        + New Project
      </button>
      <div className="sidebar-actions">
        <button
          className="sidebar-action-btn"
          onClick={openInfo}
          aria-label="Open Forge info"
          data-tour="info-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </button>
        <button
          className="sidebar-action-btn"
          onClick={openSettings}
          aria-label="Open Forge settings"
          data-tour="settings-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        {import.meta.env.DEV && (
          <>
            <button
              className="sidebar-action-btn"
              onClick={() => setDemoHeatStage(0)}
              aria-label="Demo Mode"
              title="Demo Mode"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </button>
            {ThemeLab && (
              <button
                className="sidebar-action-btn"
                onClick={() => setShowThemeLab(true)}
                aria-label="Theme Lab"
                title="Theme Lab"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                </svg>
              </button>
            )}
          </>
        )}
      </div>
      <ParticleLayer location="sidebar" />

      {newProjectMenu && (
        <NewProjectMenu
          x={newProjectMenu.x}
          y={newProjectMenu.y}
          tourElevated={tourActive}
          onSelect={tourActive ? NOOP : (path) => {
            if (path) {
              addGroup(undefined, { rootPath: path });
            } else {
              addGroup();
            }
          }}
          onClose={tourActive ? NOOP : closeNewProjectMenu}
        />
      )}
      {showWelcome && <WelcomeModal onClose={closeWelcome} onStartTour={startTour} />}
      {showInfo && (
        <div className={tourActive ? "tour-elevated-panel" : ""}>
          <InfoPanel onClose={tourActive ? NOOP : closeInfo} onExited={onInfoExited} exiting={infoExiting} onStartTour={tourActive ? undefined : startTour} />
        </div>
      )}
      {tourActive && <GuidedTour onClose={closeTour} />}
      {showSettings && (
        <div className={tourActive ? "tour-elevated-panel" : ""}>
          <Settings onClose={tourActive ? NOOP : closeSettings} onExited={onSettingsExited} exiting={settingsExiting} />
        </div>
      )}
      {showThemeLab && ThemeLab && (
        <Suspense fallback={null}>
          <ThemeLab onClose={() => setShowThemeLab(false)} />
        </Suspense>
      )}
      {contextMenu && (
        <ProjectContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isGitRepo={!!contextMenu.gitBranch && !contextMenu.worktreeParentId}
          isWorktree={!!contextMenu.worktreeParentId}
          onRename={() => startEditing(contextMenu.groupId, contextMenu.groupName)}
          onRemove={() => {
            if (hasWorktreeChildren(contextMenu.groupId)) {
              alert("Close worktree branches first.");
            } else {
              removeGroup(contextMenu.groupId);
            }
          }}
          onAddWorktree={() => {
            const group = groups.find((g) => g.id === contextMenu.groupId);
            if (group) setWorktreeDialog({ groupId: group.id, rootPath: group.rootPath, x: contextMenu.x, y: contextMenu.y });
          }}
          onRemoveWorktree={() => {
            removeWorktreeGroup(contextMenu.groupId).catch((err) => alert(err));
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
      {worktreeDialog && (
        <AddWorktreeDialog
          x={worktreeDialog.x}
          y={worktreeDialog.y}
          groupId={worktreeDialog.groupId}
          rootPath={worktreeDialog.rootPath}
          onClose={() => setWorktreeDialog(null)}
        />
      )}
    </div>
  );
}
