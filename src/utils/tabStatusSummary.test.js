import assert from "node:assert/strict";
import test from "node:test";
import { getTabStatusSummary } from "./tabStatusSummary.js";

test("waiting beats working and idle", () => {
  const result = getTabStatusSummary(
    [
      { type: "ai", status: "idle" },
      { type: "ai", status: "working" },
      { type: "ai", status: "waiting", waitingSince: 950 },
    ],
    1000,
    100
  );

  assert.deepEqual(result, {
    status: "waiting",
    hasRecentWaiting: true,
  });
});

test("working beats idle when no tabs are waiting", () => {
  const result = getTabStatusSummary(
    [
      { type: "ai", status: "idle" },
      { type: "ai", status: "working" },
    ],
    1000,
    100
  );

  assert.deepEqual(result, {
    status: "working",
    hasRecentWaiting: false,
  });
});

test("server tabs do not affect the summary", () => {
  const result = getTabStatusSummary(
    [
      { type: "server", status: "working" },
      { type: "ai", status: "idle" },
    ],
    1000,
    100
  );

  assert.deepEqual(result, {
    status: "idle",
    hasRecentWaiting: false,
  });
});

test("waiting summary tracks recency", () => {
  const result = getTabStatusSummary(
    [
      { type: "ai", status: "waiting", waitingSince: 500 },
    ],
    1000,
    100
  );

  assert.deepEqual(result, {
    status: "waiting",
    hasRecentWaiting: false,
  });
});
