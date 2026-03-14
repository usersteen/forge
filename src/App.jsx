import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import DemoStrip from "./components/DemoStrip";
import DocumentViewer from "./components/DocumentViewer";
import Sidebar from "./components/Sidebar";
import TabBar from "./components/TabBar";
import TerminalArea from "./components/TerminalArea";
import useEffectiveHeatStage from "./hooks/useEffectiveHeatStage";
import useHeatTick from "./hooks/useHeatTick";
import useForgeStore, { storeToConfig } from "./store/useForgeStore";
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
  const setWorkspaceLoading = useForgeStore((state) => state.setWorkspaceLoading);
  const setWorkspaceTree = useForgeStore((state) => state.setWorkspaceTree);
  const setWorkspaceError = useForgeStore((state) => state.setWorkspaceError);
  const setDocumentState = useForgeStore((state) => state.setDocumentState);
  const setReaderWidth = useForgeStore((state) => state.setReaderWidth);
  const effectiveHeat = useEffectiveHeatStage();

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
  const resizeStateRef = useRef({
    active: false,
    groupId: null,
  });

  useHeatTick();

  useEffect(() => {
    (async () => {
      try {
        const config = await invoke("load_config");
        if (config.groups && config.groups.length > 0) {
          useForgeStore.getState().loadFromConfig(config);
        } else {
          useForgeStore.getState().initFresh();
        }

        const win = getCurrentWindow();
        const windowConfig = config.window;
        if (windowConfig) {
          if (windowConfig.maximized) {
            await win.maximize();
          } else {
            await win.setSize(new LogicalSize(windowConfig.width, windowConfig.height));
            await win.setPosition(new LogicalPosition(windowConfig.x, windowConfig.y));
          }
        }
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
          const win = getCurrentWindow();
          const size = await win.innerSize();
          const pos = await win.outerPosition();
          const maximized = await win.isMaximized();
          const config = storeToConfig(state, {
            width: size.width,
            height: size.height,
            x: pos.x,
            y: pos.y,
            maximized,
          });
          await invoke("save_config", { config });
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
        const size = await win.innerSize();
        const pos = await win.outerPosition();
        const maximized = await win.isMaximized();
        const config = storeToConfig(state, {
          width: size.width,
          height: size.height,
          x: pos.x,
          y: pos.y,
          maximized,
        });
        await invoke("save_config", { config });
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
    if (
      activeDocumentState?.status === "ready" ||
      activeDocumentState?.status === "loading" ||
      activeDocumentState?.status === "error" ||
      activeDocumentState?.status === "unsupported" ||
      activeDocumentState?.status === "too-large"
    ) {
      return;
    }

    let cancelled = false;
    setDocumentState(activeGroupId, activeDocument.path, { status: "loading", error: "", payload: null });

    invoke("read_workspace_file", {
      rootPath: activeRootPath,
      relativePath: activeDocument.path,
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
        setDocumentState(activeGroupId, activeDocument.path, {
          status: nextStatus,
          error: "",
          payload: normalizedPayload,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setDocumentState(activeGroupId, activeDocument.path, {
          status: "error",
          error: String(error),
          payload: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeDocument, activeDocumentState?.status, activeRootPath, activeGroupId, setDocumentState]);

  if (!configLoaded) {
    return null;
  }

  return (
    <div className="app-layout" data-heat={effectiveHeat}>
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
