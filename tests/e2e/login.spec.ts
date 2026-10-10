import { expect, test } from "@playwright/test";
import { emailOtp, fillOtp, uniqueEmail, uniquePhone, waitForTurnstile, whatsappOtp } from "./helpers";

// OTP login (AGENTS.md §8): email via the local Mailpit inbox, WhatsApp via the dry-run log.

test("signs in with an email OTP", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/login");
  await page.getByRole("tab", { name: /email/i }).click();
  await page.getByLabel("Email address").fill(email);
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "Send code" }).click();

  await fillOtp(page, await emailOtp(email));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page).toHaveURL(/\/account/);
});

test("signs in with a WhatsApp OTP", async ({ page }) => {
  const phone = uniquePhone();
  await page.goto("/login");
  await page.getByLabel("WhatsApp number").fill(phone);
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "Send code" }).click();

  await fillOtp(page, await whatsappOtp(phone));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page).toHaveURL(/\/account/);
});
