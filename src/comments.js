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

function showToast(message) {
  const el = document.createElement("div");
  el.className = "preview-comment-toast";
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 220);
  }, 2400);
}

function ensureToastStyles() {
  if (document.getElementById("preview-comment-toast-style")) return;
  const style = document.createElement("style");
  style.id = "preview-comment-toast-style";
  style.textContent = `
    .preview-comment-toast {
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 9999;
      padding: 8px 14px;
      background: var(--bg-active, #141312);
      color: var(--text-primary, #e2e8f0);
      border: 1px solid rgba(var(--accent-active-rgb, 106, 100, 98), 0.45);
      border-radius: 0;
      font-size: 12px;
      font-family: inherit;
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.4);
      opacity: 0;
      transform: translateY(-6px);
      transition: opacity 200ms ease, transform 200ms ease;
      pointer-events: none;
    }
    .preview-comment-toast.show { opacity: 1; transform: none; }
  `;
  document.head.appendChild(style);
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

  ensureToastStyles();
  const providerLabel = provider === "codex" ? "Codex" : "Claude";
  showToast(`→ ${providerLabel} tab spawned`);
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
