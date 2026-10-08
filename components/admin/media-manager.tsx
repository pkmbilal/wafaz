"use client";

import { useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { uploadImage } from "@/components/admin/image-upload";
import { Thumb } from "@/components/admin/thumb";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addMedia, deleteMedia, reorderMedia, updateMedia } from "@/app/admin/(protected)/products/actions";
import type { AdminMedia } from "@/lib/catalog/admin-queries";
import { UPLOAD_ACCEPT } from "@/lib/uploads";

// Product images: upload (several at once), tag each with a colour so the storefront gallery
// switches with the selected colour, set alt text, reorder and remove. The first image is the
// product card photo.

const ALL_COLOURS = "__all";

export function MediaManager({
  productId,
  media,
  colours,
}: {
  productId: string;
  media: AdminMedia[];
  colours: string[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const { pending, run } = useAction();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].slice(0, 20);
    setUploading({ done: 0, total: list.length });
    let added = 0;
    for (const file of list) {
      const result = await uploadImage(file, "product", productId);
      if (result.ok) {
        const saved = await addMedia({ productId, key: result.key, colour: "", alt: "" });
        if (saved.ok) added++;
        else toast.error(saved.error);
      } else {
        toast.error(result.error);
      }
      setUploading((u) => (u ? { ...u, done: u.done + 1 } : u));
    }
    setUploading(null);
    if (input.current) input.current.value = "";
    if (added) toast.success(`${added} ${added === 1 ? "image" : "images"} added`);
  }

  function move(index: number, by: -1 | 1) {
    const ids = media.map((m) => m.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved);
    run(() => reorderMedia({ productId, mediaIds: ids }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose product images"
          onChange={(e) => upload(e.target.files)}
        />
        <Button type="button" variant="outline" disabled={uploading !== null} onClick={() => input.current?.click()}>
          {uploading ? <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" /> : <ImagePlus aria-hidden />}
          {uploading ? `Uploading ${uploading.done + 1} of ${uploading.total}…` : "Upload images"}
        </Button>
        <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or AVIF, up to 10 MB each. Portrait 3:4 works best.</p>
      </div>

      {media.length === 0 ? (
        <p className="text-sm text-muted-foreground">No images yet. Products without images look broken in the store.</p>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy={pending}>
          {media.map((m, i) => (
            <MediaCard
              key={`${m.id}:${m.colour}:${m.alt}`}
              productId={productId}
              media={m}
              position={i + 1}
              colours={colours}
              disabled={pending}
              onUp={i > 0 ? () => move(i, -1) : undefined}
              onDown={i < media.length - 1 ? () => move(i, 1) : undefined}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function MediaCard({
  productId,
  media,
  position,
  colours,
  disabled,
  onUp,
  onDown,
}: {
  productId: string;
  media: AdminMedia;
  position: number;
  colours: string[];
  disabled: boolean;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const id = useId();
  const [colour, setColour] = useState(media.colour ?? "");
  const [alt, setAlt] = useState(media.alt ?? "");
  const { pending, run } = useAction();
  const dirty = colour !== (media.colour ?? "") || alt !== (media.alt ?? "");
  // A colour that no variant uses any more still shows, so it can be changed.
  const options = media.colour && !colours.includes(media.colour) ? [...colours, media.colour] : colours;

  return (
    <li className="flex gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-col items-center gap-1">
        <Thumb imageKey={media.key} alt={alt} className="w-20" />
        <span className="text-xs text-muted-foreground">{position === 1 ? "Main" : `#${position}`}</span>
      </div>
      <form
        className="flex min-w-0 flex-1 flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => updateMedia({ productId, mediaId: media.id, colour, alt }));
        }}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-colour`} className="text-xs">Colour</Label>
          <Select value={colour || ALL_COLOURS} onValueChange={(v) => setColour(v === ALL_COLOURS ? "" : v)}>
            <SelectTrigger id={`${id}-colour`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_COLOURS}>All colours</SelectItem>
              {options.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-alt`} className="text-xs">Alt text</Label>
          <Input id={`${id}-alt`} maxLength={200} placeholder="Describe the photo" value={alt} onChange={(e) => setAlt(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {dirty && (
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" aria-label={`Move image ${position} earlier`} disabled={disabled || !onUp} onClick={onUp}>
            <ArrowUp aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label={`Move image ${position} later`} disabled={disabled || !onDown} onClick={onDown}>
            <ArrowDown aria-hidden />
          </Button>
          <ConfirmDialog
            trigger={<Trash2 aria-hidden />}
            triggerLabel={`Remove image ${position}`}
            variant="ghost"
            size="icon"
            title="Remove this image?"
            description="It disappears from the product page straight away."
            confirm="Remove image"
            confirmVariant="destructive"
            onConfirm={() => deleteMedia({ productId, mediaId: media.id })}
          />
        </div>
      </form>
    </li>
  );
}
