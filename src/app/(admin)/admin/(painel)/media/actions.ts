"use server";

import { revalidatePath } from "next/cache";
import { requireAnyPermission, requirePermission } from "@/lib/auth/session";
import { auditForm } from "@/lib/repo/audit";
import { saveUpload, deleteUpload } from "@/lib/uploads";
import { insertMedia, deleteMedia } from "@/lib/repo/ops";

export type UploadState = { error?: string; uploaded?: number };

export async function uploadMedia(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const actor = await requirePermission("content.manage");
  void auditForm(actor, "uploadMedia", formData);

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) return { error: "Escolha pelo menos um ficheiro." };

  let uploaded = 0;
  for (const file of files) {
    try {
      const saved = await saveUpload(file);
      await insertMedia(saved);
      uploaded++;
    } catch (err) {
      return {
        uploaded,
        error: `${file.name}: ${(err as Error).message}`,
      };
    }
  }

  revalidatePath("/admin/media");
  return { uploaded };
}

export async function removeMedia(formData: FormData) {
  const actor = await requirePermission("content.manage");
  void auditForm(actor, "removeMedia", formData);
  const id = String(formData.get("id") ?? "");
  const path = await deleteMedia(id);
  if (path) await deleteUpload(path);
  revalidatePath("/admin/media");
}
