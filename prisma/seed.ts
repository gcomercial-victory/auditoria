import { PrismaClient, FieldType, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Central de Reservas audits both hotels rather than submitting its own
// logbook, so its fields live on both properties' checklists instead of a
// separate "unit" with its own Pendente/Recebido card.
const RESERVAS_ITEMS: { label: string; type: FieldType }[] = [
  { label: "Instruções/atualizações da Central de Reservas", type: FieldType.TEXT },
  { label: "Registro bruto da resposta na thread de auditoria", type: FieldType.TEXT },
];

// Fields mirror what actually shows up in the daily e-mails from reception,
// so the AI email extractor can map straight onto these labels.
const BUSINESS_ITEMS: { label: string; type: FieldType }[] = [
  { label: "Turno / Funcionários", type: FieldType.TEXT },
  { label: "Caixa", type: FieldType.TEXT },
  { label: "Check-in", type: FieldType.NUMBER },
  { label: "Check-out", type: FieldType.NUMBER },
  { label: "Early check-in", type: FieldType.NUMBER },
  { label: "Late check-out", type: FieldType.NUMBER },
  { label: "Prorrogação", type: FieldType.NUMBER },
  { label: "Saída antecipada", type: FieldType.NUMBER },
  { label: "Pendências do dia", type: FieldType.TEXT },
  { label: "Observações da recepção", type: FieldType.TEXT },
  { label: "Registro bruto dos e-mails (LOGBOOK)", type: FieldType.TEXT },
  // "RELATÓRIOS DE AUDITORIA" / "RESUMO DE AUDITORIA" — a second, separate
  // daily e-mail pair from the Business reception, distinct from the LOGBOOK.
  { label: "Auditor", type: FieldType.TEXT },
  { label: "Fundo de Caixa (Auditoria)", type: FieldType.TEXT },
  { label: "Ocupação antes da Auditoria", type: FieldType.TEXT },
  { label: "RDS", type: FieldType.TEXT },
  { label: "Caixa – Estornos e Descontos", type: FieldType.TEXT },
  { label: "Saldos Elevados", type: FieldType.TEXT },
  { label: "Contas Pendentes", type: FieldType.TEXT },
  { label: "Registro bruto da auditoria (Business)", type: FieldType.TEXT },
  ...RESERVAS_ITEMS,
];

const SUITES_ITEMS: { label: string; type: FieldType }[] = [
  { label: "Auditor", type: FieldType.TEXT },
  { label: "No show garantido", type: FieldType.TEXT },
  { label: "No show não garantido", type: FieldType.TEXT },
  { label: "Documento vencido", type: FieldType.TEXT },
  { label: "Outras pendências da auditoria", type: FieldType.TEXT },
  { label: "Registro bruto do e-mail (AUDITORIA)", type: FieldType.TEXT },
  ...RESERVAS_ITEMS,
];

const PROPERTIES: { slug: string; name: string; items: { label: string; type: FieldType }[] }[] = [
  { slug: "victory-business", name: "Victory Business", items: BUSINESS_ITEMS },
  { slug: "victory-suites", name: "Victory Suites", items: SUITES_ITEMS },
];

// Central de Reservas used to be modeled as its own property/dashboard card.
// It never received its own logbook, so we retire that row (and archive its
// checklist items rather than delete them, to keep any historical responses
// readable) instead of leaving a stray "Pendente" card on the panel.
async function retireStaleReservasProperty() {
  const stale = await prisma.property.findUnique({ where: { slug: "central-reservas" } });
  if (!stale) return;

  await prisma.checklistItemTemplate.updateMany({
    where: { propertyId: stale.id, archived: false },
    data: { archived: true },
  });

  const [logEntryCount, processedEmailCount] = await Promise.all([
    prisma.logEntry.count({ where: { propertyId: stale.id } }),
    prisma.processedEmail.count({ where: { propertyId: stale.id } }),
  ]);

  if (logEntryCount === 0 && processedEmailCount === 0) {
    await prisma.property.delete({ where: { id: stale.id } });
  } else {
    console.log(
      `Central de Reservas (${stale.id}) mantida no banco por ter histórico (${logEntryCount} registros, ${processedEmailCount} e-mails) — apenas removida do painel.`
    );
  }
}

async function main() {
  await retireStaleReservasProperty();

  for (const p of PROPERTIES) {
    const property = await prisma.property.upsert({
      where: { slug: p.slug },
      update: { name: p.name },
      create: { slug: p.slug, name: p.name },
    });

    const targetLabels = new Set(p.items.map((i) => i.label));

    for (const [index, item] of p.items.entries()) {
      const existing = await prisma.checklistItemTemplate.findFirst({
        where: { propertyId: property.id, label: item.label },
      });
      if (existing) {
        if (existing.archived || existing.order !== index) {
          await prisma.checklistItemTemplate.update({
            where: { id: existing.id },
            data: { archived: false, order: index },
          });
        }
      } else {
        await prisma.checklistItemTemplate.create({
          data: {
            propertyId: property.id,
            label: item.label,
            type: item.type,
            order: index,
          },
        });
      }
    }

    // Archive old items that are no longer part of the current template
    // (keeps historical responses intact, just hides them from new entries).
    const existingItems = await prisma.checklistItemTemplate.findMany({
      where: { propertyId: property.id, archived: false },
    });
    for (const item of existingItems) {
      if (!targetLabels.has(item.label)) {
        await prisma.checklistItemTemplate.update({
          where: { id: item.id },
          data: { archived: true },
        });
      }
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminName = process.env.ADMIN_NAME ?? "Admin";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "changeme123";

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: adminName,
      passwordHash,
      role: Role.ADMIN,
    },
  });

  console.log("Seed concluído.");
  console.log(`Admin: ${adminEmail} / senha definida em ADMIN_PASSWORD (.env)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
