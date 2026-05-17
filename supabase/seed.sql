-- öz: idempotent demo data. Safe to re-run.
-- Apply via the Supabase SQL editor (db push does not run seed against remote).

-- 4 demo phone users. Phone numbers 77001000001..77001000004.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  phone,
  phone_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
values
  ('a0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '77001000001', now(), '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', ''),
  ('a0000002-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '77001000002', now(), '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', ''),
  ('a0000003-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '77001000003', now(), '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', ''),
  ('a0000004-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '77001000004', now(), '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- Profiles are auto-created by handle_new_user. Fill in display names.
update public.profiles set display_name = 'Айжан'   where id = 'a0000001-0000-0000-0000-000000000001';
update public.profiles set display_name = 'Даулет'  where id = 'a0000002-0000-0000-0000-000000000002';
update public.profiles set display_name = 'Альмира' where id = 'a0000003-0000-0000-0000-000000000003';
update public.profiles set display_name = 'Бекзат'  where id = 'a0000004-0000-0000-0000-000000000004';

-- 8 demo listings.
insert into public.listings (
  id, user_id, direction, amount, amount_currency, rate, min_match_amount, status, note
)
values
  ('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'kzt_to_krw',  500000.00, 'KZT', 2.620000, null,      'active', 'Сеул, могу встретиться у Itaewon'),
  ('b0000002-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'krw_to_kzt', 1200000.00, 'KRW', null,     null,      'active', 'По рынку, быстрая сделка'),
  ('b0000003-0000-0000-0000-000000000003', 'a0000002-0000-0000-0000-000000000002', 'kzt_to_krw', 1000000.00, 'KZT', 2.650000, 250000.00, 'active', 'Ансан, банковский перевод'),
  ('b0000004-0000-0000-0000-000000000004', 'a0000002-0000-0000-0000-000000000002', 'krw_to_kzt',  500000.00, 'KRW', 0.385000, null,      'active', null),
  ('b0000005-0000-0000-0000-000000000005', 'a0000003-0000-0000-0000-000000000003', 'kzt_to_krw',  250000.00, 'KZT', null,     null,      'active', 'Только наличными'),
  ('b0000006-0000-0000-0000-000000000006', 'a0000003-0000-0000-0000-000000000003', 'krw_to_kzt',  800000.00, 'KRW', 0.380000, 100000.00, 'active', 'Готов к частичной сделке'),
  ('b0000007-0000-0000-0000-000000000007', 'a0000004-0000-0000-0000-000000000004', 'kzt_to_krw', 2000000.00, 'KZT', 2.600000, 500000.00, 'active', 'Опт, договариваемся в чате'),
  ('b0000008-0000-0000-0000-000000000008', 'a0000004-0000-0000-0000-000000000004', 'krw_to_kzt',  300000.00, 'KRW', 0.390000, null,      'active', 'Пусан')
on conflict (id) do nothing;
