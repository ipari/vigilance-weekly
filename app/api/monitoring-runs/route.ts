import { and, desc, eq, inArray } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { monitoringRuns, monitors } from "../../../db/schema";

export const dynamic = "force-dynamic";

const ACTIVE_RUN_STATUSES = ["queued", "running"];

function currentSeoulWeek(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const seoulToday = new Date(value("year"), value("month") - 1, value("day"));
  const day = seoulToday.getDay() || 7;
  const periodStart = new Date(seoulToday);
  periodStart.setDate(periodStart.getDate() - day + 1);
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 6);

  const thursday = new Date(periodStart);
  thursday.setDate(thursday.getDate() + 3);
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86400000 +
      yearStart.getDay() +
      1) /
      7,
  );

  return {
    weekKey: `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`,
    periodStart: formatDate(periodStart),
    periodEnd: formatDate(periodEnd),
  };
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function serializeRun(run: typeof monitoringRuns.$inferSelect) {
  return {
    id: run.id,
    weekKey: run.weekKey,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    status: run.status,
    monitorCount: run.monitorCount,
    triggerType: run.triggerType,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    errorMessage: run.errorMessage,
  };
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const [latestRun] = await getDb()
      .select()
      .from(monitoringRuns)
      .where(eq(monitoringRuns.ownerEmail, user.email))
      .orderBy(desc(monitoringRuns.createdAt), desc(monitoringRuns.id))
      .limit(1);

    return Response.json({
      run: latestRun ? serializeRun(latestRun) : null,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "실행 상태를 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const db = getDb();
    const activeMonitors = await db
      .select({
        id: monitors.id,
        ingredient: monitors.ingredient,
        productName: monitors.productName,
        aliases: monitors.aliases,
        regions: monitors.regions,
      })
      .from(monitors)
      .where(
        and(eq(monitors.ownerEmail, user.email), eq(monitors.active, true)),
      )
      .orderBy(monitors.id);

    if (activeMonitors.length === 0) {
      return Response.json(
        { error: "먼저 활성 감시 대상 약물을 한 개 이상 등록해 주세요." },
        { status: 400 },
      );
    }

    const period = currentSeoulWeek();
    const [existingRun] = await db
      .select()
      .from(monitoringRuns)
      .where(
        and(
          eq(monitoringRuns.ownerEmail, user.email),
          eq(monitoringRuns.weekKey, period.weekKey),
          inArray(monitoringRuns.status, ACTIVE_RUN_STATUSES),
        ),
      )
      .orderBy(desc(monitoringRuns.createdAt), desc(monitoringRuns.id))
      .limit(1);

    if (existingRun) {
      return Response.json({
        run: serializeRun(existingRun),
        duplicate: true,
      });
    }

    const [run] = await db
      .insert(monitoringRuns)
      .values({
        ownerEmail: user.email,
        ...period,
        status: "queued",
        monitorCount: activeMonitors.length,
        monitorSnapshot: JSON.stringify(activeMonitors),
        triggerType: "manual",
      })
      .returning();

    return Response.json(
      { run: serializeRun(run), duplicate: false },
      { status: 202 },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "이번 주 업데이트를 시작하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
