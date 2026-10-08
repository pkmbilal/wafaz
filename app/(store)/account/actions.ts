"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  addressSchema,
  idSchema,
  marketingConsentSchema,
  profileSchema,
} from "@/lib/validators/auth";

// Account mutations run as the signed-in user, so RLS limits them to the caller's own rows.

export type ActionResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "Couldn't save your changes. Please try again.";

async function signedInClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId || data.claims.is_anonymous) return null;
  return { supabase, userId };
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the highlighted fields";
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const session = await signedInClient();
  if (!session) return { ok: false, error: "Please sign in again." };

  const { error } = await session.supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", session.userId);
  if (error) return { ok: false, error: GENERIC_ERROR };
  refresh();
  return { ok: true };
}

// Marketing consent is separate from transactional messages and off by default (ROADMAP Legal).
export async function setMarketingConsent(input: unknown): Promise<ActionResult> {
  const parsed = marketingConsentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  const session = await signedInClient();
  if (!session) return { ok: false, error: "Please sign in again." };

  const { error } = await session.supabase
    .from("profiles")
    .update({
      marketing_consent: parsed.data.consent,
      marketing_consent_at: new Date().toISOString(),
    })
    .eq("id", session.userId);
  if (error) return { ok: false, error: GENERIC_ERROR };
  refresh();
  return { ok: true };
}

// The owner handles the request from the admin dashboard; orders and invoices are kept for tax
// records. TODO(owner): no email alert for these (it would need the service role here, which
// AGENTS.md §5.8 doesn't allow); check the dashboard's "Deletion requests" panel.
export async function requestAccountDeletion(): Promise<ActionResult> {
  const session = await signedInClient();
  if (!session) return { ok: false, error: "Please sign in again." };

  const { error } = await session.supabase
    .from("profiles")
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq("id", session.userId)
    .is("deletion_requested_at", null);
  if (error) return { ok: false, error: GENERIC_ERROR };
  refresh();
  return { ok: true };
}

export async function cancelAccountDeletion(): Promise<ActionResult> {
  const session = await signedInClient();
  if (!session) return { ok: false, error: "Please sign in again." };

  const { error } = await session.supabase
    .from("profiles")
    .update({ deletion_requested_at: null })
    .eq("id", session.userId);
  if (error) return { ok: false, error: GENERIC_ERROR };
  refresh();
  return { ok: true };
}

const saveAddressSchema = z.object({ id: idSchema.optional(), address: addressSchema });

export async function saveAddress(input: unknown): Promise<ActionResult> {
  const parsed = saveAddressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const session = await signedInClient();
  if (!session) return { ok: false, error: "Please sign in again." };

  const { id, address } = parsed.data;
  const row = {
    name: address.name,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city,
    state_code: address.stateCode,
    pincode: address.pincode,
  };

  const { count } = await session.supabase
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.userId);

  let addressId = id;
  if (id) {
    const { error } = await session.supabase.from("addresses").update(row).eq("id", id);
    if (error) return { ok: false, error: GENERIC_ERROR };
  } else {
    // TODO(owner): is 20 saved addresses per customer the right cap?
    if ((count ?? 0) >= 20) return { ok: false, error: "You can save up to 20 addresses." };
    const { data, error } = await session.supabase
      .from("addresses")
      .insert({ ...row, user_id: session.userId })
      .select("id")
      .single();
    if (error) return { ok: false, error: GENERIC_ERROR };
    addressId = data.id;
  }

  // The first address, or one marked default, becomes the default.
  if (addressId && (address.isDefault || (!id && (count ?? 0) === 0))) {
    const { error } = await session.supabase.rpc("set_default_address", {
      p_address_id: addressId,
    });
    if (error) return { ok: false, error: GENERIC_ERROR };
  }

  refresh();
  return { ok: true };
}

export async function deleteAddress(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  const session = await signedInClient();
  if (!session) return { ok: false, error: "Please sign in again." };

  const { error } = await session.supabase.from("addresses").delete().eq("id", parsed.data);
  if (error) return { ok: false, error: "Couldn't delete the address. Please try again." };
  refresh();
  return { ok: true };
}

export async function setDefaultAddress(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
  const session = await signedInClient();
  if (!session) return { ok: false, error: "Please sign in again." };

  const { error } = await session.supabase.rpc("set_default_address", {
    p_address_id: parsed.data,
  });
  if (error) return { ok: false, error: GENERIC_ERROR };
  refresh();
  return { ok: true };
}
