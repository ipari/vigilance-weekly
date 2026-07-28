import { asc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { scheduledRuns } from "../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const schedules = await getDb()
    .select()
    .from(scheduledRuns)
    .orderBy(asc(scheduledRuns.executeAt), asc(scheduledRuns.id))
    .limit(50);
  return Response.json({ schedules });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json()) as { executeAt?: string };
  const executeAt = new Date(body.executeAt ?? "");
  const now = Date.now();
  if (!Number.isFinite(executeAt.getTime()) || executeAt.getTime() <= now) {
    return Response.json({ error: "현재보다 이후의 실행 시각을 입력해 주세요." }, { status: 400 });
  }
  if (executeAt.getTime() > now + 366 * 24 * 60 * 60 * 1000) {
    return Response.json({ error: "예약은 1년 이내로 지정해 주세요." }, { status: 400 });
  }

  const [schedule] = await getDb()
    .insert(scheduledRuns)
    .values({
      executeAt: executeAt.toISOString(),
      requestedBy: user.email,
      status: "pending",
    })
    .returning();
  return Response.json({ schedule }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: "취소할 예약이 올바르지 않습니다." }, { status: 400 });
  }

  const [schedule] = await getDb()
    .select()
    .from(scheduledRuns)
    .where(eq(scheduledRuns.id, id))
    .limit(1);
  if (!schedule || schedule.status !== "pending") {
    return Response.json({ error: "대기 중인 예약만 취소할 수 있습니다." }, { status: 409 });
  }

  await getDb()
    .update(scheduledRuns)
    .set({ status: "canceled", canceledAt: new Date().toISOString() })
    .where(eq(scheduledRuns.id, id));
  return Response.json({ canceled: true, id });
}
