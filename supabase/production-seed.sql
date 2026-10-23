-- Reference data the store needs in every environment: tax slabs, shipping zones and the policy pages.
-- Run once on production after `supabase db push`; locally, `supabase db reset` loads it before seed.sql
-- (config.toml [db.seed]). Idempotent: safe to run more than once, never overwrites edited rows.
-- States and the store_settings row come from the migrations.

-- ---------------------------------------------------------------------------
-- Tax slabs
-- TODO(owner): CA to confirm the HSN list and rates. Seeded from the apparel rules effective
-- 22 Sep 2025: 5% up to ₹2,500 per piece, 18% above.
-- ---------------------------------------------------------------------------
insert into public.tax_slabs (hsn_code, min_unit_paise, max_unit_paise, rate_bps, effective_from)
select hsn, 0, 250000, 500, date '2025-09-22' from unnest(array['6104', '6204', '6206', '6211', '6214']) as hsn
where not exists (select 1 from public.tax_slabs t where t.hsn_code = hsn and t.min_unit_paise = 0);

insert into public.tax_slabs (hsn_code, min_unit_paise, max_unit_paise, rate_bps, effective_from)
select hsn, 250000, null, 1800, date '2025-09-22' from unnest(array['6104', '6204', '6206', '6211', '6214']) as hsn
where not exists (select 1 from public.tax_slabs t where t.hsn_code = hsn and t.min_unit_paise = 250000);

-- ---------------------------------------------------------------------------
-- Shipping zones
-- TODO(owner): confirm courier rates and the free-shipping threshold.
-- ---------------------------------------------------------------------------
insert into public.shipping_zones (name, state_codes, base_paise, base_weight_grams, per_additional_500g_paise, free_above_paise)
values
  ('Kerala', array['32'], 5000, 500, 3000, 149900),
  ('Rest of India',
   (select array_agg(code order by code) from public.indian_states where code <> '32'),
   8000, 500, 4000, 149900)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Policy and content pages
-- TODO(owner): replace every body with the final legal text (DPDP Act 2023, Consumer Protection
-- (E-Commerce) Rules 2020) before launch. Phase 1 has no page editor: update public.pages.body in the
-- Supabase SQL editor. supabase/snippets/launch-check.sql flags bodies that still say TODO.
-- ---------------------------------------------------------------------------
insert into public.pages (slug, title, body, is_published) values
  ('about', 'About Us', 'TODO(owner): brand story.', true),
  ('contact', 'Contact Us', 'TODO(owner): contact details are also shown from store settings.', true),
  ('privacy-policy', 'Privacy Policy', 'TODO(owner): DPDP Act 2023 compliant privacy policy.', true),
  ('terms', 'Terms & Conditions', 'TODO(owner): terms of sale and use.', true),
  ('shipping-policy', 'Shipping Policy', 'TODO(owner): dispatch times, couriers, shipping charges.', true),
  ('return-refund-policy', 'Return & Refund Policy', 'TODO(owner): return window, conditions, refund timelines.', true)
on conflict (slug) do nothing;
