import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export default function Terminal({ tabId }) {
  const containerRef = useRef(null);

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
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    try {
      term.loadAddon(new WebglAddon());
    } catch (e) {
      console.warn("WebGL addon failed, falling back to default renderer", e);
    }

    // Register listener BEFORE spawning PTY to avoid missing early output
    const unlistenPromise = listen(`pty-output-${tabId}`, (event) => {
      term.write(event.payload);
    });

    invoke("spawn_pty", { tabId, rows: term.rows, cols: term.cols }).catch(
      (err) => console.error("Failed to spawn PTY:", err)
    );

    term.onData((data) => {
      invoke("write_pty", { tabId, data });
    });

    term.onResize(({ cols, rows }) => {
      invoke("resize_pty", { tabId, rows, cols });
    });

    // Use ResizeObserver for container-level resize detection (works with layout changes, not just window)
    let resizeTimeout;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => fitAddon.fit(), 100);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      unlistenPromise.then((unlisten) => unlisten());
      invoke("kill_pty", { tabId });
      term.dispose();
    };
  }, [tabId]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", padding: "4px" }}
    />
  );
}
