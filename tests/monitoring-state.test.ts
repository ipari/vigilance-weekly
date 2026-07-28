import assert from "node:assert/strict";
import test from "node:test";
import { shouldRestartLegacyRun } from "../lib/monitoring-state.ts";

test("only pre-checkpoint runs are restarted", () => {
  assert.equal(
    shouldRestartLegacyRun({
      completedSteps: 11,
      lastActivityAt: null,
      literatureResults: "[]",
      regulatoryResults: "[]",
    }),
    true,
  );
  assert.equal(
    shouldRestartLegacyRun({
      completedSteps: 1,
      lastActivityAt: "2026-07-28T14:00:00.000Z",
      literatureResults: "[]",
      regulatoryResults: "[]",
    }),
    false,
  );
});
