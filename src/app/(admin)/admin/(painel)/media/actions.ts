"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { saveUpload, deleteUpload } from "@/lib/uploads";
import { insertMedia, deleteMedia } from "@/lib/repo/ops";

export type UploadState = { error?: string; uploaded?: number };

export async function uploadMedia(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  await requireSession();

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
  await requireSession();
  const id = String(formData.get("id") ?? "");
  const path = await deleteMedia(id);
  if (path) await deleteUpload(path);
  revalidatePath("/admin/media");
}
