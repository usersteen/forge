import useForgeStore from "../store/useForgeStore";
import Terminal from "./Terminal";

export default function TerminalArea() {
  const groups = useForgeStore((s) => s.groups);
  const activeGroupId = useForgeStore((s) => s.activeGroupId);

  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const activeTabId = activeGroup?.activeTabId;

  return (
    <div className="terminal-area">
      {groups.flatMap((group) =>
        group.tabs.map((tab) => {
          const isActive =
            group.id === activeGroupId && tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className="terminal-wrapper"
              style={{
                visibility: isActive ? "visible" : "hidden",
                zIndex: isActive ? 1 : 0,
              }}
            >
              <Terminal tabId={tab.id} isActive={isActive} />
            </div>
          );
        })
      )}
    </div>
  );
}
