import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getCurrentWindow } from "@tauri-apps/api/window";
import useForgeStore from "../store/useForgeStore";
import useInlineRename from "../hooks/useInlineRename";
import useEffectiveHeatStage from "../hooks/useEffectiveHeatStage";
import NewTabMenu from "./NewTabMenu";
import ProjectExplorer from "./ProjectExplorer";
import TabContextMenu from "./TabContextMenu";
import { getEmberStyle } from "../utils/heat";


const appWindow = getCurrentWindow();

const TABBAR_EMBER_CONFIGS = {
  4: [6, 18, 30, 42, 54, 66, 78, 90],
  5: [3, 10, 17, 24, 31, 38, 45, 52, 59, 66, 73, 80, 87, 94],
};

function getStatusDotClass(tab) {
  if (tab.type === "server") {
    return "status-dot server-running";
  }
  if (tab.status === "waiting") return "status-dot waiting";
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

function getRenameSeed(tab) {
  if (tab.type === "server" && !tab.manuallyRenamed && tab.suggestedServerName) {
    return tab.suggestedServerName;
  }
  return tab.name;
}

function SortableTab({ tab, isActive, onSelect, onDoubleClick, onContextMenu, editingId, inputProps, onClose }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const statusClass =
    tab.type === "server" ? "" : tab.status === "waiting" ? "tab-waiting" : tab.status === "working" ? "tab-working" : "";
  const providerBadge = getProviderBadge(tab);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`tab ${isActive ? "tab-active" : ""} ${statusClass}`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <span className={getStatusDotClass(tab)} />
      {providerBadge ? (
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
  const fxEnabled = useForgeStore((s) => s.fxEnabled);

  const [contextMenu, setContextMenu] = useState(null);
  const [newTabMenu, setNewTabMenu] = useState(null);
  const [repoOpen, setRepoOpen] = useState(false);
  const addButtonRef = useRef(null);
  const repoPanelRef = useRef(null);

  const activeGroup = groups.find((g) => g.id === activeGroupId);

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

  const heatStage = useEffectiveHeatStage();

  const tabBarEmbers = useMemo(() => {
    if (!fxEnabled) return null;
    const positions = TABBAR_EMBER_CONFIGS[heatStage];
    if (!positions) return null;
    return positions.map((left, i) => (
      <span
        key={`tb-${i}`}
        className="forge-ember-wide"
        style={{ left: `${left}%`, animationDelay: `${(i * 0.3) % 2}s`, ...getEmberStyle(i, theme) }}
      />
    ));
  }, [fxEnabled, heatStage, theme]);

  const repoLabel = useMemo(() => {
    if (!activeGroup?.rootPath) return "Set Repo Path";
    const segments = activeGroup.rootPath.split("/");
    return segments[segments.length - 1] || activeGroup.rootPath;
  }, [activeGroup?.rootPath]);

  useEffect(() => {
    if (!repoOpen) return;

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
  }, [repoOpen]);

  useEffect(() => {
    setContextMenu(null);
    setNewTabMenu(null);
  }, [activeGroupId]);

  if (!activeGroup) return null;

  return (
    <div
      className="tab-bar"
      onMouseDown={(event) => {
        if (event.target.closest(".tab-bar-leading, .tab, .tab-add, .window-control, button, input")) {
          return;
        }
        appWindow.startDragging();
      }}
    >
      {tabBarEmbers ? <div className="forge-ember-layer forge-ember-layer-tabbar">{tabBarEmbers}</div> : null}
      <div className="tab-bar-leading" ref={repoPanelRef}>
        <button
          className={`repo-trigger ${repoOpen ? "repo-trigger-active" : ""}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setRepoOpen((value) => !value)}
        >
          <span className="repo-trigger-label">{repoLabel}</span>
        </button>
        <ProjectExplorer
          open={repoOpen}
          onClose={() => setRepoOpen(false)}
          onRefresh={onRefreshWorkspace}
        />
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeGroup.tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          <div className="tab-list">
            {activeGroup.tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeGroup.activeTabId}
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
      <div className="window-controls">
        <button className="window-control window-minimize" onClick={() => appWindow.minimize()} aria-label="Minimize">&#x2013;</button>
        <button className="window-control window-maximize" onClick={() => appWindow.toggleMaximize()} aria-label="Maximize">&#x25A1;</button>
        <button className="window-control window-close" onClick={() => appWindow.close()} aria-label="Close">&#x2715;</button>
      </div>
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
          onSelect={(tabOptions) => addTab(activeGroupId, tabOptions)}
          onClose={() => setNewTabMenu(null)}
        />
      )}
    </div>
  );
}
