"use client";

import { useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/admin/form-dialog";
import { FormField, fieldProps } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveTag } from "@/app/admin/(protected)/catalog/actions";
import { slugify } from "@/lib/catalog/admin-input";
import type { AdminTag } from "@/lib/catalog/admin-queries";
import { type TagInput, tagSchema } from "@/lib/validators/admin-catalog";

export function TagDialog({ tag }: { tag?: AdminTag }) {
  return (
    <FormDialog
      trigger={tag ? <Pencil aria-hidden /> : <><Plus aria-hidden /> New tag</>}
      triggerLabel={tag ? `Edit ${tag.name}` : undefined}
      variant={tag ? "ghost" : "default"}
      size={tag ? "icon" : "default"}
      title={tag ? `Edit ${tag.name}` : "New tag"}
      description="Tag names are searched along with product titles and fabrics."
    >
      {(close) => <TagForm tag={tag} onSaved={close} />}
    </FormDialog>
  );
}

function TagForm({ tag, onSaved }: { tag?: AdminTag; onSaved: () => void }) {
  const id = useId();
  // New rows: the slug follows the title until the admin edits the slug.
  const autoSlug = !tag;
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, dirtyFields, isSubmitting },
  } = useForm<TagInput>({
    // raw: the action re-parses the typed values itself.
    resolver: zodResolver(tagSchema, undefined, { raw: true }),
    defaultValues: { id: tag?.id, name: tag?.name ?? "", slug: tag?.slug ?? "" },
  });

  const submit = handleSubmit(async (values) => {
    const result = await saveTag(values);
    if (!result.ok) return setError("root", { message: result.error });
    toast.success(result.message ?? "Saved");
    onSaved();
  });

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <FormField id={`${id}-name`} label="Name" error={errors.name?.message}>
        <Input
          maxLength={40}
          {...fieldProps(`${id}-name`, errors.name?.message)}
          {...register("name", {
            onChange: (e) => {
              if (autoSlug && !dirtyFields.slug) setValue("slug", slugify(e.target.value, 40));
            },
          })}
        />
      </FormField>
      <FormField id={`${id}-slug`} label="Slug" error={errors.slug?.message}>
        <Input
          maxLength={80}
          {...fieldProps(`${id}-slug`, errors.slug?.message)}
          {...register("slug")}
        />
      </FormField>
      <p aria-live="assertive" className="text-sm text-destructive empty:hidden">
        {errors.root?.message}
      </p>
      <Button type="submit" disabled={isSubmitting} className="self-end">
        {isSubmitting ? "Saving…" : "Save tag"}
      </Button>
    </form>
  );
}
