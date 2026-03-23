import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import useForgeStore from "../store/useForgeStore";
import {
  extractPlainText,
  getCodexLaunchMode,
  isCodexExitCommand,
  looksLikeCodexSession,
  summarizeStatusText,
} from "../utils/statusDetection";

let _audioCtx;
const CODEX_DEBUG_TEXT_LIMIT = 400;
const CODEX_IDLE_TIMEOUT_MS = 5000;
const CODEX_SCREEN_TAIL_LINES = 12;
const CODEX_WORKING_FOOTER_PATTERN = /\besc to interrupt\b/i;
const CODEX_WAITING_FOOTER_PATTERNS = [/\bpress enter to confirm\b/i, /\besc to go back\b/i];
const CODEX_WAITING_OPTION_PATTERN = /^\s*\d+\.\s+/m;
const CODEX_REPLY_TO_WORKING_MS = 10000;
const HUMAN_INPUT_PAUSE_MS = 5000;
const TERMINAL_NOTICE_MS = 6000;
const TERMINAL_RECOVERY_MESSAGE = "Open a new terminal tab and rerun the command you were using.";
const SERVER_URL_PATTERN = /\bhttps?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1|(?:\d{1,3}\.){3}\d{1,3})(?::(\d{2,5}))?(?:\/[^\s]*)?/gi;
const SERVER_HOST_PORT_PATTERN = /\b(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1|(?:\d{1,3}\.){3}\d{1,3}):(\d{2,5})\b/gi;
const SERVER_PORT_HINT_PATTERN =
  /\b(?:local|localhost|listening|ready|started|available|port|network|app|server)\b[^\n\r:]*[: ]+\s*(\d{2,5})\b/i;

function playNotificationSound() {
  if (!_audioCtx) _audioCtx = new AudioContext();
  const ctx = _audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 880;
  osc.type = "sine";
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
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
    return { screenText: "", status: null };
  }

  const hasWaitingFooter = CODEX_WAITING_FOOTER_PATTERNS.some((pattern) => pattern.test(screenText));
  const hasChoiceList = CODEX_WAITING_OPTION_PATTERN.test(screenText);
  if (hasWaitingFooter || (hasChoiceList && /press enter|esc to go back/i.test(screenText))) {
    return { screenText, status: "waiting" };
  }

  if (CODEX_WORKING_FOOTER_PATTERN.test(screenText)) {
    return { screenText, status: "working" };
  }

  return { screenText, status: null };
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
  const noticeTimerRef = useRef(null);
  const ptyReady = useRef(false);
  const prevStatusRef = useRef("idle");
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
  const recentCodexReplyAtRef = useRef(0);

  useEffect(() => {
    let isTearingDown = false;
    let humanInputPauseTimeout;
    let humanInputPauseActive = false;

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
      const snapshot = getTabSnapshot(useForgeStore.getState(), tabId);
      if (!snapshot || snapshot.tab.type === "server") return;

      if (!humanInputPauseActive) {
        humanInputPauseActive = true;
        useForgeStore.getState().startHeatPause(`typing:${tabId}`);
      }

      clearTimeout(humanInputPauseTimeout);
      humanInputPauseTimeout = setTimeout(() => {
        humanInputPauseTimeout = undefined;
        if (!humanInputPauseActive) return;
        humanInputPauseActive = false;
        useForgeStore.getState().stopHeatPause(`typing:${tabId}`);
      }, HUMAN_INPUT_PAUSE_MS);
    };

    const maybeNotifyWaiting = (store, tab) => {
      if (tab.type === "server") return;
      const activeGroup = store.groups.find((group) => group.id === store.activeGroupId);
      const isCurrentlyActive = activeGroup?.activeTabId === tabId;
      if (isCurrentlyActive) return;

      playNotificationSound();
      if (Notification.permission === "granted") {
        new Notification("Forge", { body: "A terminal needs your attention" });
      }
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

    const applyDetectedStatus = (status, title = "", options = {}) => {
      const { countResponse = true, notifyWaiting = true } = options;
      const store = useForgeStore.getState();
      const snapshot = getTabSnapshot(store, tabId);
      if (!snapshot) return;

      const { tab } = snapshot;
      const prevStatus = prevStatusRef.current;
      const nextTitle = title || tab.statusTitle || "";
      if (status === prevStatus && nextTitle === tab.statusTitle) return;

      if (detectorRef.current.provider === "codex") {
        logCodexDebug("status-change", {
          from: prevStatus,
          to: status,
          title: nextTitle,
          recentText: codexDebugRef.current.recentText,
        });
      }

      prevStatusRef.current = status;
      console.log(`[Forge] status: ${prevStatus} -> ${status}`);

      if (countResponse && prevStatus === "waiting" && status === "working" && tab.type !== "server") {
        store.recordResponse(tabId);
      }

      store.setTabStatus(tabId, status, nextTitle);

      if (notifyWaiting && status === "waiting" && prevStatus !== "waiting") {
        maybeNotifyWaiting(store, tab);
      }
    };

    const handlePtyDisconnect = (title, message, detail = "") => {
      ptyReady.current = false;
      clearCodexIdleTimeout();
      stopHumanInputPause();
      detectorRef.current = { provider: "unknown", awaitingUser: false };
      applyDetectedStatus("idle", title, { countResponse: false, notifyWaiting: false });
      showPersistentNotice(title, message, detail);
    };

    const inspectCodexSurface = (source, fallbackTitle = "") => {
      if (detectorRef.current.provider !== "codex") return null;

      const { status, screenText } = inspectCodexScreen(termRef.current);
      if (!status) return null;

      const title = fallbackTitle || summarizeStatusText(screenText, status === "working" ? "Codex working" : "Codex needs input");

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
      applyDetectedStatus(status, title);
      return status;
    };

    const scheduleCodexIdleCheck = () => {
      if (detectorRef.current.provider !== "codex") return;
      clearCodexIdleTimeout();
      codexIdleTimeout = setTimeout(() => {
        if (detectorRef.current.provider !== "codex") return;

        const surfaceStatus = inspectCodexSurface("idle-timeout");
        if (surfaceStatus === "working") {
          scheduleCodexIdleCheck();
          return;
        }
        if (surfaceStatus === "waiting") {
          return;
        }

        detectorRef.current.awaitingUser = true;
        recentCodexReplyAtRef.current = 0;
        applyDetectedStatus("waiting", "Codex ready", { notifyWaiting: false });
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
        applyDetectedStatus("waiting", summary || "Codex ready", { notifyWaiting: false });
        return;
      }

      if (detector.provider !== "codex") return;
      scheduleCodexIdleCheck();

      const snapshot = getTabSnapshot(useForgeStore.getState(), tabId);
      const currentTabStatus = snapshot?.tab.status ?? prevStatusRef.current;

      const surfaceStatus = inspectCodexSurface("output", summary);
      if (surfaceStatus) return;

      if (summary && isRecentCodexEcho(summary)) {
        logCodexDebug("ignored-echo", {
          summary,
          recentText,
        });
        return;
      }

      if (currentTabStatus === "waiting") {
        if (summary && hasRecentCodexReply()) {
          logCodexDebug("working-after-reply", {
            summary,
            recentText,
          });
          applyDetectedStatus("working", summary);
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
        applyDetectedStatus("working", summary);
      }
    };

    const handleBell = () => {
      const detector = detectorRef.current;
      if (detector.provider === "claude") return;

      const store = useForgeStore.getState();
      const snapshot = getTabSnapshot(store, tabId);
      if (!snapshot) return;

      if (detector.provider === "unknown") {
        detector.provider = "codex";
        store.setTabProvider(tabId, "codex");
      }

      codexDebugRef.current.lastBellEventAt = Date.now();
      logCodexDebug("bell-event", {
        recentText: codexDebugRef.current.recentText,
      });
      clearCodexIdleTimeout();
      detector.awaitingUser = true;
      recentCodexReplyAtRef.current = 0;
      const title = snapshot.tab.statusTitle || "Codex needs attention";
      applyDetectedStatus("waiting", title);
    };

    const updateInputBuffer = (data) => {
      if (data === "\u007f" || data === "\b") {
        inputBufferRef.current = inputBufferRef.current.slice(0, -1);
        return null;
      }

      if (data.includes("\u0003")) {
        inputBufferRef.current = "";
        if (detectorRef.current.provider === "codex") {
          detectorRef.current.provider = "unknown";
          detectorRef.current.awaitingUser = false;
          applyDetectedStatus("idle", "");
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

    const handleSubmittedCommand = (command) => {
      if (!command) return;

      const detector = detectorRef.current;
      const codexLaunchMode = getCodexLaunchMode(command);
      if (codexLaunchMode) {
        detector.provider = "codex";
        detector.awaitingUser = codexLaunchMode === "interactive";
        const store = useForgeStore.getState();
        store.setTabProvider(tabId, "codex");
        const snapshot = getTabSnapshot(store, tabId);
        if (snapshot?.tab.type !== "server") {
          store.setTabAutoName(tabId, "Codex");
        }
        codexDebugRef.current.recentText = "";
        codexDebugRef.current.lastBellByteAt = null;
        codexDebugRef.current.lastBellEventAt = null;
        logCodexDebug("command-submitted", {
          command,
          launchMode: codexLaunchMode,
        });
        if (codexLaunchMode === "interactive") {
          clearCodexIdleTimeout();
          applyDetectedStatus("waiting", "Codex ready", { notifyWaiting: false });
        } else {
          applyDetectedStatus("working", summarizeStatusText(command, "Codex"));
          scheduleCodexIdleCheck();
        }
        return;
      }

      if (detector.provider !== "codex") return;

      if (isCodexExitCommand(command)) {
        logCodexDebug("session-exit", {
          command,
          recentText: codexDebugRef.current.recentText,
        });
        clearCodexIdleTimeout();
        detector.provider = "unknown";
        detector.awaitingUser = false;
        applyDetectedStatus("idle", "", { countResponse: false, notifyWaiting: false });
        return;
      }

      detector.awaitingUser = false;
      recentCodexReplyAtRef.current = Date.now();
      rememberRecentCodexInput(command);
      logCodexDebug("user-reply", {
        command,
        recentText: codexDebugRef.current.recentText,
      });
      scheduleCodexIdleCheck();
    };

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
      clearPersistentNotice();
      term.write(event.payload);
      syncServerSuggestion(extractPlainText(event.payload));
      handleCodexOutput(event.payload);
    });
    const unlistenExit = listen(`pty-exit-${tabId}`, () => {
      if (isTearingDown) return;
      handlePtyDisconnect(
        "Terminal session ended",
        `This shell ended or disconnected. ${TERMINAL_RECOVERY_MESSAGE}`,
        cwd ? `Working directory: ${cwd}` : ""
      );
    });
    const unlistenError = listen(`pty-error-${tabId}`, (event) => {
      if (isTearingDown) return;
      handlePtyDisconnect(
        "Terminal session lost",
        `Forge lost the connection to this shell. ${TERMINAL_RECOVERY_MESSAGE}`,
        event.payload ? String(event.payload) : cwd ? `Working directory: ${cwd}` : ""
      );
    });
    const bellListener = term.onBell(handleBell);

    invoke("spawn_pty", { tabId, rows: term.rows, cols: term.cols, cwd: cwd || null })
      .then(() => {
        ptyReady.current = true;
        clearNotice();
        const initialLaunchCommand = initialLaunchCommandRef.current;
        if (!initialLaunchCommand) return;

        useForgeStore.getState().clearTabLaunchCommand(tabId);
        handleSubmittedCommand(initialLaunchCommand);
        invoke("write_pty", { tabId, data: `${initialLaunchCommand}\r` }).catch((error) => {
          if (isTearingDown) return;
          console.error("Failed to send launch command to PTY:", error);
          handlePtyDisconnect(
            "Terminal session lost",
            `Forge could not start the preset command in this shell. ${TERMINAL_RECOVERY_MESSAGE}`,
            String(error)
          );
        });
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
        invoke("write_pty", { tabId, data }).catch((error) => {
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

    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;

      // Copy: Ctrl+C with selection (on both platforms, Ctrl not Cmd)
      if (e.ctrlKey && !e.shiftKey && e.key === "c") {
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          return false;
        }
        return true;
      }

      // Paste: Ctrl+V — trigger a native paste event so the paste listener
      // can read clipboardData (text + images) without WebKit permission prompts.
      if (e.ctrlKey && !e.shiftKey && e.key === "v") {
        e.preventDefault();
        document.execCommand("paste");
        return false;
      }

      // Linebreak: Ctrl+Enter — send a raw newline without shell execution
      if (e.ctrlKey && e.key === "Enter") {
        if (ptyReady.current) {
          noteHumanInput();
          invoke("write_pty", { tabId, data: "\n" }).catch((error) => {
            if (isTearingDown) return;
            console.error("Failed to send Ctrl+Enter to PTY:", error);
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
      invoke("resize_pty", { tabId, rows, cols }).catch((error) => {
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
      const firstChar = title.codePointAt(0);
      let status = "idle";
      if (firstChar >= 0x2800 && firstChar <= 0x28ff) {
        status = "working";
      } else if (title.startsWith("\u2733")) {
        status = "waiting";
      } else {
        return;
      }

      detectorRef.current.provider = "claude";
      detectorRef.current.awaitingUser = false;

      const store = useForgeStore.getState();
      store.setTabProvider(tabId, "claude");
      const snapshot = getTabSnapshot(store, tabId);
      const textPart = title.replace(/^[\u2800-\u28ff\u2733\uFE0F]+\s*/, "").trim();
      if (textPart && snapshot?.tab.type !== "server") {
        store.setTabAutoName(tabId, textPart);
      }

      applyDetectedStatus(status, title);
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
                  if (!ptyReady.current) return;
                  noteHumanInput();
                  const bracketed = `\x1b[200~${filePath}\x1b[201~`;
                  invoke("write_pty", { tabId, data: bracketed }).catch((error) => {
                    if (isTearingDown) return;
                    console.error("Failed to paste image path into PTY:", error);
                  });
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
        noteHumanInput();
        const bracketed = `\x1b[200~${text}\x1b[201~`;
        invoke("write_pty", { tabId, data: bracketed }).catch((error) => {
          if (isTearingDown) return;
          console.error("Failed to paste into PTY:", error);
          handlePtyDisconnect(
            "Terminal session lost",
            `Forge could not send pasted text to this shell. ${TERMINAL_RECOVERY_MESSAGE}`,
            String(error)
          );
        });
      }
    };
    pasteContainer.addEventListener("paste", handlePaste);

    return () => {
      isTearingDown = true;
      bellListener.dispose();
      clearCodexIdleTimeout();
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
      invoke("kill_pty", { tabId });
      term.dispose();
      fitAddonRef.current = null;
      termRef.current = null;
      ptyReady.current = false;
      inputBufferRef.current = "";
      codexDebugRef.current = {
        recentText: "",
        lastBellByteAt: null,
        lastBellEventAt: null,
      };
      detectorRef.current = { provider: "unknown", awaitingUser: false };
      recentCodexInputRef.current = { summary: "", at: 0 };
      recentCodexReplyAtRef.current = 0;
    };
  }, [tabId, cwd]);

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      const id = requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
        termRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isActive]);

  return (
    <div className="terminal-shell">
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
