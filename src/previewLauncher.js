import { invoke } from "@tauri-apps/api/core";
import useForgeStore from "./store/useForgeStore";
import { inferDefaultServerLaunch } from "./utils/devServerSuggestion";

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

function findGroup(state, groupId) {
  return state.groups.find((g) => g.id === groupId) || null;
}

function findTab(state, groupId, tabId) {
  return findGroup(state, groupId)?.tabs.find((t) => t.id === tabId) || null;
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

export async function launchPreview(groupId, options = {}) {
  const state = useForgeStore.getState();
  const group = findGroup(state, groupId);
  if (!group) return;

  // No project context → open empty preview tab and let user type URL.
  if (!group.rootPath) {
    useForgeStore.getState().addTab(groupId, {
      name: options.name || "Preview",
      type: "preview",
    });
    return;
  }

  let suggestion = null;
  try {
    suggestion = await inferDefaultServerLaunch(group.rootPath);
  } catch (err) {
    console.warn("[forge] preview: dev-command suggestion failed", err);
  }

  if (!suggestion?.command) {
    // No suggestion — open empty preview tab as a fallback.
    useForgeStore.getState().addTab(groupId, {
      name: options.name || "Preview",
      type: "preview",
    });
    return;
  }

  // 1. Spawn the server tab and let it become the active tab so the user
  //    sees boot output. addTab already sets activeTabId to the new tab.
  const serverTabId = spawnServerTab(groupId, suggestion.command);
  if (!serverTabId) return;

  // 2. Watch the server tab's reported URL and only commit once it has been
  //    stable for STABILITY_MS — that filters out the noisy "trying another
  //    one" lines and lands on the final bound port.
  const startedAt = Date.now();
  let lastPort = null;
  let lastChangeAt = 0;
  let timeoutHandle = null;
  let stopped = false;

  const cleanup = () => {
    stopped = true;
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (unsubscribe) unsubscribe();
  };

  const evaluate = () => {
    if (stopped) return;
    if (Date.now() - startedAt > TIMEOUT_MS) {
      console.warn("[forge] preview: timed out waiting for dev server port");
      cleanup();
      return;
    }
    if (lastPort && Date.now() - lastChangeAt >= STABILITY_MS) {
      cleanup();
      spawnPreviewTab(groupId, `http://localhost:${lastPort}`);
      return;
    }
    timeoutHandle = setTimeout(evaluate, 250);
  };

  let unsubscribe = useForgeStore.subscribe((nextState) => {
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

export function commitNewTab(groupId, tabOptions) {
  if (!groupId || !tabOptions) return;
  if (tabOptions.type === "preview") {
    launchPreview(groupId, tabOptions);
  } else {
    useForgeStore.getState().addTab(groupId, tabOptions);
  }
}
