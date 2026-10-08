"use client";

import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormField, fieldProps } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createProduct, updateProduct } from "@/app/admin/(protected)/products/actions";
import type { ActionResult } from "@/lib/admin-actions";
import { slugify } from "@/lib/catalog/admin-input";
import { productStatusLabels } from "@/lib/catalog/admin-labels";
import {
  PRODUCT_STATUSES,
  type ProductDetailsInput,
  productDetailsSchema,
} from "@/lib/validators/admin-catalog";

const NONE = "none";

// Product details for the create page (always saved as a draft) and the edit page.
export function ProductForm({
  productId,
  defaultValues,
  categories,
  sizeCharts,
  hsnCodes,
}: {
  // Absent on the create page.
  productId?: string;
  defaultValues: ProductDetailsInput;
  categories: { id: string; path: string; isActive: boolean }[];
  sizeCharts: { id: string; name: string }[];
  hsnCodes: string[];
}) {
  const id = useId();
  const creating = !productId;
  // New rows: the slug follows the title until the admin edits the slug.
  const autoSlug = creating;
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, dirtyFields, isSubmitting, isDirty },
    reset,
  } = useForm<ProductDetailsInput>({
    // raw: the action re-parses the typed values itself.
    resolver: zodResolver(productDetailsSchema, undefined, { raw: true }),
    defaultValues,
  });

  const submit = handleSubmit(async (values) => {
    // createProduct redirects to the edit page on success, so it may never hand back a result.
    const result: ActionResult | undefined = creating
      ? await createProduct(values)
      : await updateProduct({ ...values, id: productId });
    if (!result) return;
    if (!result.ok) {
      setError("root", { message: result.error });
      return;
    }
    toast.success(result.message ?? "Saved");
    reset(undefined, { keepValues: true });
  });

  const f = (name: keyof ProductDetailsInput, hint?: string) => ({
    id: `${id}-${name}`,
    error: errors[name]?.message,
    hint,
  });

  return (
    <form noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <FormField {...f("title")} label="Title" className="sm:col-span-2">
        <Input
          maxLength={200}
          {...fieldProps(`${id}-title`, errors.title?.message)}
          {...register("title", {
            onChange: (e) => {
              if (autoSlug && !dirtyFields.slug) setValue("slug", slugify(e.target.value), { shouldValidate: false });
            },
          })}
        />
      </FormField>

      <FormField {...f("slug", "Used in the product URL: /products/your-slug")} label="URL slug" className="sm:col-span-2">
        <Input
          maxLength={80}
          {...fieldProps(`${id}-slug`, errors.slug?.message, "hint")}
          {...register("slug")}
        />
      </FormField>

      <FormField {...f("categoryId")} label="Category">
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select value={field.value || undefined} onValueChange={field.onChange} name={field.name}>
              <SelectTrigger className="w-full" {...fieldProps(`${id}-categoryId`, errors.categoryId?.message)} onBlur={field.onBlur}>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.path}
                    {!c.isActive && " (hidden)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>

      <FormField {...f("hsnCode", "Sets the GST rate at checkout")} label="HSN code">
        <Input
          inputMode="numeric"
          maxLength={8}
          list={`${id}-hsn-codes`}
          {...fieldProps(`${id}-hsnCode`, errors.hsnCode?.message, "hint")}
          {...register("hsnCode")}
        />
        <datalist id={`${id}-hsn-codes`}>
          {hsnCodes.map((code) => (
            <option key={code} value={code} />
          ))}
        </datalist>
      </FormField>

      <FormField {...f("description")} label="Description" className="sm:col-span-2">
        <Textarea rows={5} maxLength={5000} {...fieldProps(`${id}-description`, errors.description?.message)} {...register("description")} />
      </FormField>

      <FormField {...f("fabric")} label="Fabric">
        <Input maxLength={60} {...fieldProps(`${id}-fabric`, errors.fabric?.message)} {...register("fabric")} />
      </FormField>
      <FormField {...f("style")} label="Style">
        <Input maxLength={60} {...fieldProps(`${id}-style`, errors.style?.message)} {...register("style")} />
      </FormField>
      <FormField {...f("occasion")} label="Occasion">
        <Input maxLength={60} {...fieldProps(`${id}-occasion`, errors.occasion?.message)} {...register("occasion")} />
      </FormField>
      <FormField {...f("countryOfOrigin")} label="Country of origin">
        <Input maxLength={60} {...fieldProps(`${id}-countryOfOrigin`, errors.countryOfOrigin?.message)} {...register("countryOfOrigin")} />
      </FormField>

      <FormField {...f("care")} label="Care instructions" className="sm:col-span-2">
        <Textarea rows={3} maxLength={1000} {...fieldProps(`${id}-care`, errors.care?.message)} {...register("care")} />
      </FormField>

      <FormField {...f("sizeChartId")} label="Size chart">
        <Controller
          control={control}
          name="sizeChartId"
          render={({ field }) => (
            <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)} name={field.name}>
              <SelectTrigger className="w-full" {...fieldProps(`${id}-sizeChartId`, errors.sizeChartId?.message)} onBlur={field.onBlur}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No size chart</SelectItem>
                {sizeCharts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>

      {!creating && (
        <FormField {...f("status", "Only active products appear in the store")} label="Status">
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} name={field.name}>
                <SelectTrigger className="w-full" {...fieldProps(`${id}-status`, errors.status?.message, "hint")} onBlur={field.onBlur}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {productStatusLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      )}

      <FormField {...f("seoTitle", "Defaults to the product title")} label="SEO title (optional)" className="sm:col-span-2">
        <Input maxLength={120} {...fieldProps(`${id}-seoTitle`, errors.seoTitle?.message, "hint")} {...register("seoTitle")} />
      </FormField>
      <FormField {...f("seoDescription")} label="SEO description (optional)" className="sm:col-span-2">
        <Textarea rows={2} maxLength={300} {...fieldProps(`${id}-seoDescription`, errors.seoDescription?.message)} {...register("seoDescription")} />
      </FormField>

      <div aria-live="assertive" className="empty:hidden sm:col-span-2">
        {errors.root?.message && <p className="text-sm text-destructive">{errors.root.message}</p>}
      </div>

      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={isSubmitting || (!creating && !isDirty)}>
          {isSubmitting ? "Saving…" : creating ? "Create draft" : "Save details"}
        </Button>
      </div>
    </form>
  );
}
