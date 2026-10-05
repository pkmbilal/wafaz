# ROADMAP — Features by Phase

The current phase is set at the top of `AGENTS.md`. Only build features for that phase.

Legend: **[MIN]** = required to finish the phase. **[OPT]** = build only once that phase is approved.

**Out of scope for every phase unless the owner changes it:** Cash on Delivery, SMS OTP, password login, social login, e-invoicing (IRN), international shipping, dark theme.

---

## Phase 1 — Minimal Launchable Store

### Catalog
- [MIN] Nested categories
- [MIN] Products with variants (size × colour): SKU, MRP, selling price (GST-inclusive), stock, **weight in grams**
- [MIN] Product attributes: fabric, style, occasion, care instructions, HSN code, **country of origin** (default India)
- [MIN] Product images, ordered, each optionally linked to a colour. The gallery switches when a colour is selected.
- [MIN] Tags (used for search and later for rule-based collections)
- [MIN] Manual collections (New Arrivals, Best Sellers, etc.)
- [MIN] Size charts linked to products
- [MIN] Product status: draft / active / archived (archived products are never deleted)

### Storefront
- [MIN] Home page: static announcement bar, hero banners, category grid, New Arrivals, Best Sellers
- [MIN] Collection page: filters (size, colour, fabric, price range), sort, pagination
- [MIN] Product card: image, title, price, MRP strike-through, % off, NEW / SALE / Sold out badges
- [MIN] Product page: gallery, colour swatches, size selector with per-size stock state, size chart, description, country of origin, add to cart
- [MIN] Search: Postgres full-text plus `pg_trgm` for typo tolerance (e.g. "kurthi" finds "kurti"), across title, tags and fabric
- [MIN] Header, mobile menu, mobile bottom nav
- [MIN] Cart drawer (sheet) plus a full cart page

### Auth and account
- [MIN] Anonymous sign-in on first cart action (Turnstile captcha)
- [MIN] Login with **WhatsApp OTP** (Send SMS Hook → Meta authentication template) or **email OTP** (6-digit code)
- [MIN] Guest-to-account upgrade and merge (see `AGENTS.md` §5.3)
- [MIN] Account: profile, saved addresses, order history, order detail
- [MIN] Guest order view through a signed link sent in the confirmation email

### Cart and checkout
- [MIN] Server-side cart (one per `auth.uid()`)
- [MIN] Checkout: contact (email + phone), address, shipping charge, coupon, order summary with GST shown as included
- [MIN] Coupons: percentage or flat, minimum cart value, start/end dates, global limit, per-user limit, first-order-only
- [MIN] Razorpay prepaid checkout (UPI, cards, netbanking, wallets)
- [MIN] 30-minute stock reservation, auto-expiry, late-payment handling
- [MIN] Order confirmation page with a "confirming payment" state until the webhook arrives

### Shipping
- [MIN] Shipping zones by state (Kerala / rest of India), priced by weight per 500 g, with a free-shipping threshold
- [MIN] Admin books the parcel offline with DTDC or India Post, then enters the courier and tracking number and marks the order shipped
- [MIN] Tracking link per courier in the shipped email and on the order page
- [MIN] Admin marks orders delivered, or returned to origin (RTO), which restocks the items

### GST and documents
- [MIN] `store_settings` for legal name, GSTIN, address, state code, invoice and credit-note prefixes, tax slab basis, shipping tax rate, grievance officer details
- [MIN] GST-inclusive back-calculation with CGST/SGST (Kerala) or IGST (other states)
- [MIN] Gapless tax invoice numbering per financial year, issued when payment is captured
- [MIN] Credit notes for every refund
- [MIN] PDFs rendered on demand: tax invoice, credit note, packing slip, shipping address label

### Admin
- [MIN] Dashboard: today's orders and revenue, low stock, **Needs attention** panel
- [MIN] Product CRUD: variant matrix generator, R2 image upload, colour tagging of images
- [MIN] Category, collection, tag, size chart and banner management
- [MIN] Orders: list with filters by the three statuses, detail view, timeline, status actions
- [MIN] Refunds: full or per-item partial via the Razorpay Refunds API, which creates a credit note automatically
- [MIN] Coupon management
- [MIN] Store settings screen
- [MIN] Roles: owner and staff (staff cannot edit settings or issue refunds)

### Notifications
- [MIN] Emails: order confirmed, shipped (with tracking), delivered, cancelled, refunded (with credit note)
- [MIN] Admin email when an order lands in "Needs attention"

### Legal, content and SEO
- [MIN] Pages: About, Contact (seller legal name, address, phone, email), Privacy Policy (DPDP Act 2023), Terms, Shipping Policy, Return & Refund Policy, **Grievance Officer** (name, contact, response timeline)
- [MIN] Footer shows seller details and links to the policies (Consumer Protection (E-Commerce) Rules 2020)
- [MIN] Marketing consent checkbox, separate from transactional messages and unticked by default
- [MIN] Account deletion request from the account page (handled by admin; orders and invoices are kept for tax records)
- [MIN] Per-page metadata, Product JSON-LD, sitemap.xml, robots.txt, canonical URLs
- [MIN] Floating WhatsApp chat link

### Engineering
- [MIN] Sentry, rate limiting, Turnstile
- [MIN] Test suite from `AGENTS.md` §8
- [MIN] Seed data: categories, 20 sample products, tax slabs, shipping zones, store settings

**Phase 1 is done when:** a guest or logged-in customer can buy with Razorpay, gets a correct GST invoice and emails, and the owner can ship, refund and track everything from admin, with all Phase 1 tests passing.

---

## Phase 2 — Conversion and Trust

- [OPT] Wishlist
- [OPT] Reviews with ratings and photos (verified-purchase flag, admin moderation, photos in a private bucket until approved)
- [OPT] Quick view modal
- [OPT] Rule-based collections (price, colour, tag, fabric)
- [OPT] Mega menu: Shop by Style / Material / Price / Colour
- [OPT] Automatic sitewide discounts (no code), shown in the announcement bar
- [OPT] Delivery estimate by pincode (static rules per zone)
- [OPT] WhatsApp order notifications (confirmed, shipped, delivered) using approved utility templates
- [OPT] Abandoned cart reminders by email or WhatsApp (pg_cron, only with marketing consent)
- [OPT] Recently viewed products, "You may also like"
- [OPT] Newsletter signup
- [OPT] Homepage section editor
- [OPT] Optional customer GSTIN at checkout for B2B invoices

## Phase 3 — Post-Purchase and Operations

- [OPT] Self-service return and exchange requests (reason, photos, admin approval)
- [OPT] Exchange with size swap and stock adjustment (credit note plus new invoice)
- [OPT] Bulk product import/export via CSV
- [OPT] Finer-grained staff permissions
- [OPT] Reports: sales by period, top products, return rate by product, GST summary for filing (by HSN and rate, B2C state-wise)
- [OPT] Courier automation: DTDC direct API or Shiprocket (automatic tracking number, label, tracking webhooks)
- [OPT] Automatic tracking sync that updates fulfillment status
- [OPT] Public order tracking page (order number + phone/email)

## Phase 4 — Retention and Growth

- [OPT] Loyalty points (append-only ledger, earned on paid orders, redeemable at checkout; GST treatment to be confirmed with the CA)
- [OPT] Referral program
- [OPT] Gift cards (GST treatment to be confirmed with the CA)
- [OPT] Shop the Look
- [OPT] Shoppable video reels
- [OPT] Blog
- [OPT] Testimonials
- [OPT] Customer segments and targeted coupons
- [OPT] PWA support
