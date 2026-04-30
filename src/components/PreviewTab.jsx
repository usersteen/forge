import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import "./PreviewTab.css";

function normalizeUrl(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function isLocalUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

const PICKER_TOKEN_MAP = [
  ["--forge-bg-deep", "--bg-deep"],
  ["--forge-bg-sidebar", "--bg-sidebar"],
  ["--forge-bg-active", "--bg-active"],
  ["--forge-bg-elevated", "--shell-elevated-bg"],
  ["--forge-border", "--border"],
  ["--forge-border-strong", "--border"],
  ["--forge-text-primary", "--text-primary"],
  ["--forge-text-secondary", "--text-secondary"],
  ["--forge-text-muted", "--text-muted"],
  ["--forge-accent", "--accent-active"],
  ["--forge-accent-rgb", "--accent-active-rgb"],
];

function getPickerThemeCss() {
  const source = document.querySelector(".app-layout") || document.documentElement;
  const styles = window.getComputedStyle(source);
  const declarations = PICKER_TOKEN_MAP.map(([target, sourceName]) => {
    const value = styles.getPropertyValue(sourceName).trim();
    return value ? `  ${target}: ${value};` : "";
  }).filter(Boolean);

  return `:root {\n${declarations.join("\n")}\n}`;
}

export default function PreviewTab({ tabId, isActive, initialUrl }) {
  const [urlDraft, setUrlDraft] = useState(initialUrl || "");
  const [loadedUrl, setLoadedUrl] = useState(null);
  const [commentMode, setCommentMode] = useState(false);
  const [error, setError] = useState(null);

  const containerRef = useRef(null);
  const bodyRef = useRef(null);
  const urlInputRef = useRef(null);
  const lastBoundsRef = useRef(null);
  const hasOpenedRef = useRef(false);

  const measureBounds = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }, []);

  const openWebview = useCallback(
    async (url) => {
      const bounds = measureBounds();
      if (!bounds) return;
      try {
        await invoke("open_preview_webview", {
          tabId,
          url,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          pickerCss: getPickerThemeCss(),
        });
        lastBoundsRef.current = bounds;
        hasOpenedRef.current = true;
        setLoadedUrl(url);
        setError(null);
      } catch (err) {
        setError(String(err));
      }
    },
    [tabId, measureBounds]
  );

  const navigateTo = useCallback(
    async (rawUrl) => {
      const url = normalizeUrl(rawUrl);
      if (!url) return;
      if (!isLocalUrl(url)) {
        setError("Only http://localhost and 127.0.0.1 URLs are allowed.");
        return;
      }
      setError(null);
      if (!hasOpenedRef.current) {
        await openWebview(url);
      } else {
        try {
          await invoke("preview_navigate", { tabId, url });
          setLoadedUrl(url);
        } catch (err) {
          setError(String(err));
        }
      }
    },
    [tabId, openWebview]
  );

  // Focus the URL input on mount when no initial URL was provided.
  useEffect(() => {
    if (initialUrl) return;
    const id = requestAnimationFrame(() => urlInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [initialUrl]);


  // Initial open only if an explicit initialUrl was provided.
  useEffect(() => {
    if (hasOpenedRef.current) return;
    if (!initialUrl) return;
    const url = normalizeUrl(initialUrl);
    if (!url || !isLocalUrl(url)) return;
    let cancelled = false;
    const tryOpen = () => {
      if (cancelled || hasOpenedRef.current) return;
      const bounds = measureBounds();
      if (!bounds) {
        requestAnimationFrame(tryOpen);
        return;
      }
      openWebview(url);
    };
    tryOpen();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track size changes and resync bounds (only when active).
  useEffect(() => {
    if (!hasOpenedRef.current) return undefined;
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      if (!isActive) return;
      const bounds = measureBounds();
      if (!bounds) return;
      const last = lastBoundsRef.current;
      if (
        last &&
        last.x === bounds.x &&
        last.y === bounds.y &&
        last.width === bounds.width &&
        last.height === bounds.height
      )
        return;
      lastBoundsRef.current = bounds;
      invoke("set_preview_bounds", { tabId, ...bounds }).catch(() => {});
    });
    observer.observe(el);
    window.addEventListener("resize", () => {
      if (!isActive) return;
      const bounds = measureBounds();
      if (!bounds) return;
      lastBoundsRef.current = bounds;
      invoke("set_preview_bounds", { tabId, ...bounds }).catch(() => {});
    });
    return () => observer.disconnect();
  }, [isActive, tabId, measureBounds]);

  // Visibility on tab activation.
  useEffect(() => {
    if (!hasOpenedRef.current) return;
    const bounds = measureBounds() || lastBoundsRef.current || { x: 0, y: 0, width: 1, height: 1 };
    invoke("set_preview_visible", {
      tabId,
      visible: !!isActive,
      ...bounds,
    }).catch(() => {});
    if (isActive && bounds) lastBoundsRef.current = bounds;
    if (!isActive && commentMode) setCommentMode(false);
  }, [isActive, tabId, measureBounds, commentMode]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      invoke("close_preview_webview", { tabId }).catch(() => {});
    };
  }, [tabId]);

  // Comment-mode toggle pipes into the child webview.
  useEffect(() => {
    if (!hasOpenedRef.current) return;
    invoke("preview_set_comment_mode", {
      tabId,
      on: commentMode,
      pickerCss: getPickerThemeCss(),
    }).catch(() => {});
  }, [commentMode, tabId]);

  // Hotkey: Ctrl/Cmd+Shift+C toggles comment mode while this tab is active.
  useEffect(() => {
    if (!isActive) return undefined;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyC") {
        e.preventDefault();
        setCommentMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive]);

  return (
    <div className="preview-tab" ref={containerRef}>
      <div className="preview-toolbar">
        <button
          type="button"
          className="preview-tb-btn"
          aria-label="Back"
          onClick={() => invoke("preview_history", { tabId, dir: -1 }).catch(() => {})}
        >
          ◀
        </button>
        <button
          type="button"
          className="preview-tb-btn"
          aria-label="Forward"
          onClick={() => invoke("preview_history", { tabId, dir: 1 }).catch(() => {})}
        >
          ▶
        </button>
        <button
          type="button"
          className="preview-tb-btn"
          aria-label="Reload"
          onClick={() => invoke("preview_reload", { tabId }).catch(() => {})}
        >
          ⟳
        </button>
        <form
          className="preview-tb-url"
          onSubmit={(e) => {
            e.preventDefault();
            navigateTo(urlDraft);
          }}
        >
          <input
            ref={urlInputRef}
            type="text"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            spellCheck={false}
            placeholder="http://localhost:5173"
          />
        </form>
        <button
          type="button"
          className={`preview-tb-comment${commentMode ? " on" : ""}`}
          aria-pressed={commentMode}
          onClick={() => setCommentMode((prev) => !prev)}
          title="Toggle comment mode (Ctrl+Shift+C)"
        >
          💬 Comment
        </button>
      </div>
      {error ? <div className="preview-error">{error}</div> : null}
      <div className="preview-body" ref={bodyRef}>
        {!loadedUrl ? (
          <div className="preview-empty">
            Enter your dev server URL above and press Enter.
            <span className="preview-empty-hint">
              e.g. http://localhost:5173 — whichever port your project uses.
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
