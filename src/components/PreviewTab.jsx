import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import "./PreviewTab.css";

const TOP_LAYER_SELECTOR = [
  ".surface-menu",
  ".settings-overlay",
  ".tab-context-menu",
].join(",");

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

const VIEW_PRESETS = {
  desktop: null,
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
};

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

function hasTopLayerSurface() {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector(TOP_LAYER_SELECTOR));
}

function useTopLayerSurfaceOpen() {
  const [open, setOpen] = useState(hasTopLayerSurface);

  useEffect(() => {
    const update = () => setOpen(hasTopLayerSurface());
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => observer.disconnect();
  }, []);

  return open;
}

function DesktopIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="3" width="12" height="8" rx="1" />
      <path d="M6 13h4" />
      <path d="M8 11v2" />
    </svg>
  );
}

function TabletIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.5" y="2" width="9" height="12" rx="1.2" />
      <path d="M7.5 12.5h1" />
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="5" y="2" width="6" height="12" rx="1.2" />
      <path d="M7.5 12.5h1" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 6V3h3" />
      <path d="M10 3h3v3" />
      <path d="M13 10v3h-3" />
      <path d="M6 13H3v-3" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 3v3H3" />
      <path d="M10 6V3h3" />
      <path d="M13 10h-3v3" />
      <path d="M3 10h3v3" />
    </svg>
  );
}

export default function PreviewTab({ tabId, isActive, initialUrl }) {
  const [urlDraft, setUrlDraft] = useState(initialUrl || "");
  const [loadedUrl, setLoadedUrl] = useState(null);
  const [commentMode, setCommentMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState("desktop");
  const [error, setError] = useState(null);
  const topLayerSurfaceOpen = useTopLayerSurfaceOpen();

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

    const preset = VIEW_PRESETS[viewMode];
    if (!preset) {
      return {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }

    const w = Math.min(preset.width, rect.width);
    const h = Math.min(preset.height, rect.height);
    const x = rect.left + (rect.width - w) / 2;
    const y = rect.top + (rect.height - h) / 2;
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
    };
  }, [viewMode]);

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

  const syncPreviewBounds = useCallback(() => {
    if (!hasOpenedRef.current || !isActive || topLayerSurfaceOpen) return;
    const bounds = measureBounds();
    if (!bounds) return;
    lastBoundsRef.current = bounds;
    invoke("set_preview_bounds", { tabId, ...bounds }).catch(() => {});
  }, [isActive, tabId, measureBounds, topLayerSurfaceOpen]);

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

  useEffect(() => {
    if (!isActive && isFullscreen) {
      setIsFullscreen(false);
    }
  }, [isActive, isFullscreen]);

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
      if (!isActive || topLayerSurfaceOpen) return;
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
      syncPreviewBounds();
    });
    observer.observe(el);
    const handleResize = () => {
      syncPreviewBounds();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [isActive, tabId, measureBounds, syncPreviewBounds, topLayerSurfaceOpen]);

  // Fullscreen toggles change the .preview-body bounds; defer the webview
  // re-sync to the next frame so getBoundingClientRect sees the new layout,
  // then re-assert visibility + bounds in one call.
  useEffect(() => {
    if (!hasOpenedRef.current) return undefined;
    const frame = requestAnimationFrame(() => {
      if (!hasOpenedRef.current) return;
      const bounds = measureBounds() || lastBoundsRef.current;
      if (!bounds) return;
      lastBoundsRef.current = bounds;
      invoke("set_preview_visible", {
        tabId,
        visible: !!isActive && !topLayerSurfaceOpen,
        ...bounds,
      }).catch(() => {});
    });
    return () => cancelAnimationFrame(frame);
  }, [isFullscreen, isActive, tabId, measureBounds, topLayerSurfaceOpen]);

  // Visibility on tab activation.
  useEffect(() => {
    if (!hasOpenedRef.current) return;
    const bounds = measureBounds() || lastBoundsRef.current || { x: 0, y: 0, width: 1, height: 1 };
    invoke("set_preview_visible", {
      tabId,
      visible: !!isActive && !topLayerSurfaceOpen,
      ...bounds,
    }).catch(() => {});
    if (isActive && !topLayerSurfaceOpen && bounds) lastBoundsRef.current = bounds;
    if (!isActive && commentMode) setCommentMode(false);
  }, [isActive, tabId, measureBounds, commentMode, topLayerSurfaceOpen]);

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

  // Hotkeys while this tab is active.
  useEffect(() => {
    if (!isActive) return undefined;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyC") {
        e.preventDefault();
        setCommentMode((prev) => !prev);
        return;
      }
      if (e.key === "Escape" && isFullscreen) {
        e.preventDefault();
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive, isFullscreen]);

  return (
    <div className={`preview-tab${isFullscreen ? " preview-tab-fullscreen" : ""}`} ref={containerRef}>
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
        <button
          type="button"
          className={`preview-tb-btn${viewMode === "desktop" ? " on" : ""}`}
          aria-label="Desktop view"
          aria-pressed={viewMode === "desktop"}
          onClick={() => setViewMode("desktop")}
          title="Desktop (fluid)"
        >
          <DesktopIcon />
        </button>
        <button
          type="button"
          className={`preview-tb-btn${viewMode === "tablet" ? " on" : ""}`}
          aria-label="Tablet view"
          aria-pressed={viewMode === "tablet"}
          onClick={() => setViewMode("tablet")}
          title="Tablet (768 × 1024)"
        >
          <TabletIcon />
        </button>
        <button
          type="button"
          className={`preview-tb-btn${viewMode === "mobile" ? " on" : ""}`}
          aria-label="Mobile view"
          aria-pressed={viewMode === "mobile"}
          onClick={() => setViewMode("mobile")}
          title="Mobile (375 × 667)"
        >
          <MobileIcon />
        </button>
        <button
          type="button"
          className={`preview-tb-btn preview-tb-fullscreen${isFullscreen ? " on" : ""}`}
          aria-label={isFullscreen ? "Exit full screen preview" : "Full screen preview"}
          aria-pressed={isFullscreen}
          onClick={() => setIsFullscreen((prev) => !prev)}
          title={isFullscreen ? "Exit full screen (Esc)" : "Full screen preview"}
        >
          {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
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
