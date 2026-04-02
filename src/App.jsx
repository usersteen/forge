import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { availableMonitors, getCurrentWindow } from "@tauri-apps/api/window";
import DemoStrip from "./components/DemoStrip";
import DocumentViewer from "./components/DocumentViewer";
import Sidebar from "./components/Sidebar";
import TabBar from "./components/TabBar";
import TerminalArea from "./components/TerminalArea";
import useEffectiveHeatStage from "./hooks/useEffectiveHeatStage";
import useHeatTick from "./hooks/useHeatTick";
import useForgeStore, { storeToConfig } from "./store/useForgeStore";
import { getThemeTokensWithVariant } from "./utils/themes";
import { MAX_READER_WIDTH, MIN_READER_WIDTH } from "./utils/workspace";

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function normalizeFilePayload(payload) {
  const type = payload.type ?? payload.file_type ?? "unsupported";
  return {
    path: payload.path,
    type,
    title: payload.title,
    content: payload.content ?? null,
    assetPath: payload.assetPath ?? payload.asset_path ?? null,
    byteSize: payload.byteSize ?? payload.byte_size ?? 0,
    truncated: payload.truncated ?? false,
  };
}

const MIN_WINDOW_WIDTH = 720;
const MIN_WINDOW_HEIGHT = 520;

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function hasValidWindowSize(windowConfig) {
  return (
    isFiniteNumber(windowConfig?.width) &&
    isFiniteNumber(windowConfig?.height) &&
    windowConfig.width >= MIN_WINDOW_WIDTH &&
    windowConfig.height >= MIN_WINDOW_HEIGHT
  );
}

function rectIntersectsMonitor(rect, monitor) {
  const monitorLeft = monitor.position.x;
  const monitorTop = monitor.position.y;
  const monitorRight = monitorLeft + monitor.size.width;
  const monitorBottom = monitorTop + monitor.size.height;
  const rectRight = rect.x + rect.width;
  const rectBottom = rect.y + rect.height;

  return (
    rect.x < monitorRight &&
    rectRight > monitorLeft &&
    rect.y < monitorBottom &&
    rectBottom > monitorTop
  );
}

async function restoreWindowGeometry(win, windowConfig) {
  if (!windowConfig) return;

  if (windowConfig.maximized) {
    await win.maximize();
    return;
  }

  const validSize = hasValidWindowSize(windowConfig);
  if (validSize) {
    await win.setSize(new LogicalSize(windowConfig.width, windowConfig.height));
  }

  if (!isFiniteNumber(windowConfig?.x) || !isFiniteNumber(windowConfig?.y)) {
    if (!validSize) {
      await win.center();
    }
    return;
  }

  const monitors = await availableMonitors();
  const nextRect = {
    x: windowConfig.x,
    y: windowConfig.y,
    width: validSize ? windowConfig.width : MIN_WINDOW_WIDTH,
    height: validSize ? windowConfig.height : MIN_WINDOW_HEIGHT,
  };

  if (monitors.some((monitor) => rectIntersectsMonitor(nextRect, monitor))) {
    await win.setPosition(new LogicalPosition(windowConfig.x, windowConfig.y));
    return;
  }

  await win.center();
}

async function captureWindowGeometry(win) {
  const minimized = await win.isMinimized();
  if (minimized) {
    return {
      window: null,
      canPersist: true,
    };
  }

  const scaleFactor = await win.scaleFactor();
  const physicalSize = await win.innerSize();
  const width = Math.round(physicalSize.width / scaleFactor);
  const height = Math.round(physicalSize.height / scaleFactor);
  const maximized = await win.isMaximized();
  const physicalPosition = maximized ? null : await win.outerPosition();
  const x = physicalPosition ? Math.round(physicalPosition.x / scaleFactor) : 0;
  const y = physicalPosition ? Math.round(physicalPosition.y / scaleFactor) : 0;

  if (!maximized && (width < MIN_WINDOW_WIDTH || height < MIN_WINDOW_HEIGHT)) {
    return null;
  }

  return {
    window: {
      width,
      height,
      x,
      y,
      maximized,
    },
    canPersist: true,
  };
}

function App() {
  const nextTab = useForgeStore((state) => state.nextTab);
  const prevTab = useForgeStore((state) => state.prevTab);
  const nextGroup = useForgeStore((state) => state.nextGroup);
  const prevGroup = useForgeStore((state) => state.prevGroup);
  const gotoTab = useForgeStore((state) => state.gotoTab);
  const configLoaded = useForgeStore((state) => state.configLoaded);
  const exitDemoMode = useForgeStore((state) => state.exitDemoMode);
  const groups = useForgeStore((state) => state.groups);
  const activeGroupId = useForgeStore((state) => state.activeGroupId);
  const documentStateByGroup = useForgeStore((state) => state.documentStateByGroup);
  const theme = useForgeStore((state) => state.theme);
  const fxEnabled = useForgeStore((state) => state.fxEnabled);
  const setWorkspaceLoading = useForgeStore((state) => state.setWorkspaceLoading);
  const setWorkspaceTree = useForgeStore((state) => state.setWorkspaceTree);
  const setWorkspaceError = useForgeStore((state) => state.setWorkspaceError);
  const setDocumentState = useForgeStore((state) => state.setDocumentState);
  const setReaderWidth = useForgeStore((state) => state.setReaderWidth);
  const effectiveHeat = useEffectiveHeatStage();
  const themeVariant = useForgeStore((state) => state.themeVariant);
  const themeTokens = useMemo(() => getThemeTokensWithVariant(theme, effectiveHeat, themeVariant), [theme, effectiveHeat, themeVariant]);

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null;
  const activeRootPath = activeGroup?.rootPath ?? null;
  const activeDocument = activeGroup?.openDocuments.find(
    (document) => document.path === activeGroup.activeDocumentPath
  ) ?? null;
  const activeDocumentState = activeDocument
    ? documentStateByGroup[activeGroupId]?.[activeDocument.path]
    : null;
  const hasOpenDocuments = Boolean(activeGroup?.openDocuments.length);
  const readerWidth = activeGroup?.readerWidth ?? 0.4;

  const [refreshNonce, setRefreshNonce] = useState(0);
  const requestWorkspaceRefresh = () => setRefreshNonce((value) => value + 1);
  const mainSurfaceRef = useRef(null);
  const lastSavedWindowRef = useRef({ width: 1200, height: 800, x: 100, y: 100, maximized: false });
  const resizeStateRef = useRef({
    active: false,
    groupId: null,
  });

  useHeatTick();

  useEffect(() => {
    (async () => {
      try {
        const config = await invoke("load_config");
        lastSavedWindowRef.current = config.window || null;
        if (config.groups && config.groups.length > 0) {
          useForgeStore.getState().loadFromConfig(config);
        } else {
          useForgeStore.getState().initFresh();
        }

        const win = getCurrentWindow();
        await restoreWindowGeometry(win, config.window);
      } catch (error) {
        console.error("Failed to load config:", error);
        useForgeStore.getState().initFresh();
      }
    })();
  }, []);

  const saveTimerRef = useRef(null);
  useEffect(() => {
    const unsubscribe = useForgeStore.subscribe(() => {
      if (!useForgeStore.getState().configLoaded) return;
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const state = useForgeStore.getState();
          // Skip native window geometry queries while user is actively typing —
          // they cause main-thread IPC contention. Reuse cached geometry instead.
          let windowGeometry;
          if (state.heatPauseStartedAt) {
            windowGeometry = lastSavedWindowRef.current;
          } else {
            const win = getCurrentWindow();
            const geometry = await captureWindowGeometry(win);
            // If geometry can't be captured (e.g. window too small during resize),
            // still save everything else using the last known good geometry.
            windowGeometry = geometry?.canPersist
              ? (geometry.window ?? lastSavedWindowRef.current)
              : lastSavedWindowRef.current;
          }
          const config = storeToConfig(state, windowGeometry);
          await invoke("save_config", { config });
          lastSavedWindowRef.current = config.window ?? null;
        } catch (error) {
          console.error("Auto-save failed:", error);
        }
      }, 2000);
    });

    return () => {
      unsubscribe();
      clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = async () => {
      try {
        const state = useForgeStore.getState();
        if (!state.configLoaded) return;
        const win = getCurrentWindow();
        const geometry = await captureWindowGeometry(win);
        const windowGeometry = geometry?.canPersist
          ? (geometry.window ?? lastSavedWindowRef.current)
          : lastSavedWindowRef.current;
        const config = storeToConfig(state, windowGeometry);
        await invoke("save_config", { config });
        lastSavedWindowRef.current = config.window ?? null;
      } catch (error) {
        console.error("Save on close failed:", error);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState.active || !mainSurfaceRef.current) return;

      const bounds = mainSurfaceRef.current.getBoundingClientRect();
      if (!bounds.width) return;

      const nextReaderWidth = (bounds.right - event.clientX) / bounds.width;
      setReaderWidth(
        resizeState.groupId,
        Math.min(MAX_READER_WIDTH, Math.max(MIN_READER_WIDTH, nextReaderWidth))
      );
    };

    const handlePointerUp = () => {
      if (!resizeStateRef.current.active) return;
      resizeStateRef.current = { active: false, groupId: null };
      document.body.classList.remove("reader-resizing");
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.body.classList.remove("reader-resizing");
    };
  }, [setReaderWidth]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isReloadShortcut =
        event.key === "F5" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r");
      if (isReloadShortcut) {
        event.preventDefault();
        return;
      }

      if (isEditableTarget(event.target)) return;

      if (event.ctrlKey && event.key === "Tab") {
        event.preventDefault();
        if (event.shiftKey) {
          prevTab();
        } else {
          nextTab();
        }
        return;
      }

      if (event.ctrlKey && event.key === "PageDown") {
        event.preventDefault();
        nextGroup();
        return;
      }

      if (event.ctrlKey && event.key === "PageUp") {
        event.preventDefault();
        prevGroup();
        return;
      }

      if (event.key === "Escape" && useForgeStore.getState().demoHeatStage !== null) {
        event.preventDefault();
        exitDemoMode();
        return;
      }

      if (event.ctrlKey && event.key >= "1" && event.key <= "9") {
        event.preventDefault();
        gotoTab(parseInt(event.key, 10) - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [exitDemoMode, gotoTab, nextGroup, nextTab, prevGroup, prevTab]);

  useEffect(() => {
    if (!activeGroupId || !activeRootPath) return;

    let cancelled = false;
    const currentRootPath = activeRootPath;

    setWorkspaceLoading(activeGroupId, currentRootPath);

    invoke("scan_workspace", { rootPath: currentRootPath })
      .then((result) => {
        if (cancelled) return;
        setWorkspaceTree(
          activeGroupId,
          result.root_path ?? currentRootPath,
          result.nodes ?? [],
          result.scanned_at ?? Date.now(),
          result.truncated ?? false
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setWorkspaceError(activeGroupId, currentRootPath, String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeRootPath,
    activeGroupId,
    refreshNonce,
    setWorkspaceError,
    setWorkspaceLoading,
    setWorkspaceTree,
  ]);

  useEffect(() => {
    if (!activeGroupId || !activeRootPath || !activeDocument) return;

    const documentPath = activeDocument.path;
    const currentStatus = activeDocumentState?.status;
    if (
      currentStatus === "ready" ||
      currentStatus === "loading" ||
      currentStatus === "error" ||
      currentStatus === "unsupported" ||
      currentStatus === "too-large"
    ) {
      return;
    }

    let cancelled = false;
    setDocumentState(activeGroupId, documentPath, { status: "loading", error: "", payload: null });

    invoke("read_workspace_file", {
      rootPath: activeRootPath,
      relativePath: documentPath,
    })
      .then((payload) => {
        if (cancelled) return;
        const normalizedPayload = normalizeFilePayload(payload);
        const nextStatus =
          normalizedPayload.type === "unsupported"
            ? "unsupported"
            : normalizedPayload.truncated
              ? "too-large"
              : "ready";
        setDocumentState(activeGroupId, documentPath, {
          status: nextStatus,
          error: "",
          payload: normalizedPayload,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setDocumentState(activeGroupId, documentPath, {
          status: "error",
          error: String(error),
          payload: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeDocument, activeRootPath, activeGroupId, setDocumentState]);

  if (!configLoaded) {
    return null;
  }

  return (
    <div
      className="app-layout"
      data-heat={effectiveHeat}
      data-theme={theme}
      data-fx={fxEnabled ? "on" : "off"}
      style={themeTokens}
    >
      <Sidebar />
      <div className="main-panel">
        <TabBar onRefreshWorkspace={requestWorkspaceRefresh} />
        <div
          ref={mainSurfaceRef}
          className={`main-surface ${hasOpenDocuments ? "main-surface-split" : ""}`}
          style={hasOpenDocuments ? { "--reader-width": `${(readerWidth * 100).toFixed(2)}%` } : undefined}
        >
          <TerminalArea />
          {hasOpenDocuments ? (
            <button
              type="button"
              className="reader-divider"
              aria-label="Resize reader pane"
              onPointerDown={(event) => {
                if (!activeGroupId) return;
                resizeStateRef.current = {
                  active: true,
                  groupId: activeGroupId,
                };
                document.body.classList.add("reader-resizing");
                event.preventDefault();
              }}
            >
              <span className="reader-divider-grip" />
            </button>
          ) : null}
          <DocumentViewer />
        </div>
      </div>
      <DemoStrip />
    </div>
  );
}

export default App;
