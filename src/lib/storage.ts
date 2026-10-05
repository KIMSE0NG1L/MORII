import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export const DIARY_BUCKET = "diary-drawings";
export const MATERIALS_BUCKET = "program-materials";

// Both buckets are private, so every image shown in the UI goes through a
// short-lived signed URL created for the current user.
export async function signedUrls(
  supabase: SupabaseClient<Database>,
  bucket: string,
  paths: (string | null | undefined)[],
) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const byPath = new Map<string, string>();
  if (unique.length === 0) return byPath;

  const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, 3600);
  data?.forEach((s) => {
    if (s.signedUrl && s.path) byPath.set(s.path, s.signedUrl);
  });
  return byPath;
}

export function isImageFile(pathOrMime: string) {
  return /^image\//.test(pathOrMime) || /\.(png|jpe?g|gif|webp)$/i.test(pathOrMime);
}

// Photos straight off a phone camera can be 10MB+; scale the long edge down
// to `maxSize` and re-encode as JPEG before uploading.
export async function prepareImageUpload(file: File, maxSize = 2000): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 처리할 수 없어요.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.88),
  );
  if (!blob) throw new Error("이미지를 처리할 수 없어요.");
  return blob;
}
