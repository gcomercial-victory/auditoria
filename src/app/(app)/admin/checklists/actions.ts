"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { FieldType } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Apenas administradores podem editar checklists.");
  return session;
}

export async function addChecklistItem(
  propertyId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  try {
    await requireAdmin();
    const label = String(formData.get("label") ?? "").trim();
    const type = String(formData.get("type") ?? "BOOLEAN") as FieldType;
    if (!label) return "Informe um nome para o item.";

    const count = await prisma.checklistItemTemplate.count({ where: { propertyId } });
    await prisma.checklistItemTemplate.create({
      data: { propertyId, label, type, order: count },
    });
    revalidatePath("/admin/checklists");
    return "ok";
  } catch (err) {
    return err instanceof Error ? err.message : "Erro ao adicionar item.";
  }
}

export async function toggleArchiveItem(itemId: string, archived: boolean) {
  await requireAdmin();
  await prisma.checklistItemTemplate.update({ where: { id: itemId }, data: { archived } });
  revalidatePath("/admin/checklists");
}
