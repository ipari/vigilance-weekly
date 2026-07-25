import { and, count, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { monitoringRuns, monitors } from "../../../db/schema";

export const dynamic = "force-dynamic";

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
    reportSequence: run.reportSequence,
    reportLabel: `${formatWeekLabel(run.weekKey)}${run.reportSequence > 1 ? ` (${run.reportSequence})` : ""}`,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    status: run.status,
    stage: run.stage,
    progress: run.progress,
    completedSteps: run.completedSteps,
    totalSteps: run.totalSteps,
    monitorCount: run.monitorCount,
    triggerType: run.triggerType,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    errorMessage: run.errorMessage,
  };
}

function formatWeekLabel(weekKey: string) {
  const [year, week] = weekKey.split("-W");
  return `${year}년 ${Number(week)}주차`;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const rows = await getDb()
      .select()
      .from(monitoringRuns)
      .where(eq(monitoringRuns.ownerEmail, user.email))
      .orderBy(desc(monitoringRuns.createdAt), desc(monitoringRuns.id))
      .limit(50);

    return Response.json({
      run: rows[0] ? serializeRun(rows[0]) : null,
      runs: rows.map(serializeRun),
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

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ error: "삭제할 리포트가 올바르지 않습니다." }, { status: 400 });
    }

    const [target] = await getDb()
      .select({
        id: monitoringRuns.id,
        status: monitoringRuns.status,
      })
      .from(monitoringRuns)
      .where(
        and(
          eq(monitoringRuns.id, id),
          eq(monitoringRuns.ownerEmail, user.email),
        ),
      )
      .limit(1);

    if (!target) {
      return Response.json({ error: "리포트를 찾을 수 없습니다." }, { status: 404 });
    }
    if (target.status === "queued" || target.status === "running") {
      return Response.json(
        { error: "진행 중인 리포트는 완료 또는 실패 후 삭제할 수 있습니다." },
        { status: 409 },
      );
    }

    await getDb()
      .delete(monitoringRuns)
      .where(
        and(
          eq(monitoringRuns.id, id),
          eq(monitoringRuns.ownerEmail, user.email),
        ),
      );

    return Response.json({ deleted: true, id });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "리포트를 삭제하지 못했습니다.",
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
    const [weekRuns] = await db
      .select({ count: count() })
      .from(monitoringRuns)
      .where(
        and(
          eq(monitoringRuns.ownerEmail, user.email),
          eq(monitoringRuns.weekKey, period.weekKey),
        ),
      );
    const reportSequence = Number(weekRuns?.count ?? 0) + 1;

    const [run] = await db
      .insert(monitoringRuns)
      .values({
        ownerEmail: user.email,
        ...period,
        reportSequence,
        status: "queued",
        monitorCount: activeMonitors.length,
        monitorSnapshot: JSON.stringify(activeMonitors),
        triggerType: "manual",
      })
      .returning();

    return Response.json(
      { run: serializeRun(run) },
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
