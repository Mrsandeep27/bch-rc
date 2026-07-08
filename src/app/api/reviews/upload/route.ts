/**
 * POST /api/reviews/upload  (multipart/form-data, field "file")
 *
 * Uploads a single review photo to Supabase Storage and returns its public
 * URL. The URL is then submitted with the review body (see the `images` field
 * on /api/reviews/submit). Verified-buyer gating happens at SUBMIT time — an
 * uploaded image is inert until it's attached to an accepted review, so a
 * stray upload costs nothing but a stored file.
 *
 * Guardrails: per-IP rate limit, image mime allow-list, 5 MB cap.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const BUCKET = "review-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const limited = rateLimit(req, { scope: "reviews:upload", limit: 20 });
  if (limited) return limited;

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ ok: false, reason: "Bad form data" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ ok: false, reason: "No file" }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { ok: false, reason: "Only JPG, PNG or WebP images." },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, reason: "Image must be under 5 MB." },
      { status: 413 },
    );
  }

  const supabase = createAdminClient();
  // Idempotently ensure the bucket exists (public read). Ignoring the error
  // covers the common "already exists" case without an extra round trip.
  await supabase.storage
    .createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES })
    .catch(() => {});

  const path = `${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) {
    return NextResponse.json(
      { ok: false, reason: error.message || "Upload failed" },
      { status: 502 },
    );
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
