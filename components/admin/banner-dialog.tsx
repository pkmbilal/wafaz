"use client";

import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/admin/form-dialog";
import { FormField, fieldProps } from "@/components/admin/form-field";
import { ImageUploadField } from "@/components/admin/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveBanner } from "@/app/admin/(protected)/catalog/actions";
import { isoToIstLocal } from "@/lib/catalog/admin-input";
import type { AdminBanner } from "@/lib/catalog/admin-queries";
import { type BannerInput, bannerSchema } from "@/lib/validators/admin-catalog";

export function BannerDialog({ banner }: { banner?: AdminBanner }) {
  return (
    <FormDialog
      trigger={banner ? <Pencil aria-hidden /> : <><Plus aria-hidden /> New banner</>}
      triggerLabel={banner ? `Edit ${banner.title}` : undefined}
      variant={banner ? "ghost" : "default"}
      size={banner ? "icon" : "default"}
      title={banner ? `Edit ${banner.title}` : "New banner"}
      description="Hero banners rotate at the top of the home page."
    >
      {(close) => <BannerForm banner={banner} onSaved={close} />}
    </FormDialog>
  );
}

function BannerForm({ banner, onSaved }: { banner?: AdminBanner; onSaved: () => void }) {
  const id = useId();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BannerInput>({
    // raw: the action re-parses the typed values itself.
    resolver: zodResolver(bannerSchema, undefined, { raw: true }),
    defaultValues: {
      id: banner?.id,
      title: banner?.title ?? "",
      imageKey: banner?.imageKey ?? "",
      link: banner?.link ?? "",
      sortOrder: String(banner?.sortOrder ?? 0),
      startsAt: isoToIstLocal(banner?.startsAt ?? null),
      endsAt: isoToIstLocal(banner?.endsAt ?? null),
      isActive: banner?.isActive ?? true,
    },
  });

  const submit = handleSubmit(async (values) => {
    const result = await saveBanner(values);
    if (!result.ok) return setError("root", { message: result.error });
    toast.success(result.message ?? "Saved");
    onSaved();
  });

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <FormField id={`${id}-title`} label="Title" error={errors.title?.message} hint="Also used as the image's alt text.">
        <Input maxLength={120} {...fieldProps(`${id}-title`, errors.title?.message, "hint")} {...register("title")} />
      </FormField>
      <div className="flex flex-col gap-1">
        <Controller
          control={control}
          name="imageKey"
          render={({ field }) => (
            <ImageUploadField
              label="Image (wide, about 16:7)"
              target="banner"
              required
              value={field.value || null}
              onChange={(k) => field.onChange(k ?? "")}
            />
          )}
        />
        {errors.imageKey?.message && <p className="text-sm text-destructive">{errors.imageKey.message}</p>}
      </div>
      <FormField id={`${id}-link`} label="Link (optional)" error={errors.link?.message} hint="A store path, e.g. /collections/new-arrivals">
        <Input maxLength={200} placeholder="/collections/new-arrivals" {...fieldProps(`${id}-link`, errors.link?.message, "hint")} {...register("link")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${id}-starts`} label="Starts (optional)" error={errors.startsAt?.message} hint="Kerala time">
          <Input type="datetime-local" {...fieldProps(`${id}-starts`, errors.startsAt?.message, "hint")} {...register("startsAt")} />
        </FormField>
        <FormField id={`${id}-ends`} label="Ends (optional)" error={errors.endsAt?.message} hint="Kerala time">
          <Input type="datetime-local" {...fieldProps(`${id}-ends`, errors.endsAt?.message, "hint")} {...register("endsAt")} />
        </FormField>
      </div>
      <FormField id={`${id}-sort`} label="Sort order" error={errors.sortOrder?.message} hint="Lower numbers show first.">
        <Input inputMode="numeric" className="w-28" {...fieldProps(`${id}-sort`, errors.sortOrder?.message, "hint")} {...register("sortOrder")} />
      </FormField>
      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <div className="flex min-h-touch items-center gap-3">
            <Switch id={`${id}-active`} checked={field.value} onCheckedChange={field.onChange} />
            <Label htmlFor={`${id}-active`}>Active</Label>
          </div>
        )}
      />
      <p aria-live="assertive" className="text-sm text-destructive empty:hidden">
        {errors.root?.message}
      </p>
      <Button type="submit" disabled={isSubmitting} className="self-end">
        {isSubmitting ? "Saving…" : "Save banner"}
      </Button>
    </form>
  );
}
