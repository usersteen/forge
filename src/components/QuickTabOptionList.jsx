import { NEW_TAB_OPTIONS } from "../data/newTabOptions";
import useServerSuggestion from "../hooks/useServerSuggestion";

function ChevronIcon({ expanded }) {
  return (
    <span
      className={`quick-tab-item-chevron${expanded ? " quick-tab-item-chevron-expanded" : ""}`}
      aria-hidden="true"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M4 2.5L7.5 6L4 9.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function QuickTabOptionList({
  rootPath,
  serverCommandOverride = null,
  onSelect,
  variant = "surface",
  heroPhase = "idle",
  selectedActionId = null,
  onSelectIntent,
  onHeroSelectionComplete,
}) {
  const { serverSuggestion, serverExpanded, hasSubmenu, serverHint, toggleServerExpanded } =
    useServerSuggestion(rootPath, serverCommandOverride);
  const heroMode = variant === "empty";
  const heroEnteredClass = heroMode && heroPhase !== "pre-enter" ? " quick-tab-hero-entered" : "";
  const runCommandLabel = serverSuggestion.value?.source === "saved"
    ? "Run Saved Command"
    : "Run Suggested Command";

  const commitSelection = (actionId, tabOptions, heroEligible = true) => {
    if (onSelectIntent) {
      onSelectIntent(actionId, tabOptions, { heroEligible });
      return;
    }
    onSelect(tabOptions);
  };

  const getHeroStateClass = (actionId) => {
    if (!heroMode || heroPhase !== "exiting" || !selectedActionId) return "";
    return selectedActionId === actionId ? " quick-tab-hero-selected" : " quick-tab-hero-dimmed";
  };

  const handleHeroTransitionEnd = (actionId, event) => {
    if (!heroMode || heroPhase !== "exiting" || selectedActionId !== actionId) return;
    if (event.propertyName !== "opacity") return;
    onHeroSelectionComplete?.(actionId);
  };

  const openServerTab = (launchCommand = null) => {
    const actionId = launchCommand ? "server-suggested" : "server-manual";
    commitSelection(actionId, { name: "Server", type: "server", launchCommand }, false);
  };

  const handleServerClick = () => {
    if (hasSubmenu) {
      toggleServerExpanded();
      return;
    }
    openServerTab();
  };

  return NEW_TAB_OPTIONS.map((option, index) => {
    if (option.id !== "server") {
      return (
        <div
          key={option.id}
          className={`quick-tab-entry surface-stagger${heroMode ? " quick-tab-entry-hero" : ""}${heroEnteredClass}${getHeroStateClass(option.id)}`}
          style={{ "--surface-index": index }}
          onTransitionEnd={(event) => handleHeroTransitionEnd(option.id, event)}
        >
          <button
            className={`quick-tab-item${heroMode ? " quick-tab-item-hero" : ""}`}
            onClick={() => commitSelection(option.id, option.tabOptions)}
          >
            <span className="quick-tab-item-label">{option.label}</span>
            <span className="quick-tab-item-hint">{option.hint}</span>
          </button>
        </div>
      );
    }

    return (
      <div
        key={option.id}
        className={`quick-tab-group surface-stagger${heroMode ? " quick-tab-group-hero" : ""}${heroEnteredClass}${getHeroStateClass(option.id)}`}
        style={{ "--surface-index": index }}
        onTransitionEnd={(event) => handleHeroTransitionEnd(option.id, event)}
      >
        <button
          className={`quick-tab-item${heroMode ? " quick-tab-item-hero" : ""}${
            serverExpanded ? " quick-tab-item-expanded" : ""
          }`}
          aria-expanded={hasSubmenu ? serverExpanded : undefined}
          onClick={handleServerClick}
        >
          <span className="quick-tab-item-row">
            <span className="quick-tab-item-label">{option.label}</span>
            {hasSubmenu ? <ChevronIcon expanded={serverExpanded} /> : null}
          </span>
          <span className="quick-tab-item-hint">{serverHint}</span>
        </button>
        {hasSubmenu ? (
          <div
            className={`quick-tab-submenu-shell${serverExpanded ? " quick-tab-submenu-shell-open" : ""}`}
            aria-hidden={!serverExpanded}
          >
            <div className="quick-tab-submenu">
              <div className="quick-tab-subitem-shell" style={{ "--submenu-index": 0 }}>
                {serverSuggestion.value ? (
                  <button
                    className="quick-tab-subitem"
                    tabIndex={serverExpanded ? 0 : -1}
                    onClick={() => openServerTab(serverSuggestion.value.command)}
                  >
                    <span className="quick-tab-item-label">{runCommandLabel}</span>
                    <span className="quick-tab-item-hint">{serverSuggestion.value.command}</span>
                    <span className="quick-tab-item-meta">{serverSuggestion.value.reason}</span>
                  </button>
                ) : (
                  <div className="quick-tab-subitem quick-tab-subitem-disabled">
                    <span className="quick-tab-item-label">Looking for a likely dev command</span>
                    <span className="quick-tab-item-hint">
                      You can still open a blank server tab below.
                    </span>
                  </div>
                )}
              </div>
              <div className="quick-tab-subitem-shell" style={{ "--submenu-index": 1 }}>
                <button
                  className="quick-tab-subitem"
                  tabIndex={serverExpanded ? 0 : -1}
                  onClick={() => openServerTab()}
                >
                  <span className="quick-tab-item-label">I&apos;ll Type the Command</span>
                  <span className="quick-tab-item-hint">
                    Open a server tab without running anything
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  });
}
