export function getTabRecencyAnchor(tab) {
  if (tab?.status === "waiting") {
    return tab.waitingSince || tab.lastEngagedAt || null;
  }
  return tab?.lastEngagedAt || null;
}

export function getTabStatusSummary(tabs = [], now = Date.now(), recencyThreshold = 0) {
  const interactiveTabs = tabs.filter((tab) => tab?.type !== "server");
  const waitingTabs = interactiveTabs.filter((tab) => tab?.status === "waiting");

  if (waitingTabs.length > 0) {
    const hasRecentWaiting = waitingTabs.some((tab) => {
      const anchor = getTabRecencyAnchor(tab);
      return anchor ? now - anchor < recencyThreshold : false;
    });

    return {
      status: "waiting",
      hasRecentWaiting,
    };
  }

  if (interactiveTabs.some((tab) => tab?.status === "working")) {
    return {
      status: "working",
      hasRecentWaiting: false,
    };
  }

  return {
    status: "idle",
    hasRecentWaiting: false,
  };
}
