-- Slice 5: ratings + reputation.
--
-- After a transaction reaches 'completed', each party may leave one
-- rating of the other. Ratings are immutable and publicly visible —
-- the public reputation signal is the whole point. profiles.rating_avg
-- and profiles.rating_count are kept fresh via an after-insert trigger.

-- =====================================================================
-- 1. Ratings table
-- =====================================================================

create table public.ratings (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references public.transactions(id) on delete restrict,
  rater_id        uuid not null references public.profiles(id) on delete restrict,
  ratee_id        uuid not null references public.profiles(id) on delete restrict,
  stars           smallint not null check (stars between 1 and 5),
  tags            text[] not null default array[]::text[],
  comment         text,
  created_at      timestamptz not null default now(),
  unique (transaction_id, rater_id),
  constraint ratings_parties_distinct check (rater_id <> ratee_id)
);

create index ratings_ratee_idx on public.ratings (ratee_id);

-- =====================================================================
-- 2. RLS
-- =====================================================================

alter table public.ratings enable row level security;

-- All ratings are visible to all authenticated users — public reputation.
create policy ratings_select_public on public.ratings
  for select
  to authenticated
  using (true);

-- Only the rater can insert, only for completed transactions they are
-- a party to, and the ratee must be the OTHER party.
create policy ratings_insert_own on public.ratings
  for insert
  to authenticated
  with check (
    rater_id = (select auth.uid())
    and exists (
      select 1 from public.transactions t
      where t.id = ratings.transaction_id
        and t.status = 'completed'
        and ((select auth.uid()) = t.initiator_id
             or (select auth.uid()) = t.counterparty_id)
        and ratings.ratee_id = case
          when (select auth.uid()) = t.initiator_id then t.counterparty_id
          else t.initiator_id
        end
    )
  );

-- No UPDATE / DELETE — ratings are permanent.

-- =====================================================================
-- 3. Aggregate maintenance: keep profiles.rating_avg + rating_count
--    in sync with the ratings table.
-- =====================================================================

create or replace function public.refresh_profile_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
     set rating_avg = (
           select round(avg(stars)::numeric, 2)
             from public.ratings
            where ratee_id = new.ratee_id
         ),
         rating_count = (
           select count(*) from public.ratings where ratee_id = new.ratee_id
         )
   where p.id = new.ratee_id;
  return new;
end;
$$;

create trigger ratings_refresh_aggregate
  after insert on public.ratings
  for each row
  execute function public.refresh_profile_rating();

revoke execute on function public.refresh_profile_rating() from public;
revoke execute on function public.refresh_profile_rating() from anon;
revoke execute on function public.refresh_profile_rating() from authenticated;

-- =====================================================================
-- 4. Realtime
-- =====================================================================

alter publication supabase_realtime add table public.ratings;
