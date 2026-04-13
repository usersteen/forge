import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import useForgeStore from "../store/useForgeStore";
import {
  classifyClaudeSessionCommand,
  classifyCodexSessionCommand,
  detectCodexAttentionText,
  extractPlainText,
  getClaudeLaunchMode,
  isClaudeLaunchCommand,
  getCodexLaunchMode,
  isCodexExitCommand,
  looksLikeCodexSession,
  parseAgentStatusTitle,
  summarizeStatusText,
} from "../utils/statusDetection";
import {
  createStatusEngineState,
  getHeatTransition,
  observeStatusTransition,
  reduceLaunchCommand,
  reduceSessionCommand,
  reduceTitleChange,
} from "../utils/statusEngine";

let _audioCtx;
const CODEX_DEBUG_TEXT_LIMIT = 400;
const CODEX_IDLE_TIMEOUT_MS = 5000;
const CODEX_SCREEN_TAIL_LINES = 12;
const CODEX_WORKING_FOOTER_PATTERN = /\besc to interrupt\b/i;
const CODEX_WAITING_FOOTER_PATTERNS = [/\bpress enter to confirm\b/i, /\besc to go back\b/i];
const CODEX_WAITING_OPTION_PATTERN = /^\s*\d+\.\s+/m;
const CODEX_REPLY_TO_WORKING_MS = 10000;
const CODEX_WAITING_CONFIRM_MS = 900;
const CODEX_WAITING_ATTENTION_COOLDOWN_MS = 4000;
const HUMAN_INPUT_PAUSE_MS = 5000;
const RESPONSE_DEBOUNCE_MS = 5000;
const TERMINAL_NOTICE_MS = 6000;
const TERMINAL_RECOVERY_MESSAGE = "Open a new terminal tab and rerun the command you were using.";
const SERVER_URL_PATTERN = /\bhttps?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1|(?:\d{1,3}\.){3}\d{1,3})(?::(\d{2,5}))?(?:\/[^\s]*)?/gi;
const SERVER_HOST_PORT_PATTERN = /\b(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1|(?:\d{1,3}\.){3}\d{1,3}):(\d{2,5})\b/gi;
const SERVER_PORT_HINT_PATTERN =
  /\b(?:local|localhost|listening|ready|started|available|port|network|app|server)\b[^\n\r:]*[: ]+\s*(\d{2,5})\b/i;

function playNotificationSound(volume = 0.3) {
  if (!_audioCtx) _audioCtx = new AudioContext();
  const ctx = _audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 880;
  osc.type = "sine";
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

function getTabSnapshot(store, tabId) {
  for (const group of store.groups) {
    const tab = group.tabs.find((entry) => entry.id === tabId);
    if (tab) {
      return { group, tab };
    }
  }
  return null;
}

function clipDebugText(text) {
  if (!text) return "";
  return text.length > CODEX_DEBUG_TEXT_LIMIT ? text.slice(-CODEX_DEBUG_TEXT_LIMIT) : text;
}

function readTerminalTail(term, lineCount = CODEX_SCREEN_TAIL_LINES) {
  const buffer = term?.buffer?.active;
  if (!buffer || !term?.rows) return "";

  const lastLine = Math.max(0, buffer.baseY + term.rows - 1);
  const firstLine = Math.max(0, lastLine - lineCount + 1);
  const lines = [];

  for (let i = firstLine; i <= lastLine; i += 1) {
    const line = buffer.getLine(i);
    if (!line) continue;
    lines.push(line.translateToString(true));
  }

  return lines.join("\n").trim();
}

function inspectCodexScreen(term) {
  const screenText = readTerminalTail(term);
  if (!screenText) {
    return { screenText: "", status: null, title: "" };
  }

  const hasWaitingFooter = CODEX_WAITING_FOOTER_PATTERNS.some((pattern) => pattern.test(screenText));
  const hasChoiceList = CODEX_WAITING_OPTION_PATTERN.test(screenText);
  if (hasWaitingFooter || (hasChoiceList && /press enter|esc to go back/i.test(screenText))) {
    return { screenText, status: "waiting", title: "" };
  }

  if (CODEX_WORKING_FOOTER_PATTERN.test(screenText)) {
    return { screenText, status: "working", title: "" };
  }

  const attentionTitle = detectCodexAttentionText(screenText);
  if (attentionTitle) {
    return { screenText, status: "waiting", title: attentionTitle };
  }

  return { screenText, status: null, title: "" };
}

function normalizeServerHost(host) {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (normalized === "127.0.0.1" || normalized === "0.0.0.0" || normalized === "::1") {
    return "localhost";
  }
  return normalized;
}

function detectServerName(text) {
  if (!text) return "";

  const candidates = [];
  const seen = new Set();
  const addCandidate = (host, port) => {
    const normalizedHost = normalizeServerHost(host);
    const label = port ? `${normalizedHost}:${port}` : normalizedHost;
    if (!label || seen.has(label)) return;
    seen.add(label);
    candidates.push({
      label,
      priority: normalizedHost === "localhost" ? 0 : 1,
    });
  };

  let match;
  while ((match = SERVER_URL_PATTERN.exec(text))) {
    addCandidate(match[1], match[2] || "");
  }
  while ((match = SERVER_HOST_PORT_PATTERN.exec(text))) {
    addCandidate(match[1], match[2]);
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.priority - b.priority);
    return candidates[0].label;
  }

  const portHintMatch = text.match(SERVER_PORT_HINT_PATTERN);
  if (portHintMatch?.[1]) {
    return `localhost:${portHintMatch[1]}`;
  }

  return "";
}

export default function Terminal({ tabId, isActive, cwd, launchCommand }) {
  const containerRef = useRef(null);
  const fitAddonRef = useRef(null);
  const termRef = useRef(null);
  const initialLaunchCommandRef = useRef(launchCommand);
  const initialLaunchSentRef = useRef(false);
  const noticeTimerRef = useRef(null);
  const launchTimerRef = useRef(null);
  const ptyReady = useRef(false);
  const prevStatusRef = useRef("idle");
  const statusTitleRef = useRef("");
  const inputBufferRef = useRef("");
  const [notice, setNotice] = useState(null);
  const codexDebugRef = useRef({
    recentText: "",
    lastBellByteAt: null,
    lastBellEventAt: null,
  });
  const detectorRef = useRef({
    provider: "unknown",
    awaitingUser: false,
  });
  const recentCodexInputRef = useRef({
    summary: "",
    at: 0,
  });
  const lastCodexInputKindRef = useRef("unknown");
  const recentCodexReplyAtRef = useRef(0);
  const codexWaitingAttentionRef = useRef({
    pendingTimer: null,
    lastAnnouncedAt: 0,
  });
  const codexTitleStatusRef = useRef({
    supported: false,
    lastSeenAt: 0,
  });
  const lastResponseAtRef = useRef(0);
  const statusEngineRef = useRef(createStatusEngineState());

  useEffect(() => {
    const sessionId = crypto.randomUUID();
    let isTearingDown = false;
    let humanInputPauseTimeout;
    let humanInputPauseActive = false;
    let debugScenarioTimers = [];
    const initialSnapshot = getTabSnapshot(useForgeStore.getState(), tabId);
    prevStatusRef.current = initialSnapshot?.tab.status || "idle";
    statusTitleRef.current = initialSnapshot?.tab.statusTitle || "";
    statusEngineRef.current = createStatusEngineState({
      provider: initialSnapshot?.tab.provider,
      status: initialSnapshot?.tab.status,
      statusTitle: initialSnapshot?.tab.statusTitle,
      waitingReason: initialSnapshot?.tab.waitingReason,
    });
    if (
      initialSnapshot?.tab.provider &&
      initialSnapshot.tab.provider !== "unknown" &&
      !initialSnapshot.tab.launchCommand
    ) {
      detectorRef.current.provider = statusEngineRef.current.provider;
      detectorRef.current.awaitingUser =
        statusEngineRef.current.status === "waiting" || statusEngineRef.current.codexWorkingTitleGuard;
    }

    const logCodexDebug = (event, details = {}) => {
      const snapshot = getTabSnapshot(useForgeStore.getState(), tabId);
      console.log(`[Forge][Codex][${tabId}] ${event}`, {
        tabName: snapshot?.tab.name || "",
        tabStatus: snapshot?.tab.status || "",
        awaitingUser: detectorRef.current.awaitingUser,
        provider: detectorRef.current.provider,
        ...details,
      });
    };

    let codexIdleTimeout;

    const clearLaunchTimer = () => {
      clearTimeout(launchTimerRef.current);
      launchTimerRef.current = null;
    };

    const triggerInitialLaunch = () => {
      if (initialLaunchSentRef.current || !ptyReady.current || isTearingDown) return;
      const initialLaunchCommand = initialLaunchCommandRef.current;
      if (!initialLaunchCommand) return;

      initialLaunchSentRef.current = true;
      clearLaunchTimer();
      useForgeStore.getState().clearTabLaunchCommand(tabId);
      handleSubmittedCommand(initialLaunchCommand);
      invoke("write_pty", { tabId, sessionId, data: `${initialLaunchCommand}\r` }).catch((error) => {
        if (isTearingDown) return;
        console.error("Failed to send launch command to PTY:", error);
        handlePtyDisconnect(
          "Terminal session lost",
          `Forge could not start the preset command in this shell. ${TERMINAL_RECOVERY_MESSAGE}`,
          String(error)
        );
      });
    };

    const clearNoticeTimer = () => {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    };

    const clearNotice = () => {
      clearNoticeTimer();
      setNotice(null);
    };

    const clearPersistentNotice = () => {
      setNotice((current) => {
        if (!current?.persistent) {
          return current;
        }
        clearNoticeTimer();
        return null;
      });
    };

    const showTransientNotice = (title, message) => {
      clearNoticeTimer();
      setNotice({
        level: "warning",
        title,
        message,
        detail: "",
        persistent: false,
      });
      noticeTimerRef.current = setTimeout(() => {
        if (!isTearingDown) {
          setNotice(null);
        }
        noticeTimerRef.current = null;
      }, TERMINAL_NOTICE_MS);
    };

    const showPersistentNotice = (title, message, detail = "") => {
      clearNoticeTimer();
      setNotice({
        level: "error",
        title,
        message,
        detail,
        persistent: true,
      });
    };

    const rememberCodexText = (plainText) => {
      if (!plainText) return "";
      const nextText = clipDebugText(
        `${codexDebugRef.current.recentText}\n${plainText}`
          .replace(/\s+/g, " ")
          .trim()
      );
      codexDebugRef.current.recentText = nextText;
      return nextText;
    };

    const clearCodexIdleTimeout = () => {
      clearTimeout(codexIdleTimeout);
      codexIdleTimeout = undefined;
    };

    const resetCodexTitleStatus = () => {
      codexTitleStatusRef.current = {
        supported: false,
        lastSeenAt: 0,
      };
    };

    const noteCodexTitleStatus = () => {
      codexTitleStatusRef.current = {
        supported: true,
        lastSeenAt: Date.now(),
      };
    };

    const hasCodexTitleStatus = () =>
      detectorRef.current.provider === "codex" && codexTitleStatusRef.current.supported;

    const rememberRecentCodexInput = (command) => {
      recentCodexInputRef.current = {
        summary: summarizeStatusText(command).replace(/\s+/g, " ").trim().toLowerCase(),
        at: Date.now(),
      };
    };

    const hasRecentCodexReply = () => Date.now() - recentCodexReplyAtRef.current <= CODEX_REPLY_TO_WORKING_MS;

    const isRecentCodexEcho = (summary) => {
      const normalizedSummary = summary.replace(/\s+/g, " ").trim().toLowerCase();
      if (!normalizedSummary) return false;

      const recentInput = recentCodexInputRef.current;
      if (!recentInput.summary || Date.now() - recentInput.at > 1500) {
        return false;
      }

      if (normalizedSummary !== recentInput.summary) {
        return false;
      }

      recentCodexInputRef.current = { summary: "", at: 0 };
      return true;
    };

    const stopHumanInputPause = () => {
      clearTimeout(humanInputPauseTimeout);
      humanInputPauseTimeout = undefined;
      if (!humanInputPauseActive) return;
      humanInputPauseActive = false;
      useForgeStore.getState().stopHeatPause(`typing:${tabId}`);
    };

    const noteHumanInput = () => {
      const store = useForgeStore.getState();
      const snapshot = getTabSnapshot(store, tabId);
      if (!snapshot || snapshot.tab.type === "server") return;
      store.markTabInteraction(tabId);

      clearPendingCodexWaitingAttention();

      if (!humanInputPauseActive) {
        humanInputPauseActive = true;
        store.startHeatPause(`typing:${tabId}`);
      }

      clearTimeout(humanInputPauseTimeout);
      humanInputPauseTimeout = setTimeout(() => {
        humanInputPauseTimeout = undefined;
        if (!humanInputPauseActive) return;
        humanInputPauseActive = false;
        useForgeStore.getState().stopHeatPause(`typing:${tabId}`);
      }, HUMAN_INPUT_PAUSE_MS);
    };

    const clearPendingCodexWaitingAttention = () => {
      const pendingTimer = codexWaitingAttentionRef.current.pendingTimer;
      if (!pendingTimer) return;
      clearTimeout(pendingTimer);
      codexWaitingAttentionRef.current.pendingTimer = null;
    };

    const clearDebugScenarioTimers = () => {
      debugScenarioTimers.forEach((timer) => clearTimeout(timer));
      debugScenarioTimers = [];
    };

    const scheduleDebugStep = (delayMs, action) => {
      const timer = setTimeout(() => {
        debugScenarioTimers = debugScenarioTimers.filter((entry) => entry !== timer);
        if (isTearingDown) return;
        action();
      }, delayMs);
      debugScenarioTimers.push(timer);
    };

    const maybeNotifyWaiting = (store, tab) => {
      if (tab.type === "server") return;
      const volume = store.soundVolume;
      if (volume === 0) return;

      const activeGroup = store.groups.find((group) => group.id === store.activeGroupId);
      const isCurrentlyActive = activeGroup?.activeTabId === tabId;
      const scale = (isCurrentlyActive && document.hasFocus()) ? 0.4 : 1.0;
      const finalVolume = (volume / 100) * scale;

      playNotificationSound(finalVolume);
      if (!isCurrentlyActive && Notification.permission === "granted") {
        new Notification("Forge", { body: "A terminal needs your attention" });
      }
    };

    const maybeAnnounceWaitingAttention = (store, tab, options = {}) => {
      const { enforceCooldown = false } = options;
      if (tab.type === "server") return false;

      if (enforceCooldown) {
        const now = Date.now();
        const msSinceLastAnnouncement = now - codexWaitingAttentionRef.current.lastAnnouncedAt;
        const hasReplySinceLastAnnouncement =
          recentCodexReplyAtRef.current > codexWaitingAttentionRef.current.lastAnnouncedAt;
        if (msSinceLastAnnouncement < CODEX_WAITING_ATTENTION_COOLDOWN_MS && !hasReplySinceLastAnnouncement) {
          logCodexDebug("waiting-attention-suppressed", {
            cooldownMs: CODEX_WAITING_ATTENTION_COOLDOWN_MS,
            msSinceLastAnnouncement,
            hasReplySinceLastAnnouncement,
            statusTitle: tab.statusTitle,
          });
          return false;
        }
        codexWaitingAttentionRef.current.lastAnnouncedAt = now;
      }

      store.triggerWaitingAttention(tabId);
      maybeNotifyWaiting(store, tab);
      return true;
    };

    const scheduleCodexWaitingAttention = () => {
      clearPendingCodexWaitingAttention();
      codexWaitingAttentionRef.current.pendingTimer = setTimeout(() => {
        codexWaitingAttentionRef.current.pendingTimer = null;
        const store = useForgeStore.getState();
        const snapshot = getTabSnapshot(store, tabId);
        if (!snapshot) return;
        if (detectorRef.current.provider !== "codex") return;
        if (snapshot.tab.status !== "waiting") {
          logCodexDebug("waiting-attention-cancelled", {
            tabStatus: snapshot.tab.status,
            statusTitle: snapshot.tab.statusTitle,
          });
          return;
        }

        maybeAnnounceWaitingAttention(store, snapshot.tab, { enforceCooldown: true });
      }, CODEX_WAITING_CONFIRM_MS);
    };

    const syncServerSuggestion = (plainText = "") => {
      const store = useForgeStore.getState();
      const snapshot = getTabSnapshot(store, tabId);
      if (!snapshot || snapshot.tab.type !== "server") return;

      const detectedName = detectServerName(plainText) || detectServerName(readTerminalTail(termRef.current, 24));
      if (!detectedName) return;

      if (snapshot.tab.suggestedServerName !== detectedName) {
        store.setTabSuggestedServerName(tabId, detectedName);
      }

      if (!snapshot.tab.manuallyRenamed && snapshot.tab.name !== detectedName) {
        store.setTabAutoName(tabId, detectedName);
      }
    };

    const syncDetectorFromEngine = () => {
      const engineState = statusEngineRef.current;
      detectorRef.current.provider = engineState.provider;
      detectorRef.current.awaitingUser =
        engineState.status === "waiting" || engineState.codexWorkingTitleGuard;
    };

    const applyDetectedStatus = (status, title = "", options = {}) => {
      const {
        countResponse = true,
        notifyWaiting = true,
        heatEligibleWaiting = status === "waiting",
        waitingReason: requestedWaitingReason,
        source = "status_detected",
        metadata = {},
      } = options;
      const store = useForgeStore.getState();
      const snapshot = getTabSnapshot(store, tabId);
      if (!snapshot) return;

      const { tab } = snapshot;
      const prevStatus = prevStatusRef.current;
      const currentTitle = statusTitleRef.current || tab.statusTitle || "";
      const nextTitle = title || currentTitle;
      const nextWaitingReason =
        status === "waiting"
          ? (requestedWaitingReason ?? tab.waitingReason ?? null)
          : null;
      const heatTransition = getHeatTransition({
        prevStatus,
        nextStatus: status,
        countResponse,
        heatEligibleWaiting,
        hasHeatWaiting: Boolean(tab.heatWaitingSince),
        tabType: tab.type,
      });
      const shouldSyncTitle = nextTitle !== currentTitle || nextTitle !== (tab.statusTitle || "");
      statusTitleRef.current = nextTitle;
      if (
        status === prevStatus &&
        nextWaitingReason === tab.waitingReason &&
        !heatTransition.opensHeatWaiting &&
        !heatTransition.clearsHeatWaiting &&
        !shouldSyncTitle
      ) return;

      if (detectorRef.current.provider === "codex") {
        logCodexDebug("status-change", {
          from: prevStatus,
          to: status,
          title: nextTitle,
          waitingReason: nextWaitingReason,
          recentText: codexDebugRef.current.recentText,
        });
      }

      prevStatusRef.current = status;
      console.log(`[Forge] status: ${prevStatus} -> ${status}`);

      if (status !== "waiting") {
        clearPendingCodexWaitingAttention();
      }

      const shouldAnnounceWaiting = notifyWaiting && status === "waiting" && prevStatus !== "waiting";
      const shouldDelayCodexWaitingAnnouncement =
        detectorRef.current.provider === "codex" && shouldAnnounceWaiting;

      store.setTabStatus(tabId, status, nextTitle, {
        triggerWaitingAttention: shouldAnnounceWaiting && !shouldDelayCodexWaitingAnnouncement,
        waitingReason: nextWaitingReason,
      });
      if (heatTransition.opensHeatWaiting) {
        store.openHeatWaiting(tabId);
      }
      if (heatTransition.recordsResponse) {
        const now = Date.now();
        if (now - lastResponseAtRef.current >= RESPONSE_DEBOUNCE_MS) {
          lastResponseAtRef.current = now;
          store.recordResponse(tabId);
        } else {
          store.clearHeatWaiting(tabId);
        }
      } else if (heatTransition.clearsHeatWaiting) {
        store.clearHeatWaiting(tabId);
      }
      store.recordStatusTransition({
        tabId,
        prevStatus,
        nextStatus: status,
        source,
        title: nextTitle,
        waitingReason: nextWaitingReason,
        metadata: {
          ...metadata,
          countResponse,
          notifyWaiting,
          heatOpened: heatTransition.opensHeatWaiting,
          heatResolved: heatTransition.recordsResponse,
          heatCleared: heatTransition.clearsHeatWaiting,
        },
      });
      statusEngineRef.current = observeStatusTransition(statusEngineRef.current, {
        provider: detectorRef.current.provider,
        status,
        title: nextTitle,
        waitingReason: nextWaitingReason,
      });
      syncDetectorFromEngine();

      if (shouldAnnounceWaiting) {
        if (shouldDelayCodexWaitingAnnouncement) {
          scheduleCodexWaitingAttention();
          return;
        }
        maybeNotifyWaiting(store, tab);
      }
    };

    const handlePtyDisconnect = (title, message, detail = "") => {
      ptyReady.current = false;
      clearCodexIdleTimeout();
      stopHumanInputPause();
      detectorRef.current = { provider: "unknown", awaitingUser: false };
      applyDetectedStatus("idle", title, {
        countResponse: false,
        notifyWaiting: false,
        source: "pty_disconnect",
        metadata: { detail: detail || message },
      });
      showPersistentNotice(title, message, detail);
    };

    const inspectCodexSurface = (source, fallbackTitle = "", options = {}) => {
      const { allowDuringTitleMode = false } = options;
      if (detectorRef.current.provider !== "codex") return null;
      if (hasCodexTitleStatus() && !allowDuringTitleMode) return null;

      const { status, screenText, title: detectedTitle } = inspectCodexScreen(termRef.current);
      if (!status) return null;

      const title =
        detectedTitle ||
        fallbackTitle ||
        summarizeStatusText(screenText, status === "working" ? "Codex working" : "Codex needs input");

      logCodexDebug("surface-check", {
        source,
        detectedStatus: status,
        title,
        screenText: clipDebugText(screenText.replace(/\s+/g, " ").trim()),
      });

      detectorRef.current.awaitingUser = status === "waiting";
      if (status === "waiting") {
        recentCodexReplyAtRef.current = 0;
      }
      applyDetectedStatus(status, title, {
        countResponse: false,
        source: `codex_surface_${source}`,
        metadata: { surfaceSource: source, detectedTitle: Boolean(detectedTitle) },
        waitingReason:
          status === "waiting"
            ? (detectedTitle ? "interrupted" : "userInput")
            : null,
      });
      return status;
    };

    const scheduleCodexIdleCheck = () => {
      if (detectorRef.current.provider !== "codex") return;
      clearCodexIdleTimeout();
      codexIdleTimeout = setTimeout(() => {
        if (detectorRef.current.provider !== "codex") return;
        const titleModeActive = hasCodexTitleStatus();

        const surfaceStatus = inspectCodexSurface("idle-timeout", "", {
          allowDuringTitleMode: true,
        });
        if (surfaceStatus === "working") {
          scheduleCodexIdleCheck();
          return;
        }
        if (surfaceStatus === "waiting") {
          return;
        }
        if (titleModeActive) {
          scheduleCodexIdleCheck();
          return;
        }

        detectorRef.current.awaitingUser = true;
        recentCodexReplyAtRef.current = 0;
        applyDetectedStatus("waiting", "Codex ready", {
          notifyWaiting: false,
          source: "codex_idle_timeout",
          waitingReason: "ready",
        });
      }, CODEX_IDLE_TIMEOUT_MS);
    };

    const handleCodexOutput = (payload) => {
      const plainText = extractPlainText(payload);
      const summary = summarizeStatusText(plainText);
      const recentText = rememberCodexText(plainText);
      const hasBellByte = payload.includes("\u0007");

      if (hasBellByte) {
        codexDebugRef.current.lastBellByteAt = Date.now();
        logCodexDebug("bell-byte", {
          summary,
          recentText,
        });
      }

      const detector = detectorRef.current;
      if (detector.provider === "unknown" && looksLikeCodexSession(plainText)) {
        detector.provider = "codex";
        detector.awaitingUser = true;
        recentCodexReplyAtRef.current = 0;
        const store = useForgeStore.getState();
        store.setTabProvider(tabId, "codex");
        const snapshot = getTabSnapshot(store, tabId);
        if (snapshot?.tab.type !== "server") {
          store.setTabAutoName(tabId, "Codex");
        }
        logCodexDebug("session-detected", {
          summary: summary || "Codex ready",
          recentText,
        });
        applyDetectedStatus("waiting", summary || "Codex ready", {
          notifyWaiting: false,
          heatEligibleWaiting: false,
          source: "codex_session_detected",
          waitingReason: "ready",
        });
        return;
      }

      if (detector.provider !== "codex") return;

      const attentionTitle = detectCodexAttentionText(plainText);
      if (attentionTitle) {
        clearCodexIdleTimeout();
        detector.awaitingUser = true;
        recentCodexReplyAtRef.current = 0;
        logCodexDebug("attention-output", {
          summary,
          title: attentionTitle,
          recentText,
        });
        applyDetectedStatus("waiting", attentionTitle, {
          source: "codex_attention_output",
          waitingReason: "interrupted",
        });
        return;
      }

      scheduleCodexIdleCheck();

      const snapshot = getTabSnapshot(useForgeStore.getState(), tabId);
      const currentTabStatus = snapshot?.tab.status ?? prevStatusRef.current;

      const surfaceStatus = inspectCodexSurface("output", summary, {
        allowDuringTitleMode: true,
      });
      if (surfaceStatus) return;

      if (hasCodexTitleStatus()) {
        logCodexDebug("ignored-output-title-mode", {
          summary,
          recentText,
          lastTitleAt: codexTitleStatusRef.current.lastSeenAt,
        });
        return;
      }

      if (summary && isRecentCodexEcho(summary)) {
        logCodexDebug("ignored-echo", {
          summary,
          recentText,
        });
        return;
      }

      if (lastCodexInputKindRef.current === "ui") {
        logCodexDebug("ignored-ui-output", {
          summary,
          recentText,
        });
        return;
      }

      if (currentTabStatus === "waiting") {
        if (summary && hasRecentCodexReply() && lastCodexInputKindRef.current !== "ui") {
          logCodexDebug("working-after-reply", {
            summary,
            recentText,
            commandKind: lastCodexInputKindRef.current,
          });
          applyDetectedStatus("working", summary, {
            countResponse: false,
            source: "codex_output_after_reply",
          });
          return;
        }

        logCodexDebug("ignored-ambiguous-output", {
          summary,
          recentText,
        });
        return;
      }

      if (summary) {
        logCodexDebug("working-output", {
          summary,
          recentText,
        });
        applyDetectedStatus("working", summary, {
          countResponse: false,
          source: "codex_output",
        });
      }
    };

    const handleBell = () => {
      const detector = detectorRef.current;
      if (detector.provider === "claude") return;

      const store = useForgeStore.getState();
      const snapshot = getTabSnapshot(store, tabId);
      if (!snapshot) return;
      if (detector.provider === "unknown" && snapshot.tab.launchCommand) return;

      if (detector.provider === "unknown") {
        detector.provider = "codex";
        store.setTabProvider(tabId, "codex");
      }

      const surfaceStatus = inspectCodexSurface(
        "bell",
        statusTitleRef.current || snapshot.tab.statusTitle || "Codex needs attention",
        {
          allowDuringTitleMode: true,
        }
      );
      if (surfaceStatus) {
        return;
      }

      if (hasCodexTitleStatus()) {
        logCodexDebug("ignored-bell-title-mode", {
          recentText: codexDebugRef.current.recentText,
          lastTitleAt: codexTitleStatusRef.current.lastSeenAt,
        });
        return;
      }

      codexDebugRef.current.lastBellEventAt = Date.now();
      logCodexDebug("bell-event", {
        recentText: codexDebugRef.current.recentText,
      });
      clearCodexIdleTimeout();
      detector.awaitingUser = true;
      recentCodexReplyAtRef.current = 0;
      const title = statusTitleRef.current || snapshot.tab.statusTitle || "Codex needs attention";
      applyDetectedStatus("waiting", title, {
        source: "codex_bell",
        waitingReason: "userInput",
      });
    };

    const updateInputBuffer = (data) => {
      if (data === "\u007f" || data === "\b") {
        inputBufferRef.current = inputBufferRef.current.slice(0, -1);
        return null;
      }

      if (data.includes("\u0003")) {
        inputBufferRef.current = "";
        if (detectorRef.current.provider === "codex" && prevStatusRef.current === "working") {
          detectorRef.current.awaitingUser = true;
          recentCodexReplyAtRef.current = 0;
          clearCodexIdleTimeout();
          applyDetectedStatus("waiting", statusTitleRef.current || "Codex interrupted", {
            notifyWaiting: false,
            heatEligibleWaiting: false,
            source: "codex_interrupt",
          });
        }
        return null;
      }

      if (!data.includes("\r") && !data.includes("\n")) {
        inputBufferRef.current += data
          .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
          .replace(/\u001b/g, "");
        return null;
      }

      const command = inputBufferRef.current.trim();
      inputBufferRef.current = "";
      return command;
    };

    const recordBufferedInput = (text) => {
      if (typeof text !== "string" || !text) return;
      inputBufferRef.current += text.replace(/\u001b/g, "");
    };

    const handleSubmittedCommand = (command) => {
      if (!command) return;

      clearPendingCodexWaitingAttention();

      const detector = detectorRef.current;
      const codexLaunchMode = getCodexLaunchMode(command);
      if (codexLaunchMode) {
        useForgeStore.getState().recordDiagnosticsEvent({
          kind: "command_submitted",
          source: "codex_launch_command",
          tabId,
          provider: "codex",
          metadata: {
            launchMode: codexLaunchMode,
            commandLength: command.length,
          },
        });
        const launchResult = reduceLaunchCommand(statusEngineRef.current, {
          provider: "codex",
          launchMode: codexLaunchMode,
          title:
            codexLaunchMode === "interactive"
              ? "Codex ready"
              : summarizeStatusText(command, "Codex"),
        });
        statusEngineRef.current = launchResult.state;
        syncDetectorFromEngine();
        resetCodexTitleStatus();
        const store = useForgeStore.getState();
        store.setTabProvider(tabId, "codex");
        const snapshot = getTabSnapshot(store, tabId);
        if (snapshot?.tab.type !== "server") {
          store.setTabAutoName(tabId, "Codex");
        }
        codexDebugRef.current.recentText = "";
        codexDebugRef.current.lastBellByteAt = null;
        codexDebugRef.current.lastBellEventAt = null;
        codexWaitingAttentionRef.current.lastAnnouncedAt = 0;
        logCodexDebug("command-submitted", {
          command,
          launchMode: codexLaunchMode,
        });
        lastCodexInputKindRef.current = codexLaunchMode === "interactive" ? "launch" : "prompt";
        if (codexLaunchMode === "interactive") {
          clearCodexIdleTimeout();
          applyDetectedStatus(launchResult.transition.status, launchResult.transition.title, {
            notifyWaiting: false,
            heatEligibleWaiting: launchResult.transition.heatEligibleWaiting,
            source: "codex_launch_interactive",
            waitingReason: launchResult.transition.waitingReason,
          });
        } else {
          applyDetectedStatus(launchResult.transition.status, launchResult.transition.title, {
            source: "codex_launch_task",
            waitingReason: launchResult.transition.waitingReason,
          });
          scheduleCodexIdleCheck();
        }
        return;
      }

      if (isClaudeLaunchCommand(command)) {
        clearCodexIdleTimeout();
        const claudeLaunchMode = getClaudeLaunchMode(command);
        useForgeStore.getState().recordDiagnosticsEvent({
          kind: "command_submitted",
          source: "claude_launch_command",
          tabId,
          provider: "claude",
          metadata: {
            launchMode: claudeLaunchMode,
            commandLength: command.length,
          },
        });
        const launchResult = reduceLaunchCommand(statusEngineRef.current, {
          provider: "claude",
          launchMode: claudeLaunchMode,
          title:
            claudeLaunchMode === "interactive"
              ? "Claude ready"
              : summarizeStatusText(command, "Claude"),
        });
        statusEngineRef.current = launchResult.state;
        syncDetectorFromEngine();
        resetCodexTitleStatus();
        const store = useForgeStore.getState();
        store.setTabProvider(tabId, "claude");
        const snapshot = getTabSnapshot(store, tabId);
        if (snapshot?.tab.type !== "server") {
          store.setTabAutoName(tabId, "Claude");
        }
        if (claudeLaunchMode === "interactive") {
          applyDetectedStatus(launchResult.transition.status, launchResult.transition.title, {
            notifyWaiting: false,
            heatEligibleWaiting: launchResult.transition.heatEligibleWaiting,
            source: "claude_launch_interactive",
            waitingReason: launchResult.transition.waitingReason,
          });
        } else {
          applyDetectedStatus(launchResult.transition.status, launchResult.transition.title, {
            source: "claude_launch_task",
            waitingReason: launchResult.transition.waitingReason,
          });
        }
        return;
      }

      if (detector.provider === "claude") {
        const claudeCommandKind = classifyClaudeSessionCommand(command);
        useForgeStore.getState().recordDiagnosticsEvent({
          kind: "command_submitted",
          source: "claude_session_command",
          tabId,
          provider: "claude",
          metadata: {
            commandKind: claudeCommandKind,
            commandLength: command.length,
          },
        });
        const commandResult = reduceSessionCommand(statusEngineRef.current, {
          provider: "claude",
          commandKind: claudeCommandKind,
          summary: summarizeStatusText(command, "Claude"),
        });
        statusEngineRef.current = commandResult.state;
        syncDetectorFromEngine();
        const store = useForgeStore.getState();
        const snapshot = getTabSnapshot(store, tabId);
        if (!snapshot) return;

        if (commandResult.transition && snapshot.tab.status === "waiting") {
          applyDetectedStatus(commandResult.transition.status, commandResult.transition.title, {
            notifyWaiting: false,
            source: "claude_user_reply",
            metadata: { commandKind: claudeCommandKind },
            waitingReason: commandResult.transition.waitingReason,
          });
        }
        return;
      }

      if (detector.provider !== "codex") return;

      if (isCodexExitCommand(command)) {
        useForgeStore.getState().recordDiagnosticsEvent({
          kind: "command_submitted",
          source: "codex_exit_command",
          tabId,
          provider: "codex",
          metadata: {
            commandLength: command.length,
          },
        });
        logCodexDebug("session-exit", {
          command,
          recentText: codexDebugRef.current.recentText,
        });
        clearCodexIdleTimeout();
        detector.provider = "unknown";
        detector.awaitingUser = false;
        resetCodexTitleStatus();
        applyDetectedStatus("idle", "", {
          countResponse: false,
          notifyWaiting: false,
          source: "codex_exit_command",
        });
        return;
      }

      const codexCommandKind = classifyCodexSessionCommand(command);
      const isUiFlow = codexCommandKind === "ui" || command.length <= 1;
      const isPrompt = codexCommandKind === "prompt";
      useForgeStore.getState().recordDiagnosticsEvent({
        kind: "command_submitted",
        source: "codex_session_command",
        tabId,
        provider: "codex",
        metadata: {
          commandKind: codexCommandKind,
          isUiFlow,
          commandLength: command.length,
        },
      });
      const commandResult = reduceSessionCommand(statusEngineRef.current, {
        provider: "codex",
        commandKind: isUiFlow ? "ui" : codexCommandKind,
        summary: summarizeStatusText(command, "Codex"),
      });
      statusEngineRef.current = commandResult.state;
      syncDetectorFromEngine();
      lastCodexInputKindRef.current = isUiFlow ? "ui" : codexCommandKind;
      if (isPrompt) {
        recentCodexReplyAtRef.current = Date.now();
        rememberRecentCodexInput(command);
      } else {
        recentCodexInputRef.current = { summary: "", at: 0 };
      }
      logCodexDebug("user-reply", {
        command,
        commandKind: codexCommandKind,
        isUiFlow,
        recentText: codexDebugRef.current.recentText,
      });
      const store = useForgeStore.getState();
      const snapshot = getTabSnapshot(store, tabId);
      if (commandResult.transition && snapshot?.tab.status === "waiting") {
        applyDetectedStatus(commandResult.transition.status, commandResult.transition.title, {
          notifyWaiting: false,
          source: "codex_user_reply",
          metadata: { commandKind: codexCommandKind, isUiFlow },
          waitingReason: commandResult.transition.waitingReason,
        });
      }
      if (isPrompt) {
        scheduleCodexIdleCheck();
      }
    };

    const ensureDebugCodexProvider = () => {
      detectorRef.current.provider = "codex";
      useForgeStore.getState().setTabProvider(tabId, "codex");
    };

    const simulateCodexStatus = (status, title = "", options = {}) => {
      ensureDebugCodexProvider();
      detectorRef.current.awaitingUser = status === "waiting";
      if (status === "waiting") {
        recentCodexReplyAtRef.current = 0;
      }
      applyDetectedStatus(
        status,
        title || (status === "waiting" ? "Codex needs attention" : "Codex working"),
        {
          waitingReason: status === "waiting" ? "userInput" : null,
          ...options,
        }
      );
    };

    const simulateCodexReply = (command = "debug reply") => {
      ensureDebugCodexProvider();
      lastCodexInputKindRef.current = "prompt";
      detectorRef.current.awaitingUser = false;
      recentCodexReplyAtRef.current = Date.now();
      rememberRecentCodexInput(command);
      applyDetectedStatus("working", summarizeStatusText(command, "Debug reply"), { notifyWaiting: false });
    };

    const runCodexDebugScenario = (scenario = "hiccup") => {
      clearDebugScenarioTimers();
      clearPendingCodexWaitingAttention();

      if (scenario === "hiccup") {
        simulateCodexStatus("working", "Debug: command running", { notifyWaiting: false });
        scheduleDebugStep(80, () => simulateCodexStatus("waiting", "Debug: spinner hiccup"));
        scheduleDebugStep(380, () => simulateCodexStatus("working", "Debug: command resumed", { notifyWaiting: false }));
        return { ok: true, scenario };
      }

      if (scenario === "real-waiting") {
        simulateCodexStatus("working", "Debug: command running", { notifyWaiting: false });
        scheduleDebugStep(80, () => simulateCodexStatus("waiting", "Debug: needs input"));
        return { ok: true, scenario };
      }

      if (scenario === "repeat-churn") {
        simulateCodexStatus("working", "Debug: command running", { notifyWaiting: false });
        scheduleDebugStep(80, () => simulateCodexStatus("waiting", "Debug: first wait"));
        scheduleDebugStep(1700, () => simulateCodexStatus("working", "Debug: resumed", { notifyWaiting: false }));
        scheduleDebugStep(1850, () => simulateCodexStatus("waiting", "Debug: false re-wait"));
        scheduleDebugStep(2250, () => simulateCodexStatus("working", "Debug: resumed again", { notifyWaiting: false }));
        scheduleDebugStep(2400, () => simulateCodexStatus("waiting", "Debug: still waiting"));
        return { ok: true, scenario };
      }

      if (scenario === "reply-then-waiting") {
        simulateCodexStatus("waiting", "Debug: initial wait", { notifyWaiting: false });
        scheduleDebugStep(100, () => simulateCodexReply("debug follow-up"));
        scheduleDebugStep(260, () => simulateCodexStatus("waiting", "Debug: new wait after reply"));
        return { ok: true, scenario };
      }

      if (scenario === "resume-ui") {
        simulateCodexStatus("waiting", "Debug: initial wait", { notifyWaiting: false });
        scheduleDebugStep(100, () => {
          lastCodexInputKindRef.current = "ui";
          recentCodexInputRef.current = { summary: "", at: 0 };
          recentCodexReplyAtRef.current = 0;
          detectorRef.current.awaitingUser = true;
        });
        scheduleDebugStep(220, () => {
          const previous = prevStatusRef.current;
          const summary = "Debug: resume picker";
          if (previous === "waiting" && lastCodexInputKindRef.current !== "ui") {
            applyDetectedStatus("working", summary, { notifyWaiting: false });
          }
        });
        scheduleDebugStep(420, () => simulateCodexStatus("waiting", "Debug: back from resume", { notifyWaiting: false }));
        return { ok: true, scenario };
      }

      return { ok: false, error: `Unknown scenario: ${scenario}` };
    };

    if (import.meta.env.DEV && typeof window !== "undefined") {
      const debugWindow = window;
      const forgeDebug = debugWindow.forgeDebug || (debugWindow.forgeDebug = {});
      const terminals = forgeDebug.terminals || (forgeDebug.terminals = {});

      terminals[tabId] = {
        getInfo: () => {
          const snapshot = getTabSnapshot(useForgeStore.getState(), tabId);
          return {
            tabId,
            name: snapshot?.tab.name || "",
            status: snapshot?.tab.status || prevStatusRef.current,
            provider: snapshot?.tab.provider || detectorRef.current.provider,
            active: Boolean(snapshot && snapshot.group.activeTabId === tabId && useForgeStore.getState().activeGroupId === snapshot.group.id),
          };
        },
        simulateCodexStatus,
        simulateCodexReply,
        runScenario: runCodexDebugScenario,
      };

      forgeDebug.listTerminals = () =>
        Object.values(forgeDebug.terminals || {}).map((terminal) => terminal.getInfo());

      forgeDebug.getActiveTerminal = () =>
        forgeDebug.listTerminals().find((terminal) => terminal.active) || null;

      forgeDebug.simulateCodex = (scenario = "hiccup", targetTabId = null) => {
        const activeTerminal = forgeDebug.getActiveTerminal();
        const terminal =
          (targetTabId && forgeDebug.terminals?.[targetTabId]) ||
          (activeTerminal && forgeDebug.terminals?.[activeTerminal.tabId]);
        if (!terminal) {
          return { ok: false, error: "No active Forge terminal found." };
        }
        return terminal.runScenario(scenario);
      };
    }

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "'IBM Plex Mono', 'Cascadia Code', 'Consolas', monospace",
      fontSize: 14,
      theme: {
        background: "#080c14",
        foreground: "#c5cdd9",
        cursor: "#c5cdd9",
        selectionBackground: "#28344a",
      },
    });

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    termRef.current = term;
    term.open(containerRef.current);
    fitAddon.fit();

    let webglAddon = null;
    let webglContextLossListener = null;
    try {
      webglAddon = new WebglAddon();
      webglContextLossListener = webglAddon.onContextLoss(() => {
        if (isTearingDown) return;
        console.warn("WebGL renderer lost context, falling back to DOM renderer");
        showTransientNotice(
          "Terminal display recovered",
          "Forge switched this tab to a safer renderer. Your session should still be running."
        );
        try {
          webglAddon?.dispose();
        } catch (error) {
          console.warn("Failed to dispose WebGL addon after context loss", error);
        }
        requestAnimationFrame(() => {
          fitAddon.fit();
          term.refresh(0, term.rows - 1);
        });
      });
      term.loadAddon(webglAddon);
    } catch (error) {
      console.warn("WebGL addon failed, falling back to default renderer", error);
    }

    const unlistenOutput = listen(`pty-output-${tabId}`, (event) => {
      if (event.payload?.sessionId !== sessionId) return;
      clearPersistentNotice();
      term.write(event.payload.data);
      triggerInitialLaunch();
      syncServerSuggestion(extractPlainText(event.payload.data));
      handleCodexOutput(event.payload.data);
    });
    const unlistenExit = listen(`pty-exit-${tabId}`, (event) => {
      if (event.payload?.sessionId !== sessionId) return;
      if (isTearingDown) return;
      handlePtyDisconnect(
        "Terminal session ended",
        `This shell ended or disconnected. ${TERMINAL_RECOVERY_MESSAGE}`,
        cwd ? `Working directory: ${cwd}` : ""
      );
    });
    const unlistenError = listen(`pty-error-${tabId}`, (event) => {
      if (event.payload?.sessionId !== sessionId) return;
      if (isTearingDown) return;
      handlePtyDisconnect(
        "Terminal session lost",
        `Forge lost the connection to this shell. ${TERMINAL_RECOVERY_MESSAGE}`,
        event.payload?.error ? String(event.payload.error) : cwd ? `Working directory: ${cwd}` : ""
      );
    });
    const bellListener = term.onBell(handleBell);

    invoke("spawn_pty", { tabId, sessionId, rows: term.rows, cols: term.cols, cwd: cwd || null })
      .then(() => {
        if (isTearingDown) return;
        ptyReady.current = true;
        clearNotice();
        const initialLaunchCommand = initialLaunchCommandRef.current;
        if (!initialLaunchCommand) return;
        clearLaunchTimer();
        launchTimerRef.current = setTimeout(() => {
          launchTimerRef.current = null;
          triggerInitialLaunch();
        }, 250);
      })
      .catch((err) => {
        console.error("Failed to spawn PTY:", err);
        handlePtyDisconnect(
          "Terminal failed to start",
          "Forge could not start the shell for this tab.",
          String(err)
        );
      });

    term.onData((data) => {
      noteHumanInput();
      const command = updateInputBuffer(data);
      if (command !== null) {
        handleSubmittedCommand(command);
      }

      if (ptyReady.current) {
        invoke("write_pty", { tabId, sessionId, data }).catch((error) => {
          if (isTearingDown) return;
          console.error("Failed to write to PTY:", error);
          handlePtyDisconnect(
            "Terminal session lost",
            `Forge could not send input to this shell. ${TERMINAL_RECOVERY_MESSAGE}`,
            String(error)
          );
        });
      }
    });

    const writeBracketedPaste = (text, failureLabel = "paste into PTY") => {
      if (!text || !ptyReady.current) return;
      noteHumanInput();
      recordBufferedInput(text);
      const bracketed = `\x1b[200~${text}\x1b[201~`;
      invoke("write_pty", { tabId, sessionId, data: bracketed }).catch((error) => {
        if (isTearingDown) return;
        console.error(`Failed to ${failureLabel}:`, error);
        handlePtyDisconnect(
          "Terminal session lost",
          `Forge could not send pasted text to this shell. ${TERMINAL_RECOVERY_MESSAGE}`,
          String(error)
        );
      });
    };

    const copySelectionToClipboard = () => {
      const selection = term.getSelection();
      if (!selection) return false;
      invoke("write_clipboard_text", { text: selection }).catch((error) => {
        if (isTearingDown) return;
        console.error("Failed to copy selection to clipboard:", error);
        showTransientNotice("Copy failed", "Forge could not write the selected text to the system clipboard.");
      });
      return true;
    };

    const pasteNativeClipboard = () => {
      if (!ptyReady.current) return;
      invoke("read_clipboard_payload")
        .then((payload) => {
          if (!payload) {
            showTransientNotice("Clipboard empty", "There is no text or image data available to paste.");
            return;
          }
          if (payload.kind === "image") {
            writeBracketedPaste(payload.filePath ?? payload.file_path, "paste clipboard image path into PTY");
            return;
          }
          if (payload.kind === "text") {
            writeBracketedPaste(payload.text);
            return;
          }
          console.warn("Unsupported clipboard payload:", payload);
        })
        .catch((error) => {
          if (isTearingDown) return;
          console.error("Failed to read clipboard:", error);
          showTransientNotice("Paste failed", "Forge could not read the system clipboard.");
        });
    };

    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;
      const key = e.key.toLowerCase();
      const hasPrimaryModifier = e.ctrlKey || e.metaKey;

      // Copy: Ctrl+Shift+C copies selection (terminal convention).
      // Plain Ctrl+C always passes through as interrupt (SIGINT).
      if (hasPrimaryModifier && e.shiftKey && key === "c") {
        if (copySelectionToClipboard()) {
          e.preventDefault();
          return false;
        }
        return true;
      }

      // Ctrl+C without shift — always let xterm send \x03 (interrupt).
      // Prevent the browser/webview from intercepting it as a copy shortcut.
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && key === "c") {
        e.preventDefault();
        return true;
      }

      // Paste: Ctrl+Shift+V (terminal convention) or Ctrl+V — trigger a
      // native paste event so the paste listener can read clipboardData
      // (text + images) without WebKit permission prompts.
      if (hasPrimaryModifier && key === "v") {
        e.preventDefault();
        pasteNativeClipboard();
        return false;
      }

      // Linebreak: Ctrl+Enter — send a raw newline without shell execution
      if (hasPrimaryModifier && e.key === "Enter") {
        if (ptyReady.current) {
          noteHumanInput();
          invoke("write_pty", { tabId, sessionId, data: "\n" }).catch((error) => {
            if (isTearingDown) return;
            console.error("Failed to send modified Enter to PTY:", error);
            handlePtyDisconnect(
              "Terminal session lost",
              `Forge could not send input to this shell. ${TERMINAL_RECOVERY_MESSAGE}`,
              String(error)
            );
          });
        }
        return false;
      }

      // Block Cmd+key combos from reaching xterm on macOS so they trigger
      // native behaviour (Cmd+C = copy in non-terminal contexts, etc.)
      if (e.metaKey) return false;

      return true;
    });

    term.onResize(({ cols, rows }) => {
      invoke("resize_pty", { tabId, sessionId, rows, cols }).catch((error) => {
        if (isTearingDown || !ptyReady.current) return;
        console.error("Failed to resize PTY:", error);
        handlePtyDisconnect(
          "Terminal session lost",
          `Forge lost the shell while resizing this tab. ${TERMINAL_RECOVERY_MESSAGE}`,
          String(error)
        );
      });
    });

    term.onTitleChange((title) => {
      const store = useForgeStore.getState();
      const snapshot = getTabSnapshot(store, tabId);
      const launchPending = Boolean(snapshot?.tab.launchCommand);
      const provider =
        detectorRef.current.provider !== "unknown"
          ? detectorRef.current.provider
          : launchPending
            ? "unknown"
            : (snapshot?.tab.provider ?? "unknown");

      if (provider === "unknown") {
        return;
      }

      const parsedTitle = parseAgentStatusTitle(title);
      const titleResult = reduceTitleChange(statusEngineRef.current, {
        provider,
        titleInfo: parsedTitle,
        rawTitle: title,
      });
      statusEngineRef.current = titleResult.state;
      syncDetectorFromEngine();
      if (titleResult.ignored) {
        store.recordDiagnosticsEvent({
          kind: "event",
          source: `${provider}_title_change_ignored`,
          tabId,
          provider,
          metadata: {
            titleStatus: parsedTitle?.status || "",
            rawTitle: title,
          },
        });
        return;
      }

      let nextStatus = parsedTitle?.status ?? null;
      let nextLabel = parsedTitle?.label ?? "";

      if (provider === "codex") {
        if (parsedTitle?.status === "working") {
          noteCodexTitleStatus();
        } else if (hasCodexTitleStatus()) {
          nextStatus = "waiting";
          nextLabel = "";
        }
      }

      if (!nextStatus) return;

      detectorRef.current.provider = titleResult.state.provider;
      detectorRef.current.awaitingUser = titleResult.state.status === "waiting";

      if (provider === "codex") {
        if (nextStatus === "waiting") {
          clearCodexIdleTimeout();
          recentCodexReplyAtRef.current = 0;
        } else {
          scheduleCodexIdleCheck();
        }
      }

      store.setTabProvider(tabId, provider);
      if (provider === "claude" && nextLabel && snapshot?.tab.type !== "server") {
        store.setTabAutoName(tabId, nextLabel);
      }

      applyDetectedStatus(nextStatus, nextLabel || title, {
        countResponse: false,
        source: `${provider}_title_change`,
        metadata: { rawTitle: title },
        waitingReason: nextStatus === "waiting" ? "userInput" : null,
      });
    });

    let resizeTimeout;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => fitAddon.fit(), 100);
    });
    resizeObserver.observe(containerRef.current);

    // Use a native paste event listener instead of navigator.clipboard API
    // because WebKit (macOS Tauri) blocks the Clipboard API with permission prompts.
    const pasteContainer = containerRef.current;
    const handlePaste = (e) => {
      e.preventDefault();
      if (!ptyReady.current) return;

      // Check for image data first (screenshots, copied images)
      const items = e.clipboardData?.items;
      if (items) {
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            const blob = item.getAsFile();
            if (!blob) continue;
            if (blob.size > 50 * 1024 * 1024) {
              console.warn("Clipboard image too large (>50MB), skipping");
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              // Strip the data:image/...;base64, prefix
              const base64 = reader.result.split(",")[1];
              invoke("save_clipboard_image", { dataBase64: base64, mime: item.type })
                .then((filePath) => {
                  writeBracketedPaste(filePath, "paste image path into PTY");
                })
                .catch((error) => {
                  console.error("Failed to save clipboard image:", error);
                });
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }

      // Fall back to plain text paste
      const text = e.clipboardData?.getData("text/plain");
      if (text) {
        writeBracketedPaste(text);
      }
    };
    pasteContainer.addEventListener("paste", handlePaste);

    return () => {
      isTearingDown = true;
      bellListener.dispose();
      clearCodexIdleTimeout();
      clearPendingCodexWaitingAttention();
      clearDebugScenarioTimers();
      clearLaunchTimer();
      stopHumanInputPause();
      clearNoticeTimer();
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      pasteContainer.removeEventListener("paste", handlePaste);
      unlistenOutput.then((unlisten) => unlisten());
      unlistenExit.then((unlisten) => unlisten());
      unlistenError.then((unlisten) => unlisten());
      webglContextLossListener?.dispose?.();
      webglAddon?.dispose?.();
      invoke("kill_pty", { tabId, sessionId });
      term.dispose();
      fitAddonRef.current = null;
      termRef.current = null;
      ptyReady.current = false;
      inputBufferRef.current = "";
      statusTitleRef.current = "";
      initialLaunchSentRef.current = false;
      codexDebugRef.current = {
        recentText: "",
        lastBellByteAt: null,
        lastBellEventAt: null,
      };
      codexWaitingAttentionRef.current = {
        pendingTimer: null,
        lastAnnouncedAt: 0,
      };
      if (import.meta.env.DEV && typeof window !== "undefined" && window.forgeDebug?.terminals) {
        delete window.forgeDebug.terminals[tabId];
      }
      detectorRef.current = { provider: "unknown", awaitingUser: false };
      statusEngineRef.current = createStatusEngineState();
      lastResponseAtRef.current = 0;
      recentCodexInputRef.current = { summary: "", at: 0 };
      recentCodexReplyAtRef.current = 0;
      lastCodexInputKindRef.current = "unknown";
      codexTitleStatusRef.current = {
        supported: false,
        lastSeenAt: 0,
      };
    };
  }, [tabId, cwd]);

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      termRef.current?.focus();
      const id = requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
        termRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isActive]);

  // Focus guard — use native Tauri window events instead of DOM-level listeners.
  // Previous attempts with focusin/focusout/window.focus all failed because the
  // focus loss was at the native NSWindow level (borderless window losing key status),
  // not the DOM level. With decorations: true on macOS the root cause is fixed,
  // but we keep these as defense-in-depth.
  useEffect(() => {
    if (!isActive) return;

    const appWindow = getCurrentWindow();
    let windowBlurred = false;
    let unlistenFocusChanged;

    // Native Tauri event: fires when NSWindow gains/loses key window status.
    const setup = async () => {
      unlistenFocusChanged = await appWindow.onFocusChanged(({ payload: focused }) => {
        if (focused) {
          windowBlurred = false;
          termRef.current?.focus();
        } else {
          windowBlurred = true;
        }
      });
    };
    setup();

    // Safety net: if a keystroke reaches the document but xterm's textarea isn't
    // focused, redirect immediately. Skip if user intentionally left the window.
    const handleKeyDown = (event) => {
      if (windowBlurred) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        if (target.isContentEditable) return;
        const tag = target.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        // Allow xterm's own textarea
        if (tag === "textarea" && containerRef.current?.contains(target)) return;
      }
      termRef.current?.focus();
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      unlistenFocusChanged?.then?.((fn) => fn());
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isActive]);

  return (
    <div className="terminal-shell" onMouseDown={() => isActive && termRef.current?.focus()}>
      <div
        ref={containerRef}
        className="terminal-canvas"
        style={{ width: "100%", height: "100%", padding: "4px" }}
      />
      {notice ? (
        <div className={`terminal-notice terminal-notice-${notice.level}`}>
          <div className="terminal-notice-title">{notice.title}</div>
          <div className="terminal-notice-message">{notice.message}</div>
          {notice.detail ? <div className="terminal-notice-detail">{notice.detail}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
