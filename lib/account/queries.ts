import "server-only";
import { createClient } from "@/lib/supabase/server";

// Account reads run as the signed-in user (RLS: own rows only). Never cached.

export type AccountProfile = {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  marketingConsent: boolean;
  deletionRequestedAt: string | null;
};

export type SavedAddress = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  stateCode: string;
  pincode: string;
  isDefault: boolean;
};

export async function getAccountProfile(userId: string): Promise<AccountProfile> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, phone, email, marketing_consent, deletion_requested_at")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);
  return {
    fullName: data.full_name,
    phone: data.phone,
    email: data.email,
    marketingConsent: data.marketing_consent,
    deletionRequestedAt: data.deletion_requested_at,
  };
}

export async function getSavedAddresses(userId: string): Promise<SavedAddress[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("addresses")
    .select("id, name, phone, line1, line2, city, state_code, pincode, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data.map((a) => ({
    id: a.id,
    name: a.name,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    stateCode: a.state_code,
    pincode: a.pincode,
    isDefault: a.is_default,
  }));
}
