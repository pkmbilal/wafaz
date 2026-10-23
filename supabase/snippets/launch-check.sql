-- Pre-launch check (read-only). Paste into the Supabase SQL editor on production and run.
-- Every row should say ok = true before the go-live test order.

select check_name, ok, detail from (
  select 1 as sort, 'pg_cron jobs active' as check_name,
    count(*) filter (where active) = 3 as ok,
    string_agg(jobname || case when active then '' else ' (inactive)' end, ', ' order by jobname) as detail
  from cron.job
  where jobname in ('expire-pending-orders', 'stale-anonymous-users-cleanup', 'rate-limits-cleanup')

  union all
  select 2, 'store_settings: legal details filled in',
    legal_name not like 'TODO%' and address_line1 not like 'TODO%'
      and support_email not like '%example.com' and support_phone <> '+910000000000',
    format('%s, %s, %s, %s', legal_name, address_line1, support_email, support_phone)
  from public.store_settings

  union all
  select 3, 'store_settings: GSTIN set', gstin is not null, coalesce(gstin, 'empty')
  from public.store_settings

  union all
  select 4, 'store_settings: shipping tax rate set (CA)', shipping_tax_rate_bps is not null,
    format('basis %s, shipping %s bps', tax_slab_basis, coalesce(shipping_tax_rate_bps::text, 'empty'))
  from public.store_settings

  union all
  select 5, 'tax slabs present', count(*) > 0, count(*) || ' rows'
  from public.tax_slabs

  union all
  select 6, 'shipping zones present', count(*) > 0, count(*) || ' rows'
  from public.shipping_zones

  union all
  select 7, 'policy pages have final text', count(*) filter (where body like '%TODO%') = 0,
    coalesce(string_agg(slug, ', ') filter (where body like '%TODO%'), 'all done')
  from public.pages

  union all
  select 8, 'owner account exists', count(*) > 0, count(*) || ' owner(s)'
  from public.profiles where role = 'owner'

  union all
  select 9, 'no dev sample data', count(*) = 0,
    count(*) || ' product image(s) still using seed/ placeholders'
  from public.product_media where r2_key like 'seed/%'

  union all
  select 10, 'no dev test coupons', count(*) = 0, coalesce(string_agg(code, ', '), 'none')
  from public.coupons where code in ('WELCOME10', 'FLAT200')
) checks
order by sort;
