import { asc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { scheduledRuns } from "../../../db/schema";
import { nextScheduleOccurrence } from "../../../lib/scheduling";

export const dynamic = "force-dynamic";

type Frequency = "once" | "daily" | "weekly";

type ScheduleInput = {
  frequency?: unknown;
  executeAt?: unknown;
  timeOfDay?: unknown;
  weekday?: unknown;
};

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const schedules = await getDb()
    .select()
    .from(scheduledRuns)
    .orderBy(asc(scheduledRuns.executeAt), asc(scheduledRuns.id))
    .limit(100);
  return Response.json({ schedules });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const parsed = parseScheduleInput((await request.json()) as ScheduleInput);
  if (parsed instanceof Response) return parsed;

  const [schedule] = await getDb()
    .insert(scheduledRuns)
    .values({
      ...parsed,
      requestedBy: user.email,
      status: "pending",
      active: true,
    })
    .returning();
  return Response.json({ schedule }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const id = parseId(request);
  if (!id) {
    return Response.json({ error: "수정할 일정이 올바르지 않습니다." }, { status: 400 });
  }
  const parsed = parseScheduleInput((await request.json()) as ScheduleInput);
  if (parsed instanceof Response) return parsed;

  const [schedule] = await getDb()
    .update(scheduledRuns)
    .set({
      ...parsed,
      status: "pending",
      active: true,
      runId: null,
      errorMessage: null,
      canceledAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(scheduledRuns.id, id))
    .returning();
  if (!schedule) {
    return Response.json({ error: "일정을 찾을 수 없습니다." }, { status: 404 });
  }
  return Response.json({ schedule });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const id = parseId(request);
  if (!id) {
    return Response.json({ error: "삭제할 일정이 올바르지 않습니다." }, { status: 400 });
  }
  const [deleted] = await getDb()
    .delete(scheduledRuns)
    .where(eq(scheduledRuns.id, id))
    .returning({ id: scheduledRuns.id });
  if (!deleted) {
    return Response.json({ error: "일정을 찾을 수 없습니다." }, { status: 404 });
  }
  return Response.json({ deleted: true, id });
}

function parseId(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseScheduleInput(body: ScheduleInput) {
  const frequency = String(body.frequency ?? "") as Frequency;
  if (!["once", "daily", "weekly"].includes(frequency)) {
    return Response.json({ error: "반복 방식을 선택해 주세요." }, { status: 400 });
  }

  if (frequency === "once") {
    const executeAt = new Date(String(body.executeAt ?? ""));
    const now = Date.now();
    if (!Number.isFinite(executeAt.getTime()) || executeAt.getTime() <= now) {
      return Response.json({ error: "현재보다 이후의 실행 시각을 입력해 주세요." }, { status: 400 });
    }
    if (executeAt.getTime() > now + 366 * 24 * 60 * 60 * 1000) {
      return Response.json({ error: "1회 일정은 1년 이내로 지정해 주세요." }, { status: 400 });
    }
    return {
      frequency,
      executeAt: executeAt.toISOString(),
      timeOfDay: seoulTime(executeAt),
      weekday: null,
    };
  }

  const timeOfDay = String(body.timeOfDay ?? "");
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeOfDay)) {
    return Response.json({ error: "실행 시각을 선택해 주세요." }, { status: 400 });
  }
  const weekday = frequency === "weekly" ? Number(body.weekday) : null;
  if (frequency === "weekly" && (!Number.isInteger(weekday) || weekday! < 0 || weekday! > 6)) {
    return Response.json({ error: "실행할 요일을 선택해 주세요." }, { status: 400 });
  }

  return {
    frequency,
    executeAt: nextScheduleOccurrence(frequency, timeOfDay, weekday),
    timeOfDay,
    weekday,
  };
}

function seoulTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
