import { PrismaClient, FieldType, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const HOTEL_ITEMS: { label: string; type: FieldType }[] = [
  { label: "Ocorrências do turno registradas no livro", type: FieldType.BOOLEAN },
  { label: "Check-ins do dia conferidos", type: FieldType.BOOLEAN },
  { label: "Check-outs do dia conferidos", type: FieldType.BOOLEAN },
  { label: "Caixa inicial (R$)", type: FieldType.NUMBER },
  { label: "Caixa final (R$)", type: FieldType.NUMBER },
  { label: "Total de diárias vendidas", type: FieldType.NUMBER },
  { label: "Número de hóspedes hospedados", type: FieldType.NUMBER },
  { label: "Observações da recepção", type: FieldType.TEXT },
];

const RESERVAS_ITEMS: { label: string; type: FieldType }[] = [
  { label: "Reservas confirmadas no dia", type: FieldType.NUMBER },
  { label: "Reservas canceladas no dia", type: FieldType.NUMBER },
  { label: "Atendimentos/ligações registrados no livro", type: FieldType.BOOLEAN },
  { label: "Pendências repassadas às unidades", type: FieldType.BOOLEAN },
  { label: "Observações", type: FieldType.TEXT },
];

const PROPERTIES: { slug: string; name: string; items: { label: string; type: FieldType }[] }[] = [
  { slug: "victory-business", name: "Victory Business", items: HOTEL_ITEMS },
  { slug: "victory-suites", name: "Victory Suites", items: HOTEL_ITEMS },
  { slug: "central-reservas", name: "Central de Reservas", items: RESERVAS_ITEMS },
];

async function main() {
  for (const p of PROPERTIES) {
    const property = await prisma.property.upsert({
      where: { slug: p.slug },
      update: { name: p.name },
      create: { slug: p.slug, name: p.name },
    });

    for (const [index, item] of p.items.entries()) {
      const existing = await prisma.checklistItemTemplate.findFirst({
        where: { propertyId: property.id, label: item.label },
      });
      if (!existing) {
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
