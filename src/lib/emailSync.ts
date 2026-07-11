import { prisma } from "@/lib/prisma";
import { getOrCreateEntry } from "@/lib/logEntry";
import { parseDateFromSubject } from "@/lib/date";
import { listMessageIds, getMessage, getThreadMessages, type GmailMessageSummary } from "@/lib/gmail";
import { extractFieldsFromText } from "@/lib/emailExtract";
import type { ChecklistItemTemplate, Property } from "@prisma/client";

const BUSINESS_RAW_LABEL = "Registro bruto dos e-mails (LOGBOOK)";
const SUITES_RAW_LABEL = "Registro bruto do e-mail (AUDITORIA)";
// Central de Reservas audits both hotels rather than filing its own logbook,
// so its replies get folded into whichever property's entry the thread
// belongs to, under this label.
const RESERVAS_RAW_LABEL = "Registro bruto da resposta na thread de auditoria";

const LOOKBACK = "newer_than:15d";

// Vercel Hobby caps a function at ~60s. Each new message costs a Gmail
// fetch + a Claude call, so cap how many we process per invocation — the
// rest catch up on the next cron run or manual click.
const MAX_NEW_PER_RUN = 12;

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
): Promise<{ outcome: "processed" | "error"; error?: string }> {
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

// A property's template can hold more than one "raw text" field (e.g. Suites
// has its own AUDITORIA raw log plus the Reservas thread-reply raw log), so
// callers look up the specific one they need by label.
function splitFields(templates: ChecklistItemTemplate[], rawLabels: string[]) {
  const rawByLabel = new Map(templates.filter((t) => rawLabels.includes(t.label)).map((t) => [t.label, t]));
  const aiFields = templates.filter((t) => !rawByLabel.has(t.label));
  return { rawByLabel, aiFields };
}

// Returns the subset of ids/threadIds not already present in ProcessedEmail.
async function filterUnprocessed<T extends { id: string }>(refs: T[]): Promise<T[]> {
  if (refs.length === 0) return [];
  const already = await prisma.processedEmail.findMany({
    where: { gmailMessageId: { in: refs.map((r) => r.id) } },
    select: { gmailMessageId: true },
  });
  const processedIds = new Set(already.map((a) => a.gmailMessageId));
  return refs.filter((r) => !processedIds.has(r.id));
}

// Shared across properties within a single run so the invocation stays
// under the platform's function-duration limit.
class Budget {
  remaining = MAX_NEW_PER_RUN;
  take(): boolean {
    if (this.remaining <= 0) return false;
    this.remaining--;
    return true;
  }
}

async function syncBusiness(property: Property, budget: Budget): Promise<SyncResult> {
  const result = newResult(property.name);

  const templates = await prisma.checklistItemTemplate.findMany({
    where: { propertyId: property.id, archived: false },
  });
  const { rawByLabel, aiFields } = splitFields(templates, [BUSINESS_RAW_LABEL]);
  const rawTemplate = rawByLabel.get(BUSINESS_RAW_LABEL);

  const refs = await listMessageIds(`from:recepcao.business@victoryhoteis.com subject:LOGBOOK ${LOOKBACK}`, 60);
  const unprocessed = await filterUnprocessed(refs);
  result.skipped = refs.length - unprocessed.length;

  for (const ref of unprocessed) {
    if (!budget.take()) break;
    const msg = await getMessage(ref.id);
    const outcome = await processMessage(msg, property, aiFields, rawTemplate);
    if (outcome.outcome === "processed") result.processed++;
    else result.errors.push({ messageId: msg.id, subject: msg.subject, error: outcome.error ?? "Erro desconhecido." });
  }

  return result;
}

// Central de Reservas replies inside the same thread as the Suites AUDITORIA
// e-mail, so both messages land on the Suites property's daily entry — just
// under different "raw text" fields.
async function syncSuites(suites: Property, budget: Budget): Promise<SyncResult> {
  const result = newResult(suites.name);

  const templates = await prisma.checklistItemTemplate.findMany({
    where: { propertyId: suites.id, archived: false },
  });
  const { rawByLabel, aiFields } = splitFields(templates, [SUITES_RAW_LABEL, RESERVAS_RAW_LABEL]);
  const suitesRaw = rawByLabel.get(SUITES_RAW_LABEL);
  const reservasRaw = rawByLabel.get(RESERVAS_RAW_LABEL);

  // Only the Suites root message determines whether we've already handled
  // a given day's thread — cheap to check before fetching the full thread.
  const rootRefs = await listMessageIds(
    `from:recepcao@victorysuites.com.br subject:AUDITORIA ${LOOKBACK}`,
    30
  );
  const unprocessedRoots = await filterUnprocessed(rootRefs);
  result.skipped = rootRefs.length - unprocessedRoots.length;

  const threadIds = Array.from(new Set(unprocessedRoots.map((r) => r.threadId)));

  for (const threadId of threadIds) {
    if (budget.remaining <= 0) break;

    const threadMessages = await getThreadMessages(threadId);
    const suitesMsg = threadMessages.find((m) => m.from.toLowerCase().includes("recepcao@victorysuites.com.br"));
    if (!suitesMsg) continue;

    const dateKey = parseDateFromSubject(suitesMsg.subject, suitesMsg.date ? new Date(suitesMsg.date) : new Date());

    if (budget.take()) {
      const suitesOutcome = await processMessage(suitesMsg, suites, aiFields, suitesRaw, dateKey);
      if (suitesOutcome.outcome === "processed") result.processed++;
      else
        result.errors.push({
          messageId: suitesMsg.id,
          subject: suitesMsg.subject,
          error: suitesOutcome.error ?? "Erro desconhecido.",
        });
    }

    const reservasMessages = await filterUnprocessed(
      threadMessages.filter((m) => m.from.toLowerCase().includes("centraldereservas@victoryhoteis.com"))
    );
    for (const rMsg of reservasMessages) {
      if (!budget.take()) break;
      const outcome = await processMessage(rMsg, suites, aiFields, reservasRaw, dateKey);
      if (outcome.outcome === "processed") result.processed++;
      else
        result.errors.push({
          messageId: rMsg.id,
          subject: rMsg.subject,
          error: outcome.error ?? "Erro desconhecido.",
        });
    }
  }

  return result;
}

export async function runEmailSync(): Promise<SyncResult[]> {
  const properties = await prisma.property.findMany();
  const bySlug = new Map(properties.map((p) => [p.slug, p]));

  const results: SyncResult[] = [];
  const budget = new Budget();

  const business = bySlug.get("victory-business");
  if (business) results.push(await syncBusiness(business, budget));

  const suites = bySlug.get("victory-suites");
  if (suites) results.push(await syncSuites(suites, budget));

  return results;
}
