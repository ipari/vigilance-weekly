import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { monitors } from "../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  try {
    const rows = await getDb()
      .select()
      .from(monitors)
      .where(eq(monitors.ownerEmail, user.email))
      .orderBy(desc(monitors.createdAt), desc(monitors.id));
    return Response.json({ monitors: rows.map((row) => ({ ...row, active: Boolean(row.active) })) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const ingredient = String(body.ingredient ?? "").trim();
    if (!ingredient) return Response.json({ error: "성분명을 입력해 주세요." }, { status: 400 });

    const [monitor] = await getDb()
      .insert(monitors)
      .values({
        ownerEmail: user.email,
        ingredient,
        productName: String(body.productName ?? "").trim(),
        aliases: String(body.aliases ?? "").trim(),
        regions: String(body.regions ?? "KR,US,EU"),
      })
      .returning();

    return Response.json({ monitor: { ...monitor, active: Boolean(monitor.active) } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "저장하지 못했습니다." }, { status: 500 });
  }
}
