import test from "node:test";
import assert from "node:assert/strict";
import {
  createStatusEngineState,
  getHeatTransition,
  getTabRecencyAnchor,
  reduceLaunchCommand,
  reduceSessionCommand,
  reduceTitleChange,
  shouldTabAutoIdle,
} from "./statusEngine.js";

test("interactive Claude launches in waiting and prompt replies move it to working", () => {
  let state = createStatusEngineState();

  const launch = reduceLaunchCommand(state, {
    provider: "claude",
    launchMode: "interactive",
    title: "Claude ready",
  });
  state = launch.state;

  assert.equal(launch.transition.status, "waiting");
  assert.equal(launch.transition.waitingReason, "ready");
  assert.equal(launch.transition.heatEligibleWaiting, false);

  const submit = reduceSessionCommand(state, {
    provider: "claude",
    commandKind: "prompt",
    summary: "Ship the refactor",
  });

  assert.equal(submit.transition.status, "working");
  assert.equal(submit.transition.title, "Ship the refactor");
});

test("Claude working titles are accepted even while the tab is waiting", () => {
  const state = createStatusEngineState({
    provider: "claude",
    status: "waiting",
    statusTitle: "Claude ready",
    waitingReason: "ready",
  });

  const result = reduceTitleChange(state, {
    provider: "claude",
    titleInfo: { status: "working", label: "Implementing feature" },
    rawTitle: "Claude: Implementing feature",
  });

  assert.equal(result.ignored, false);
  assert.equal(result.transition.status, "working");
  assert.equal(result.transition.title, "Implementing feature");
});

test("Codex UI flows keep the working-title guard up", () => {
  let state = createStatusEngineState({
    provider: "codex",
    status: "waiting",
    statusTitle: "Codex ready",
    waitingReason: "ready",
  });

  const uiCommand = reduceSessionCommand(state, {
    provider: "codex",
    commandKind: "ui",
  });
  state = uiCommand.state;

  assert.equal(uiCommand.transition, null);
  assert.equal(state.codexWorkingTitleGuard, true);

  const title = reduceTitleChange(state, {
    provider: "codex",
    titleInfo: { status: "working", label: "Resume picker" },
    rawTitle: "Codex: Resume picker",
  });

  assert.equal(title.ignored, true);
  assert.equal(title.transition, null);
});

test("Codex prompt replies clear the UI guard and move waiting tabs to working", () => {
  let state = createStatusEngineState({
    provider: "codex",
    status: "waiting",
    statusTitle: "Needs input",
    waitingReason: "userInput",
  });

  state = reduceSessionCommand(state, {
    provider: "codex",
    commandKind: "ui",
  }).state;

  const prompt = reduceSessionCommand(state, {
    provider: "codex",
    commandKind: "prompt",
    summary: "Continue with the patch",
  });

  assert.equal(prompt.transition.status, "working");
  assert.equal(prompt.state.codexWorkingTitleGuard, false);
});

test("waiting recency prefers the current waiting timestamp", () => {
  const anchor = getTabRecencyAnchor({
    status: "waiting",
    waitingSince: 200,
    lastEngagedAt: 100,
  });

  assert.equal(anchor, 200);
});

test("heat opens on actionable waiting states and not on ready states", () => {
  const actionable = getHeatTransition({
    prevStatus: "working",
    nextStatus: "waiting",
    heatEligibleWaiting: true,
    hasHeatWaiting: false,
  });
  const ready = getHeatTransition({
    prevStatus: "idle",
    nextStatus: "waiting",
    heatEligibleWaiting: false,
    hasHeatWaiting: false,
  });

  assert.equal(actionable.opensHeatWaiting, true);
  assert.equal(ready.opensHeatWaiting, false);
});

test("cold starts can arm heat from ready without reopening hot ready states", () => {
  const coldReady = getHeatTransition({
    prevStatus: "idle",
    nextStatus: "waiting",
    heatEligibleWaiting: false,
    warmColdStart: true,
    hasHeatWaiting: false,
  });
  const hotReady = getHeatTransition({
    prevStatus: "idle",
    nextStatus: "waiting",
    heatEligibleWaiting: false,
    warmColdStart: false,
    hasHeatWaiting: false,
  });

  assert.equal(coldReady.opensHeatWaiting, true);
  assert.equal(hotReady.opensHeatWaiting, false);
});

test("heat records only explicit waiting-to-working replies", () => {
  const explicitReply = getHeatTransition({
    prevStatus: "waiting",
    nextStatus: "working",
    countResponse: true,
    hasHeatWaiting: true,
  });
  const titleResume = getHeatTransition({
    prevStatus: "waiting",
    nextStatus: "working",
    countResponse: false,
    hasHeatWaiting: true,
  });

  assert.equal(explicitReply.recordsResponse, true);
  assert.equal(explicitReply.clearsHeatWaiting, false);
  assert.equal(titleResume.recordsResponse, false);
  assert.equal(titleResume.clearsHeatWaiting, true);
});

test("working tabs do not auto-idle just because they run for a long time", () => {
  const shouldIdle = shouldTabAutoIdle({
    status: "working",
    now: 700_000,
    idleTimeoutMs: 600_000,
    lastInteractionAt: 0,
    nonWorkingSince: 0,
  });

  assert.equal(shouldIdle, false);
});

test("waiting tabs auto-idle after ten minutes of non-working inactivity", () => {
  const shouldIdle = shouldTabAutoIdle({
    status: "waiting",
    now: 700_000,
    idleTimeoutMs: 600_000,
    lastInteractionAt: 0,
    nonWorkingSince: 90_000,
  });

  assert.equal(shouldIdle, true);
});

test("waiting tabs do not auto-idle immediately after leaving working", () => {
  const shouldIdle = shouldTabAutoIdle({
    status: "waiting",
    now: 700_000,
    idleTimeoutMs: 600_000,
    lastInteractionAt: 10_000,
    nonWorkingSince: 650_000,
  });

  assert.equal(shouldIdle, false);
});
