"use client";

import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/admin/form-dialog";
import { FormField, fieldProps } from "@/components/admin/form-field";
import { ImageUploadField } from "@/components/admin/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveCollection } from "@/app/admin/(protected)/catalog/actions";
import type { ActionResult } from "@/lib/admin-actions";
import { slugify } from "@/lib/catalog/admin-input";
import type { AdminCollection } from "@/lib/catalog/admin-queries";
import { type CollectionInput, collectionSchema } from "@/lib/validators/admin-catalog";

export function NewCollectionDialog() {
  return (
    <FormDialog
      trigger={<><Plus aria-hidden /> New collection</>}
      title="New collection"
      description="Hand-picked product lists such as New Arrivals. Add products after saving."
    >
      {() => <CollectionForm />}
    </FormDialog>
  );
}

// Create (redirects to the collection's page) or edit in place.
export function CollectionForm({ collection }: { collection?: AdminCollection }) {
  const id = useId();
  // New rows: the slug follows the title until the admin edits the slug.
  const autoSlug = !collection;
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors, dirtyFields, isSubmitting, isDirty },
  } = useForm<CollectionInput>({
    // raw: the action re-parses the typed values itself.
    resolver: zodResolver(collectionSchema, undefined, { raw: true }),
    defaultValues: {
      id: collection?.id,
      title: collection?.title ?? "",
      slug: collection?.slug ?? "",
      description: collection?.description ?? "",
      imageKey: collection?.imageKey ?? "",
      isActive: collection?.isActive ?? true,
    },
  });

  const submit = handleSubmit(async (values) => {
    // Creating redirects to the new collection, so there may be no result.
    const result: ActionResult | undefined = await saveCollection(values);
    if (!result) return;
    if (!result.ok) return setError("root", { message: result.error });
    toast.success(result.message ?? "Saved");
    reset(values);
  });

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <FormField id={`${id}-title`} label="Title" error={errors.title?.message}>
        <Input
          maxLength={120}
          {...fieldProps(`${id}-title`, errors.title?.message)}
          {...register("title", {
            onChange: (e) => {
              if (autoSlug && !dirtyFields.slug) setValue("slug", slugify(e.target.value));
            },
          })}
        />
      </FormField>
      <FormField id={`${id}-slug`} label="URL slug" error={errors.slug?.message} hint="The page is /collections/your-slug">
        <Input
          maxLength={80}
          {...fieldProps(`${id}-slug`, errors.slug?.message, "hint")}
          {...register("slug")}
        />
      </FormField>
      <FormField id={`${id}-description`} label="Description (optional)" error={errors.description?.message}>
        <Textarea rows={3} maxLength={1000} {...fieldProps(`${id}-description`, errors.description?.message)} {...register("description")} />
      </FormField>
      <Controller
        control={control}
        name="imageKey"
        render={({ field }) => (
          <ImageUploadField label="Image" target="collection" value={field.value || null} onChange={(k) => field.onChange(k ?? "")} />
        )}
      />
      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <div className="flex min-h-touch items-center gap-3">
            <Switch id={`${id}-active`} checked={field.value} onCheckedChange={field.onChange} />
            <Label htmlFor={`${id}-active`}>Show in the store</Label>
          </div>
        )}
      />
      <p aria-live="assertive" className="text-sm text-destructive empty:hidden">
        {errors.root?.message}
      </p>
      <Button type="submit" disabled={isSubmitting || (Boolean(collection) && !isDirty)} className="self-end">
        {isSubmitting ? "Saving…" : collection ? "Save collection" : "Create collection"}
      </Button>
    </form>
  );
}
