"use client";

import { useId } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/admin/form-dialog";
import { FormField, fieldProps } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveCoupon } from "@/app/admin/(protected)/coupons/actions";
import type { AdminCoupon } from "@/lib/admin/queries";
import { isoToIstLocal, paiseToRupeesInput } from "@/lib/catalog/admin-input";
import { type CouponInput, couponSchema } from "@/lib/validators/admin-coupons";

export function CouponDialog({ coupon }: { coupon?: AdminCoupon }) {
  return (
    <FormDialog
      trigger={coupon ? <Pencil aria-hidden /> : <><Plus aria-hidden /> New coupon</>}
      triggerLabel={coupon ? `Edit ${coupon.code}` : undefined}
      variant={coupon ? "ghost" : "default"}
      size={coupon ? "icon" : "default"}
      title={coupon ? `Edit ${coupon.code}` : "New coupon"}
      description="Checkout checks every rule again when the coupon is applied and when the order is paid."
    >
      {(close) => <CouponForm coupon={coupon} onSaved={close} />}
    </FormDialog>
  );
}

const rupees = (paise: number | null) => (paise === null || paise === 0 ? "" : paiseToRupeesInput(paise));

function CouponForm({ coupon, onSaved }: { coupon?: AdminCoupon; onSaved: () => void }) {
  const id = useId();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CouponInput>({
    // raw: the action re-parses the typed values itself.
    resolver: zodResolver(couponSchema, undefined, { raw: true }),
    defaultValues: {
      id: coupon?.id,
      code: coupon?.code ?? "",
      kind: coupon?.kind ?? "percent",
      value: coupon ? (coupon.kind === "percent" ? String(coupon.value) : paiseToRupeesInput(coupon.value)) : "",
      maxDiscount: rupees(coupon?.maxDiscountPaise ?? null),
      minCart: rupees(coupon?.minCartPaise ?? null),
      maxUses: coupon?.maxUses ? String(coupon.maxUses) : "",
      perUserLimit: coupon?.perUserLimit ? String(coupon.perUserLimit) : "",
      firstOrderOnly: coupon?.firstOrderOnly ?? false,
      startsAt: isoToIstLocal(coupon?.startsAt ?? null),
      endsAt: isoToIstLocal(coupon?.endsAt ?? null),
      isActive: coupon?.isActive ?? true,
    },
  });
  const kind = useWatch({ control, name: "kind" });

  const submit = handleSubmit(async (values) => {
    const result = await saveCoupon(values);
    if (!result.ok) return setError("root", { message: result.error });
    toast.success(result.message ?? "Saved");
    onSaved();
  });

  const field = (name: keyof CouponInput, label: string, props: React.ComponentProps<"input"> = {}, hint?: string) => (
    <FormField id={`${id}-${name}`} label={label} error={errors[name]?.message} hint={hint}>
      <Input {...props} {...fieldProps(`${id}-${name}`, errors[name]?.message, hint)} {...register(name)} />
    </FormField>
  );

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {field("code", "Code", { maxLength: 30, className: "font-mono uppercase", autoCapitalize: "characters" }, "Customers type this at checkout")}

      <div className="flex flex-col gap-2">
        <Label id={`${id}-kind`}>Discount type</Label>
        <Controller
          control={control}
          name="kind"
          render={({ field: f }) => (
            <Tabs value={f.value} onValueChange={f.onChange}>
              <TabsList aria-labelledby={`${id}-kind`}>
                <TabsTrigger value="percent">Percent off</TabsTrigger>
                <TabsTrigger value="flat">Rupees off</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {field("value", kind === "percent" ? "Percent off" : "Rupees off", { inputMode: "decimal", maxLength: 10 })}
        {kind === "percent" &&
          field("maxDiscount", "Maximum discount ₹ (optional)", { inputMode: "decimal", maxLength: 10 })}
        {field("minCart", "Minimum cart value ₹ (optional)", { inputMode: "decimal", maxLength: 10 })}
        {field("maxUses", "Total uses (optional)", { inputMode: "numeric", maxLength: 7 }, "Empty = unlimited")}
        {field("perUserLimit", "Uses per customer (optional)", { inputMode: "numeric", maxLength: 7 }, "Matched by account, email or phone")}
        {field("startsAt", "Starts (optional)", { type: "datetime-local" }, "Kerala time")}
        {field("endsAt", "Ends (optional)", { type: "datetime-local" }, "Kerala time")}
      </div>

      <Controller
        control={control}
        name="firstOrderOnly"
        render={({ field: f }) => (
          <div className="flex min-h-touch items-center gap-3">
            <Checkbox id={`${id}-first`} checked={f.value} onCheckedChange={(v) => f.onChange(v === true)} />
            <Label htmlFor={`${id}-first`}>First order only</Label>
          </div>
        )}
      />
      <Controller
        control={control}
        name="isActive"
        render={({ field: f }) => (
          <div className="flex min-h-touch items-center gap-3">
            <Switch id={`${id}-active`} checked={f.value} onCheckedChange={f.onChange} />
            <Label htmlFor={`${id}-active`}>Active</Label>
          </div>
        )}
      />

      {coupon && coupon.usedCount > 0 && (
        <p className="text-sm text-muted-foreground">Used {coupon.usedCount} times. Changes apply to future orders only.</p>
      )}
      <p aria-live="assertive" className="text-sm text-destructive empty:hidden">
        {errors.root?.message}
      </p>
      <Button type="submit" disabled={isSubmitting} className="self-end">
        {isSubmitting ? "Saving…" : "Save coupon"}
      </Button>
    </form>
  );
}
