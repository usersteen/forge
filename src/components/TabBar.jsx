import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getCurrentWindow } from "@tauri-apps/api/window";
import useForgeStore from "../store/useForgeStore";
import useInlineRename from "../hooks/useInlineRename";
import useFlashAnimation from "../hooks/useFlashAnimation";
import useRecencyTick from "../hooks/useRecencyTick";
import NewTabMenu from "./NewTabMenu";
import ProjectExplorer from "./ProjectExplorer";
import TabContextMenu from "./TabContextMenu";
import ParticleCanvas from "./ParticleCanvas";


const appWindow = getCurrentWindow();
const IS_MACOS = navigator.platform.startsWith("Mac");


function getStatusDotClass(tab, isRecent) {
  if (tab.type === "server") {
    return "status-dot server-running";
  }
  if (tab.status === "waiting") {
    return isRecent ? "status-dot waiting waiting-hot" : "status-dot waiting waiting-cold";
  }
  if (tab.status === "working") return "status-dot working";
  return "status-dot idle";
}

function getProviderBadge(tab) {
  if (tab.type === "server") return null;
  if (tab.provider === "claude") {
    return { label: "CL", title: "Claude Code terminal" };
  }
  if (tab.provider === "codex") {
    return { label: "CX", title: "Codex terminal" };
  }
  return null;
}

function getTabTooltip(tab, providerBadge) {
  if (!providerBadge) return tab.name;
  return `${tab.name} - ${providerBadge.title}`;
}

function getRenameSeed(tab) {
  if (tab.type === "server" && !tab.manuallyRenamed && tab.suggestedServerName) {
    return tab.suggestedServerName;
  }
  return tab.name;
}

function SortableTab({ tab, isActive, isRecent, onSelect, onDoubleClick, onContextMenu, editingId, inputProps, onClose }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });
  const { elementRef: tabRef, handleAnimationEnd } = useFlashAnimation(tab.waitingFlashKey);
  const style = {
    transform: transform ? CSS.Transform.toString({ ...transform, y: 0, scaleX: 1, scaleY: 1 }) : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const statusClass =
    tab.type === "server" ? "" : tab.status === "waiting" ? "tab-waiting" : tab.status === "working" ? "tab-working" : "";
  const providerBadge = getProviderBadge(tab);
  const showProviderBadge = isActive && providerBadge;

  return (
    <div
      ref={(node) => { setNodeRef(node); tabRef.current = node; }}
      style={style}
      {...attributes}
      {...listeners}
      className={`tab ${isActive ? "tab-active" : ""} ${statusClass}`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onAnimationEnd={handleAnimationEnd}
      title={getTabTooltip(tab, providerBadge)}
    >
      <span className={getStatusDotClass(tab, isRecent)} />
      {showProviderBadge ? (
        <span className={`tab-provider-badge tab-provider-${tab.provider}`} title={providerBadge.title}>
          {providerBadge.label}
        </span>
      ) : null}
      {editingId === tab.id ? (
        <input className="tab-rename-input" {...inputProps} />
      ) : (
        <span className="tab-name">{tab.name}</span>
      )}
      <button
        className="tab-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        x
      </button>
    </div>
  );
}

export default function TabBar({ onRefreshWorkspace }) {
  const groups = useForgeStore((s) => s.groups);
  const activeGroupId = useForgeStore((s) => s.activeGroupId);
  const setActiveTab = useForgeStore((s) => s.setActiveTab);
  const addTab = useForgeStore((s) => s.addTab);
  const removeTab = useForgeStore((s) => s.removeTab);
  const renameTab = useForgeStore((s) => s.renameTab);
  const reorderTabs = useForgeStore((s) => s.reorderTabs);
  const updateTabTerminal = useForgeStore((s) => s.updateTabTerminal);
  const theme = useForgeStore((s) => s.theme);
  const tourActive = useForgeStore((s) => s.tourActive);
  const tourExpandedPanel = useForgeStore((s) => s.tourExpandedPanel);
  const tabRecencyMinutes = useForgeStore((s) => s.tabRecencyMinutes);

  const [contextMenu, setContextMenu] = useState(null);
  const [newTabMenu, setNewTabMenu] = useState(null);
  const [repoOpen, setRepoOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const addButtonRef = useRef(null);
  const repoPanelRef = useRef(null);

  // Sync fullscreen state with OS (e.g. user clicks macOS green button)
  useEffect(() => {
    if (!IS_MACOS) return;
    const unlisten = appWindow.onResized(() => {
      appWindow.isFullscreen().then(setIsFullscreen);
    });
    return () => unlisten.then((f) => f());
  }, []);

  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const hasWaitingTabs = activeGroup?.tabs.some((t) => t.status === "waiting") ?? false;
  const now = useRecencyTick(hasWaitingTabs);
  const recencyThreshold = tabRecencyMinutes * 60000;
  const isTabRecent = (tab) => tab.lastEngagedAt && now - tab.lastEngagedAt < recencyThreshold;

  const onCommit = useCallback(
    (id, name) => renameTab(activeGroupId, id, name),
    [renameTab, activeGroupId]
  );
  const { editingId, startEditing, inputProps } = useInlineRename(onCommit);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !activeGroup) return;
    const ids = activeGroup.tabs.map((t) => t.id);
    const oldIdx = ids.indexOf(active.id);
    const newIdx = ids.indexOf(over.id);
    const newIds = [...ids];
    newIds.splice(oldIdx, 1);
    newIds.splice(newIdx, 0, active.id);
    reorderTabs(activeGroupId, newIds);
  };

  const repoLabel = useMemo(() => {
    if (!activeGroup?.rootPath) return "Set Repo Path";
    const segments = activeGroup.rootPath.split("/");
    return segments[segments.length - 1] || activeGroup.rootPath;
  }, [activeGroup?.rootPath]);

  useEffect(() => {
    if (!repoOpen || tourActive) return;

    const handlePointerDown = (event) => {
      if (repoPanelRef.current?.contains(event.target)) return;
      setRepoOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setRepoOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [repoOpen, tourActive]);

  // Sync tour-driven panel expansion
  useEffect(() => {
    if (!tourActive) {
      setNewTabMenu(null);
      setRepoOpen(false);
      return;
    }
    if (tourExpandedPanel === "new-tab-menu" && addButtonRef.current) {
      const rect = addButtonRef.current.getBoundingClientRect();
      setNewTabMenu({ x: rect.left, y: rect.bottom + 6 });
    } else {
      setNewTabMenu(null);
    }
    setRepoOpen(tourExpandedPanel === "project-explorer");
  }, [tourActive, tourExpandedPanel]);

  useEffect(() => {
    setContextMenu(null);
    setNewTabMenu(null);
  }, [activeGroupId]);

  const NOOP = useCallback(() => {}, []);

  if (!activeGroup) return null;

  return (
    <div
      className="tab-bar"
      data-tour="tab-bar"
      onMouseDown={(event) => {
        if (event.target.closest(".tab-bar-leading, .tab, .tab-add, .window-control, button, input")) {
          return;
        }
        appWindow.startDragging();
      }}
    >
      <ParticleCanvas location="tabbar" />
      <div className="tab-bar-leading" ref={repoPanelRef}>
        <button
          className={`repo-trigger ${repoOpen ? "repo-trigger-active" : ""}`}
          data-tour="repo-trigger"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setRepoOpen((value) => !value)}
        >
          <span className="repo-trigger-label">{repoLabel}</span>
        </button>
        <ProjectExplorer
          open={repoOpen}
          onClose={tourActive ? NOOP : () => setRepoOpen(false)}
          onRefresh={onRefreshWorkspace}
          tourElevated={tourActive}
        />
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeGroup.tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          <div className="tab-list" data-tour="tab-list">
            {activeGroup.tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeGroup.activeTabId}
                isRecent={isTabRecent(tab)}
                onSelect={() => setActiveTab(activeGroupId, tab.id)}
                onDoubleClick={() => startEditing(tab.id, tab.name, getRenameSeed(tab))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActiveTab(activeGroupId, tab.id);
                  setContextMenu({
                    tabId: tab.id,
                    tabName: tab.name,
                    renameSeed: getRenameSeed(tab),
                    tabType: tab.type,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
                editingId={editingId}
                inputProps={inputProps}
                onClose={() => removeTab(activeGroupId, tab.id)}
              />
            ))}
            <button
              ref={addButtonRef}
              className="tab-add"
              data-tour="tab-add"
              aria-label="Open new tab menu"
              aria-haspopup="menu"
              aria-expanded={Boolean(newTabMenu)}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                const rect = addButtonRef.current?.getBoundingClientRect();
                if (!rect) return;
                setNewTabMenu((current) =>
                  current
                    ? null
                    : {
                        x: rect.left,
                        y: rect.bottom + 6,
                      }
                );
              }}
            >
              +
            </button>
          </div>
        </SortableContext>
      </DndContext>
      {/* macOS windowed: native title bar handles controls; show inline only in fullscreen.
           Windows: always show inline controls (no native title bar). */}
      {(!IS_MACOS || isFullscreen) && (
        <div className="window-controls">
          {!IS_MACOS && (
            <>
              <button className="window-control window-minimize" onClick={() => appWindow.minimize()} aria-label="Minimize">&#x2013;</button>
              <button className="window-control window-maximize" onClick={() => appWindow.toggleMaximize()} aria-label="Maximize">&#x25A1;</button>
            </>
          )}
          {IS_MACOS && isFullscreen && (
            <button
              className="window-control window-fullscreen"
              onClick={async () => {
                await appWindow.setFullscreen(false);
                setIsFullscreen(false);
              }}
              aria-label="Exit Fullscreen"
              title="Exit Fullscreen"
            >
              {"\u29C9"}
            </button>
          )}
          <button className="window-control window-close" onClick={() => appWindow.close()} aria-label="Close">&#x2715;</button>
        </div>
      )}
      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tabType={contextMenu.tabType}
          onRename={() => startEditing(contextMenu.tabId, contextMenu.tabName, contextMenu.renameSeed)}
          onUpdateTab={(updates) => updateTabTerminal(contextMenu.tabId, updates)}
          onCloseTab={() => removeTab(activeGroupId, contextMenu.tabId)}
          onClose={() => setContextMenu(null)}
        />
      )}
      {newTabMenu && (
        <NewTabMenu
          x={newTabMenu.x}
          y={newTabMenu.y}
          rootPath={activeGroup.rootPath}
          tourElevated={tourActive}
          onSelect={tourActive ? NOOP : (tabOptions) => addTab(activeGroupId, tabOptions)}
          onClose={tourActive ? NOOP : () => setNewTabMenu(null)}
        />
      )}
    </div>
  );
}
