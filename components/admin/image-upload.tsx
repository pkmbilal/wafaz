"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Thumb } from "@/components/admin/thumb";
import { isUploadContentType, MAX_UPLOAD_BYTES, UPLOAD_ACCEPT, type UploadTarget } from "@/lib/uploads";

// Browser side of an admin image upload: ask /api/r2/presign for a URL and key, then PUT the file
// straight to R2. The Server Action that saves the key checks the object again.

export async function uploadImage(
  file: File,
  target: UploadTarget,
  productId?: string,
): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  if (!isUploadContentType(file.type)) return { ok: false, error: `${file.name}: use a JPEG, PNG, WebP or AVIF image.` };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: `${file.name} is larger than 10 MB.` };

  const res = await fetch("/api/r2/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, productId, contentType: file.type, size: file.size }),
  }).catch(() => null);
  const body: unknown = await res?.json().catch(() => null);
  if (!res?.ok || !body || typeof body !== "object" || !("url" in body) || !("key" in body)) {
    const error = body && typeof body === "object" && "error" in body ? String(body.error) : "Couldn't start the upload.";
    return { ok: false, error };
  }

  const put = await fetch(String(body.url), {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  }).catch(() => null);
  if (!put?.ok) return { ok: false, error: `Uploading ${file.name} failed. Please try again.` };
  return { ok: true, key: String(body.key) };
}

// Single image field (category, collection and banner forms). The form submits the key.
export function ImageUploadField({
  label,
  target,
  value,
  onChange,
  required = false,
}: {
  label: string;
  target: Exclude<UploadTarget, "product">;
  value: string | null;
  onChange: (key: string | null) => void;
  required?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const result = await uploadImage(file, target);
    setBusy(false);
    if (input.current) input.current.value = "";
    if (result.ok) onChange(result.key);
    else setError(result.error);
  }

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm leading-none font-medium">
        {label}
        {!required && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </span>
      <div className="flex items-center gap-3">
        <Thumb imageKey={value} className="w-16" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept={UPLOAD_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-labelledby={`${id}-label`}
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" /> : <ImagePlus aria-hidden />}
            {busy ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </Button>
          {value && !required && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(null)}>
              <X aria-hidden />
              Remove
            </Button>
          )}
        </div>
      </div>
      <p aria-live="polite" className="text-sm text-destructive empty:hidden">
        {error}
      </p>
    </div>
  );
}
