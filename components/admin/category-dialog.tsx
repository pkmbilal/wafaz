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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { saveCategory } from "@/app/admin/(protected)/catalog/actions";
import { slugify } from "@/lib/catalog/admin-input";
import type { AdminCategory } from "@/lib/catalog/admin-queries";
import { type CategoryInput, categorySchema } from "@/lib/validators/admin-catalog";

const TOP_LEVEL = "none";

type Parent = Pick<AdminCategory, "id" | "parentId" | "path">;

// Categories a category may move under: anything except itself and its own descendants.
function allowedParents(all: Parent[], self?: string): Parent[] {
  if (!self) return all;
  const blocked = new Set([self]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of all) {
      if (c.parentId && blocked.has(c.parentId) && !blocked.has(c.id)) {
        blocked.add(c.id);
        grew = true;
      }
    }
  }
  return all.filter((c) => !blocked.has(c.id));
}

export function CategoryDialog({ category, categories }: { category?: AdminCategory; categories: Parent[] }) {
  return (
    <FormDialog
      trigger={category ? <Pencil aria-hidden /> : <><Plus aria-hidden /> New category</>}
      triggerLabel={category ? `Edit ${category.name}` : undefined}
      variant={category ? "ghost" : "default"}
      size={category ? "icon" : "default"}
      title={category ? `Edit ${category.name}` : "New category"}
      description="Categories appear in the store menu and at /collections/your-slug."
    >
      {(close) => <CategoryForm category={category} parents={allowedParents(categories, category?.id)} onSaved={close} />}
    </FormDialog>
  );
}

function CategoryForm({
  category,
  parents,
  onSaved,
}: {
  category?: AdminCategory;
  parents: Parent[];
  onSaved: () => void;
}) {
  const id = useId();
  // New rows: the slug follows the title until the admin edits the slug.
  const autoSlug = !category;
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, dirtyFields, isSubmitting },
  } = useForm<CategoryInput>({
    // raw: the action re-parses the typed values itself.
    resolver: zodResolver(categorySchema, undefined, { raw: true }),
    defaultValues: {
      id: category?.id,
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      parentId: category?.parentId ?? "",
      imageKey: category?.imageKey ?? "",
      sortOrder: String(category?.sortOrder ?? 0),
      isActive: category?.isActive ?? true,
    },
  });

  const submit = handleSubmit(async (values) => {
    const result = await saveCategory(values);
    if (!result.ok) return setError("root", { message: result.error });
    toast.success(result.message ?? "Saved");
    onSaved();
  });

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <FormField id={`${id}-name`} label="Name" error={errors.name?.message}>
        <Input
          maxLength={80}
          {...fieldProps(`${id}-name`, errors.name?.message)}
          {...register("name", {
            onChange: (e) => {
              if (autoSlug && !dirtyFields.slug) setValue("slug", slugify(e.target.value));
            },
          })}
        />
      </FormField>
      <FormField id={`${id}-slug`} label="URL slug" error={errors.slug?.message}>
        <Input
          maxLength={80}
          {...fieldProps(`${id}-slug`, errors.slug?.message)}
          {...register("slug")}
        />
      </FormField>
      <FormField id={`${id}-parent`} label="Parent category" error={errors.parentId?.message}>
        <Controller
          control={control}
          name="parentId"
          render={({ field }) => (
            <Select value={field.value || TOP_LEVEL} onValueChange={(v) => field.onChange(v === TOP_LEVEL ? "" : v)}>
              <SelectTrigger className="w-full" {...fieldProps(`${id}-parent`, errors.parentId?.message)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOP_LEVEL}>None (top level)</SelectItem>
                {parents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
      <FormField id={`${id}-sort`} label="Sort order" error={errors.sortOrder?.message} hint="Lower numbers come first.">
        <Input inputMode="numeric" className="w-28" {...fieldProps(`${id}-sort`, errors.sortOrder?.message, "hint")} {...register("sortOrder")} />
      </FormField>
      <Controller
        control={control}
        name="imageKey"
        render={({ field }) => (
          <ImageUploadField label="Image" target="category" value={field.value || null} onChange={(k) => field.onChange(k ?? "")} />
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
      <Button type="submit" disabled={isSubmitting} className="self-end">
        {isSubmitting ? "Saving…" : "Save category"}
      </Button>
    </form>
  );
}
