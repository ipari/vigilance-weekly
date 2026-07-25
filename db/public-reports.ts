import { desc, eq } from "drizzle-orm";
import { getDb } from ".";
import { monitoringRuns } from "./schema";
import type { Report } from "../app/report-data";

type MonitorSnapshot = {
  ingredient: string;
  productName: string;
  aliases: string;
  regions: string;
};

export async function getStoredReports(): Promise<Report[]> {
  try {
    const rows = await getDb()
      .select()
      .from(monitoringRuns)
      .orderBy(desc(monitoringRuns.createdAt), desc(monitoringRuns.id))
      .limit(30);

    return rows
      .filter((run) => run.reportSequence > 1)
      .map(toPublicReport);
  } catch {
    return [];
  }
}

export async function getStoredReport(id: number): Promise<Report | null> {
  if (!Number.isInteger(id) || id < 1) return null;

  try {
    const [run] = await getDb()
      .select()
      .from(monitoringRuns)
      .where(eq(monitoringRuns.id, id))
      .limit(1);
    return run ? toPublicReport(run) : null;
  } catch {
    return null;
  }
}

function toPublicReport(
  run: typeof monitoringRuns.$inferSelect,
): Report {
  const snapshot = safeSnapshot(run.monitorSnapshot);
  const targets = snapshot.map((monitor) => monitor.ingredient).filter(Boolean);
  const aliases = snapshot
    .flatMap((monitor) => [monitor.productName, monitor.aliases])
    .filter(Boolean);
  const baseWeek = formatWeekLabel(run.weekKey);

  return {
    slug: `run-${run.id}`,
    week: `${baseWeek}${run.reportSequence > 1 ? ` (${run.reportSequence})` : ""}`,
    range: `${formatKoreanDate(run.periodStart)} — ${formatKoreanDate(run.periodEnd)}`,
    updatedAt: formatKoreanTimestamp(run.createdAt),
    current: false,
    target: targets.join(" · ") || `${run.monitorCount}개 감시 대상`,
    aliases: aliases.join(" · ") || "등록된 제품명 및 검색 동의어 기준",
    regulationCount: 0,
    literatureCount: 0,
    icsrCount: 0,
    literature: [],
    status: run.status,
  };
}

function safeSnapshot(value: string): MonitorSnapshot[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatWeekLabel(weekKey: string) {
  const [year, week] = weekKey.split("-W");
  return `${year}년 ${Number(week)}주차`;
}

function formatKoreanDate(value: string) {
  const [, month, day] = value.split("-").map(Number);
  return `${month}월 ${day}일`;
}

function formatKoreanTimestamp(value: string) {
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
