import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import useForgeStore from "../store/useForgeStore";

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

export default function Terminal({ tabId, isActive, cwd }) {
  const containerRef = useRef(null);
  const fitAddonRef = useRef(null);
  const termRef = useRef(null);
  const ptyReady = useRef(false);
  const prevStatusRef = useRef("idle");

  useEffect(() => {
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
    } catch (e) {
      console.warn("WebGL addon failed, falling back to default renderer", e);
    }

    const unlistenOutput = listen(`pty-output-${tabId}`, (event) => {
      term.write(event.payload);
    });

    invoke("spawn_pty", { tabId, rows: term.rows, cols: term.cols, cwd: cwd || null })
      .then(() => { ptyReady.current = true; })
      .catch((err) => console.error("Failed to spawn PTY:", err));

    term.onData((data) => {
      if (ptyReady.current) {
        invoke("write_pty", { tabId, data });
      }
    });

    // Custom key handlers for Ctrl+V paste and Ctrl+Enter line break
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;

      // Ctrl+C: copy selection to clipboard (if text is selected), otherwise pass through as interrupt
      if (e.ctrlKey && !e.shiftKey && e.key === "c") {
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          return false;
        }
        return true; // No selection — let ^C go to PTY as interrupt
      }

      // Ctrl+V: bracketed paste with double-paste prevention
      if (e.ctrlKey && !e.shiftKey && e.key === "v") {
        e.preventDefault(); // Stop browser paste event (prevents double-paste)
        navigator.clipboard.readText().then((text) => {
          if (text && ptyReady.current) {
            const bracketed = `\x1b[200~${text}\x1b[201~`;
            invoke("write_pty", { tabId, data: bracketed });
          }
        });
        return false;
      }

      // Ctrl+Enter: send newline
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

    // Detect Claude Code status from OSC title changes
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

      const store = useForgeStore.getState();

      // Auto-name tab from title text (strip leading status icon + space)
      const textPart = title.replace(/^[\u2800-\u28ff\u2733\uFE0F]+\s*/, "").trim();
      if (textPart) {
        store.setTabAutoName(tabId, textPart);
      }

      const prevStatus = prevStatusRef.current;
      if (status === prevStatus) return;
      prevStatusRef.current = status;
      console.log(`[Forge] status: ${prevStatus} → ${status}`);
      if (prevStatus === "waiting" && status !== "waiting") {
        store.recordResponse(tabId);
      }
      store.setTabStatus(tabId, status, title);

      // Notify on transition to "waiting" for non-active tabs
      if (status === "waiting") {
        const activeGroup = store.groups.find((g) => g.id === store.activeGroupId);
        const isCurrentlyActive = activeGroup?.activeTabId === tabId;
        if (!isCurrentlyActive) {
          playNotificationSound();
          if (Notification.permission === "granted") {
            new Notification("Forge", { body: "A terminal needs your attention" });
          }
        }
      }
    });

    let resizeTimeout;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => fitAddon.fit(), 100);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      unlistenOutput.then((unlisten) => unlisten());
      invoke("kill_pty", { tabId });
      term.dispose();
      fitAddonRef.current = null;
      termRef.current = null;
      ptyReady.current = false;
    };
  }, [tabId]);

  // Refit when becoming active (handles stale dimensions from hidden state)
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
