import { prisma } from "@/lib/prisma";
import { getOrCreateEntry } from "@/lib/logEntry";
import { parseDateFromSubject } from "@/lib/date";
import { searchMessages, getThreadMessages, type GmailMessageSummary } from "@/lib/gmail";
import { extractFieldsFromText } from "@/lib/emailExtract";
import type { ChecklistItemTemplate, Property } from "@prisma/client";

const RAW_TEXT_LABEL: Record<string, string> = {
  "victory-business": "Registro bruto dos e-mails (LOGBOOK)",
  "victory-suites": "Registro bruto do e-mail (AUDITORIA)",
  "central-reservas": "Registro bruto da resposta na thread de auditoria",
};

const LOOKBACK = "newer_than:30d";

export interface SyncResult {
  property: string;
  processed: number;
  skipped: number;
  errors: { messageId: string; subject: string; error: string }[];
}

function newResult(propertyName: string): SyncResult {
  return { property: propertyName, processed: 0, skipped: 0, errors: [] };
}

async function applyExtractedValues(
  logEntryId: string,
  templates: ChecklistItemTemplate[],
  extracted: Record<string, string | number | boolean>
) {
  for (const template of templates) {
    const raw = extracted[template.label];
    if (raw === undefined || raw === null || raw === "") continue;

    const values =
      template.type === "NUMBER"
        ? { valueNumber: typeof raw === "number" ? raw : Number(raw), valueBoolean: null, valueText: null }
        : template.type === "BOOLEAN"
          ? { valueBoolean: Boolean(raw), valueNumber: null, valueText: null }
          : { valueText: String(raw), valueNumber: null, valueBoolean: null };

    if (template.type === "NUMBER" && !Number.isFinite(values.valueNumber)) continue;

    await prisma.checklistItemResponse.upsert({
      where: { logEntryId_templateItemId: { logEntryId, templateItemId: template.id } },
      create: { logEntryId, templateItemId: template.id, ...values, status: "OK" },
      update: { ...values, status: "OK" },
    });
  }
}

async function appendRawText(logEntryId: string, templateId: string, headerLine: string, bodyText: string) {
  const existing = await prisma.checklistItemResponse.findUnique({
    where: { logEntryId_templateItemId: { logEntryId, templateItemId: templateId } },
  });
  const block = `--- ${headerLine} ---\n${bodyText.trim()}`;
  const combined = existing?.valueText ? `${existing.valueText}\n\n${block}` : block;

  await prisma.checklistItemResponse.upsert({
    where: { logEntryId_templateItemId: { logEntryId, templateItemId: templateId } },
    create: { logEntryId, templateItemId: templateId, valueText: combined, status: "OK" },
    update: { valueText: combined, status: "OK" },
  });
}

async function processMessage(
  msg: GmailMessageSummary,
  property: Property,
  aiFields: ChecklistItemTemplate[],
  rawTemplate: ChecklistItemTemplate | undefined,
  dateKeyOverride?: string | null
): Promise<{ outcome: "processed" | "skipped" | "error"; error?: string }> {
  const already = await prisma.processedEmail.findUnique({ where: { gmailMessageId: msg.id } });
  if (already) return { outcome: "skipped" };

  const dateKey = dateKeyOverride ?? parseDateFromSubject(msg.subject, msg.date ? new Date(msg.date) : new Date());
  if (!dateKey) return { outcome: "error", error: `Não foi possível identificar a data no assunto "${msg.subject}".` };

  const entry = await getOrCreateEntry(property.id, dateKey);

  const extracted = await extractFieldsFromText(
    msg.bodyText,
    aiFields.map((f) => ({ label: f.label, type: f.type }))
  );
  await applyExtractedValues(entry.id, aiFields, extracted);

  if (rawTemplate) {
    await appendRawText(entry.id, rawTemplate.id, `${msg.subject} — ${msg.from} — ${msg.date}`, msg.bodyText);
  }

  await prisma.logEntry.update({
    where: { id: entry.id },
    data: {
      sourceType: "EMAIL",
      submittedBy: msg.from,
      status: entry.status === "PENDENTE" ? "RECEBIDO" : entry.status,
    },
  });

  await prisma.processedEmail.create({
    data: {
      gmailMessageId: msg.id,
      propertyId: property.id,
      logEntryId: entry.id,
      emailSubject: msg.subject,
      emailFrom: msg.from,
      emailDate: msg.date ? new Date(msg.date) : null,
    },
  });

  return { outcome: "processed" };
}

function splitFields(templates: ChecklistItemTemplate[], propertySlug: string) {
  const rawLabel = RAW_TEXT_LABEL[propertySlug];
  const rawTemplate = templates.find((t) => t.label === rawLabel);
  const aiFields = templates.filter((t) => t.id !== rawTemplate?.id);
  return { rawTemplate, aiFields };
}

async function syncBusiness(property: Property): Promise<SyncResult> {
  const result = newResult(property.name);

  const templates = await prisma.checklistItemTemplate.findMany({
    where: { propertyId: property.id, archived: false },
  });
  const { rawTemplate, aiFields } = splitFields(templates, property.slug);

  const messages = await searchMessages(
    `from:recepcao.business@victoryhoteis.com subject:LOGBOOK ${LOOKBACK}`,
    50
  );

  for (const msg of messages) {
    const outcome = await processMessage(msg, property, aiFields, rawTemplate);
    if (outcome.outcome === "processed") result.processed++;
    else if (outcome.outcome === "skipped") result.skipped++;
    else result.errors.push({ messageId: msg.id, subject: msg.subject, error: outcome.error ?? "Erro desconhecido." });
  }

  return result;
}

async function syncSuitesAndReservas(suites: Property, reservas: Property): Promise<[SyncResult, SyncResult]> {
  const suitesResult = newResult(suites.name);
  const reservasResult = newResult(reservas.name);

  const suitesTemplates = await prisma.checklistItemTemplate.findMany({
    where: { propertyId: suites.id, archived: false },
  });
  const { rawTemplate: suitesRaw, aiFields: suitesAiFields } = splitFields(suitesTemplates, suites.slug);

  const reservasTemplates = await prisma.checklistItemTemplate.findMany({
    where: { propertyId: reservas.id, archived: false },
  });
  const { rawTemplate: reservasRaw, aiFields: reservasAiFields } = splitFields(reservasTemplates, reservas.slug);

  const rootMessages = await searchMessages(
    `from:recepcao.suites@victoryhoteis.com subject:AUDITORIA ${LOOKBACK}`,
    30
  );
  const threadIds = Array.from(new Set(rootMessages.map((m) => m.threadId).filter(Boolean)));

  for (const threadId of threadIds) {
    const threadMessages = await getThreadMessages(threadId);
    const suitesMsg = threadMessages.find((m) => m.from.toLowerCase().includes("recepcao.suites@victoryhoteis.com"));
    if (!suitesMsg) continue;

    const dateKey = parseDateFromSubject(suitesMsg.subject, suitesMsg.date ? new Date(suitesMsg.date) : new Date());

    const suitesOutcome = await processMessage(suitesMsg, suites, suitesAiFields, suitesRaw, dateKey);
    if (suitesOutcome.outcome === "processed") suitesResult.processed++;
    else if (suitesOutcome.outcome === "skipped") suitesResult.skipped++;
    else
      suitesResult.errors.push({
        messageId: suitesMsg.id,
        subject: suitesMsg.subject,
        error: suitesOutcome.error ?? "Erro desconhecido.",
      });

    const reservasMessages = threadMessages.filter((m) =>
      m.from.toLowerCase().includes("centraldereservas@victoryhoteis.com")
    );
    for (const rMsg of reservasMessages) {
      const outcome = await processMessage(rMsg, reservas, reservasAiFields, reservasRaw, dateKey);
      if (outcome.outcome === "processed") reservasResult.processed++;
      else if (outcome.outcome === "skipped") reservasResult.skipped++;
      else
        reservasResult.errors.push({
          messageId: rMsg.id,
          subject: rMsg.subject,
          error: outcome.error ?? "Erro desconhecido.",
        });
    }
  }

  return [suitesResult, reservasResult];
}

export async function runEmailSync(): Promise<SyncResult[]> {
  const properties = await prisma.property.findMany();
  const bySlug = new Map(properties.map((p) => [p.slug, p]));

  const results: SyncResult[] = [];

  const business = bySlug.get("victory-business");
  if (business) results.push(await syncBusiness(business));

  const suites = bySlug.get("victory-suites");
  const reservas = bySlug.get("central-reservas");
  if (suites && reservas) {
    const [suitesResult, reservasResult] = await syncSuitesAndReservas(suites, reservas);
    results.push(suitesResult, reservasResult);
  }

  return results;
}
