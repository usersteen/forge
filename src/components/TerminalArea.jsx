import useForgeStore from "../store/useForgeStore";
import ShowcaseTerminal from "./ShowcaseTerminal";
import Terminal from "./Terminal";
import EmptyGroupPicker from "./EmptyGroupPicker";

function MockDocViewer() {
  return (
    <div className="tour-mock-doc-viewer">
      <div className="tour-mock-doc-toolbar">
        <span className="tour-mock-doc-title">README.md</span>
        <div className="tour-mock-doc-actions">
          <button type="button" className="tour-mock-doc-btn">Save</button>
          <button type="button" className="tour-mock-doc-btn">Revert</button>
        </div>
      </div>
      <div className="tour-mock-doc-content">
        <div className="tour-mock-doc-line"># Project Name</div>
        <div className="tour-mock-doc-line tour-mock-doc-line-muted"> </div>
        <div className="tour-mock-doc-line">A terminal manager for running multiple</div>
        <div className="tour-mock-doc-line">Claude Code and Codex sessions.</div>
        <div className="tour-mock-doc-line tour-mock-doc-line-muted"> </div>
        <div className="tour-mock-doc-line">## Getting Started</div>
        <div className="tour-mock-doc-line tour-mock-doc-line-muted"> </div>
        <div className="tour-mock-doc-line">Clone the repo and run `npm install`.</div>
      </div>
    </div>
  );
}

export default function TerminalArea() {
  const groups = useForgeStore((s) => s.groups);
  const activeGroupId = useForgeStore((s) => s.activeGroupId);
  const tourExpandedPanel = useForgeStore((s) => s.tourExpandedPanel);
  const showcaseActive = useForgeStore((s) => s.showcaseActive);

  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const activeTabId = activeGroup?.activeTabId;
  const showPicker = activeGroup && activeGroup.tabs.length === 0;
  const showMockDocViewer = tourExpandedPanel === "doc-viewer-mock";

  // Sort by stable ID so DnD reordering never moves DOM nodes (which kills xterm WebGL)
  const allTabs = groups
    .flatMap((group) => group.tabs.map((tab) => ({ tab, groupId: group.id })))
    .sort((a, b) => a.tab.id.localeCompare(b.tab.id));

  return (
    <div className="terminal-area" data-tour="terminal-area">
      {showMockDocViewer && <MockDocViewer />}
      {showPicker && (
        <EmptyGroupPicker
          groupId={activeGroupId}
          rootPath={activeGroup.rootPath}
          serverCommandOverride={activeGroup.serverCommandOverride}
        />
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
              ...(showMockDocViewer ? { width: "60%" } : {}),
            }}
          >
            {showcaseActive ? (
              <ShowcaseTerminal tabId={tab.id} isActive={isActive} />
            ) : (
              <Terminal tabId={tab.id} isActive={isActive} cwd={tab.cwd} launchCommand={tab.launchCommand} />
            )}
          </div>
        );
      })}
    </div>
  );
}
