-- =====================================================================
-- Slice 7: display name + avatar
--
-- This migration adds the avatars storage bucket and the
-- update_profile_identity RPC. Avatars are private but readable by any
-- authenticated user (identity signals). Only the owner can write.
-- The RPC writes display_name and avatar_url onto public.profiles after
-- validating both inputs.
-- =====================================================================

-- =====================================================================
-- 1. Private avatars storage bucket
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- =====================================================================
-- 2. Storage RLS on storage.objects for the avatars bucket.
--    Path convention: {user_id}/{ts}.{ext}
--    storage.foldername(name)[1] → '{user_id}'
-- =====================================================================

-- Any authenticated user can read any avatar (identity signal).
drop policy if exists avatars_storage_select on storage.objects;
create policy avatars_storage_select on storage.objects
  for select
  to authenticated
  using (bucket_id = 'avatars');

-- Owner-only INSERT.
drop policy if exists avatars_storage_insert on storage.objects;
create policy avatars_storage_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Owner-only UPDATE.
drop policy if exists avatars_storage_update on storage.objects;
create policy avatars_storage_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Owner-only DELETE.
drop policy if exists avatars_storage_delete on storage.objects;
create policy avatars_storage_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- =====================================================================
-- 3. update_profile_identity RPC
--    Validates and writes display_name and/or avatar_url. Either argument
--    may be null to leave that column unchanged. avatar_path is verified
--    against storage.objects and ownership.
-- =====================================================================

create or replace function public.update_profile_identity(
  p_display_name text,
  p_avatar_path text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  if p_display_name is not null then
    if length(trim(p_display_name)) < 2 or length(p_display_name) > 30 then
      raise exception 'display_name must be 2-30 characters';
    end if;
  end if;

  if p_avatar_path is not null then
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'avatars'
        and name = p_avatar_path
        and (storage.foldername(name))[1] = v_uid::text
    ) then
      raise exception 'avatar file not found or not owned by caller';
    end if;
  end if;

  update public.profiles
     set display_name  = coalesce(trim(p_display_name), display_name),
         avatar_url    = coalesce(p_avatar_path, avatar_url),
         last_active_at = now()
   where id = v_uid
   returning * into v_profile;

  return v_profile;
end;
$$;

revoke execute on function public.update_profile_identity(text, text) from public;
revoke execute on function public.update_profile_identity(text, text) from anon;
grant  execute on function public.update_profile_identity(text, text) to authenticated;
