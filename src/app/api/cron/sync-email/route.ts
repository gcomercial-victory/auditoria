import { NextRequest, NextResponse } from "next/server";
import { runEmailSync } from "@/lib/emailSync";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse("Não autorizado", { status: 401 });
    }
  }

  try {
    const results = await runEmailSync();
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("sync-email failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido." },
      { status: 500 }
    );
  }
}
