import { prisma } from "@/lib/prisma";
import { dateKeyToDate } from "@/lib/date";

export async function getOrCreateEntry(propertyId: string, dateKey: string) {
  const date = dateKeyToDate(dateKey);
  const existing = await prisma.logEntry.findUnique({
    where: { propertyId_date: { propertyId, date } },
  });
  if (existing) return existing;
  return prisma.logEntry.create({
    data: { propertyId, date, status: "PENDENTE" },
  });
}
