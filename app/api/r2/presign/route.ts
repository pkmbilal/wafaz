import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/guards";
import { isR2Configured, PRESIGN_EXPIRES_SECONDS, presignUpload } from "@/lib/r2-upload";
import { buildUploadKey } from "@/lib/uploads";
import { presignRequestSchema } from "@/lib/validators/admin-catalog";

// Presigned PUT URL for one admin image upload (AGENTS.md §5.8): admins only, 5-minute expiry,
// key generated here, jpeg/png/webp/avif up to 10 MB. The Server Action that saves the key checks
// the uploaded object again.
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!isR2Configured()) {
    return NextResponse.json({ error: "Image uploads aren't set up yet (R2 is not configured)." }, { status: 503 });
  }

  const parsed = presignRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const { target, contentType, size } = parsed.data;
  const productId = parsed.data.target === "product" ? parsed.data.productId : undefined;

  const key = buildUploadKey(target, contentType, randomUUID(), productId);
  try {
    const url = await presignUpload(key, contentType, size);
    return NextResponse.json(
      { url, key, expiresIn: PRESIGN_EXPIRES_SECONDS },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("[r2] presign failed");
    return NextResponse.json({ error: "Couldn't start the upload. Please try again." }, { status: 502 });
  }
}
