import { expect, test } from "@playwright/test";
import { razorpayTestKeys } from "./env";
import { inStockProduct, stubRazorpayCheckout, uniqueEmail, uniquePhone, waitForTurnstile } from "./helpers";

// browse → add to cart → guest checkout → Razorpay test payment → order confirmed → invoice
// downloadable (AGENTS.md §8).
const rzp = razorpayTestKeys();

test.skip(!rzp, "Set Razorpay test keys (rzp_test_…) in .env.local or the shell to run checkout e2e.");

test("guest buys a product and downloads the tax invoice", async ({ page }) => {
  const product = await inStockProduct();
  await stubRazorpayCheckout(page, rzp!.keySecret);

  // Browse
  await page.goto("/");
  await page.goto(`/products/${product.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Add to cart (creates the lazy guest session)
  await page.getByRole("group", { name: "Size" }).getByText(product.size, { exact: true }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("dialog", { name: "Your cart" })).toBeVisible();
  await page.getByRole("dialog").getByRole("link", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);

  // Contact
  const contact = page.getByRole("region", { name: "Contact" });
  await contact.getByLabel("Email").fill(uniqueEmail());
  await contact.getByLabel("Mobile number").fill(uniquePhone());
  await contact.getByRole("button", { name: "Continue" }).click();

  // Address (Kerala → CGST + SGST)
  const address = page.getByRole("region", { name: "Delivery address" });
  await address.getByLabel("Full name").fill("E2E Buyer");
  await address.getByLabel("Mobile number").fill(uniquePhone());
  await address.getByLabel("House / flat, building, street").fill("12 MG Road");
  await address.getByLabel("City / town").fill("Kochi");
  await address.getByLabel("PIN code").fill("682016");
  await address.getByRole("combobox", { name: "State" }).click();
  await page.getByRole("option", { name: "Kerala" }).click();
  await address.getByRole("button", { name: "Deliver here" }).click();

  // Review & pay
  const pay = page.getByRole("button", { name: /^Pay ₹/ });
  await expect(pay).toBeEnabled();
  await waitForTurnstile(page);
  await pay.click();

  // Confirmation: the webhook confirms the order and issues the invoice.
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByText(/Tax invoice INV\/\d{2}-\d{2}\/\d{5}/)).toBeVisible({ timeout: 30_000 });

  const invoice = page.getByRole("link", { name: "Download invoice" });
  const res = await page.request.get((await invoice.getAttribute("href"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
});
