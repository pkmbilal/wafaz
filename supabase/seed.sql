-- Dev seed data: tax slabs, shipping zones, categories, size chart, tags, collections,
-- 20 sample products with variants and placeholder media, banners and policy pages.
-- Idempotent: safe to run more than once. Images use `seed/…` keys served from public/seed/.

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
-- Categories
-- ---------------------------------------------------------------------------
insert into public.categories (name, slug, sort_order, image_key) values
  ('Kurtis', 'kurtis', 1, 'seed/placeholder-01.webp'),
  ('Kurti Sets', 'kurti-sets', 2, 'seed/placeholder-02.webp'),
  ('Co-ords', 'co-ords', 3, 'seed/placeholder-03.webp'),
  ('Kaftans', 'kaftans', 4, 'seed/placeholder-04.webp'),
  ('Dupattas', 'dupattas', 5, 'seed/placeholder-05.webp')
on conflict (slug) do nothing;

insert into public.categories (parent_id, name, slug, sort_order)
select (select id from public.categories where slug = 'kurtis'), name, slug, sort_order
from (values
  ('Straight Kurtis', 'straight-kurtis', 1),
  ('A-line Kurtis', 'a-line-kurtis', 2),
  ('Anarkali Kurtis', 'anarkali-kurtis', 3)
) as c (name, slug, sort_order)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Size chart
-- ---------------------------------------------------------------------------
insert into public.size_charts (name, data) values (
  'Women''s standard',
  '{
    "unit": "in",
    "columns": ["Size", "Bust", "Waist", "Hip", "Length"],
    "rows": [
      ["XS", 32, 26, 35, 44],
      ["S", 34, 28, 37, 44],
      ["M", 36, 30, 39, 45],
      ["L", 38, 32, 41, 45],
      ["XL", 40, 34, 43, 46],
      ["XXL", 42, 36, 45, 46]
    ],
    "note": "Garment measurements. If you are between sizes, choose the larger size."
  }'::jsonb
) on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------
insert into public.tags (name, slug) values
  ('Cotton', 'cotton'),
  ('Rayon', 'rayon'),
  ('Silk Blend', 'silk-blend'),
  ('Georgette', 'georgette'),
  ('Linen', 'linen'),
  ('Block Print', 'block-print'),
  ('Embroidered', 'embroidered'),
  ('Festive', 'festive'),
  ('Office Wear', 'office-wear'),
  ('Casual', 'casual'),
  ('Summer', 'summer'),
  ('Onam', 'onam')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Collections
-- ---------------------------------------------------------------------------
insert into public.collections (title, slug, description) values
  ('New Arrivals', 'new-arrivals', 'Fresh styles, just in.'),
  ('Best Sellers', 'best-sellers', 'The pieces our customers love most.')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Products, variants, media, tags, collection membership
-- ---------------------------------------------------------------------------
create temporary table seed_products (
  n int,
  slug text,
  title text,
  category_slug text,
  fabric text,
  style text,
  occasion text,
  hsn text,
  price_rupees int,
  mrp_rupees int,
  weight_grams int,
  colour1 text, hex1 text,
  colour2 text, hex2 text,
  tags text[],
  collections text[]
);

insert into seed_products values
  (1,  'indigo-block-print-straight-kurti', 'Indigo Block Print Straight Kurti', 'straight-kurtis', 'Cotton', 'Straight', 'Casual', '6211', 899, 1299, 250, 'Indigo', '#2E3A6E', 'Ivory', '#F4EEDC', array['cotton','block-print','casual','summer'], array['new-arrivals','best-sellers']),
  (2,  'mustard-floral-a-line-kurti', 'Mustard Floral A-line Kurti', 'a-line-kurtis', 'Rayon', 'A-line', 'Casual', '6211', 799, 1199, 230, 'Mustard', '#D4A017', 'Teal', '#1F7A7A', array['rayon','casual'], array['best-sellers']),
  (3,  'maroon-anarkali-kurti', 'Maroon Embroidered Anarkali Kurti', 'anarkali-kurtis', 'Georgette', 'Anarkali', 'Festive', '6211', 2499, 3499, 420, 'Maroon', '#7B1E2B', 'Emerald', '#1E6B4F', array['georgette','embroidered','festive'], array['new-arrivals']),
  (4,  'kasavu-straight-kurti', 'Kasavu Border Straight Kurti', 'straight-kurtis', 'Cotton', 'Straight', 'Festive', '6211', 1299, 1599, 260, 'Off White', '#F3EBD8', 'Gold', '#C9A227', array['cotton','festive','onam'], array['new-arrivals','best-sellers']),
  (5,  'sage-linen-a-line-kurti', 'Sage Linen A-line Kurti', 'a-line-kurtis', 'Linen', 'A-line', 'Office', '6211', 1499, 1899, 280, 'Sage', '#9CAF88', 'Sky Blue', '#87AFC7', array['linen','office-wear','summer'], array['new-arrivals']),
  (6,  'rose-silk-anarkali-kurti', 'Rose Silk Blend Anarkali Kurti', 'anarkali-kurtis', 'Silk Blend', 'Anarkali', 'Wedding', '6211', 2999, 3999, 480, 'Rose', '#C9677F', 'Wine', '#5E1A2F', array['silk-blend','embroidered','festive'], array['best-sellers']),
  (7,  'black-chikankari-kurti', 'Black Chikankari Straight Kurti', 'straight-kurtis', 'Cotton', 'Straight', 'Office', '6211', 1199, 1499, 240, 'Black', '#1C1C1C', 'White', '#FAFAFA', array['cotton','embroidered','office-wear'], array['best-sellers']),
  (8,  'peach-printed-kurti-set', 'Peach Printed Kurti Set with Dupatta', 'kurti-sets', 'Cotton', 'Straight', 'Casual', '6204', 1699, 2299, 520, 'Peach', '#F2B8A0', 'Lilac', '#B9A2D0', array['cotton','casual','summer'], array['new-arrivals','best-sellers']),
  (9,  'green-silk-kurti-set', 'Bottle Green Silk Blend Kurti Set', 'kurti-sets', 'Silk Blend', 'Straight', 'Festive', '6204', 2699, 3499, 600, 'Bottle Green', '#0F4D3A', 'Royal Blue', '#2A4B9B', array['silk-blend','festive'], array['new-arrivals']),
  (10, 'red-anarkali-kurti-set', 'Red Anarkali Kurti Set', 'kurti-sets', 'Georgette', 'Anarkali', 'Wedding', '6204', 3499, 4999, 700, 'Red', '#B3202A', 'Magenta', '#A1206B', array['georgette','embroidered','festive'], array['best-sellers']),
  (11, 'yellow-cotton-kurti-set', 'Haldi Yellow Cotton Kurti Set', 'kurti-sets', 'Cotton', 'A-line', 'Festive', '6204', 1899, 2499, 540, 'Yellow', '#E8B923', 'Orange', '#E0702B', array['cotton','festive','onam'], array['new-arrivals']),
  (12, 'blue-linen-co-ord-set', 'Powder Blue Linen Co-ord Set', 'co-ords', 'Linen', 'Co-ord', 'Casual', '6204', 2199, 2799, 500, 'Powder Blue', '#A7C4DE', 'Beige', '#D9C7A7', array['linen','casual','summer'], array['new-arrivals','best-sellers']),
  (13, 'terracotta-rayon-co-ord', 'Terracotta Rayon Co-ord Set', 'co-ords', 'Rayon', 'Co-ord', 'Casual', '6204', 1599, 2199, 450, 'Terracotta', '#C0603B', 'Olive', '#6B7234', array['rayon','casual'], array['best-sellers']),
  (14, 'black-silk-co-ord', 'Black Silk Blend Co-ord Set', 'co-ords', 'Silk Blend', 'Co-ord', 'Party', '6204', 2899, 3599, 480, 'Black', '#1C1C1C', 'Champagne', '#E5D3B3', array['silk-blend','festive'], array['new-arrivals']),
  (15, 'ikat-print-kaftan', 'Ikat Print Cotton Kaftan', 'kaftans', 'Cotton', 'Kaftan', 'Lounge', '6204', 1099, 1499, 300, 'Navy', '#1F2A44', 'Rust', '#A4502A', array['cotton','casual','summer'], array['new-arrivals','best-sellers']),
  (16, 'floral-georgette-kaftan', 'Floral Georgette Kaftan', 'kaftans', 'Georgette', 'Kaftan', 'Resort', '6204', 1399, 1899, 280, 'Coral', '#E8735A', 'Mint', '#A8D5BA', array['georgette','summer'], array['best-sellers']),
  (17, 'gold-zari-kaftan', 'Gold Zari Festive Kaftan', 'kaftans', 'Silk Blend', 'Kaftan', 'Festive', '6204', 2599, 3299, 350, 'Purple', '#5B2A86', 'Teal', '#1F7A7A', array['silk-blend','festive','embroidered'], array['new-arrivals']),
  (18, 'bandhani-dupatta', 'Bandhani Georgette Dupatta', 'dupattas', 'Georgette', 'Dupatta', 'Festive', '6214', 699, 999, 150, 'Red', '#B3202A', 'Pink', '#E37BA0', array['georgette','festive'], array['best-sellers']),
  (19, 'kasavu-cotton-dupatta', 'Kasavu Cotton Dupatta', 'dupattas', 'Cotton', 'Dupatta', 'Festive', '6214', 599, 799, 140, 'Off White', '#F3EBD8', 'Gold', '#C9A227', array['cotton','onam','festive'], array['new-arrivals']),
  (20, 'pastel-mulmul-kurti', 'Pastel Mulmul Straight Kurti', 'straight-kurtis', 'Cotton', 'Straight', 'Casual', '6211', 699, 999, 200, 'Powder Pink', '#F4C6CF', 'Lemon', '#F3E58B', array['cotton','casual','summer'], array['new-arrivals']);

insert into public.products (
  category_id, title, slug, description, fabric, style, occasion, care, hsn_code,
  size_chart_id, status, seo_title, seo_description
)
select
  c.id,
  sp.title,
  sp.slug,
  sp.title || ' in breathable ' || lower(sp.fabric) || '. Designed for everyday comfort with a flattering '
    || lower(sp.style) || ' silhouette. Sample product for development.',
  sp.fabric,
  sp.style,
  sp.occasion,
  case when sp.fabric in ('Silk Blend', 'Georgette') then 'Dry clean only.' else 'Gentle hand wash in cold water. Dry in shade.' end,
  sp.hsn,
  case when sp.category_slug = 'dupattas' then null else (select id from public.size_charts where name = 'Women''s standard') end,
  -- product 20 stays draft so the RLS hiding of drafts is visible in dev
  case when sp.n = 20 then 'draft' else 'active' end,
  sp.title,
  'Shop the ' || sp.title || ' online. Free shipping above ₹1,499.'
from seed_products sp
join public.categories c on c.slug = sp.category_slug
on conflict (slug) do nothing;

insert into public.product_variants (
  product_id, sku, size, colour, colour_hex, mrp_paise, price_paise, weight_grams, stock
)
select
  p.id,
  upper(format('WF-%s-%s-%s', lpad(sp.n::text, 3, '0'), left(regexp_replace(col.colour, '[^A-Za-z]', '', 'g'), 4), replace(sz.size, ' ', ''))),
  sz.size,
  col.colour,
  col.hex,
  sp.mrp_rupees::bigint * 100,
  sp.price_rupees::bigint * 100,
  sp.weight_grams,
  -- deterministic stock 0..11, so some sizes show as sold out
  abs(hashtext(sp.slug || col.colour || sz.size)) % 12
from seed_products sp
join public.products p on p.slug = sp.slug
cross join lateral (values (sp.colour1, sp.hex1, 1), (sp.colour2, sp.hex2, 2)) as col (colour, hex, ord)
cross join lateral (
  select unnest(case when sp.category_slug = 'dupattas'
                     then array['Free Size']
                     else array['XS', 'S', 'M', 'L', 'XL', 'XXL'] end) as size
) as sz
on conflict (sku) do nothing;

insert into public.product_media (product_id, colour, r2_key, alt, sort_order)
select
  p.id,
  col.colour,
  format('seed/placeholder-%s.webp', lpad((((sp.n * 2 + col.ord + img.i) % 10) + 1)::text, 2, '0')),
  format('%s in %s, view %s', sp.title, lower(col.colour), img.i),
  (col.ord - 1) * 10 + img.i
from seed_products sp
join public.products p on p.slug = sp.slug
cross join lateral (values (sp.colour1, 1), (sp.colour2, 2)) as col (colour, ord)
cross join generate_series(1, 2) as img (i)
where not exists (select 1 from public.product_media m where m.product_id = p.id);

insert into public.product_tags (product_id, tag_id)
select p.id, t.id
from seed_products sp
join public.products p on p.slug = sp.slug
cross join unnest(sp.tags) as tag_slug
join public.tags t on t.slug = tag_slug
on conflict do nothing;

insert into public.collection_products (collection_id, product_id, sort_order)
select c.id, p.id, sp.n
from seed_products sp
join public.products p on p.slug = sp.slug
cross join unnest(sp.collections) as collection_slug
join public.collections c on c.slug = collection_slug
on conflict do nothing;

drop table seed_products;

-- ---------------------------------------------------------------------------
-- Banners
-- ---------------------------------------------------------------------------
insert into public.banners (title, image_key, link, sort_order)
select * from (values
  ('Festive Edit — Onam 2026', 'seed/banner-01.webp', '/collections/new-arrivals', 1),
  ('Everyday Cotton Kurtis', 'seed/banner-02.webp', '/collections/best-sellers', 2)
) as b (title, image_key, link, sort_order)
where not exists (select 1 from public.banners);

-- ---------------------------------------------------------------------------
-- Policy and content pages
-- TODO(owner): replace every body with the final legal text (DPDP Act 2023, Consumer Protection
-- (E-Commerce) Rules 2020) before launch.
-- ---------------------------------------------------------------------------
insert into public.pages (slug, title, body, is_published) values
  ('about', 'About Us', 'TODO(owner): brand story.', true),
  ('contact', 'Contact Us', 'TODO(owner): contact details are also shown from store settings.', true),
  ('privacy-policy', 'Privacy Policy', 'TODO(owner): DPDP Act 2023 compliant privacy policy.', true),
  ('terms', 'Terms & Conditions', 'TODO(owner): terms of sale and use.', true),
  ('shipping-policy', 'Shipping Policy', 'TODO(owner): dispatch times, couriers, shipping charges.', true),
  ('return-refund-policy', 'Return & Refund Policy', 'TODO(owner): return window, conditions, refund timelines.', true),
  ('grievance-officer', 'Grievance Officer', 'TODO(owner): grievance officer name, contact and response timeline.', true)
on conflict (slug) do nothing;
