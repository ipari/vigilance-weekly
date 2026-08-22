import { and, desc, eq, lt } from "drizzle-orm";
import { getDb } from ".";
import { monitoringRuns } from "./schema";
import type { Report } from "../app/report-data";
import {
  mergeRegulatoryResults,
  compareRegulatoryItem,
  type RegulatoryActionType,
  type RegulatoryPriority,
  type RegulatoryRegion,
  type RegulatoryResult,
} from "../lib/regulatory";

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
  authority?: RegulatoryResult["authority"];
  region?: RegulatoryRegion;
  title: string;
  date: string;
  description: string;
  sourceUrl: string;
  monitor: string;
  matchedTerms?: string[];
  actionType?: RegulatoryActionType;
  priority?: RegulatoryPriority;
  assessment?: string;
  officialDocumentName?: string;
  revision?: number;
};

export async function getStoredReports(): Promise<Report[]> {
  try {
    const rows = await getDb()
      .select()
      .from(monitoringRuns)
      .orderBy(desc(monitoringRuns.createdAt), desc(monitoringRuns.id))
      .limit(30);

    return rows.map((row) => toPublicReport(row));
  } catch (error) {
    console.error("공개 리포트 목록을 불러오지 못했습니다.", error);
    return [];
  }
}

export async function getStoredReport(id: number): Promise<Report | null> {
  if (!Number.isInteger(id) || id < 1) return null;

  try {
    const database = getDb();
    const [run] = await database
      .select()
      .from(monitoringRuns)
      .where(eq(monitoringRuns.id, id))
      .limit(1);
    if (!run) return null;
    const [previousRun] = await database
      .select()
      .from(monitoringRuns)
      .where(
        and(
          lt(monitoringRuns.id, run.id),
          eq(monitoringRuns.status, "completed"),
        ),
      )
      .orderBy(desc(monitoringRuns.createdAt), desc(monitoringRuns.id))
      .limit(1);
    return toPublicReport(run, previousRun);
  } catch {
    return null;
  }
}

function toPublicReport(
  run: typeof monitoringRuns.$inferSelect,
  previousRun?: typeof monitoringRuns.$inferSelect,
): Report {
  const snapshot = safeSnapshot(run.monitorSnapshot);
  const targets = snapshot.map((monitor) => monitor.ingredient).filter(Boolean);
  const aliases = snapshot
    .flatMap((monitor) => [monitor.productName, monitor.aliases])
    .filter(Boolean);
  const baseWeek = formatWeekLabel(run.weekKey);
  const literature = safeJsonArray<StoredLiterature>(run.literatureResults);
  const storedRegulatory = safeJsonArray<StoredRegulatory>(run.regulatoryResults);
  const regulatory = mergeRegulatoryResults(
    storedRegulatory as RegulatoryResult[],
  );
  const previousRegulatory = previousRun
    ? mergeRegulatoryResults(
        safeJsonArray<StoredRegulatory>(previousRun.regulatoryResults) as RegulatoryResult[],
      )
    : [];

  return {
    slug: `run-${run.id}`,
    week:
      run.customName?.trim() ||
      `${baseWeek}${run.reportSequence > 1 ? ` (${run.reportSequence})` : ""}`,
    range: `${formatKoreanDate(run.periodStart)} — ${formatKoreanDate(run.periodEnd)}`,
    updatedAt: formatKoreanTimestamp(run.createdAt),
    current: false,
    target: targets.join(" · ") || `${run.monitorCount}개 감시 대상`,
    aliases: aliases.join(" · ") || "등록된 제품명 및 검색 동의어 기준",
    regulationCount: regulatory.length,
    literatureCount: literature.length,
    icsrCount: literature.filter((item) => item.tag === "ICSR 검토").length,
    regions: regionSummaries(regulatory),
    regulatoryComparison: previousRun
      ? regulatoryComparison(regulatory, previousRun, previousRegulatory)
      : undefined,
    targets: snapshot.map((monitor) => {
      const matchesMonitor = (value: string) =>
        value.trim().toLocaleLowerCase() ===
        monitor.ingredient.trim().toLocaleLowerCase();
      const monitorLiterature = literature.filter((item) =>
        matchesMonitor(item.monitor),
      );
      return {
        ingredient: monitor.ingredient,
        productName: monitor.productName,
        aliases: monitor.aliases,
        literatureCount: monitorLiterature.length,
        regulationCount: regulatory.filter((item) =>
          regulatoryMatchesMonitor(item.monitor, monitor.ingredient),
        ).length,
        icsrCount: monitorLiterature.filter(
          (item) => item.tag === "ICSR 검토",
        ).length,
      };
    }),
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
      monitor: item.monitor,
    })),
    status: run.status,
    stage: run.stage,
    progress: run.progress,
    regulatory: regulatory.map((item) => ({
      source: item.source,
      authority: item.authority,
      region: item.region,
      title: item.title,
      date: item.date,
      description: item.description,
      sourceUrl: item.sourceUrl,
      monitor: item.monitor,
      matchedTerms: item.matchedTerms,
      actionType: item.actionType,
      priority: item.priority,
      assessment: item.assessment,
      officialDocumentName: item.officialDocumentName,
      revision: item.revision,
      change: previousRun
        ? compareRegulatoryItem(item, previousRegulatory)
        : undefined,
    })),
  };
}

function regulatoryComparison(
  current: RegulatoryResult[],
  previousRun: typeof monitoringRuns.$inferSelect,
  previous: RegulatoryResult[],
): NonNullable<Report["regulatoryComparison"]> {
  const regions = [
    { code: "KR" as const, name: "한국" },
    { code: "US" as const, name: "미국" },
    { code: "EU" as const, name: "유럽" },
  ].map((region) => {
    const currentCount = current.filter((item) => item.region === region.code).length;
    const previousCount = previous.filter((item) => item.region === region.code).length;
    return {
      ...region,
      currentCount,
      previousCount,
      difference: currentCount - previousCount,
    };
  });

  return {
    baseline: reportName(previousRun),
    previousCount: previous.length,
    currentCount: current.length,
    difference: current.length - previous.length,
    regions,
  };
}

function reportName(run: typeof monitoringRuns.$inferSelect) {
  const baseWeek = formatWeekLabel(run.weekKey);
  return (
    run.customName?.trim() ||
    `${baseWeek}${run.reportSequence > 1 ? ` (${run.reportSequence})` : ""}`
  );
}

function regionSummaries(regulatory: RegulatoryResult[]): NonNullable<Report["regions"]> {
  const definitions = [
    { code: "KR" as const, name: "한국", source: "MFDS · KIDS" },
    { code: "US" as const, name: "미국", source: "FDA" },
    { code: "EU" as const, name: "유럽", source: "EMA · PRAC" },
  ];
  return definitions.map((definition) => {
    const items = regulatory.filter((item) => item.region === definition.code);
    const highCount = items.filter((item) => item.priority === "높음").length;
    return {
      ...definition,
      count: items.length,
      highCount,
      status: highCount
        ? `${highCount}건 우선 검토`
        : items.length
          ? `${items.length}건 검토 필요`
          : "신규 조치 없음",
    };
  });
}

function regulatoryMatchesMonitor(value: string, ingredient: string) {
  const expected = ingredient.trim().toLocaleLowerCase();
  return value
    .split("·")
    .some((item) => item.trim().toLocaleLowerCase() === expected);
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
