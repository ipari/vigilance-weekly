import assert from "node:assert/strict";
import test from "node:test";
import { nextScheduleOccurrence } from "../lib/scheduling.ts";

test("daily schedule uses Asia/Seoul and advances after today's time", () => {
  assert.equal(
    nextScheduleOccurrence("daily", "06:00", null, new Date("2026-07-27T20:59:00Z")),
    "2026-07-27T21:00:00.000Z",
  );
  assert.equal(
    nextScheduleOccurrence("daily", "06:00", null, new Date("2026-07-27T21:01:00Z")),
    "2026-07-28T21:00:00.000Z",
  );
});

test("weekly schedule selects the requested Seoul weekday", () => {
  assert.equal(
    nextScheduleOccurrence("weekly", "06:00", 1, new Date("2026-07-28T07:00:00Z")),
    "2026-08-02T21:00:00.000Z",
  );
  assert.equal(
    nextScheduleOccurrence("weekly", "06:00", 2, new Date("2026-07-27T20:00:00Z")),
    "2026-07-27T21:00:00.000Z",
  );
});
