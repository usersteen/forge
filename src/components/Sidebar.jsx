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
import { getDefaultShowcaseSceneId } from "../demo/showcaseScenes";


const appWindow = getCurrentWindow();

function getTabRecencyAnchor(tab) {
  if (tab.status === "waiting") {
    return tab.lastEngagedAt || tab.waitingSince || null;
  }
  return tab.lastEngagedAt || null;
}

function WorktreeCloseBlockedModal({ groupName, childNames, onClose }) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="worktree-blocked-modal" onClick={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <span>Close Worktrees First</span>
          <button className="settings-close" onClick={onClose} aria-label="Close dialog">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="worktree-blocked-body">
          <p>
            <strong>{groupName}</strong> has nested worktrees, so it cannot be closed until those child worktrees are removed first.
          </p>
          {childNames.length > 0 && (
            <>
              <div className="worktree-blocked-label">Nested worktrees</div>
              <div className="worktree-blocked-list">
                {childNames.map((name) => (
                  <div key={name} className="worktree-blocked-item">{name}</div>
                ))}
              </div>
            </>
          )}
          <button type="button" className="settings-path-save" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

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

function getGroupPriorityClass(group, now, recencyThreshold) {
  const interactiveTabs = group.tabs.filter((t) => t.type !== "server");
  const waitingTabs = interactiveTabs.filter((t) => t.status === "waiting");
  if (waitingTabs.length) {
    const hasRecentWaiting = waitingTabs.some(
      (tab) => {
        const anchor = getTabRecencyAnchor(tab);
        return anchor ? now - anchor < recencyThreshold : false;
      }
    );
    return hasRecentWaiting ? "sidebar-group-waiting sidebar-group-waiting-hot" : "sidebar-group-waiting sidebar-group-waiting-cold";
  }
  const hasWorking = interactiveTabs.some((t) => t.status === "working");
  if (hasWorking) return "sidebar-group-working";
  return "";
}

function getVisibleSidebarTabs(tabs, limit = 4) {
  return {
    visibleTabs: tabs.slice(0, limit),
    overflowCount: Math.max(0, tabs.length - limit),
  };
}

function SortableGroup({
  group,
  isActive,
  now,
  recencyThreshold,
  projectMenuDetail,
  onSelect,
  onSelectTab,
  onDoubleClick,
  onContextMenu,
  editingId,
  inputProps,
  onRemove,
  branchName,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const { elementRef: groupRef, handleAnimationEnd } = useFlashAnimation(group.waitingFlashKey);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const { visibleTabs, overflowCount } = getVisibleSidebarTabs(group.tabs);
  const isDetailed = projectMenuDetail === "detailed";

  return (
    <div
      ref={(node) => { setNodeRef(node); groupRef.current = node; }}
      style={style}
      className={`sidebar-group ${isDetailed ? "sidebar-group-detailed" : ""} ${isActive ? "sidebar-group-active" : ""} ${getGroupPriorityClass(group, now, recencyThreshold)}`}
      onAnimationEnd={handleAnimationEnd}
    >
      <div
        className="sidebar-group-main"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
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
            {isDetailed ? (
              <div className="sidebar-tab-list" aria-label={`${group.name} tabs`}>
                {visibleTabs.map((tab) => {
                  const anchor = getTabRecencyAnchor(tab);
                  const isRecent = anchor ? now - anchor < recencyThreshold : false;
                  const isActiveTab = tab.id === group.activeTabId;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`sidebar-tab-row${isActiveTab ? " sidebar-tab-row-active" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectTab(tab.id);
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      title={tab.name}
                    >
                      <span
                        className={`sidebar-dot sidebar-tab-dot ${getSidebarDotClass(tab, isRecent)}`}
                        aria-hidden="true"
                      />
                      <span className="sidebar-tab-label">{tab.name}</span>
                    </button>
                  );
                })}
                {overflowCount > 0 && <div className="sidebar-tab-overflow">+{overflowCount} more</div>}
              </div>
            ) : (
              <div className="sidebar-group-dots">
                {group.tabs.map((tab) => (
                  <span
                    key={tab.id}
                    className={`sidebar-dot ${getSidebarDotClass(tab, (() => {
                      const anchor = getTabRecencyAnchor(tab);
                      return anchor ? now - anchor < recencyThreshold : false;
                    })())}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
        </div>
      </div>
      <button
        type="button"
        className="sidebar-group-close"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
        aria-label={`Close project ${group.name}`}
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
  const setActiveTab = useForgeStore((s) => s.setActiveTab);
  const theme = useForgeStore((s) => s.theme);
  const fxEnabled = useForgeStore((s) => s.fxEnabled);
  const configLoaded = useForgeStore((s) => s.configLoaded);
  const showWelcomeOnLaunch = useForgeStore((s) => s.showWelcomeOnLaunch);
  const tabRecencyMinutes = useForgeStore((s) => s.tabRecencyMinutes);
  const projectMenuDetail = useForgeStore((s) => s.projectMenuDetail);
  const setDemoHeatStage = useForgeStore((s) => s.setDemoHeatStage);
  const showcaseActive = useForgeStore((s) => s.showcaseActive);
  const startShowcaseScene = useForgeStore((s) => s.startShowcaseScene);
  const exitShowcase = useForgeStore((s) => s.exitShowcase);

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
  const [blockedCloseGroup, setBlockedCloseGroup] = useState(null);
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

  const openBlockedCloseModal = useCallback((groupId) => {
    const group = groups.find((entry) => entry.id === groupId);
    if (!group) return;
    const childNames = groups
      .filter((entry) => entry.worktreeParentId === groupId)
      .map((entry) => entry.name);
    setBlockedCloseGroup({ groupName: group.name, childNames });
  }, [groups]);

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
                  projectMenuDetail={projectMenuDetail}
                  onSelect={() => setActiveGroup(group.id)}
                  onSelectTab={(tabId) => {
                    setActiveGroup(group.id);
                    setActiveTab(group.id, tabId);
                  }}
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
                  onRemove={() => {
                    if (hasWorktreeChildren(group.id)) {
                      openBlockedCloseModal(group.id);
                      return;
                    }
                    removeGroup(group.id);
                  }}
                />
              );

              if (item.type === "cluster") {
                return (
                  <div key={item.parent.id} className="sidebar-worktree-cluster">
                    {renderGroup(item.parent, item.parent.gitBranch)}
                    <div className="sidebar-worktree-children">
                      {item.children.map((child) => (
                        <div key={child.id} className="sidebar-worktree-child">
                          {renderGroup(child, child.gitBranch)}
                        </div>
                      ))}
                    </div>
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
                aria-label="Heat Block Lab"
                title="Heat Block Lab"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                </svg>
              </button>
            )}
            <button
              className={`sidebar-action-btn${showcaseActive ? " sidebar-action-btn-active" : ""}`}
              onClick={() => {
                if (showcaseActive) {
                  exitShowcase();
                } else {
                  startShowcaseScene(getDefaultShowcaseSceneId(), { studioVisible: true, cleanMode: false });
                }
              }}
              aria-label={showcaseActive ? "Exit Showcase" : "Open Showcase"}
              title={showcaseActive ? "Exit Showcase" : "Open Showcase"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="14" rx="1"/>
                <path d="M7 20h10"/>
                <path d="M8 8h8"/>
                <path d="M8 12h5"/>
              </svg>
            </button>
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
              openBlockedCloseModal(contextMenu.groupId);
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
      {blockedCloseGroup && (
        <WorktreeCloseBlockedModal
          groupName={blockedCloseGroup.groupName}
          childNames={blockedCloseGroup.childNames}
          onClose={() => setBlockedCloseGroup(null)}
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
