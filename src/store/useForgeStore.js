import { create } from "zustand";

function makeTab(name = "Terminal 1") {
  return { id: crypto.randomUUID(), name, status: "idle" };
}

function makeGroup(name = "Project 1") {
  const tab = makeTab();
  return { id: crypto.randomUUID(), name, tabs: [tab], activeTabId: tab.id };
}

const defaultGroup = makeGroup();

const useForgeStore = create((set, get) => ({
  groups: [defaultGroup],
  activeGroupId: defaultGroup.id,

  // Group actions
  addGroup: (name) => {
    const count = get().groups.length;
    const group = makeGroup(name || `Project ${count + 1}`);
    set((s) => ({
      groups: [...s.groups, group],
      activeGroupId: group.id,
    }));
  },
  removeGroup: (groupId) =>
    set((s) => {
      const remaining = s.groups.filter((g) => g.id !== groupId);
      if (remaining.length === 0) {
        const newGroup = makeGroup();
        return { groups: [newGroup], activeGroupId: newGroup.id };
      }
      const activeGroupId =
        s.activeGroupId === groupId ? remaining[0].id : s.activeGroupId;
      return { groups: remaining, activeGroupId };
    }),
  renameGroup: (groupId, name) =>
    set((s) => ({
      groups: s.groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
    })),
  setActiveGroup: (groupId) =>
    set({ activeGroupId: groupId }),

  // Tab actions
  addTab: (groupId, name) =>
    set((s) => {
      const group = s.groups.find((g) => g.id === groupId);
      const tabName = name || `Terminal ${group ? group.tabs.length + 1 : 1}`;
      const tab = makeTab(tabName);
      return {
        groups: s.groups.map((g) =>
          g.id === groupId
            ? { ...g, tabs: [...g.tabs, tab], activeTabId: tab.id }
            : g
        ),
      };
    }),
  removeTab: (groupId, tabId) =>
    set((s) => ({
      groups: s.groups.map((g) => {
        if (g.id !== groupId) return g;
        const remaining = g.tabs.filter((t) => t.id !== tabId);
        if (remaining.length === 0) {
          const newTab = makeTab();
          return { ...g, tabs: [newTab], activeTabId: newTab.id };
        }
        const activeTabId =
          g.activeTabId === tabId ? remaining[0].id : g.activeTabId;
        return { ...g, tabs: remaining, activeTabId };
      }),
    })),
  renameTab: (groupId, tabId, name) =>
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              tabs: g.tabs.map((t) => (t.id === tabId ? { ...t, name } : t)),
            }
          : g
      ),
    })),
  setActiveTab: (groupId, tabId) =>
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === groupId ? { ...g, activeTabId: tabId } : g
      ),
    })),

  // Navigation
  nextTab: () =>
    set((s) => {
      const group = s.groups.find((g) => g.id === s.activeGroupId);
      if (!group || group.tabs.length < 2) return s;
      const idx = group.tabs.findIndex((t) => t.id === group.activeTabId);
      const next = (idx + 1) % group.tabs.length;
      return {
        groups: s.groups.map((g) =>
          g.id === s.activeGroupId
            ? { ...g, activeTabId: g.tabs[next].id }
            : g
        ),
      };
    }),
  prevTab: () =>
    set((s) => {
      const group = s.groups.find((g) => g.id === s.activeGroupId);
      if (!group || group.tabs.length < 2) return s;
      const idx = group.tabs.findIndex((t) => t.id === group.activeTabId);
      const prev = (idx - 1 + group.tabs.length) % group.tabs.length;
      return {
        groups: s.groups.map((g) =>
          g.id === s.activeGroupId
            ? { ...g, activeTabId: g.tabs[prev].id }
            : g
        ),
      };
    }),
  nextGroup: () =>
    set((s) => {
      if (s.groups.length < 2) return s;
      const idx = s.groups.findIndex((g) => g.id === s.activeGroupId);
      const next = (idx + 1) % s.groups.length;
      return { activeGroupId: s.groups[next].id };
    }),
  prevGroup: () =>
    set((s) => {
      if (s.groups.length < 2) return s;
      const idx = s.groups.findIndex((g) => g.id === s.activeGroupId);
      const prev = (idx - 1 + s.groups.length) % s.groups.length;
      return { activeGroupId: s.groups[prev].id };
    }),
}));

export default useForgeStore;
