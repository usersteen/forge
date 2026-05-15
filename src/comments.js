import { listen } from "@tauri-apps/api/event";
import useForgeStore from "./store/useForgeStore";

let initialized = false;

function findGroupForTab(state, tabId) {
  for (const group of state.groups) {
    if (group.tabs.some((tab) => tab.id === tabId)) {
      return group;
    }
  }
  return null;
}

function handleCommentReceived(payload) {
  const { tabId, provider, shortLabel, tabLabel, launchCommand, initialPrompt } = payload || {};
  if (!tabId || !launchCommand || !initialPrompt) return;

  const store = useForgeStore.getState();
  const sourceGroup = findGroupForTab(store, tabId);
  const groupId = sourceGroup?.id || store.activeGroupId;
  if (!groupId) return;

  const tabName = tabLabel
    ? tabLabel
    : shortLabel
      ? `${provider === "codex" ? "Codex" : "Claude"}: ${shortLabel}`
      : provider === "codex"
        ? "Codex"
        : "Claude";

  store.addTab(groupId, {
    type: "ai",
    provider: provider === "codex" ? "codex" : "claude",
    name: tabName,
    launchCommand,
    initialPrompt,
    manuallyRenamed: Boolean(tabLabel),
    activate: false,
  });
  if (sourceGroup) {
    store.setActiveTab(groupId, tabId);
  }
}

export async function initCommentDispatcher() {
  if (initialized) return;
  initialized = true;
  try {
    await listen("comment:received", (event) => {
      try {
        handleCommentReceived(event.payload);
      } catch (err) {
        console.error("[forge] comment dispatch failed", err);
      }
    });
  } catch (err) {
    console.error("[forge] failed to subscribe to comment:received", err);
  }
}
