import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { clampHeatStreak } from "../utils/heat";
import { getAgentLaunchPreset } from "../utils/statusDetection";
import { shouldTabAutoIdle } from "../utils/statusEngine";
import { getDefaultShowcaseSceneId, getShowcaseScene } from "../demo/showcaseScenes";
import { DEFAULT_THEME, normalizeTheme } from "../utils/themes";
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

const AI_TAB_TYPE = "ai";
const SERVER_TAB_TYPE = "server";
const PREVIEW_TAB_TYPE = "preview";
const DEFAULT_PROJECT_MENU_DETAIL = "simple";
const PROJECT_MENU_DETAIL_STORAGE_KEY = "forge.projectMenuDetail";
const MAX_DIAGNOSTIC_ENTRIES = 400;

function createDiagnosticsId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clipDiagnosticText(value, limit = 160) {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function sanitizeDiagnosticMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};
  const sanitized = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      sanitized[key] = clipDiagnosticText(value, 120);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
      continue;
    }
  }
  return sanitized;
}

function appendDiagnosticEntry(entries, entry) {
  const nextEntries = [...entries, entry];
  return nextEntries.length > MAX_DIAGNOSTIC_ENTRIES
    ? nextEntries.slice(nextEntries.length - MAX_DIAGNOSTIC_ENTRIES)
    : nextEntries;
}

function findTabContext(groups, tabId) {
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    const tabIndex = group.tabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex !== -1) {
      return {
        group,
        tab: group.tabs[tabIndex],
        groupIndex,
        tabIndex,
      };
    }
  }
  return null;
}

function snapshotDiagnosticsGroups(groups, activeGroupId) {
  return groups.map((group, groupIndex) => ({
    id: group.id,
    index: groupIndex + 1,
    name: group.name,
    active: group.id === activeGroupId,
    activeTabId: group.activeTabId,
    tabs: group.tabs.map((tab, tabIndex) => ({
      id: tab.id,
      index: tabIndex + 1,
      name: tab.name,
      active: group.activeTabId === tab.id,
      type: tab.type,
      provider: tab.provider,
      status: tab.status,
      statusTitle: clipDiagnosticText(tab.statusTitle, 160),
      waitingReason: tab.waitingReason,
      waitingSince: tab.waitingSince,
      heatWaitingSince: tab.heatWaitingSince,
      lastEngagedAt: tab.lastEngagedAt,
      lastInteractionAt: tab.lastInteractionAt,
      nonWorkingSince: tab.nonWorkingSince,
    })),
  }));
}

function normalizeTabType(value) {
  if (value === SERVER_TAB_TYPE) return SERVER_TAB_TYPE;
  if (value === PREVIEW_TAB_TYPE) return PREVIEW_TAB_TYPE;
  return AI_TAB_TYPE;
}

function normalizeServerCommandOverride(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeProjectMenuDetail(value) {
  return value === "detailed" ? "detailed" : DEFAULT_PROJECT_MENU_DETAIL;
}

function loadStoredProjectMenuDetail() {
  if (typeof window === "undefined") return DEFAULT_PROJECT_MENU_DETAIL;
  try {
    return normalizeProjectMenuDetail(window.localStorage.getItem(PROJECT_MENU_DETAIL_STORAGE_KEY));
  } catch {
    return DEFAULT_PROJECT_MENU_DETAIL;
  }
}

function persistProjectMenuDetail(value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROJECT_MENU_DETAIL_STORAGE_KEY, normalizeProjectMenuDetail(value));
  } catch {
    // Ignore localStorage failures and fall back to config persistence.
  }
}

function inferProviderFromLaunchCommand(command) {
  if (typeof command !== "string") return "unknown";
  const normalized = command.trim().toLowerCase();
  if (/^codex(?:\.cmd)?(?:\s|$)/.test(normalized)) return "codex";
  if (/^claude(?:\.cmd)?(?:\s|$)/.test(normalized)) return "claude";
  return "unknown";
}

function inferProviderFromName(name) {
  if (typeof name !== "string") return "unknown";
  const normalized = name.trim().toLowerCase();
  if (normalized === "codex") return "codex";
  if (normalized === "claude" || normalized === "claude code") return "claude";
  return "unknown";
}

function normalizeTabProvider(provider) {
  if (provider === "claude" || provider === "codex") return provider;
  return "unknown";
}

function resolveInitialTabProvider(provider, launchCommand = null, name = null) {
  if (provider === "claude" || provider === "codex") return provider;
  const inferredFromLaunchCommand = inferProviderFromLaunchCommand(launchCommand);
  if (inferredFromLaunchCommand !== "unknown") return inferredFromLaunchCommand;
  return inferProviderFromName(name);
}

function normalizeLoadedTabProvider(tabConfig, schemaVersion) {
  const provider = normalizeTabProvider(tabConfig.provider);
  if (schemaVersion >= 4) {
    return provider;
  }

  if (provider === "unknown") {
    return "unknown";
  }

  const inferredFromName = inferProviderFromName(tabConfig.name);
  return inferredFromName === provider ? provider : "unknown";
}

function makeTab(name = "Terminal 1", cwd = null, options = {}) {
  const type = normalizeTabType(options.type);
  const launchPreset = getAgentLaunchPreset(options.launchCommand);
  const initialStatus = launchPreset?.status ?? "idle";
  const initialStatusTitle = launchPreset?.title ?? "";
  const initialWaitingReason = initialStatus === "waiting" ? "ready" : null;
  const createdAt = Date.now();
  const initialWaitingSince = initialStatus === "waiting" ? createdAt : null;
  return {
    id: crypto.randomUUID(),
    name,
    cwd,
    status: initialStatus,
    statusTitle: initialStatusTitle,
    waitingReason: initialWaitingReason,
    type,
    provider: resolveInitialTabProvider(options.provider, options.launchCommand, name),
    manuallyRenamed: false,
    suggestedServerName: "",
    waitingSince: initialWaitingSince,
    heatWaitingSince: null,
    lastEngagedAt: null,
    lastInteractionAt: createdAt,
    nonWorkingSince: initialStatus === "working" ? null : createdAt,
    launchCommand: options.launchCommand || null,
    initialPrompt: options.initialPrompt || null,
    url: options.url || null,
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
    worktreeParentId: null,
    gitBranch: null,
    gitCommonDir: null,
    serverCommandOverride: null,
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
  reposRootPath: null,
  theme: DEFAULT_THEME,
  fxEnabled: true,
  soundVolume: 80,
  showWelcomeOnLaunch: true,
  welcomeModalVisible: false,
  projectMenuDetail: loadStoredProjectMenuDetail(),

  workspaceByGroup: {},
  documentStateByGroup: {},

  // Heat / streak state
  streak: 0,
  lastStreakTime: null,
  streakTimer: 10000,
  cooldownTimer: 30000,
  tabRecencyMinutes: 5,
  heatPauseStartedAt: null,
  heatPauseSources: {},
  diagnosticsEntries: [],
  diagnosticsLastExportPath: null,

  // Demo mode (ephemeral, not persisted)
  demoHeatStage: null,
  themeVariant: null, // null = v2 (current main), "v1", "v3"
  particleVersion: null, // null = v2 (canvas), "v1" = CSS spans

  // Guided tour (ephemeral, not persisted)
  tourActive: false,
  tourStep: 0,
  tourExpandedPanel: null,
  tourSavedState: null,
  tourOriginalTheme: null,
  showcaseActive: false,
  showcaseSceneId: null,
  showcaseMeta: null,
  showcaseStudioVisible: true,
  showcaseCleanMode: false,
  showcaseRepoOpen: false,
  showcaseTerminalScreensByTab: {},
  showcaseSavedState: null,

  initFresh: () => {
    const group = makeGroup();
    set({
      groups: [group],
      activeGroupId: group.id,
      workspaceByGroup: { [group.id]: makeRuntimeWorkspaceState() },
      documentStateByGroup: { [group.id]: {} },
      favoriteRepoPaths: [],
      reposRootPath: null,
      theme: DEFAULT_THEME,
      fxEnabled: true,
      showWelcomeOnLaunch: true,
      welcomeModalVisible: false,
      projectMenuDetail: loadStoredProjectMenuDetail(),
      streak: 0,
      lastStreakTime: null,
      heatPauseStartedAt: null,
      heatPauseSources: {},
      diagnosticsEntries: [],
      diagnosticsLastExportPath: null,
      demoHeatStage: null,
      themeVariant: null,
      particleVersion: null,
      tourActive: false,
      tourStep: 0,
      tourExpandedPanel: null,
      tourSavedState: null,
      tourOriginalTheme: null,
      showcaseActive: false,
      showcaseSceneId: null,
      showcaseMeta: null,
      showcaseStudioVisible: true,
      showcaseCleanMode: false,
      showcaseRepoOpen: false,
      showcaseTerminalScreensByTab: {},
      showcaseSavedState: null,
      configLoaded: true,
    });
  },

  loadFromConfig: (config) => {
    const schemaVersion = Number(config.schema_version) || 0;
    const groups = (config.groups || []).map((groupConfig) => {
      const workspace = withWorkspaceDefaults(groupConfig);
      // Don't restore terminal tabs — PTY sessions are killed on close,
      // so restored tabs are just dead shells. Start each group clean.
      return {
        id: groupConfig.id,
        name: groupConfig.name,
        activeTabId: null,
        tabs: [],
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
      reposRootPath: config.settings?.repos_root_path || null,
      theme: normalizeTheme(config.settings?.theme),
      fxEnabled: config.settings?.fx_enabled ?? true,
      soundVolume: config.settings?.sound_volume ?? 80,
      showWelcomeOnLaunch: config.settings?.show_welcome_on_launch ?? true,
      welcomeModalVisible: false,
      projectMenuDetail: normalizeProjectMenuDetail(
        config.settings?.project_menu_detail ?? loadStoredProjectMenuDetail()
      ),
      streakTimer: config.settings?.streak_timer ?? 10000,
      cooldownTimer: config.settings?.cooldown_timer ?? 30000,
      tabRecencyMinutes: config.settings?.tab_recency_minutes ?? 5,
      streak: 0,
      lastStreakTime: null,
      heatPauseStartedAt: null,
      heatPauseSources: {},
      diagnosticsEntries: [],
      diagnosticsLastExportPath: null,
      demoHeatStage: null,
      themeVariant: null,
      particleVersion: null,
      tourActive: false,
      tourStep: 0,
      tourExpandedPanel: null,
      tourSavedState: null,
      tourOriginalTheme: null,
      showcaseActive: false,
      showcaseSceneId: null,
      showcaseMeta: null,
      showcaseStudioVisible: true,
      showcaseCleanMode: false,
      showcaseRepoOpen: false,
      showcaseTerminalScreensByTab: {},
      showcaseSavedState: null,
      configLoaded: true,
    });
  },

  addGroup: (name, options = {}) => {
    const count = get().groups.length;
    const rootPath = options.rootPath ? normalizeRootPath(options.rootPath) : null;
    const derivedName = name || (rootPath && rootPath.split(/[\\/]/).filter(Boolean).pop()) || `Project ${count + 1}`;
    const group = makeGroup(derivedName);
    if (rootPath) {
      group.rootPath = rootPath;
      // Start with no tabs so the user can pick from the quick menu
      group.tabs = [];
      group.activeTabId = null;
    }
    set((state) => ({
      groups: [...state.groups, group],
      activeGroupId: group.id,
      workspaceByGroup: { ...state.workspaceByGroup, [group.id]: makeRuntimeWorkspaceState(rootPath) },
      documentStateByGroup: { ...state.documentStateByGroup, [group.id]: {} },
    }));
  },

  removeGroup: (groupId) =>
    set((state) => {
      // Block removal if this group has worktree children
      const hasChildren = state.groups.some((g) => g.worktreeParentId === groupId);
      if (hasChildren) return state;

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

  addTab: (groupId, options = {}) =>
    set((state) => {
      const group = state.groups.find((entry) => entry.id === groupId);
      const tabName = options.name || `Terminal ${group ? group.tabs.length + 1 : 1}`;
      const tab = makeTab(tabName, group?.rootPath ?? null, {
        type: options.type,
        provider: options.provider,
        launchCommand: options.launchCommand,
        initialPrompt: options.initialPrompt,
        url: options.url,
      });
      return {
        groups: mapGroups(state.groups, groupId, (entry) => ({
          ...entry,
          tabs: [...entry.tabs, tab],
          activeTabId: options.activate === false ? entry.activeTabId : tab.id,
        })),
      };
    }),

  removeTab: (groupId, tabId) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => {
        const remaining = group.tabs.filter((tab) => tab.id !== tabId);
        if (remaining.length === 0) {
          return { ...group, tabs: [], activeTabId: null };
        }
        let activeTabId = group.activeTabId;
        if (activeTabId === tabId) {
          const closedIndex = group.tabs.findIndex((tab) => tab.id === tabId);
          activeTabId = remaining[Math.min(Math.max(closedIndex - 1, 0), remaining.length - 1)].id;
        }
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

  setTabStatus: (tabId, status, title, options = {}) =>
    set((state) => ({
      groups: state.groups.map((group) => {
        const tabIndex = group.tabs.findIndex((tab) => tab.id === tabId);
        if (tabIndex === -1) return group;
        const oldTab = group.tabs[tabIndex];
        const newWaiting = oldTab.status !== "waiting" && status === "waiting";
        const waitingReason =
          status === "waiting"
            ? (options.waitingReason ?? (newWaiting ? null : oldTab.waitingReason))
            : null;
        const triggerWaitingAttention = options.triggerWaitingAttention ?? true;
        const shouldFlashWaiting = newWaiting && triggerWaitingAttention;
        const waitingSince = status === "waiting" ? (oldTab.waitingSince ?? Date.now()) : null;
        const now = Date.now();
        const nonWorkingSince =
          status === "working"
            ? null
            : oldTab.status === "working"
              ? now
              : oldTab.nonWorkingSince ?? oldTab.lastInteractionAt ?? now;
        const updatedTab = {
          ...oldTab,
          status,
          statusTitle: title,
          waitingReason,
          waitingSince,
          nonWorkingSince,
          waitingFlashKey: shouldFlashWaiting ? (oldTab.waitingFlashKey ?? 0) + 1 : (oldTab.waitingFlashKey ?? 0),
        };
        const tabs = group.tabs.slice();
        tabs[tabIndex] = updatedTab;
        return {
          ...group,
          waitingFlashKey: shouldFlashWaiting ? (group.waitingFlashKey ?? 0) + 1 : (group.waitingFlashKey ?? 0),
          tabs,
        };
      }),
    })),

  triggerWaitingAttention: (tabId) =>
    set((state) => {
      const hasTab = state.groups.some((g) =>
        g.tabs.some((t) => t.id === tabId && t.status === "waiting")
      );
      if (!hasTab) return state;
      return {
        groups: state.groups.map((group) => {
          const tabIndex = group.tabs.findIndex((tab) => tab.id === tabId);
          if (tabIndex === -1) return group;
          const oldTab = group.tabs[tabIndex];
          const tabs = group.tabs.slice();
          tabs[tabIndex] = {
            ...oldTab,
            waitingFlashKey: (oldTab.waitingFlashKey ?? 0) + 1,
          };
          return {
            ...group,
            waitingFlashKey: (group.waitingFlashKey ?? 0) + 1,
            tabs,
          };
        }),
      };
    }),

  openHeatWaiting: (tabId, openedAt = Date.now()) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.tabs.some((tab) => tab.id === tabId)
          ? {
              ...group,
              tabs: group.tabs.map((tab) =>
                tab.id === tabId && tab.type !== "server" && !tab.heatWaitingSince
                  ? { ...tab, heatWaitingSince: openedAt }
                  : tab
              ),
            }
          : group
      ),
    })),

  clearHeatWaiting: (tabId) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.tabs.some((tab) => tab.id === tabId)
          ? {
              ...group,
              tabs: group.tabs.map((tab) =>
                tab.id === tabId && tab.heatWaitingSince ? { ...tab, heatWaitingSince: null } : tab
              ),
            }
          : group
      ),
    })),

  markTabInteraction: (tabId, at = Date.now()) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.tabs.some((tab) => tab.id === tabId)
          ? {
              ...group,
              tabs: group.tabs.map((tab) =>
                tab.id === tabId
                  ? {
                      ...tab,
                      lastInteractionAt: at,
                    }
                  : tab
              ),
            }
          : group
      ),
    })),

  recordDiagnosticsEvent: (input = {}) =>
    set((state) => {
      const context = input.tabId ? findTabContext(state.groups, input.tabId) : null;
      const entry = {
        id: createDiagnosticsId(),
        at: input.at ?? Date.now(),
        kind: input.kind || "event",
        source: input.source || "unknown",
        message: clipDiagnosticText(input.message, 180),
        metadata: sanitizeDiagnosticMetadata(input.metadata),
        groupId: context?.group.id ?? input.groupId ?? null,
        groupName: context?.group.name ?? "",
        groupIndex: context ? context.groupIndex + 1 : null,
        tabId: context?.tab.id ?? input.tabId ?? null,
        tabName: context?.tab.name ?? "",
        tabIndex: context ? context.tabIndex + 1 : null,
        tabType: context?.tab.type ?? null,
        provider: context?.tab.provider ?? input.provider ?? "unknown",
      };

      return {
        diagnosticsEntries: appendDiagnosticEntry(state.diagnosticsEntries, entry),
      };
    }),

  recordStatusTransition: (input = {}) =>
    set((state) => {
      const context = input.tabId ? findTabContext(state.groups, input.tabId) : null;
      if (!context) return state;

      const entry = {
        id: createDiagnosticsId(),
        at: input.at ?? Date.now(),
        kind: "status_transition",
        source: input.source || "unknown",
        prevStatus: input.prevStatus ?? null,
        nextStatus: input.nextStatus ?? context.tab.status,
        waitingReason: input.waitingReason ?? context.tab.waitingReason ?? null,
        title: clipDiagnosticText(input.title ?? context.tab.statusTitle, 160),
        metadata: sanitizeDiagnosticMetadata(input.metadata),
        groupId: context.group.id,
        groupName: context.group.name,
        groupIndex: context.groupIndex + 1,
        tabId: context.tab.id,
        tabName: context.tab.name,
        tabIndex: context.tabIndex + 1,
        tabType: context.tab.type,
        provider: context.tab.provider,
      };

      return {
        diagnosticsEntries: appendDiagnosticEntry(state.diagnosticsEntries, entry),
      };
    }),

  markDiagnosticsExported: (path) =>
    set({
      diagnosticsLastExportPath: typeof path === "string" && path.trim() ? path : null,
    }),

  buildDiagnosticsReport: (context = {}) => {
    const state = get();
    return {
      generatedAt: Date.now(),
      appContext: {
        activeGroupId: state.activeGroupId,
        diagnosticsEntryCount: state.diagnosticsEntries.length,
        streak: state.streak,
        lastStreakTime: state.lastStreakTime,
        heatPauseStartedAt: state.heatPauseStartedAt,
        tabRecencyMinutes: state.tabRecencyMinutes,
        theme: state.theme,
        fxEnabled: state.fxEnabled,
        soundVolume: state.soundVolume,
        ...sanitizeDiagnosticMetadata(context),
      },
      groups: snapshotDiagnosticsGroups(state.groups, state.activeGroupId),
      transitions: state.diagnosticsEntries,
    };
  },

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

  setTabSuggestedServerName: (tabId, name) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.tabs.some((tab) => tab.id === tabId)
          ? {
              ...group,
              tabs: group.tabs.map((tab) =>
                tab.id === tabId ? { ...tab, suggestedServerName: name?.trim?.() || "" } : tab
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
              tabs: group.tabs.map((tab) => {
                if (tab.id !== tabId) return tab;
                const nextType = normalizeTabType(type);
                if (nextType !== SERVER_TAB_TYPE || tab.manuallyRenamed) {
                  return { ...tab, type: nextType };
                }
                return {
                  ...tab,
                  type: nextType,
                  name: tab.suggestedServerName || "Server",
                };
              }),
            }
          : group
      ),
    })),

  setTabProvider: (tabId, provider) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.tabs.some((tab) => tab.id === tabId)
          ? {
              ...group,
              tabs: group.tabs.map((tab) =>
                tab.id === tabId ? { ...tab, provider: normalizeTabProvider(provider) } : tab
              ),
            }
          : group
      ),
    })),

  updateTabTerminal: (tabId, updates = {}) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.tabs.some((tab) => tab.id === tabId)
          ? {
              ...group,
              tabs: group.tabs.map((tab) =>
                tab.id === tabId
                  ? {
                      ...tab,
                      type:
                        updates.type === undefined ? tab.type : normalizeTabType(updates.type),
                      provider:
                        updates.provider === undefined
                          ? tab.provider
                          : normalizeTabProvider(updates.provider),
                      name:
                        updates.type !== undefined &&
                        normalizeTabType(updates.type) === SERVER_TAB_TYPE &&
                        !tab.manuallyRenamed
                          ? tab.suggestedServerName || "Server"
                          : tab.name,
                    }
                  : tab
              ),
            }
          : group
      ),
    })),

  clearTabLaunchCommand: (tabId) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.tabs.some((tab) => tab.id === tabId)
          ? {
              ...group,
              tabs: group.tabs.map((tab) =>
                tab.id === tabId ? { ...tab, launchCommand: null, initialPrompt: null } : tab
              ),
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
          serverCommandOverride:
            group.rootPath === normalizedRootPath ? group.serverCommandOverride : null,
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

  setGroupServerCommandOverride: (groupId, command) =>
    set((state) => ({
      groups: mapGroups(state.groups, groupId, (group) => ({
        ...group,
        serverCommandOverride: normalizeServerCommandOverride(command),
      })),
    })),

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

  recordResponse: (tabId) =>
    set((state) => {
      let heatWaitingSince = null;
      let foundGroupId = null;

      for (const group of state.groups) {
        const tab = group.tabs.find((entry) => entry.id === tabId);
        if (!tab) continue;
        heatWaitingSince = tab.heatWaitingSince;
        foundGroupId = group.id;
        break;
      }

      if (!heatWaitingSince || !foundGroupId) return state;

      const now = Date.now();
      const fast = state.streak <= 0 || now - heatWaitingSince <= state.streakTimer;
      return {
        groups: mapGroups(state.groups, foundGroupId, (group) => ({
          ...group,
          tabs: group.tabs.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  heatWaitingSince: null,
                  lastEngagedAt: now,
                }
              : tab
          ),
        })),
        streak: fast ? clampHeatStreak(state.streak + 1) : clampHeatStreak(state.streak),
        lastStreakTime: now,
      };
    }),

  startHeatPause: (sourceId, now = Date.now()) =>
    set((state) => {
      if (!sourceId || state.heatPauseSources[sourceId]) {
        return state;
      }

      return {
        heatPauseStartedAt: state.heatPauseStartedAt ?? now,
        heatPauseSources: {
          ...state.heatPauseSources,
          [sourceId]: true,
        },
      };
    }),

  stopHeatPause: (sourceId, now = Date.now()) =>
    set((state) => {
      if (!sourceId || !state.heatPauseSources[sourceId]) {
        return state;
      }

      const { [sourceId]: _removedSource, ...remainingSources } = state.heatPauseSources;
      if (Object.keys(remainingSources).length > 0) {
        return {
          heatPauseSources: remainingSources,
        };
      }

      const pausedAt = state.heatPauseStartedAt;
      const pausedDuration = pausedAt ? Math.max(0, now - pausedAt) : 0;
      return {
        groups:
          pausedDuration > 0
            ? state.groups.map((group) => ({
                ...group,
                tabs: group.tabs.map((tab) => ({
                  ...tab,
                  waitingSince: tab.waitingSince ? tab.waitingSince + pausedDuration : null,
                  heatWaitingSince: tab.heatWaitingSince ? tab.heatWaitingSince + pausedDuration : null,
                  lastEngagedAt: tab.lastEngagedAt ? tab.lastEngagedAt + pausedDuration : null,
                })),
              }))
            : state.groups,
        lastStreakTime: state.lastStreakTime ? state.lastStreakTime + pausedDuration : null,
        heatPauseStartedAt: null,
        heatPauseSources: remainingSources,
      };
    }),

  coolStreak: (now = Date.now()) =>
    set((state) => {
      if (
        state.heatPauseStartedAt ||
        state.streak <= 0 ||
        !state.lastStreakTime ||
        state.cooldownTimer <= 0
      ) {
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

  idleInactiveTabs: (now = Date.now(), idleTimeoutMs = 10 * 60 * 1000) =>
    set((state) => {
      if (idleTimeoutMs <= 0) return state;

      let changed = false;
      let diagnosticsEntries = state.diagnosticsEntries;
      const groups = state.groups.map((group, groupIndex) => {
        let groupChanged = false;
        const tabs = group.tabs.map((tab, tabIndex) => {
          if (
            !shouldTabAutoIdle({
              status: tab.status,
              tabType: tab.type,
              now,
              idleTimeoutMs,
              lastInteractionAt: tab.lastInteractionAt,
              nonWorkingSince: tab.nonWorkingSince,
            })
          ) {
            return tab;
          }

          changed = true;
          groupChanged = true;
          diagnosticsEntries = appendDiagnosticEntry(diagnosticsEntries, {
            id: createDiagnosticsId(),
            at: now,
            kind: "status_transition",
            source: "auto_idle",
            prevStatus: tab.status,
            nextStatus: "idle",
            waitingReason: null,
            title: "",
            metadata: sanitizeDiagnosticMetadata({
              idleTimeoutMs,
              lastInteractionAt: tab.lastInteractionAt,
              nonWorkingSince: tab.nonWorkingSince,
            }),
            groupId: group.id,
            groupName: group.name,
            groupIndex: groupIndex + 1,
            tabId: tab.id,
            tabName: tab.name,
            tabIndex: tabIndex + 1,
            tabType: tab.type,
            provider: tab.provider,
          });
          return {
            ...tab,
            status: "idle",
            statusTitle: "",
            waitingReason: null,
            waitingSince: null,
            heatWaitingSince: null,
          };
        });

        return groupChanged ? { ...group, tabs } : group;
      });

      return changed ? { groups, diagnosticsEntries } : state;
    }),

  decrementStreak: () =>
    set((state) => ({ streak: Math.max(0, state.streak - 1), lastStreakTime: Date.now() })),

  setTabRecencyMinutes: (minutes) => set({ tabRecencyMinutes: Math.max(1, Math.min(60, Number(minutes) || 5)) }),
  setStreakTimer: (ms) => set({ streakTimer: ms }),
  setCooldownTimer: (ms) => set({ cooldownTimer: ms }),
  setTheme: (theme) => set({ theme: normalizeTheme(theme) }),
  setFxEnabled: (fxEnabled) => set({ fxEnabled: Boolean(fxEnabled) }),
  setSoundVolume: (v) => set({ soundVolume: Math.max(0, Math.min(100, Number(v) || 0)) }),
  setShowWelcomeOnLaunch: (showWelcomeOnLaunch) =>
    set({ showWelcomeOnLaunch: Boolean(showWelcomeOnLaunch) }),
  setWelcomeModalVisible: (welcomeModalVisible) =>
    set({ welcomeModalVisible: Boolean(welcomeModalVisible) }),
  setProjectMenuDetail: (projectMenuDetail) => {
    const normalized = normalizeProjectMenuDetail(projectMenuDetail);
    persistProjectMenuDetail(normalized);
    set({ projectMenuDetail: normalized });
  },
  setReposRootPath: (path) => set({ reposRootPath: path || null }),

  setDemoHeatStage: (stage) => set({ demoHeatStage: stage }),
  setParticleVersion: (version) => set({ particleVersion: version }),
  setThemeVariant: (variant) => set({ themeVariant: variant }),
  exitDemoMode: () => set({ demoHeatStage: null, themeVariant: null, particleVersion: null }),
  setShowcaseStudioVisible: (visible) => set({ showcaseStudioVisible: Boolean(visible) }),
  setShowcaseCleanMode: (enabled) => set({ showcaseCleanMode: Boolean(enabled) }),
  startShowcaseScene: (sceneId, options = {}) => {
    const state = get();
    const savedState = state.showcaseActive
      ? state.showcaseSavedState
      : {
          groups: state.groups,
          activeGroupId: state.activeGroupId,
          workspaceByGroup: state.workspaceByGroup,
          documentStateByGroup: state.documentStateByGroup,
          theme: state.theme,
          fxEnabled: state.fxEnabled,
          streak: state.streak,
          lastStreakTime: state.lastStreakTime,
          heatPauseStartedAt: state.heatPauseStartedAt,
          heatPauseSources: state.heatPauseSources,
          demoHeatStage: state.demoHeatStage,
          themeVariant: state.themeVariant,
          particleVersion: state.particleVersion,
        };

    const loaded = get().loadShowcaseScene(sceneId, options);
    if (!loaded) return false;
    set({ showcaseSavedState: savedState });
    return true;
  },
  loadShowcaseScene: (sceneId, options = {}) => {
    const scene = getShowcaseScene(sceneId) || getShowcaseScene(getDefaultShowcaseSceneId());
    if (!scene) return false;
    const snapshot = typeof structuredClone === "function"
      ? structuredClone(scene)
      : JSON.parse(JSON.stringify(scene));

    const nextStudioVisible = options.studioVisible ?? get().showcaseStudioVisible ?? true;
    const nextCleanMode = options.cleanMode ?? get().showcaseCleanMode ?? false;
    const pausedAt = Date.now();

    set({
      groups: snapshot.groups,
      activeGroupId: snapshot.activeGroupId,
      workspaceByGroup: snapshot.workspaceByGroup,
      documentStateByGroup: snapshot.documentStateByGroup,
      theme: normalizeTheme(snapshot.theme),
      fxEnabled: snapshot.fxEnabled ?? true,
      streak: snapshot.heatStage ?? 0,
      lastStreakTime: pausedAt,
      heatPauseStartedAt: pausedAt,
      heatPauseSources: { showcase: pausedAt },
      demoHeatStage: snapshot.heatStage ?? null,
      themeVariant: null,
      particleVersion: null,
      tourActive: false,
      tourStep: 0,
      tourExpandedPanel: null,
      tourSavedState: null,
      tourOriginalTheme: null,
      showcaseActive: true,
      showcaseSceneId: snapshot.id,
      showcaseMeta: {
        kicker: snapshot.kicker,
        title: snapshot.title,
        summary: snapshot.summary,
        feature: snapshot.feature,
        notes: snapshot.notes || [],
        captureNotes: snapshot.captureNotes || "",
      },
      showcaseStudioVisible: nextStudioVisible,
      showcaseCleanMode: nextCleanMode,
      showcaseRepoOpen: Boolean(snapshot.repoExplorerOpen),
      showcaseTerminalScreensByTab: snapshot.terminalScreensByTab || {},
      showcaseSavedState: get().showcaseSavedState,
      showWelcomeOnLaunch: false,
      configLoaded: true,
    });

    return true;
  },
  exitShowcase: () => {
    const state = get();
    const saved = state.showcaseSavedState;
    if (!saved) {
      set({
        showcaseActive: false,
        showcaseSceneId: null,
        showcaseMeta: null,
        showcaseStudioVisible: true,
        showcaseCleanMode: false,
        showcaseRepoOpen: false,
        showcaseTerminalScreensByTab: {},
        showcaseSavedState: null,
        heatPauseSources: {},
        heatPauseStartedAt: null,
        demoHeatStage: null,
      });
      return;
    }

    set({
      groups: saved.groups,
      activeGroupId: saved.activeGroupId,
      workspaceByGroup: saved.workspaceByGroup,
      documentStateByGroup: saved.documentStateByGroup,
      theme: saved.theme,
      fxEnabled: saved.fxEnabled,
      streak: saved.streak,
      lastStreakTime: saved.lastStreakTime,
      heatPauseStartedAt: saved.heatPauseStartedAt,
      heatPauseSources: saved.heatPauseSources,
      demoHeatStage: saved.demoHeatStage,
      themeVariant: saved.themeVariant,
      particleVersion: saved.particleVersion,
      showcaseActive: false,
      showcaseSceneId: null,
      showcaseMeta: null,
      showcaseStudioVisible: true,
      showcaseCleanMode: false,
      showcaseRepoOpen: false,
      showcaseTerminalScreensByTab: {},
      showcaseSavedState: null,
    });
  },

  startTour: () => {
    const state = get();
    // Snapshot current state for restoration
    const savedState = {
      groups: state.groups,
      activeGroupId: state.activeGroupId,
      workspaceByGroup: state.workspaceByGroup,
      documentStateByGroup: state.documentStateByGroup,
    };

    // Create demo group with 3 descriptive tabs
    const serverTab = {
      ...makeTab("Server", null, { type: "server" }),
      status: "idle",
    };
    const waitingTab = {
      ...makeTab("Waiting", null, { provider: "claude" }),
      status: "waiting",
      waitingReason: "userInput",
    };
    const workingTab = {
      ...makeTab("Working", null, { provider: "codex" }),
      status: "working",
    };
    const demoGroup = {
      id: crypto.randomUUID(),
      name: "Demo Project",
      tabs: [serverTab, waitingTab, workingTab],
      activeTabId: waitingTab.id,
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

    set({
      tourSavedState: savedState,
      tourOriginalTheme: state.theme,
      groups: [demoGroup],
      activeGroupId: demoGroup.id,
      workspaceByGroup: { [demoGroup.id]: makeRuntimeWorkspaceState() },
      documentStateByGroup: { [demoGroup.id]: {} },
      tourActive: true,
      tourStep: 0,
      tourExpandedPanel: null,
    });

    // Pause heat system during tour
    get().startHeatPause("guided-tour");
  },

  setTourStep: (step) => set({ tourStep: step }),
  setTourExpandedPanel: (panel) => set({ tourExpandedPanel: panel }),

  endTour: () => {
    const state = get();
    const saved = state.tourSavedState;
    const originalTheme = state.tourOriginalTheme;

    // Stop heat pause and demo mode
    state.stopHeatPause("guided-tour");
    state.exitDemoMode();

    // Restore original theme if changed
    const restoreTheme = originalTheme || state.theme;

    if (saved) {
      set({
        groups: saved.groups,
        activeGroupId: saved.activeGroupId,
        workspaceByGroup: saved.workspaceByGroup,
        documentStateByGroup: saved.documentStateByGroup,
        tourActive: false,
        tourStep: 0,
        tourExpandedPanel: null,
        tourSavedState: null,
        tourOriginalTheme: null,
        theme: restoreTheme,
        showcaseActive: false,
        showcaseSceneId: null,
        showcaseMeta: null,
        showcaseStudioVisible: true,
        showcaseCleanMode: false,
        showcaseRepoOpen: false,
        showcaseTerminalScreensByTab: {},
        showcaseSavedState: null,
      });
    } else {
      set({
        tourActive: false,
        tourStep: 0,
        tourExpandedPanel: null,
        tourSavedState: null,
        tourOriginalTheme: null,
        theme: restoreTheme,
        showcaseActive: false,
        showcaseSceneId: null,
        showcaseMeta: null,
        showcaseStudioVisible: true,
        showcaseCleanMode: false,
        showcaseRepoOpen: false,
        showcaseTerminalScreensByTab: {},
        showcaseSavedState: null,
      });
    }
  },
}));

// --- Worktree helpers ---

function normalizeCmpPath(p) {
  if (!p) return "";
  const normalized = p.replace(/\\/g, "/");
  return navigator.platform?.startsWith("Win") ? normalized.toLowerCase() : normalized;
}

export function resolveWorktreeNesting() {
  const state = useForgeStore.getState();
  const groups = state.groups;

  // Group by gitCommonDir
  const families = new Map();
  for (const group of groups) {
    if (!group.gitCommonDir) continue;
    const key = normalizeCmpPath(group.gitCommonDir);
    if (!families.has(key)) families.set(key, []);
    families.get(key).push(group);
  }

  const updates = new Map(); // id -> { worktreeParentId, name? }
  for (const members of families.values()) {
    if (members.length < 2) {
      // Single member — clear any stale worktreeParentId
      for (const m of members) {
        if (m.worktreeParentId) updates.set(m.id, { worktreeParentId: null });
      }
      continue;
    }
    // Pick parent: the non-worktree group, or first group
    const parent = members.find((m) => m._isWorktree === false) || members[0];
    for (const m of members) {
      const desired = m.id === parent.id ? null : parent.id;
      if (m.worktreeParentId !== desired) {
        const patch = { worktreeParentId: desired };
        // Auto-rename worktree children to their branch name (if not manually renamed)
        if (desired && m.gitBranch && !m._manuallyRenamed) {
          patch.name = m.gitBranch;
        }
        updates.set(m.id, patch);
      }
    }
  }

  if (updates.size === 0) return;

  useForgeStore.setState((state) => ({
    groups: state.groups.map((g) =>
      updates.has(g.id) ? { ...g, ...updates.get(g.id) } : g
    ),
  }));
}

export async function refreshGitInfo(groupId) {
  const group = useForgeStore.getState().groups.find((g) => g.id === groupId);
  if (!group?.rootPath) return;

  try {
    const info = await invoke("git_repo_info", { path: group.rootPath });
    useForgeStore.setState((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId
          ? { ...g, gitBranch: info.branch, gitCommonDir: info.common_dir, _isWorktree: info.is_worktree }
          : g
      ),
    }));
    resolveWorktreeNesting();
  } catch {
    useForgeStore.setState((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId
          ? { ...g, gitBranch: null, gitCommonDir: null, _isWorktree: false }
          : g
      ),
    }));
  }
}

export async function addWorktreeGroup(parentGroupId, worktreePath, branchName) {
  const store = useForgeStore.getState();
  store.addGroup(branchName, { rootPath: worktreePath });

  // Find the newly added group (last one)
  const newGroup = useForgeStore.getState().groups.at(-1);
  if (newGroup) {
    useForgeStore.setState((state) => ({
      groups: state.groups.map((g) =>
        g.id === newGroup.id ? { ...g, worktreeParentId: parentGroupId } : g
      ),
    }));
    await refreshGitInfo(newGroup.id);
  }
}

export async function removeWorktreeGroup(groupId) {
  const state = useForgeStore.getState();
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return;

  const parent = state.groups.find((g) => g.id === group.worktreeParentId);
  const repoPath = parent?.rootPath || group.rootPath;

  await invoke("git_remove_worktree", {
    repoPath,
    worktreePath: group.rootPath,
  });

  state.removeGroup(groupId);
}

export function hasWorktreeChildren(groupId) {
  return useForgeStore.getState().groups.some((g) => g.worktreeParentId === groupId);
}

export function storeToConfig(state, windowGeometry) {
  // During tour, persist the saved (real) state, not the demo state
  const groups = state.tourActive && state.tourSavedState
    ? state.tourSavedState.groups
    : state.groups;
  const activeGroupId = state.tourActive && state.tourSavedState
    ? state.tourSavedState.activeGroupId
    : state.activeGroupId;

  return {
    schema_version: 6,
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      active_tab_id: group.activeTabId,
      tabs: group.tabs.map((tab) => ({
        id: tab.id,
        name: tab.name,
        cwd: tab.cwd || null,
        tab_type: tab.type,
        provider: tab.provider || "unknown",
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
      worktree_parent_id: group.worktreeParentId || null,
      server_command_override: normalizeServerCommandOverride(group.serverCommandOverride),
    })),
    active_group_id: activeGroupId,
    window: windowGeometry,
    settings: {
      streak_timer: state.streakTimer,
      cooldown_timer: state.cooldownTimer,
      tab_recency_minutes: state.tabRecencyMinutes,
      favorite_repo_paths: state.favoriteRepoPaths,
      repos_root_path: state.reposRootPath,
      theme: normalizeTheme(state.theme),
      fx_enabled: state.fxEnabled,
      sound_volume: state.soundVolume,
      show_welcome_on_launch: state.showWelcomeOnLaunch,
      project_menu_detail: normalizeProjectMenuDetail(state.projectMenuDetail),
    },
  };
}

export default useForgeStore;
