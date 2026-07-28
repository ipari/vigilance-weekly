import { and, asc, eq, gt } from "drizzle-orm";
import { getDb } from ".";
import { scheduledRuns } from "./schema";

export async function getNextScheduledRun() {
  try {
    const [schedule] = await getDb()
      .select({
        executeAt: scheduledRuns.executeAt,
        frequency: scheduledRuns.frequency,
        weekday: scheduledRuns.weekday,
        timeOfDay: scheduledRuns.timeOfDay,
      })
      .from(scheduledRuns)
      .where(
        and(
          eq(scheduledRuns.active, true),
          eq(scheduledRuns.status, "pending"),
          gt(scheduledRuns.executeAt, new Date().toISOString()),
        ),
      )
      .orderBy(asc(scheduledRuns.executeAt), asc(scheduledRuns.id))
      .limit(1);
    return schedule ?? null;
  } catch {
    return null;
  }
}
