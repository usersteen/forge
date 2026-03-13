import { create } from "zustand";
import { clampHeatStreak } from "../utils/heat";
import {
  classifyWorkspacePath,
  makeRuntimeWorkspaceState,
  normalizeRelativePath,
  normalizeReaderWidth,
  normalizeRootPath,
  normalizeSurface,
  titleFromPath,
  withWorkspaceDefaults,
} from "../utils/workspace";

function makeTab(name = "Terminal 1", cwd = null) {
  return {
    id: crypto.randomUUID(),
    name,
    cwd,
    status: "idle",
    statusTitle: "",
    type: "claude",
    manuallyRenamed: false,
    waitingSince: null,
  };
}

function makeGroup(name = "Project 1") {
  const tab = makeTab();
  return {
    id: crypto.randomUUID(),
    name,
    tabs: [tab],
    activeTabId: tab.id,
    rootPath: null,
    explorerVisible: true,
    inspectorVisible: true,
    selectedPath: null,
    openDocuments: [],
    activeDocumentPath: null,
    activeSurface: "terminal",
    readerWidth: 0.4,
    lastIndexedAt: null,
  };
}

function ensureActiveTabId(tabs, activeTabId) {
  if (tabs.some((tab) => tab.id === activeTabId)) {
    return activeTabId;
  }
  return tabs[0]?.id ?? null;
}

function mapGroups(groups, groupId, updater) {
  return groups.map((group) => (group.id === groupId ? updater(group) : group));
}

function mapObjectEntry(source, key, updater) {
  return {
    ...source,
    [key]: updater(source[key]),
  };
}

function normalizeFavoriteRepoPaths(paths) {
  const seen = new Set();
  const normalized = [];

  for (const path of Array.isArray(paths) ? paths : []) {
    const value = normalizeRootPath(path);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

const useForgeStore = create((set, get) => ({
  groups: [],
  activeGroupId: null,
  configLoaded: false,
  favoriteRepoPaths: [],

  workspaceByGroup: {},
  documentStateByGroup: {},

  // Heat / streak state
  streak: 0,
  lastStreakTime: null,
  streakTimer: 10000,
  cooldownTimer: 30000,

  // Demo mode (ephemeral, not persisted)
  demoHeatStage: null,

  initFresh: () => {
    const group = makeGroup();
    set({
      groups: [group],
      activeGroupId: group.id,
      workspaceByGroup: { [group.id]: makeRuntimeWorkspaceState() },
      documentStateByGroup: { [group.id]: {} },
      favoriteRepoPaths: [],
      configLoaded: true,
    });
  },

  loadFromConfig: (config) => {
    const groups = (config.groups || []).map((groupConfig) => {
      const workspace = withWorkspaceDefaults(groupConfig);
      const tabs = (groupConfig.tabs || []).map((tabConfig) => ({
        id: tabConfig.id,
        name: tabConfig.name,
        cwd: tabConfig.cwd || null,
        status: "idle",
        statusTitle: "",
        type: tabConfig.tab_type || "claude",
        manuallyRenamed: tabConfig.manually_renamed || false,
        waitingSince: null,
      }));
      const safeTabs = tabs.length > 0 ? tabs : [makeTab()];

      return {
        id: groupConfig.id,
        name: groupConfig.name,
        activeTabId: ensureActiveTabId(safeTabs, groupConfig.active_tab_id),
        tabs: safeTabs,
        ...workspace,
      };
    });

    const safeGroups = groups.length > 0 ? groups : [makeGroup()];
    const workspaceByGroup = Object.fromEntries(
      safeGroups.map((group) => [group.id, makeRuntimeWorkspaceState(group.rootPath)])
    );
    const documentStateByGroup = Object.fromEntries(safeGroups.map((group) => [group.id, {}]));

    set({
      groups: safeGroups,
      activeGroupId:
        safeGroups.some((group) => group.id === config.active_group_id)
          ? config.active_group_id
          : (safeGroups[0]?.id ?? null),
      workspaceByGroup,
      documentStateByGroup,
      favoriteRepoPaths: normalizeFavoriteRepoPaths(config.settings?.favorite_repo_paths),
      streakTimer: config.settings?.streak_timer ?? 10000,
      cooldownTimer: config.settings?.cooldown_timer ?? 30000,
      configLoaded: true,
    });
  },

  addGroup: (name) => {
    const count = get().groups.length;
    const group = makeGroup(name || `Project ${count + 1}`);
    set((state) => ({
      groups: [...state.groups, group],
      activeGroupId: group.id,
      workspaceByGroup: { ...state.workspaceByGroup, [group.id]: makeRuntimeWorkspaceState() },
      documentStateByGroup: { ...state.documentStateByGroup, [group.id]: {} },
    }));
  },

  removeGroup: (groupId) =>
    set((state) => {
      const remaining = state.groups.filter((group) => group.id !== groupId);
      if (remaining.length === 0) {
        const group = makeGroup();
        return {
          groups: [group],
          activeGroupId: group.id,
          workspaceByGroup: { [group.id]: makeRuntimeWorkspaceState() },
          documentStateByGroup: { [group.id]: {} },
        };
      }

      const nextActiveGroupId =
        state.activeGroupId === groupId ? remaining[0].id : state.activeGroupId;
      const { [groupId]: _removedWorkspace, ...workspaceByGroup } = state.workspaceByGroup;
      const { [groupId]: _removedDocuments, ...documentStateByGroup } = state.documentStateByGroup;

      return {
        groups: remaining,
        activeGroupId: nextActiveGroupId,
        workspaceByGroup,
        documentStateByGroup,
      };
    }),

  renameGroup: (groupId, name) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => ({ ...group, name })),
    })),

  setActiveGroup: (groupId) => set({ activeGroupId: groupId }),

  addTab: (groupId, name) =>
    set((state) => {
      const group = state.groups.find((entry) => entry.id === groupId);
      const tabName = name || `Terminal ${group ? group.tabs.length + 1 : 1}`;
      const tab = makeTab(tabName, group?.rootPath ?? null);
      return {
        groups: mapGroups(state.groups, groupId, (entry) => ({
          ...entry,
          tabs: [...entry.tabs, tab],
          activeTabId: tab.id,
        })),
      };
    }),

  removeTab: (groupId, tabId) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => {
        const remaining = group.tabs.filter((tab) => tab.id !== tabId);
        if (remaining.length === 0) {
          const newTab = makeTab("Terminal 1", group.rootPath ?? null);
          return { ...group, tabs: [newTab], activeTabId: newTab.id };
        }
        const activeTabId = group.activeTabId === tabId ? remaining[0].id : group.activeTabId;
        return { ...group, tabs: remaining, activeTabId };
      }),
    })),

  renameTab: (groupId, tabId, name) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => ({
        ...group,
        tabs: group.tabs.map((tab) =>
          tab.id === tabId ? { ...tab, name, manuallyRenamed: true } : tab
        ),
      })),
    })),

  setActiveTab: (groupId, tabId) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => ({ ...group, activeTabId: tabId })),
    })),

  setTabCwd: (tabId, cwd) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.tabs.some((tab) => tab.id === tabId)
          ? {
              ...group,
              tabs: group.tabs.map((tab) => (tab.id === tabId ? { ...tab, cwd } : tab)),
            }
          : group
      ),
    })),

  setTabStatus: (tabId, status, title) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.tabs.some((tab) => tab.id === tabId)
          ? {
              ...group,
              tabs: group.tabs.map((tab) => {
                if (tab.id !== tabId) return tab;
                const waitingSince = status === "waiting" ? (tab.waitingSince ?? Date.now()) : null;
                return { ...tab, status, statusTitle: title, waitingSince };
              }),
            }
          : group
      ),
    })),

  setTabAutoName: (tabId, name) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.tabs.some((tab) => tab.id === tabId)
          ? {
              ...group,
              tabs: group.tabs.map((tab) =>
                tab.id === tabId && !tab.manuallyRenamed ? { ...tab, name } : tab
              ),
            }
          : group
      ),
    })),

  setTabType: (tabId, type) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.tabs.some((tab) => tab.id === tabId)
          ? {
              ...group,
              tabs: group.tabs.map((tab) => (tab.id === tabId ? { ...tab, type } : tab)),
            }
          : group
      ),
    })),

  reorderTabs: (groupId, orderedTabIds) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => {
        const tabMap = new Map(group.tabs.map((tab) => [tab.id, tab]));
        const reordered = orderedTabIds.map((id) => tabMap.get(id)).filter(Boolean);
        return { ...group, tabs: reordered };
      }),
    })),

  reorderGroups: (orderedGroupIds) =>
    set((state) => {
      const groupMap = new Map(state.groups.map((group) => [group.id, group]));
      return {
        groups: orderedGroupIds.map((id) => groupMap.get(id)).filter(Boolean),
      };
    }),

  setGroupRootPath: (groupId, rootPath) =>
    set((state) => {
      const normalizedRootPath = normalizeRootPath(rootPath);
      return {
        groups: mapGroups(state.groups, groupId, (group) => ({
          ...group,
          rootPath: normalizedRootPath,
          selectedPath: null,
          openDocuments: [],
          activeDocumentPath: null,
          activeSurface: "terminal",
          lastIndexedAt: null,
        })),
        workspaceByGroup: {
          ...state.workspaceByGroup,
          [groupId]: makeRuntimeWorkspaceState(normalizedRootPath),
        },
        documentStateByGroup: {
          ...state.documentStateByGroup,
          [groupId]: {},
        },
      };
    }),

  setExplorerVisible: (groupId, explorerVisible) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => ({ ...group, explorerVisible })),
    })),

  setInspectorVisible: (groupId, inspectorVisible) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => ({ ...group, inspectorVisible })),
    })),

  setSelectedPath: (groupId, path) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => ({
        ...group,
        selectedPath: normalizeRelativePath(path),
      })),
    })),

  setReaderWidth: (groupId, readerWidth) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => ({
        ...group,
        readerWidth: normalizeReaderWidth(readerWidth),
      })),
    })),

  toggleFavoriteRepoPath: (rootPath) =>
    set((state) => {
      const normalizedRootPath = normalizeRootPath(rootPath);
      if (!normalizedRootPath) return state;

      return {
        favoriteRepoPaths: state.favoriteRepoPaths.includes(normalizedRootPath)
          ? state.favoriteRepoPaths.filter((path) => path !== normalizedRootPath)
          : [...state.favoriteRepoPaths, normalizedRootPath],
      };
    }),

  removeFavoriteRepoPath: (rootPath) =>
    set((state) => {
      const normalizedRootPath = normalizeRootPath(rootPath);
      if (!normalizedRootPath) return state;

      return {
        favoriteRepoPaths: state.favoriteRepoPaths.filter((path) => path !== normalizedRootPath),
      };
    }),

  openDocument: (groupId, path, explicitType = null) =>
    set((state) => {
      const normalizedPath = normalizeRelativePath(path);
      if (!normalizedPath) return state;

      return {
        groups: mapGroups(state.groups, groupId, (group) => {
          const existingDocument = group.openDocuments.find((document) => document.path === normalizedPath);
          const type = explicitType || classifyWorkspacePath(normalizedPath);
          if (!["markdown", "text", "image"].includes(type)) {
            return group;
          }

          const openDocuments = existingDocument
            ? group.openDocuments
            : [
                ...group.openDocuments,
                {
                  path: normalizedPath,
                  title: titleFromPath(normalizedPath),
                  type,
                },
              ];

          return {
            ...group,
            selectedPath: normalizedPath,
            openDocuments,
            activeDocumentPath: normalizedPath,
            activeSurface: "document",
          };
        }),
      };
    }),

  closeDocument: (groupId, path) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => {
        const normalizedPath = normalizeRelativePath(path);
        if (!normalizedPath) return group;

        const currentIndex = group.openDocuments.findIndex((document) => document.path === normalizedPath);
        if (currentIndex === -1) return group;

        const remainingDocuments = group.openDocuments.filter((document) => document.path !== normalizedPath);
        const nextActiveDocument =
          remainingDocuments[currentIndex] ?? remainingDocuments[currentIndex - 1] ?? null;

        return {
          ...group,
          openDocuments: remainingDocuments,
          activeDocumentPath: nextActiveDocument?.path ?? null,
          activeSurface: normalizeSurface(group.activeSurface, remainingDocuments),
        };
      }),
      documentStateByGroup: mapObjectEntry(state.documentStateByGroup, groupId, (documents = {}) => {
        const normalizedPath = normalizeRelativePath(path);
        if (!normalizedPath) return documents;
        const { [normalizedPath]: _removed, ...remaining } = documents;
        return remaining;
      }),
    })),

  setActiveDocument: (groupId, path) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => {
        const normalizedPath = normalizeRelativePath(path);
        if (!normalizedPath || !group.openDocuments.some((document) => document.path === normalizedPath)) {
          return group;
        }

        return {
          ...group,
          activeDocumentPath: normalizedPath,
          activeSurface: "document",
          selectedPath: normalizedPath,
        };
      }),
    })),

  setActiveSurface: (groupId, surface) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => ({
        ...group,
        activeSurface: normalizeSurface(surface, group.openDocuments),
      })),
    })),

  setWorkspaceLoading: (groupId, rootPath) =>
    set((state) => ({
      workspaceByGroup: {
        ...state.workspaceByGroup,
        [groupId]: {
          ...makeRuntimeWorkspaceState(normalizeRootPath(rootPath)),
          status: rootPath ? "loading" : "empty",
        },
      },
    })),

  setWorkspaceTree: (groupId, rootPath, tree, lastIndexedAt, truncated = false) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => ({
        ...group,
        lastIndexedAt,
      })),
      workspaceByGroup: {
        ...state.workspaceByGroup,
        [groupId]: {
          ...(state.workspaceByGroup[groupId] || makeRuntimeWorkspaceState(rootPath)),
          rootPath: normalizeRootPath(rootPath),
          status: tree.length > 0 ? "ready" : "empty-folder",
          error: truncated ? "Scan truncated to workspace limits." : "",
          tree,
        },
      },
    })),

  setWorkspaceError: (groupId, rootPath, error) =>
    set((state) => ({
      workspaceByGroup: {
        ...state.workspaceByGroup,
        [groupId]: {
          ...(state.workspaceByGroup[groupId] || makeRuntimeWorkspaceState(rootPath)),
          rootPath: normalizeRootPath(rootPath),
          status: rootPath ? "error" : "empty",
          error,
          tree: [],
        },
      },
    })),

  setRecentImagesLoading: (groupId) =>
    set((state) => ({
      workspaceByGroup: {
        ...state.workspaceByGroup,
        [groupId]: {
          ...(state.workspaceByGroup[groupId] || makeRuntimeWorkspaceState()),
          recentImagesStatus: "loading",
          recentImagesError: "",
        },
      },
    })),

  setRecentImages: (groupId, images) =>
    set((state) => ({
      workspaceByGroup: {
        ...state.workspaceByGroup,
        [groupId]: {
          ...(state.workspaceByGroup[groupId] || makeRuntimeWorkspaceState()),
          recentImages: images,
          recentImagesStatus: "ready",
          recentImagesError: "",
        },
      },
    })),

  setRecentImagesError: (groupId, error) =>
    set((state) => ({
      workspaceByGroup: {
        ...state.workspaceByGroup,
        [groupId]: {
          ...(state.workspaceByGroup[groupId] || makeRuntimeWorkspaceState()),
          recentImagesStatus: "error",
          recentImagesError: error,
        },
      },
    })),

  setDocumentState: (groupId, path, nextDocumentState) =>
    set((state) => {
      const normalizedPath = normalizeRelativePath(path);
      if (!normalizedPath) return state;

      return {
        documentStateByGroup: {
          ...state.documentStateByGroup,
          [groupId]: {
            ...(state.documentStateByGroup[groupId] || {}),
            [normalizedPath]: {
              ...(state.documentStateByGroup[groupId]?.[normalizedPath] || {
                status: "idle",
                payload: null,
                error: "",
              }),
              ...nextDocumentState,
            },
          },
        },
      };
    }),

  nextTab: () =>
    set((state) => {
      const group = state.groups.find((entry) => entry.id === state.activeGroupId);
      if (!group || group.tabs.length < 2) return state;
      const index = group.tabs.findIndex((tab) => tab.id === group.activeTabId);
      const nextIndex = (index + 1) % group.tabs.length;
      return {
        groups: mapGroups(state.groups, state.activeGroupId, (entry) => ({
          ...entry,
          activeTabId: group.tabs[nextIndex].id,
        })),
      };
    }),

  prevTab: () =>
    set((state) => {
      const group = state.groups.find((entry) => entry.id === state.activeGroupId);
      if (!group || group.tabs.length < 2) return state;
      const index = group.tabs.findIndex((tab) => tab.id === group.activeTabId);
      const previousIndex = (index - 1 + group.tabs.length) % group.tabs.length;
      return {
        groups: mapGroups(state.groups, state.activeGroupId, (entry) => ({
          ...entry,
          activeTabId: group.tabs[previousIndex].id,
        })),
      };
    }),

  gotoTab: (index) =>
    set((state) => {
      const group = state.groups.find((entry) => entry.id === state.activeGroupId);
      if (!group || index >= group.tabs.length) return state;
      return {
        groups: mapGroups(state.groups, state.activeGroupId, (entry) => ({
          ...entry,
          activeTabId: group.tabs[index].id,
        })),
      };
    }),

  nextGroup: () =>
    set((state) => {
      if (state.groups.length < 2) return state;
      const index = state.groups.findIndex((group) => group.id === state.activeGroupId);
      const nextIndex = (index + 1) % state.groups.length;
      return { activeGroupId: state.groups[nextIndex].id };
    }),

  prevGroup: () =>
    set((state) => {
      if (state.groups.length < 2) return state;
      const index = state.groups.findIndex((group) => group.id === state.activeGroupId);
      const previousIndex = (index - 1 + state.groups.length) % state.groups.length;
      return { activeGroupId: state.groups[previousIndex].id };
    }),

  recordResponse: (tabId) => {
    const state = get();
    let waitingSince = null;
    for (const group of state.groups) {
      const tab = group.tabs.find((entry) => entry.id === tabId);
      if (tab) {
        waitingSince = tab.waitingSince;
        break;
      }
    }
    if (!waitingSince) return;
    const fast = Date.now() - waitingSince <= state.streakTimer;
    set({
      streak: fast ? clampHeatStreak(state.streak + 1) : clampHeatStreak(state.streak),
      lastStreakTime: Date.now(),
    });
  },

  coolStreak: (now = Date.now()) =>
    set((state) => {
      if (state.streak <= 0 || !state.lastStreakTime || state.cooldownTimer <= 0) {
        return state;
      }

      const currentStreak = clampHeatStreak(state.streak);
      const elapsed = now - state.lastStreakTime;
      const levelsLost = Math.floor(elapsed / state.cooldownTimer);
      if (levelsLost <= 0) {
        return currentStreak === state.streak ? state : { streak: currentStreak };
      }

      const streak = Math.max(0, currentStreak - levelsLost);
      const lastStreakTime =
        streak > 0 ? state.lastStreakTime + levelsLost * state.cooldownTimer : null;
      return { streak, lastStreakTime };
    }),

  decrementStreak: () =>
    set((state) => ({ streak: Math.max(0, state.streak - 1), lastStreakTime: Date.now() })),

  setStreakTimer: (ms) => set({ streakTimer: ms }),
  setCooldownTimer: (ms) => set({ cooldownTimer: ms }),

  setDemoHeatStage: (stage) => set({ demoHeatStage: stage }),
  exitDemoMode: () => set({ demoHeatStage: null }),
}));

export function storeToConfig(state, windowGeometry) {
  return {
    schema_version: 2,
    groups: state.groups.map((group) => ({
      id: group.id,
      name: group.name,
      active_tab_id: group.activeTabId,
      tabs: group.tabs.map((tab) => ({
        id: tab.id,
        name: tab.name,
        cwd: tab.cwd || null,
        tab_type: tab.type,
        manually_renamed: tab.manuallyRenamed,
      })),
      root_path: group.rootPath,
      explorer_visible: group.explorerVisible,
      inspector_visible: group.inspectorVisible,
      selected_path: group.selectedPath,
      open_documents: group.openDocuments.map((document) => ({
        path: document.path,
        title: document.title,
        type: document.type,
      })),
      active_document_path: group.activeDocumentPath,
      active_surface: group.activeSurface,
      reader_width: group.readerWidth,
      last_indexed_at: group.lastIndexedAt,
    })),
    active_group_id: state.activeGroupId,
    window: windowGeometry,
    settings: {
      streak_timer: state.streakTimer,
      cooldown_timer: state.cooldownTimer,
      favorite_repo_paths: state.favoriteRepoPaths,
    },
  };
}

export default useForgeStore;
