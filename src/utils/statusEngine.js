function normalizeProvider(provider) {
  return provider === "claude" || provider === "codex" ? provider : "unknown";
}

function normalizeStatus(status) {
  return status === "idle" || status === "working" || status === "waiting" ? status : "idle";
}

function normalizeTitle(title) {
  return typeof title === "string" ? title : "";
}

function normalizeTabType(type) {
  return type === "server" ? "server" : "ai";
}

function normalizeWaitingReason(reason, status) {
  if (status !== "waiting") return null;
  return typeof reason === "string" && reason.trim() ? reason : null;
}

function observeTransition(state, transition) {
  return {
    ...state,
    provider: normalizeProvider(transition.provider ?? state.provider),
    status: normalizeStatus(transition.status),
    title: normalizeTitle(transition.title ?? state.title),
    waitingReason: normalizeWaitingReason(
      transition.waitingReason ?? state.waitingReason,
      transition.status
    ),
    codexWorkingTitleGuard: false,
  };
}

function providerLabel(provider) {
  return provider === "claude" ? "Claude" : "Codex";
}

export function createStatusEngineState(initial = {}) {
  const status = normalizeStatus(initial.status);
  return {
    provider: normalizeProvider(initial.provider),
    status,
    title: normalizeTitle(initial.title ?? initial.statusTitle),
    waitingReason: normalizeWaitingReason(initial.waitingReason, status),
    codexWorkingTitleGuard: false,
  };
}

export function observeStatusTransition(state, observation = {}) {
  const provider = normalizeProvider(observation.provider ?? state.provider);
  const status = normalizeStatus(observation.status ?? state.status);
  return {
    ...state,
    provider,
    status,
    title: normalizeTitle(observation.title ?? state.title),
    waitingReason: normalizeWaitingReason(
      observation.waitingReason ?? state.waitingReason,
      status
    ),
    codexWorkingTitleGuard:
      provider === "codex" && status === "waiting" ? state.codexWorkingTitleGuard : false,
  };
}

export function reduceLaunchCommand(state, input) {
  const provider = normalizeProvider(input?.provider);
  const launchMode = input?.launchMode === "interactive" ? "interactive" : "task";
  const nextState = {
    ...state,
    provider,
    codexWorkingTitleGuard: false,
  };

  const transition =
    launchMode === "interactive"
      ? {
          status: "waiting",
          title: normalizeTitle(input?.title) || `${providerLabel(provider)} ready`,
          waitingReason: "ready",
          heatEligibleWaiting: false,
        }
      : {
          status: "working",
          title: normalizeTitle(input?.title) || providerLabel(provider),
          waitingReason: null,
        };

  return {
    state: observeTransition(nextState, transition),
    transition,
  };
}

export function reduceSessionCommand(state, input) {
  const provider = normalizeProvider(input?.provider);
  const commandKind = input?.commandKind;
  const nextState = {
    ...state,
    provider,
  };

  if (provider === "claude") {
    if (commandKind === "ui") {
      return { state: nextState, transition: null };
    }

    if (state.status === "waiting") {
      const transition = {
        status: "working",
        title: normalizeTitle(input?.summary) || "Claude",
        waitingReason: null,
      };
      return {
        state: observeTransition(nextState, transition),
        transition,
      };
    }

    return { state: nextState, transition: null };
  }

  if (provider === "codex") {
    if (commandKind === "ui") {
      return {
        state: {
          ...nextState,
          codexWorkingTitleGuard: true,
        },
        transition: null,
      };
    }

    const baseState = {
      ...nextState,
      codexWorkingTitleGuard: false,
    };

    if (commandKind === "prompt" && state.status === "waiting") {
      const transition = {
        status: "working",
        title: normalizeTitle(input?.summary) || "Codex",
        waitingReason: null,
      };
      return {
        state: observeTransition(baseState, transition),
        transition,
      };
    }

    return { state: baseState, transition: null };
  }

  return { state: nextState, transition: null };
}

export function reduceTitleChange(state, input) {
  const provider = normalizeProvider(input?.provider ?? state.provider);
  const titleInfo = input?.titleInfo;
  const rawTitle = normalizeTitle(input?.rawTitle);
  const nextState = {
    ...state,
    provider,
  };

  if (!titleInfo?.status) {
    return { state: nextState, transition: null, ignored: false };
  }

  if (
    provider === "codex" &&
    titleInfo.status === "working" &&
    state.codexWorkingTitleGuard
  ) {
    return { state: nextState, transition: null, ignored: true };
  }

  const transition = {
    status: titleInfo.status,
    title: normalizeTitle(titleInfo.label) || rawTitle || state.title,
    waitingReason: titleInfo.status === "waiting" ? "userInput" : null,
  };

  return {
    state: observeTransition(nextState, transition),
    transition,
    ignored: false,
  };
}

export function getHeatTransition(input = {}) {
  const prevStatus = normalizeStatus(input.prevStatus);
  const nextStatus = normalizeStatus(input.nextStatus);
  const tabType = normalizeTabType(input.tabType);
  const hasHeatWaiting = Boolean(input.hasHeatWaiting);
  const heatEligibleWaiting = input.heatEligibleWaiting ?? nextStatus === "waiting";
  const warmColdStart = Boolean(input.warmColdStart);
  const countResponse = input.countResponse ?? true;

  const opensHeatWaiting =
    nextStatus === "waiting" && (heatEligibleWaiting || warmColdStart) && !hasHeatWaiting;
  const recordsResponse =
    countResponse &&
    prevStatus === "waiting" &&
    nextStatus === "working" &&
    tabType !== "server" &&
    hasHeatWaiting;
  const clearsHeatWaiting = nextStatus !== "waiting" && hasHeatWaiting && !recordsResponse;

  return {
    opensHeatWaiting,
    recordsResponse,
    clearsHeatWaiting,
  };
}

export function shouldTabAutoIdle(input = {}) {
  const status = normalizeStatus(input.status);
  const tabType = normalizeTabType(input.tabType);
  const now = Number.isFinite(input.now) ? input.now : Date.now();
  const idleTimeoutMs = Math.max(0, Number(input.idleTimeoutMs) || 0);
  const lastInteractionAt = Number.isFinite(input.lastInteractionAt) ? input.lastInteractionAt : 0;
  const nonWorkingSince = Number.isFinite(input.nonWorkingSince) ? input.nonWorkingSince : 0;

  if (tabType === "server" || status === "working" || status === "idle" || idleTimeoutMs <= 0) {
    return false;
  }

  const referenceAt = Math.max(lastInteractionAt, nonWorkingSince);
  if (!referenceAt) return false;

  return now - referenceAt >= idleTimeoutMs;
}

export function getTabRecencyAnchor(tab) {
  if (tab.status === "waiting") {
    return tab.waitingSince || tab.lastEngagedAt || null;
  }
  return tab.lastEngagedAt || null;
}
