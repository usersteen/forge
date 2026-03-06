import useForgeStore from "../store/useForgeStore";

export default function StatusBar() {
  const groups = useForgeStore((s) => s.groups);
  const activeGroupId = useForgeStore((s) => s.activeGroupId);

  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const totalTabs = groups.reduce((sum, g) => sum + g.tabs.length, 0);

  return (
    <div className="status-bar">
      <span className="status-bar-group">
        {activeGroup?.name || "No project"}
      </span>
      <span className="status-bar-separator">|</span>
      <span className="status-bar-tabs">
        {totalTabs} tab{totalTabs !== 1 ? "s" : ""} total
      </span>
    </div>
  );
}
