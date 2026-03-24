import useForgeStore from "../store/useForgeStore";
import Terminal from "./Terminal";
import EmptyGroupPicker from "./EmptyGroupPicker";

export default function TerminalArea() {
  const groups = useForgeStore((s) => s.groups);
  const activeGroupId = useForgeStore((s) => s.activeGroupId);

  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const activeTabId = activeGroup?.activeTabId;
  const showPicker = activeGroup && activeGroup.tabs.length === 0;

  // Sort by stable ID so DnD reordering never moves DOM nodes (which kills xterm WebGL)
  const allTabs = groups
    .flatMap((group) => group.tabs.map((tab) => ({ tab, groupId: group.id })))
    .sort((a, b) => a.tab.id.localeCompare(b.tab.id));

  return (
    <div className="terminal-area">
      {showPicker && (
        <EmptyGroupPicker groupId={activeGroupId} rootPath={activeGroup.rootPath} />
      )}
      {allTabs.map(({ tab, groupId }) => {
        const isActive = groupId === activeGroupId && tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className="terminal-wrapper"
            style={{
              visibility: isActive ? "visible" : "hidden",
              zIndex: isActive ? 1 : 0,
            }}
          >
            <Terminal tabId={tab.id} isActive={isActive} cwd={tab.cwd} launchCommand={tab.launchCommand} />
          </div>
        );
      })}
    </div>
  );
}
