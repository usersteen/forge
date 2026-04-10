import { NEW_TAB_OPTIONS } from "../data/newTabOptions";
import useServerSuggestion from "../hooks/useServerSuggestion";
import useForgeStore from "../store/useForgeStore";

export default function EmptyGroupPicker({ groupId, rootPath, serverCommandOverride }) {
  const addTab = useForgeStore((s) => s.addTab);
  const { serverSuggestion, serverExpanded, hasSubmenu, serverHint, toggleServerExpanded } =
    useServerSuggestion(rootPath, serverCommandOverride);

  const selectOption = (tabOptions) => {
    addTab(groupId, tabOptions);
  };

  const openServerTab = (launchCommand = null) => {
    selectOption({ name: "Server", type: "server", launchCommand });
  };

  const handleServerClick = () => {
    if (hasSubmenu) {
      toggleServerExpanded();
      return;
    }
    openServerTab();
  };

  const runCommandLabel = serverSuggestion.value?.source === "saved"
    ? "Run Saved Command"
    : "Run Suggested Command";

  return (
    <div className="empty-group-picker">
      <h2 className="empty-group-picker-title">New Terminal</h2>
      <div className="empty-group-picker-options">
        {NEW_TAB_OPTIONS.map((option) =>
          option.id === "server" ? (
            <div key={option.id} className="quick-tab-group">
              <button
                className="quick-tab-item"
                aria-expanded={hasSubmenu ? serverExpanded : undefined}
                onClick={handleServerClick}
              >
                <span className="quick-tab-item-row">
                  <span className="quick-tab-item-label">{option.label}</span>
                  {hasSubmenu ? (
                    <span className="quick-tab-item-chevron">{serverExpanded ? "−" : "+"}</span>
                  ) : null}
                </span>
                <span className="quick-tab-item-hint">{serverHint}</span>
              </button>
              {serverExpanded ? (
                <div className="quick-tab-submenu">
                  {serverSuggestion.value ? (
                    <button
                      className="quick-tab-subitem"
                      onClick={() => openServerTab(serverSuggestion.value.command)}
                    >
                      <span className="quick-tab-item-label">{runCommandLabel}</span>
                      <span className="quick-tab-item-hint">{serverSuggestion.value.command}</span>
                      <span className="quick-tab-item-meta">{serverSuggestion.value.reason}</span>
                    </button>
                  ) : (
                    <div className="quick-tab-subitem quick-tab-subitem-disabled">
                      <span className="quick-tab-item-label">Looking for a likely dev command</span>
                      <span className="quick-tab-item-hint">You can still open a blank server tab below.</span>
                    </div>
                  )}
                  <button className="quick-tab-subitem" onClick={() => openServerTab()}>
                    <span className="quick-tab-item-label">I&apos;ll Type the Command</span>
                    <span className="quick-tab-item-hint">Open a server tab without running anything</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              key={option.id}
              className="quick-tab-item"
              onClick={() => selectOption(option.tabOptions)}
            >
              <span className="quick-tab-item-label">{option.label}</span>
              <span className="quick-tab-item-hint">{option.hint}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}
