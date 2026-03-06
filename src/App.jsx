import { useEffect } from "react";
import Sidebar from "./components/Sidebar";
import TabBar from "./components/TabBar";
import TerminalArea from "./components/TerminalArea";
import StatusBar from "./components/StatusBar";
import useForgeStore from "./store/useForgeStore";

function App() {
  const nextTab = useForgeStore((s) => s.nextTab);
  const prevTab = useForgeStore((s) => s.prevTab);
  const nextGroup = useForgeStore((s) => s.nextGroup);
  const prevGroup = useForgeStore((s) => s.prevGroup);

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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextTab, prevTab, nextGroup, prevGroup]);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-panel">
        <TabBar />
        <TerminalArea />
        <StatusBar />
      </div>
    </div>
  );
}

export default App;
