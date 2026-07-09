import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import { auth } from "@/auth";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".csv": "text/csv",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Não autenticado", { status: 401 });

  const { filename } = await params;
  // reject any path traversal / separators — files are stored as flat randomUUID names
  if (!/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9]{1,10})?$/.test(filename)) {
    return new NextResponse("Nome de arquivo inválido", { status: 400 });
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new NextResponse("Arquivo não encontrado", { status: 404 });
  }
}
