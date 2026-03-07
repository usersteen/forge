import { useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import TabBar from "./components/TabBar";
import TerminalArea from "./components/TerminalArea";

import useForgeStore, { storeToConfig } from "./store/useForgeStore";
import useHeatTick from "./hooks/useHeatTick";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize, LogicalPosition } from "@tauri-apps/api/dpi";

function App() {
  const nextTab = useForgeStore((s) => s.nextTab);
  const prevTab = useForgeStore((s) => s.prevTab);
  const nextGroup = useForgeStore((s) => s.nextGroup);
  const prevGroup = useForgeStore((s) => s.prevGroup);
  const gotoTab = useForgeStore((s) => s.gotoTab);
  const configLoaded = useForgeStore((s) => s.configLoaded);

  useHeatTick();

  // Load config on startup
  useEffect(() => {
    (async () => {
      try {
        const config = await invoke("load_config");
        if (config.groups && config.groups.length > 0) {
          useForgeStore.getState().loadFromConfig(config);
        } else {
          useForgeStore.getState().initFresh();
        }

        // Restore window geometry
        const win = getCurrentWindow();
        const w = config.window;
        if (w) {
          if (w.maximized) {
            await win.maximize();
          } else {
            await win.setSize(new LogicalSize(w.width, w.height));
            await win.setPosition(new LogicalPosition(w.x, w.y));
          }
        }
      } catch (err) {
        console.error("Failed to load config:", err);
        useForgeStore.getState().initFresh();
      }
    })();
  }, []);

  // Debounced auto-save on store changes
  const saveTimerRef = useRef(null);
  useEffect(() => {
    const unsub = useForgeStore.subscribe(() => {
      if (!useForgeStore.getState().configLoaded) return;
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const state = useForgeStore.getState();
          const win = getCurrentWindow();
          const size = await win.innerSize();
          const pos = await win.outerPosition();
          const maximized = await win.isMaximized();
          const windowGeometry = {
            width: size.width,
            height: size.height,
            x: pos.x,
            y: pos.y,
            maximized,
          };
          const config = storeToConfig(state, windowGeometry);
          await invoke("save_config", { config });
        } catch (err) {
          console.error("Auto-save failed:", err);
        }
      }, 2000);
    });
    return () => {
      unsub();
      clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Save on close
  useEffect(() => {
    const handleBeforeUnload = async () => {
      try {
        const state = useForgeStore.getState();
        if (!state.configLoaded) return;
        const win = getCurrentWindow();
        const size = await win.innerSize();
        const pos = await win.outerPosition();
        const maximized = await win.isMaximized();
        const windowGeometry = {
          width: size.width,
          height: size.height,
          x: pos.x,
          y: pos.y,
          maximized,
        };
        const config = storeToConfig(state, windowGeometry);
        await invoke("save_config", { config });
      } catch (err) {
        console.error("Save on close failed:", err);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          prevTab();
        } else {
          nextTab();
        }
      }
      if (e.ctrlKey && e.key === "PageDown") {
        e.preventDefault();
        nextGroup();
      }
      if (e.ctrlKey && e.key === "PageUp") {
        e.preventDefault();
        prevGroup();
      }
      // Ctrl+1 through Ctrl+9 to jump to tab N
      if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        gotoTab(parseInt(e.key, 10) - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextTab, prevTab, nextGroup, prevGroup, gotoTab]);

  if (!configLoaded) {
    return null;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-panel">
        <TabBar />
        <TerminalArea />

      </div>
    </div>
  );
}

export default App;
