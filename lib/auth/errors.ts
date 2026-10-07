// Customer-facing copy for Supabase Auth errors. Unknown errors get a generic message so
// internal details never reach the UI.

type AuthErrorLike = { code?: string | null; message?: string | null; status?: number | null };

const MESSAGES: Record<string, string> = {
  otp_expired: "That code is wrong or has expired. Check it or request a new one.",
  captcha_failed: "The security check failed. Please try again.",
  over_sms_send_rate_limit: "Too many codes requested. Please wait a while and try again.",
  over_email_send_rate_limit: "Too many codes requested. Please wait a while and try again.",
  over_request_rate_limit: "Too many attempts. Please wait a few minutes and try again.",
  phone_exists: "This number is already linked to another account.",
  email_exists: "This email is already linked to another account.",
  validation_failed: "Check the number or email and try again.",
  signup_disabled: "Sign-ups are paused right now. Please try again later.",
};

// Messages our Send SMS Hook returns (app/api/auth/send-otp) are written for customers.
const HOOK_CODES = new Set(["hook_timeout", "hook_payload_invalid_content_type", "unexpected_failure"]);

export function authErrorMessage(error: AuthErrorLike): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error.status === 429) return MESSAGES.over_request_rate_limit;
  if (error.code && HOOK_CODES.has(error.code)) {
    return "We couldn't send the WhatsApp code. Try email instead.";
  }
  return "Something went wrong. Please try again.";
}

export function isAlreadyLinked(error: AuthErrorLike): boolean {
  return error.code === "phone_exists" || error.code === "email_exists";
}
