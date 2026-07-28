export type RecurringFrequency = "daily" | "weekly";

export function nextScheduleOccurrence(
  frequency: RecurringFrequency,
  timeOfDay: string,
  weekday: number | null,
  now = new Date(),
) {
  const seoulNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const [hour, minute] = timeOfDay.split(":").map(Number);
  const candidate = new Date(
    Date.UTC(
      seoulNow.getUTCFullYear(),
      seoulNow.getUTCMonth(),
      seoulNow.getUTCDate(),
      hour - 9,
      minute,
    ),
  );
  if (frequency === "daily") {
    if (candidate.getTime() <= now.getTime()) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
    return candidate.toISOString();
  }

  const currentWeekday = seoulNow.getUTCDay();
  let daysAhead = (Number(weekday) - currentWeekday + 7) % 7;
  if (daysAhead === 0 && candidate.getTime() <= now.getTime()) daysAhead = 7;
  candidate.setUTCDate(candidate.getUTCDate() + daysAhead);
  return candidate.toISOString();
}
