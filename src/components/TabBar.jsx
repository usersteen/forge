import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getCurrentWindow } from "@tauri-apps/api/window";
import useForgeStore from "../store/useForgeStore";
import { commitNewTab } from "../previewLauncher";
import useInlineRename from "../hooks/useInlineRename";
import useFlashAnimation from "../hooks/useFlashAnimation";
import { usePresenceList } from "../hooks/useMotionList";
import useRecencyTick from "../hooks/useRecencyTick";
import useAnimatedSurface from "../hooks/useAnimatedSurface";
import NewTabMenu from "./NewTabMenu";
import ProjectExplorer from "./ProjectExplorer";
import TabContextMenu from "./TabContextMenu";
import ParticleLayer from "./ParticleLayer";
import { getTabRecencyAnchor } from "../utils/tabStatusSummary";


const appWindow = getCurrentWindow();
const IS_MACOS = navigator.platform.startsWith("Mac");
const TAB_EXIT_DURATION_MS = 135;

function CloseIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 2.5L9.5 9.5" />
      <path d="M9.5 2.5L2.5 9.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 2.5v7" />
      <path d="M2.5 6h7" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.5" y="3" width="11" height="10" rx="1" />
      <path d="M5 6h3" />
      <path d="M5 9.5h1.5" />
      <path d="M11 9.5h.5" />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect className="tab-type-fill" x="2.5" y="3.5" width="11" height="8" rx="1" />
      <path className="tab-type-cutout" d="M6.25 13h3.5" />
      <path className="tab-type-cutout" d="M8 11.5V13" />
    </svg>
  );
}

function getUtilityTabMeta(tab) {
  if (tab.type === "server") {
    return { label: "Server tab", className: "tab-type-server", icon: <ServerIcon /> };
  }
  if (tab.type === "preview") {
    return { label: "Design preview tab", className: "tab-type-preview", icon: <PreviewIcon /> };
  }
  return null;
}

function getStatusDotClass(tab, isRecent) {
  if (tab.type === "server") {
    return "status-dot server-running";
  }
  if (tab.type === "preview") {
    return "status-dot preview-running";
  }
  if (tab.status === "waiting") {
    return isRecent ? "status-dot waiting waiting-hot" : "status-dot waiting waiting-cold";
  }
  if (tab.status === "working") return "status-dot working";
  return "status-dot idle";
}

function getTabStateClass(tab, isRecent) {
  if (tab.type === "server") return "tab-server";
  if (tab.type === "preview") return "tab-preview";
  if (tab.status === "waiting") {
    return isRecent ? "tab-waiting tab-waiting-hot" : "tab-waiting tab-waiting-cold";
  }
  if (tab.status === "working") return "tab-working";
  return "";
}

function getProviderBadge(tab) {
  if (tab.type === "server" || tab.type === "preview") return null;
  if (tab.provider === "claude") {
    return { label: "CL", title: "Claude Code terminal" };
  }
  if (tab.provider === "codex") {
    return { label: "CX", title: "Codex terminal" };
  }
  return null;
}

function getTabTooltip(tab, providerBadge) {
  if (tab.type === "preview") return `${tab.name} - Design preview`;
  if (tab.type === "server") return `${tab.name} - Local server`;
  if (!providerBadge) return tab.name;
  return `${tab.name} - ${providerBadge.title}`;
}

function getRenameSeed(tab) {
  if (tab.type === "server" && !tab.manuallyRenamed && tab.suggestedServerName) {
    return tab.suggestedServerName;
  }
  return tab.name;
}

function SortableTab({
  tab,
  isActive,
  isRecent,
  presencePhase,
  onSelect,
  onDoubleClick,
  onContextMenu,
  editingId,
  inputProps,
  onClose,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });
  const { elementRef: tabRef, handleAnimationEnd } = useFlashAnimation(tab.waitingFlashKey);
  const dragTransform = transform
    ? CSS.Transform.toString({ ...transform, y: 0, scaleX: 1, scaleY: 1 })
    : "translate3d(0px, 0px, 0px)";
  const style = {
    transform: `${dragTransform} var(--tab-interaction-transform, translate3d(0px, 0px, 0px)) var(--tab-presence-transform, translate3d(0px, 0px, 0px))`,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const statusClass = getTabStateClass(tab, isRecent);
  const providerBadge = getProviderBadge(tab);
  const showProviderBadge = isActive && providerBadge;
  const utilityMeta = getUtilityTabMeta(tab);

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        tabRef.current = node;
      }}
      style={style}
      {...attributes}
      {...listeners}
      className={`tab ${utilityMeta ? "tab-utility" : ""} ${isActive ? "tab-active" : ""} ${statusClass}`}
      data-presence={presencePhase}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onAnimationEnd={handleAnimationEnd}
      title={getTabTooltip(tab, providerBadge)}
      aria-label={utilityMeta ? `${tab.name} - ${utilityMeta.label}` : tab.name}
    >
      {utilityMeta ? (
        <span className={`tab-type-icon ${utilityMeta.className}`} title={utilityMeta.label}>
          {utilityMeta.icon}
        </span>
      ) : (
        <span className={getStatusDotClass(tab, isRecent)} />
      )}
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
        type="button"
        aria-label={`Close tab ${tab.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <CloseIcon />
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
  const tourActive = useForgeStore((s) => s.tourActive);
  const tourExpandedPanel = useForgeStore((s) => s.tourExpandedPanel);
  const tabRecencyMinutes = useForgeStore((s) => s.tabRecencyMinutes);
  const showcaseActive = useForgeStore((s) => s.showcaseActive);
  const showcaseRepoOpen = useForgeStore((s) => s.showcaseRepoOpen);

  const {
    surface: contextMenu,
    clearSurface: clearContextMenu,
    hideSurface: closeContextMenu,
    showSurface: openContextMenu,
  } = useAnimatedSurface(140);
  const {
    surface: newTabMenu,
    isOpen: isNewTabMenuOpen,
    clearSurface: clearNewTabMenu,
    hideSurface: closeNewTabMenu,
    showSurface: openNewTabMenu,
  } = useAnimatedSurface(145);
  const {
    surface: repoPanel,
    isOpen: isRepoOpen,
    clearSurface: clearRepoPanel,
    hideSurface: closeRepoPanel,
    showSurface: openRepoPanel,
  } = useAnimatedSurface(150);
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
  const renderedTabs = usePresenceList(activeGroup?.tabs ?? [], {
    exitDuration: TAB_EXIT_DURATION_MS,
    resetKey: activeGroupId,
  });
  const hasWaitingTabs = activeGroup?.tabs.some((t) => t.status === "waiting") ?? false;
  const now = useRecencyTick(hasWaitingTabs);
  const recencyThreshold = tabRecencyMinutes * 60000;
  const isTabRecent = (tab) => {
    const anchor = getTabRecencyAnchor(tab);
    return anchor ? now - anchor < recencyThreshold : false;
  };
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
    if (!repoPanel || tourActive) return;

    const handlePointerDown = (event) => {
      if (repoPanelRef.current?.contains(event.target)) return;
      closeRepoPanel();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeRepoPanel();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeRepoPanel, repoPanel, tourActive]);

  useEffect(() => {
    if (!showcaseActive) return;
    if (showcaseRepoOpen) {
      openRepoPanel({});
      return;
    }
    closeRepoPanel();
  }, [closeRepoPanel, openRepoPanel, showcaseActive, showcaseRepoOpen]);

  // Sync tour-driven panel expansion
  useEffect(() => {
    if (!tourActive) {
      clearNewTabMenu();
      clearRepoPanel();
      return;
    }
    if (tourExpandedPanel === "new-tab-menu" && addButtonRef.current) {
      const rect = addButtonRef.current.getBoundingClientRect();
      openNewTabMenu({ x: rect.left, y: rect.bottom + 10 });
    } else {
      clearNewTabMenu();
    }
    if (tourExpandedPanel === "project-explorer") {
      openRepoPanel({});
      return;
    }
    clearRepoPanel();
  }, [clearNewTabMenu, clearRepoPanel, openNewTabMenu, openRepoPanel, tourActive, tourExpandedPanel]);

  useEffect(() => {
    clearContextMenu();
    clearNewTabMenu();
    clearRepoPanel();
  }, [activeGroupId, clearContextMenu, clearNewTabMenu, clearRepoPanel]);

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
      <ParticleLayer location="tabbar" />
      <div className="tab-bar-leading" ref={repoPanelRef}>
        <button
          className={`repo-trigger ${isRepoOpen ? "repo-trigger-active" : ""}`}
          data-tour="repo-trigger"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => {
            if (isRepoOpen) {
              closeRepoPanel();
              return;
            }
            openRepoPanel({});
          }}
        >
          <span className="repo-trigger-label">{repoLabel}</span>
        </button>
        <ProjectExplorer
          open={Boolean(repoPanel)}
          motionState={repoPanel?.motionState ?? "open"}
          onClose={tourActive ? NOOP : closeRepoPanel}
          onRefresh={onRefreshWorkspace}
          tourElevated={tourActive}
        />
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={renderedTabs.map((entry) => entry.key)} strategy={horizontalListSortingStrategy}>
          <div className="tab-list" data-tour="tab-list">
            {renderedTabs.map((entry) => (
              <SortableTab
                key={entry.key}
                tab={entry.item}
                isActive={entry.item.id === activeGroup.activeTabId}
                isRecent={isTabRecent(entry.item)}
                presencePhase={entry.phase}
                onSelect={() => setActiveTab(activeGroupId, entry.item.id)}
                onDoubleClick={() => startEditing(entry.item.id, entry.item.name, getRenameSeed(entry.item))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActiveTab(activeGroupId, entry.item.id);
                  openContextMenu({
                    tabId: entry.item.id,
                    tabName: entry.item.name,
                    renameSeed: getRenameSeed(entry.item),
                    tabType: entry.item.type,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
                editingId={editingId}
                inputProps={inputProps}
                onClose={() => removeTab(activeGroupId, entry.item.id)}
              />
            ))}
            <button
              ref={addButtonRef}
              className="tab-add"
              data-tour="tab-add"
              aria-label="Open new tab menu"
              aria-haspopup="menu"
              aria-expanded={isNewTabMenuOpen}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                const rect = addButtonRef.current?.getBoundingClientRect();
                if (!rect) return;
                if (isNewTabMenuOpen) {
                  closeNewTabMenu();
                  return;
                }
                openNewTabMenu({
                  x: rect.left,
                  y: rect.bottom + 10,
                });
              }}
            >
              <PlusIcon />
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
          motionState={contextMenu.motionState}
          onClose={closeContextMenu}
        />
      )}
      {newTabMenu && (
        <NewTabMenu
          x={newTabMenu.x}
          y={newTabMenu.y}
          rootPath={activeGroup.rootPath}
          serverCommandOverride={activeGroup.serverCommandOverride}
          anchorRef={addButtonRef}
          tourElevated={tourActive}
          motionState={newTabMenu.motionState}
          onSelect={tourActive ? NOOP : (tabOptions) => commitNewTab(activeGroupId, tabOptions)}
          onClose={tourActive ? NOOP : closeNewTabMenu}
        />
      )}
    </div>
  );
}
