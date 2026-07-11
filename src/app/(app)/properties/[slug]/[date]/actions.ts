"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateEntry } from "@/lib/logEntry";
import { toCsvExportUrl, parseCsv, findRowForDate, matchColumnForLabel } from "@/lib/sheetImport";
import { IMMUTABLE_VALUE_LABELS } from "@/lib/checklistLabels";
import type { FieldType, ItemStatus } from "@prisma/client";

const IMMUTABLE_LABELS = new Set(IMMUTABLE_VALUE_LABELS);

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");
  return session;
}

function parseResponseValue(type: FieldType, raw: FormDataEntryValue | null) {
  if (raw === null) return { valueBoolean: null, valueNumber: null, valueText: null };
  const value = String(raw);
  if (type === "BOOLEAN") return { valueBoolean: value === "true", valueNumber: null, valueText: null };
  if (type === "NUMBER") {
    const n = value.trim() === "" ? null : Number(value.replace(",", "."));
    return { valueBoolean: null, valueNumber: Number.isFinite(n) ? n : null, valueText: null };
  }
  return { valueBoolean: null, valueNumber: null, valueText: value };
}

export async function saveEntry(propertyId: string, dateKey: string, formData: FormData) {
  await requireSession();

  const entry = await getOrCreateEntry(propertyId, dateKey);
  const templates = await prisma.checklistItemTemplate.findMany({
    where: { propertyId, archived: false },
  });

  const submittedBy = formData.get("submittedBy");
  const notes = formData.get("notes");

  await prisma.$transaction([
    prisma.logEntry.update({
      where: { id: entry.id },
      data: {
        submittedBy: submittedBy ? String(submittedBy) : null,
        notes: notes ? String(notes) : null,
        status: entry.status === "PENDENTE" ? "RECEBIDO" : entry.status,
      },
    }),
    ...templates.map((item) => {
      const statusRaw = formData.get(`status_${item.id}`);
      const noteRaw = formData.get(`note_${item.id}`);
      // Immutable fields (who was on shift, cash counted) keep whatever value
      // the e-mail ingestion recorded — the auditor can only conference them.
      const values = IMMUTABLE_LABELS.has(item.label)
        ? {}
        : parseResponseValue(item.type, formData.get(`item_${item.id}`));

      return prisma.checklistItemResponse.upsert({
        where: { logEntryId_templateItemId: { logEntryId: entry.id, templateItemId: item.id } },
        create: {
          logEntryId: entry.id,
          templateItemId: item.id,
          ...values,
          status: (statusRaw ? String(statusRaw) : "OK") as ItemStatus,
          note: noteRaw ? String(noteRaw) : null,
        },
        update: {
          ...values,
          status: (statusRaw ? String(statusRaw) : "OK") as ItemStatus,
          note: noteRaw ? String(noteRaw) : null,
        },
      });
    }),
  ]);

  revalidatePath(`/properties`);
  revalidatePath(`/`);
}

export async function saveEntryAction(
  propertyId: string,
  dateKey: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  try {
    await saveEntry(propertyId, dateKey, formData);
    return "ok";
  } catch (err) {
    return err instanceof Error ? err.message : "Erro ao salvar.";
  }
}

export async function reviewEntry(
  entryId: string,
  decision: "VERIFICADO" | "DIVERGENCIA" | "PENDENTE",
  reviewNotes: string
) {
  const session = await requireSession();

  await prisma.logEntry.update({
    where: { id: entryId },
    data: {
      status: decision,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || null,
    },
  });

  revalidatePath(`/`);
  revalidatePath(`/history`);
}

export async function importFromSheetAction(
  propertyId: string,
  dateKey: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const sheetUrl = String(formData.get("sheetUrl") ?? "");
  try {
    await importFromSheet(propertyId, dateKey, sheetUrl);
    return "ok";
  } catch (err) {
    return err instanceof Error ? err.message : "Erro ao importar planilha.";
  }
}

export async function uploadEntryFileAction(
  propertyId: string,
  dateKey: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  try {
    await uploadEntryFile(propertyId, dateKey, formData);
    return "ok";
  } catch (err) {
    return err instanceof Error ? err.message : "Erro ao enviar arquivo.";
  }
}

export async function reviewEntryAction(
  entryId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const decision = String(formData.get("decision") ?? "");
  const reviewNotes = String(formData.get("reviewNotes") ?? "");
  if (decision !== "VERIFICADO" && decision !== "DIVERGENCIA" && decision !== "PENDENTE") {
    return "Decisão inválida.";
  }
  try {
    await reviewEntry(entryId, decision, reviewNotes);
    return "ok";
  } catch (err) {
    return err instanceof Error ? err.message : "Erro ao registrar revisão.";
  }
}

export async function importFromSheet(propertyId: string, dateKey: string, sheetUrl: string) {
  await requireSession();

  const csvUrl = toCsvExportUrl(sheetUrl);
  const res = await fetch(csvUrl);
  if (!res.ok) {
    throw new Error(
      "Não foi possível ler a planilha. Confirme que ela está publicada/compartilhada como 'qualquer pessoa com o link pode visualizar'."
    );
  }
  const csvText = await res.text();
  const rows = parseCsv(csvText);
  const match = findRowForDate(rows, dateKey);
  if (!match) {
    throw new Error(
      `Nenhuma linha encontrada para ${dateKey} na planilha. Verifique se existe uma coluna "Data" com o dia correspondente.`
    );
  }

  const templates = await prisma.checklistItemTemplate.findMany({
    where: { propertyId, archived: false },
  });

  const entry = await getOrCreateEntry(propertyId, dateKey);

  const updates = templates.map((item) => {
    const colIndex = matchColumnForLabel(match.header, item.label);
    const raw = colIndex === -1 ? null : match.row[colIndex];
    const values = parseResponseValue(item.type, raw ?? null);
    return prisma.checklistItemResponse.upsert({
      where: { logEntryId_templateItemId: { logEntryId: entry.id, templateItemId: item.id } },
      create: { logEntryId: entry.id, templateItemId: item.id, ...values, status: "OK" },
      update: { ...values, status: "OK" },
    });
  });

  await prisma.$transaction([
    prisma.logEntry.update({
      where: { id: entry.id },
      data: { status: entry.status === "PENDENTE" ? "RECEBIDO" : entry.status, sourceType: "SHEET_IMPORT" },
    }),
    ...updates,
  ]);

  revalidatePath(`/`);
}

export async function uploadEntryFile(propertyId: string, dateKey: string, formData: FormData) {
  await requireSession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Nenhum arquivo selecionado.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Arquivo maior que 15MB.");

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name).slice(0, 10);
  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);

  const entry = await getOrCreateEntry(propertyId, dateKey);
  await prisma.logEntry.update({
    where: { id: entry.id },
    data: {
      fileUrl: `/api/files/${storedName}`,
      fileName: file.name,
      sourceType: entry.sourceType === "SHEET_IMPORT" ? entry.sourceType : "UPLOAD",
      status: entry.status === "PENDENTE" ? "RECEBIDO" : entry.status,
    },
  });

  revalidatePath(`/`);
}
