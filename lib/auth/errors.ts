// Customer-facing copy for Supabase Auth errors. Unknown errors get a generic message so
// internal details never reach the UI.

type AuthErrorLike = { code?: string | null; message?: string | null; status?: number | null };

export const INVALID_LOGIN = "Incorrect email or password.";

const MESSAGES: Record<string, string> = {
  invalid_credentials: INVALID_LOGIN,
  otp_expired: "That code is wrong or has expired. Check it or request a new one.",
  captcha_failed: "The security check failed. Please try again.",
  over_email_send_rate_limit: "Too many emails requested. Please wait a while and try again.",
  over_request_rate_limit: "Too many attempts. Please wait a few minutes and try again.",
  weak_password: "Choose a stronger password: at least 8 characters, and not a common one.",
  same_password: "Your new password must be different from the old one.",
  email_exists: "This email is already linked to another account.",
  user_already_exists: "An account with this email already exists. Log in instead.",
  email_not_confirmed: "Confirm your email first. We've sent you a new code.",
  validation_failed: "Check your details and try again.",
  signup_disabled: "Sign-ups are paused right now. Please try again later.",
};

export function authErrorMessage(error: AuthErrorLike): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error.status === 429) return MESSAGES.over_request_rate_limit;
  return "Something went wrong. Please try again.";
}
