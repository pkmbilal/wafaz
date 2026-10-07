import { createClient } from "@/lib/supabase/browser";

// Lazy guest session (AGENTS.md §5.3): called on the first cart action, never on catalog pages.
// Returns the existing session if there is one, otherwise signs in anonymously with a Turnstile token.
// Called by CartProvider on the first add to cart.
export async function ensureGuestSession(captchaToken: string): Promise<{ userId: string } | { error: string }> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return { userId: data.session.user.id };

  const { data: signedIn, error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
  if (error || !signedIn.user) return { error: "Couldn't start your cart. Please try again." };
  return { userId: signedIn.user.id };
}
