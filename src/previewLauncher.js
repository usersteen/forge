import { invoke } from "@tauri-apps/api/core";
import useForgeStore from "./store/useForgeStore";
import { inferDefaultServerLaunch, inferWebPreviewLaunch } from "./utils/devServerSuggestion";

const POST_OPEN_RELOAD_MS = 1200;

// Wait this long after the server tab's reported URL stops changing before
// trusting it. Vite-style servers print "Port X is in use, trying..." lines
// before the final "Local: http://localhost:Y" — debouncing past those false
// candidates is what makes auto-launch reliable.
const STABILITY_MS = 2000;
const TIMEOUT_MS = 90_000;

function parseServerPort(value) {
  if (!value) return null;
  const match = String(value).match(/(\d{2,5})/);
  if (!match) return null;
  const port = Number(match[1]);
  return port > 0 && port < 65536 ? port : null;
}

function encodePreviewPath(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  return normalized
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function buildPreviewUrl(port, relativePath = "") {
  const path = encodePreviewPath(relativePath);
  return `http://localhost:${port}${path ? `/${path}` : ""}`;
}

function findGroup(state, groupId) {
  return state.groups.find((g) => g.id === groupId) || null;
}

function findTab(state, groupId, tabId) {
  return findGroup(state, groupId)?.tabs.find((t) => t.id === tabId) || null;
}

function findReusablePreviewTab(group) {
  if (!group) return null;
  for (let index = group.tabs.length - 1; index >= 0; index -= 1) {
    if (group.tabs[index].type === "preview") return group.tabs[index];
  }
  return null;
}

// Skip server tabs whose PTY has exited — their suggestedServerName may
// still hold a stale port. ptyAlive flips true on spawn_pty resolve and
// false on pty-exit/pty-error (Terminal.jsx).
function findDetectedServerPort(group) {
  if (!group) return null;
  for (let index = group.tabs.length - 1; index >= 0; index -= 1) {
    const tab = group.tabs[index];
    if (tab.type !== "server") continue;
    if (!tab.ptyAlive) continue;
    const port = parseServerPort(tab.suggestedServerName);
    if (port) return port;
  }
  return null;
}

function spawnServerTab(groupId, command) {
  const before = new Set(
    findGroup(useForgeStore.getState(), groupId)?.tabs
      .filter((t) => t.type === "server")
      .map((t) => t.id) || []
  );
  useForgeStore.getState().addTab(groupId, {
    name: "Server",
    type: "server",
    launchCommand: command,
  });
  const afterGroup = findGroup(useForgeStore.getState(), groupId);
  const next = (afterGroup?.tabs || []).find(
    (t) => t.type === "server" && !before.has(t.id)
  );
  return next?.id || null;
}

function spawnPreviewTab(groupId, url) {
  const before = new Set(
    findGroup(useForgeStore.getState(), groupId)?.tabs
      .filter((t) => t.type === "preview")
      .map((t) => t.id) || []
  );
  useForgeStore.getState().addTab(groupId, {
    name: "Preview",
    type: "preview",
    url,
  });
  const afterGroup = findGroup(useForgeStore.getState(), groupId);
  const next = (afterGroup?.tabs || []).find(
    (t) => t.type === "preview" && !before.has(t.id)
  );
  if (!next) return null;
  useForgeStore.getState().setActiveTab(groupId, next.id);
  // Force a fresh GET shortly after the webview is up. Without this, Vite
  // sometimes serves the dev shell from cache without running the transform
  // pipeline — meaning the dev terminal sits silent and nothing renders.
  setTimeout(() => {
    invoke("preview_reload", { tabId: next.id }).catch(() => {});
  }, POST_OPEN_RELOAD_MS);
  return next.id;
}

function openOrReusePreviewTab(groupId, url) {
  const state = useForgeStore.getState();
  const group = findGroup(state, groupId);
  const previewTab = findReusablePreviewTab(group);
  if (!previewTab) return spawnPreviewTab(groupId, url);

  useForgeStore.getState().setTabUrl(previewTab.id, url);
  useForgeStore.getState().setActiveTab(groupId, previewTab.id);
  invoke("preview_navigate", { tabId: previewTab.id, url }).catch(() => {});
  setTimeout(() => {
    invoke("preview_reload", { tabId: previewTab.id }).catch(() => {});
  }, POST_OPEN_RELOAD_MS);
  return previewTab.id;
}

// Watch a server tab's reported URL and resolve once a port has stayed stable
// for STABILITY_MS — Vite-style servers print "Port X is in use, trying..."
// lines before the final bound port, and the debounce filters those out.
function waitForServerPort(groupId, serverTabId, { onResolved, onTimeout }) {
  const startedAt = Date.now();
  let lastPort = null;
  let lastChangeAt = 0;
  let timeoutHandle = null;
  let stopped = false;
  let unsubscribe = null;

  const cleanup = () => {
    stopped = true;
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (unsubscribe) unsubscribe();
  };

  const evaluate = () => {
    if (stopped) return;
    if (Date.now() - startedAt > TIMEOUT_MS) {
      cleanup();
      onTimeout?.();
      return;
    }
    if (lastPort && Date.now() - lastChangeAt >= STABILITY_MS) {
      const port = lastPort;
      cleanup();
      onResolved(port);
      return;
    }
    timeoutHandle = setTimeout(evaluate, 250);
  };

  unsubscribe = useForgeStore.subscribe((nextState) => {
    if (stopped) return;
    const tab = findTab(nextState, groupId, serverTabId);
    if (!tab) {
      cleanup();
      return;
    }
    const port = parseServerPort(tab.suggestedServerName);
    if (!port) return;
    if (port !== lastPort) {
      lastPort = port;
      lastChangeAt = Date.now();
    }
  });

  evaluate();
}

export async function launchPreview(groupId, options = {}) {
  const state = useForgeStore.getState();
  const group = findGroup(state, groupId);
  if (!group) return;

  if (!group.rootPath) {
    useForgeStore.getState().addTab(groupId, {
      name: options.name || "Preview",
      type: "preview",
    });
    return;
  }

  const detectedPort = findDetectedServerPort(group);
  if (detectedPort) {
    spawnPreviewTab(groupId, buildPreviewUrl(detectedPort));
    return;
  }

  let suggestion = null;
  try {
    suggestion = await inferDefaultServerLaunch(group.rootPath);
  } catch (err) {
    console.warn("[forge] preview: dev-command suggestion failed", err);
  }

  if (!suggestion?.command) {
    useForgeStore.getState().addTab(groupId, {
      name: options.name || "Preview",
      type: "preview",
    });
    return;
  }

  const serverTabId = spawnServerTab(groupId, suggestion.command);
  if (!serverTabId) return;

  waitForServerPort(groupId, serverTabId, {
    onResolved: (port) => spawnPreviewTab(groupId, buildPreviewUrl(port)),
    onTimeout: () =>
      console.warn("[forge] preview: timed out waiting for dev server port"),
  });
}

export async function launchPreviewForFile(groupId, relativePath) {
  const state = useForgeStore.getState();
  const group = findGroup(state, groupId);
  if (!group?.rootPath || !relativePath) return;

  const detectedPort = findDetectedServerPort(group);
  if (detectedPort) {
    openOrReusePreviewTab(groupId, buildPreviewUrl(detectedPort, relativePath));
    return;
  }

  let suggestion = null;
  try {
    suggestion = await inferWebPreviewLaunch(group.rootPath, group.serverCommandOverride);
  } catch (err) {
    console.warn("[forge] preview file: dev-command suggestion failed", err);
  }

  if (!suggestion?.command) {
    useForgeStore.getState().addTab(groupId, {
      name: "Preview",
      type: "preview",
    });
    return;
  }

  const serverTabId = spawnServerTab(groupId, suggestion.command);
  if (!serverTabId) return;

  waitForServerPort(groupId, serverTabId, {
    onResolved: (port) =>
      openOrReusePreviewTab(groupId, buildPreviewUrl(port, relativePath)),
    onTimeout: () =>
      console.warn("[forge] preview file: timed out waiting for dev server port"),
  });
}

export function commitNewTab(groupId, tabOptions) {
  if (!groupId || !tabOptions) return;
  if (tabOptions.type === "preview") {
    launchPreview(groupId, tabOptions);
  } else {
    useForgeStore.getState().addTab(groupId, tabOptions);
  }
}
