"use client";

import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IndianState } from "@/lib/catalog/queries";
import { addressSchema, type AddressInput, type AddressOutput } from "@/lib/validators/auth";

type Props = {
  states: IndianState[];
  defaultValues?: Partial<AddressInput>;
  submitLabel?: string;
  // Hide "make default" where it doesn't apply (e.g. the only address).
  showDefaultToggle?: boolean;
  onSubmit: (values: AddressOutput) => Promise<{ ok: true } | { ok: false; error: string }>;
  onCancel?: () => void;
};

export function AddressForm({
  states,
  defaultValues,
  submitLabel = "Save address",
  showDefaultToggle = true,
  onSubmit,
  onCancel,
}: Props) {
  const id = useId();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddressInput, unknown, AddressOutput>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      name: "",
      phone: "",
      line1: "",
      line2: "",
      city: "",
      stateCode: "",
      pincode: "",
      isDefault: false,
      ...defaultValues,
    },
  });

  const submit = handleSubmit(async (values) => {
    const result = await onSubmit(values);
    if (!result.ok) setError("root", { message: result.error });
  });

  const field = (name: keyof AddressInput) => ({
    id: `${id}-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
  });

  return (
    <form noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" name="name" id={id} error={errors.name?.message} className="sm:col-span-2">
        <Input autoComplete="name" maxLength={120} {...field("name")} {...register("name")} />
      </Field>

      <Field label="Mobile number" name="phone" id={id} error={errors.phone?.message} className="sm:col-span-2">
        <Input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="10-digit mobile number"
          maxLength={14}
          {...field("phone")}
          {...register("phone")}
        />
      </Field>

      <Field
        label="House / flat, building, street"
        name="line1"
        id={id}
        error={errors.line1?.message}
        className="sm:col-span-2"
      >
        <Input autoComplete="address-line1" maxLength={200} {...field("line1")} {...register("line1")} />
      </Field>

      <Field
        label="Area, landmark (optional)"
        name="line2"
        id={id}
        error={errors.line2?.message}
        className="sm:col-span-2"
      >
        <Input autoComplete="address-line2" maxLength={200} {...field("line2")} {...register("line2")} />
      </Field>

      <Field label="City / town" name="city" id={id} error={errors.city?.message}>
        <Input autoComplete="address-level2" maxLength={100} {...field("city")} {...register("city")} />
      </Field>

      <Field label="PIN code" name="pincode" id={id} error={errors.pincode?.message}>
        <Input
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          {...field("pincode")}
          {...register("pincode")}
        />
      </Field>

      <Field label="State" name="stateCode" id={id} error={errors.stateCode?.message} className="sm:col-span-2">
        <Controller
          control={control}
          name="stateCode"
          render={({ field: f }) => (
            <Select value={f.value} onValueChange={f.onChange} name={f.name}>
              <SelectTrigger className="w-full" {...field("stateCode")} onBlur={f.onBlur}>
                <SelectValue placeholder="Choose a state" />
              </SelectTrigger>
              <SelectContent>
                {states.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      {showDefaultToggle && (
        <Controller
          control={control}
          name="isDefault"
          render={({ field: f }) => (
            <div className="flex min-h-touch items-center gap-3 sm:col-span-2">
              <Checkbox
                id={`${id}-isDefault`}
                checked={f.value === true}
                onCheckedChange={(v) => f.onChange(v === true)}
              />
              <Label htmlFor={`${id}-isDefault`}>Use as my default address</Label>
            </div>
          )}
        />
      )}

      <div aria-live="assertive" className="empty:hidden sm:col-span-2">
        {errors.root?.message && <p className="text-sm text-destructive">{errors.root.message}</p>}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  id,
  error,
  className,
  children,
}: {
  label: string;
  name: string;
  id: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label htmlFor={`${id}-${name}`}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
