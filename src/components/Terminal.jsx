import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import useForgeStore from "../store/useForgeStore";
import {
  extractPlainText,
  isCodexExitCommand,
  isCodexLaunchCommand,
  looksLikeCodexSession,
  summarizeStatusText,
} from "../utils/statusDetection";

let _audioCtx;

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

export default function Terminal({ tabId, isActive, cwd }) {
  const containerRef = useRef(null);
  const fitAddonRef = useRef(null);
  const termRef = useRef(null);
  const ptyReady = useRef(false);
  const prevStatusRef = useRef("idle");
  const inputBufferRef = useRef("");
  const detectorRef = useRef({
    provider: "unknown",
    awaitingUser: false,
  });

  useEffect(() => {
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

    const applyDetectedStatus = (status, title = "", options = {}) => {
      const { countResponse = true, notifyWaiting = true } = options;
      const store = useForgeStore.getState();
      const snapshot = getTabSnapshot(store, tabId);
      if (!snapshot) return;

      const { tab } = snapshot;
      const prevStatus = prevStatusRef.current;
      const nextTitle = title || tab.statusTitle || "";
      if (status === prevStatus && nextTitle === tab.statusTitle) return;

      prevStatusRef.current = status;
      console.log(`[Forge] status: ${prevStatus} -> ${status}`);

      if (countResponse && prevStatus === "waiting" && status !== "waiting" && tab.type !== "server") {
        store.recordResponse(tabId);
      }

      store.setTabStatus(tabId, status, nextTitle);

      if (notifyWaiting && status === "waiting") {
        maybeNotifyWaiting(store, tab);
      }
    };

    const handleCodexOutput = (payload) => {
      const plainText = extractPlainText(payload);
      const summary = summarizeStatusText(plainText);
      if (!summary) return;

      const detector = detectorRef.current;
      if (detector.provider === "unknown" && looksLikeCodexSession(plainText)) {
        detector.provider = "codex";
        useForgeStore.getState().setTabAutoName(tabId, "Codex");
      }

      if (detector.provider !== "codex") return;
      if (detector.awaitingUser) return;

      applyDetectedStatus("working", summary);
    };

    const handleBell = () => {
      const detector = detectorRef.current;
      if (detector.provider === "claude") return;

      const store = useForgeStore.getState();
      const snapshot = getTabSnapshot(store, tabId);
      if (!snapshot) return;

      if (detector.provider === "unknown") {
        detector.provider = "codex";
      }

      detector.awaitingUser = true;
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
      if (isCodexLaunchCommand(command)) {
        detector.provider = "codex";
        detector.awaitingUser = false;
        useForgeStore.getState().setTabAutoName(tabId, "Codex");
        applyDetectedStatus("working", summarizeStatusText(command, "Codex"));
        return;
      }

      if (detector.provider !== "codex") return;

      if (isCodexExitCommand(command)) {
        detector.provider = "unknown";
        detector.awaitingUser = false;
        applyDetectedStatus("idle", "", { countResponse: false, notifyWaiting: false });
        return;
      }

      detector.awaitingUser = false;
      applyDetectedStatus("working", summarizeStatusText(command, "Codex"));
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

    try {
      term.loadAddon(new WebglAddon());
    } catch (error) {
      console.warn("WebGL addon failed, falling back to default renderer", error);
    }

    const unlistenOutput = listen(`pty-output-${tabId}`, (event) => {
      term.write(event.payload);
      handleCodexOutput(event.payload);
    });
    const bellListener = term.onBell(handleBell);

    invoke("spawn_pty", { tabId, rows: term.rows, cols: term.cols, cwd: cwd || null })
      .then(() => {
        ptyReady.current = true;
      })
      .catch((err) => console.error("Failed to spawn PTY:", err));

    term.onData((data) => {
      const command = updateInputBuffer(data);
      if (command !== null) {
        handleSubmittedCommand(command);
      }

      if (ptyReady.current) {
        invoke("write_pty", { tabId, data });
      }
    });

    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;

      if (e.ctrlKey && !e.shiftKey && e.key === "c") {
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          return false;
        }
        return true;
      }

      if (e.ctrlKey && !e.shiftKey && e.key === "v") {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          if (text && ptyReady.current) {
            const bracketed = `\x1b[200~${text}\x1b[201~`;
            invoke("write_pty", { tabId, data: bracketed });
          }
        });
        return false;
      }

      if (e.ctrlKey && e.key === "Enter") {
        if (ptyReady.current) {
          invoke("write_pty", { tabId, data: "\n" });
        }
        return false;
      }

      return true;
    });

    term.onResize(({ cols, rows }) => {
      invoke("resize_pty", { tabId, rows, cols });
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
      const textPart = title.replace(/^[\u2800-\u28ff\u2733\uFE0F]+\s*/, "").trim();
      if (textPart) {
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

    return () => {
      bellListener.dispose();
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      unlistenOutput.then((unlisten) => unlisten());
      invoke("kill_pty", { tabId });
      term.dispose();
      fitAddonRef.current = null;
      termRef.current = null;
      ptyReady.current = false;
      inputBufferRef.current = "";
      detectorRef.current = { provider: "unknown", awaitingUser: false };
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
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", padding: "4px" }}
    />
  );
}
