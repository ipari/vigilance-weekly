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

type StoredLiterature = {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  published: string;
  doi: string;
  abstract: string;
  sourceUrl: string;
  monitor: string;
  priority: "낮음" | "중간";
  tag: string;
};

type StoredRegulatory = {
  source: string;
  title: string;
  date: string;
  description: string;
  sourceUrl: string;
  monitor: string;
};

export async function getStoredReports(): Promise<Report[]> {
  try {
    const rows = await getDb()
      .select()
      .from(monitoringRuns)
      .orderBy(desc(monitoringRuns.createdAt), desc(monitoringRuns.id))
      .limit(30);

    return rows.map(toPublicReport);
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
  const literature = safeJsonArray<StoredLiterature>(run.literatureResults);
  const regulatory = safeJsonArray<StoredRegulatory>(run.regulatoryResults);

  return {
    slug: `run-${run.id}`,
    week: `${baseWeek}${run.reportSequence > 1 ? ` (${run.reportSequence})` : ""}`,
    range: `${formatKoreanDate(run.periodStart)} — ${formatKoreanDate(run.periodEnd)}`,
    updatedAt: formatKoreanTimestamp(run.createdAt),
    current: false,
    target: targets.join(" · ") || `${run.monitorCount}개 감시 대상`,
    aliases: aliases.join(" · ") || "등록된 제품명 및 검색 동의어 기준",
    regulationCount: regulatory.length,
    literatureCount: literature.length,
    icsrCount: literature.filter((item) => item.tag === "ICSR 검토").length,
    literature: literature.map((item) => ({
      pmid: item.pmid,
      tag: item.tag,
      level: item.priority,
      title: item.title,
      summary: excerpt(item.abstract),
      meta: `PMID ${item.pmid} · ${item.journal || "PubMed"}`,
      originalTitle: item.title,
      authors: item.authors,
      journal: item.journal,
      doi: item.doi,
      published: item.published,
      assessment:
        item.priority === "중간"
          ? "개별 증례 가능성과 중대성, 예상성 및 중복 여부를 우선 검토합니다."
          : "누적 안전성 근거로 분류하고 기존 시그널과의 일관성을 확인합니다.",
      sourceUrl: item.sourceUrl,
    })),
    status: run.status,
    stage: run.stage,
    progress: run.progress,
    regulatory: regulatory.map((item) => ({
      source: item.source,
      title: item.title,
      date: item.date,
      description: item.description,
      sourceUrl: item.sourceUrl,
      monitor: item.monitor,
    })),
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

function safeJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function excerpt(value: string) {
  if (value.length <= 360) return value;
  return `${value.slice(0, 357).trim()}…`;
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
