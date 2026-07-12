import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Temporary maintenance endpoint: clears the "already processed" marker for
// one specific Gmail message so the next sync re-ingests it under the
// current extraction logic (e.g. after fixing a bug in how a field was
// derived). Removed once the one-off backfill it was added for is done.
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse("Não autorizado", { status: 401 });
    }
  }

  const { gmailMessageId } = await req.json();
  if (!gmailMessageId || typeof gmailMessageId !== "string") {
    return NextResponse.json({ ok: false, error: "gmailMessageId obrigatório." }, { status: 400 });
  }

  const deleted = await prisma.processedEmail.deleteMany({ where: { gmailMessageId } });
  return NextResponse.json({ ok: true, deletedCount: deleted.count });
}
