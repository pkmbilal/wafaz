import { expect, test, type Page } from "@playwright/test";
import { emailOtp, fillOtp, inStockProduct, uniqueEmail, waitForTurnstile } from "./helpers";

// Email + password accounts (AGENTS.md §8): sign-up confirmed by an emailed code (local Mailpit),
// password sign-in, password reset, and a guest's cart carried into the new account.

const PASSWORD = "kurti-2026-pass";

async function signUp(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Asha Nair");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password", { exact: true }).fill(PASSWORD);
  await waitForTurnstile(page);
  const sentAfter = new Date(Date.now() - 1000);
  await page.getByRole("button", { name: "Continue" }).click();

  await fillOtp(page, await emailOtp(email, sentAfter));
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account/);
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function signOut(page: Page) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("signs up with an emailed code, then signs back in with the password", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await expect(page.getByLabel("Full name")).toHaveValue("Asha Nair");

  await signOut(page);
  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/account/);
});

test("rejects a wrong password without revealing the account", async ({ page }) => {
  await signIn(page, uniqueEmail(), "not-the-password");
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("resets a forgotten password with an emailed code", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await signOut(page);

  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
  await page.getByLabel("Email address").fill(email);
  await waitForTurnstile(page);
  const sentAfter = new Date(Date.now() - 1000);
  await page.getByRole("button", { name: "Send code" }).click();
  await fillOtp(page, await emailOtp(email, sentAfter));
  await page.getByRole("button", { name: "Continue" }).click();

  const newPassword = "new-kurti-2026";
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Save password and sign in" }).click();
  await expect(page).toHaveURL(/\/account/);

  await signOut(page);
  await signIn(page, email, newPassword);
  await expect(page).toHaveURL(/\/account/);
});

test("keeps a guest's cart when they create an account", async ({ page }) => {
  const product = await inStockProduct();
  await page.goto(`/products/${product.slug}`);
  await page.getByRole("group", { name: "Size" }).getByText(product.size, { exact: true }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("dialog", { name: "Your cart" })).toBeVisible();

  await signUp(page, uniqueEmail());

  await page.goto("/cart");
  await expect(page.getByRole("region", { name: "Order summary" })).toBeVisible();
  await expect(page.getByText("Your cart is empty")).toHaveCount(0);
});
