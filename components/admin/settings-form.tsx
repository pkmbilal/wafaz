"use client";

import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormField, fieldProps } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveSettings } from "@/app/admin/(protected)/settings/actions";
import type { IndianState } from "@/lib/catalog/queries";
import { type SettingsInput, settingsSchema } from "@/lib/validators/admin-settings";

// Store settings. Staff see the same form read-only.
export function SettingsForm({
  defaultValues,
  states,
  canEdit,
}: {
  defaultValues: SettingsInput;
  states: IndianState[];
  canEdit: boolean;
}) {
  const id = useId();
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsInput>({
    // raw: the action re-parses the typed values itself.
    resolver: zodResolver(settingsSchema, undefined, { raw: true }),
    defaultValues,
  });

  const submit = handleSubmit(async (values) => {
    const result = await saveSettings(values);
    if (!result.ok) return setError("root", { message: result.error });
    toast.success(result.message ?? "Saved");
    reset(values);
  });

  const input = (name: keyof SettingsInput, label: string, opts: { hint?: string; className?: string; props?: React.ComponentProps<"input"> } = {}) => (
    <FormField id={`${id}-${name}`} label={label} error={errors[name]?.message} hint={opts.hint} className={opts.className}>
      <Input {...opts.props} {...fieldProps(`${id}-${name}`, errors[name]?.message, opts.hint)} {...register(name)} />
    </FormField>
  );

  const select = (name: "stateCode" | "taxSlabBasis", label: string, options: { value: string; label: string }[], hint?: string) => (
    <FormField id={`${id}-${name}`} label={label} error={errors[name]?.message} hint={hint}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange} disabled={!canEdit}>
            <SelectTrigger className="w-full" {...fieldProps(`${id}-${name}`, errors[name]?.message, hint)} onBlur={field.onBlur}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </FormField>
  );

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <fieldset disabled={!canEdit} className="flex flex-col gap-6">
        <Group title="Business" description="Printed on invoices and shown in the store footer.">
          {input("legalName", "Legal name", { className: "sm:col-span-2", props: { maxLength: 200 } })}
          {input("tradeName", "Trade name", { props: { maxLength: 120 } })}
          {input("gstin", "GSTIN", { hint: "Leave empty until registered", props: { maxLength: 15, className: "font-mono uppercase" } })}
          {input("supportEmail", "Support email", { props: { type: "email", maxLength: 254 } })}
          {input("supportPhone", "Support phone", { hint: "10 digits", props: { inputMode: "tel", maxLength: 14 } })}
        </Group>

        <Group title="Registered address" description="The seller state decides CGST + SGST vs IGST at checkout.">
          {input("addressLine1", "Address line 1", { className: "sm:col-span-2", props: { maxLength: 200 } })}
          {input("addressLine2", "Address line 2 (optional)", { className: "sm:col-span-2", props: { maxLength: 200 } })}
          {input("city", "City", { props: { maxLength: 100 } })}
          {input("pincode", "PIN code", { props: { inputMode: "numeric", maxLength: 6 } })}
          {select(
            "stateCode",
            "State",
            states.map((s) => ({ value: s.code, label: `${s.name} (${s.code})` })),
          )}
        </Group>

        <Group title="Grievance officer" description="Required by the Consumer Protection (E-Commerce) Rules; shown on the grievance page.">
          {input("grievanceOfficerName", "Name", { className: "sm:col-span-2", props: { maxLength: 120 } })}
          {input("grievanceOfficerEmail", "Email", { props: { type: "email", maxLength: 254 } })}
          {input("grievanceOfficerPhone", "Phone", { hint: "10 digits", props: { inputMode: "tel", maxLength: 14 } })}
        </Group>

        <Group
          title="Tax and invoices"
          description="Changes apply to documents issued from now on. Issued invoices and credit notes never change. Confirm these with your CA."
        >
          {input("invoicePrefix", "Invoice prefix", { hint: "e.g. INV → INV/26-27/00001", props: { maxLength: 5, className: "font-mono uppercase" } })}
          {input("creditNotePrefix", "Credit note prefix", { hint: "e.g. CN → CN/26-27/00001", props: { maxLength: 5, className: "font-mono uppercase" } })}
          {select(
            "taxSlabBasis",
            "GST slab tested on",
            [
              { value: "inclusive", label: "Price including GST" },
              { value: "taxable", label: "Taxable value (excluding GST)" },
            ],
            "Which value decides the slab for each piece",
          )}
          {input("shippingTaxRate", "GST on shipping (%)", {
            hint: "Empty = the highest rate among the order's items",
            props: { inputMode: "decimal", maxLength: 6 },
          })}
        </Group>

        <Group title="Store">
          {input("lowStockThreshold", "Low-stock alert at", { hint: "Available units or fewer", props: { inputMode: "numeric", maxLength: 4 } })}
          {input("newBadgeDays", "NEW badge for", { hint: "Days after a product is published", props: { inputMode: "numeric", maxLength: 3 } })}
        </Group>
      </fieldset>

      <p aria-live="assertive" className="text-sm text-destructive empty:hidden">
        {errors.root?.message}
      </p>
      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Saving…" : "Save settings"}
          </Button>
        </div>
      )}
    </form>
  );
}

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
