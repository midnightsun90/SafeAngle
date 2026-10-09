-- Entering the same evaluator name shares all records under that name.
-- A name is not a secret: anyone who knows it can access those records.
create table public.evaluator_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name_key text not null check (char_length(name_key) between 1 and 100)
);
alter table public.evaluator_sessions enable row level security;
revoke all on public.evaluator_sessions from anon, authenticated;

create schema if not exists private;
grant usage on schema private to authenticated;

create function private.can_access_evaluator(p_manager_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.evaluator_sessions s
    join public.managers m on lower(btrim(m.name)) = s.name_key
    where s.user_id = (select auth.uid()) and m.id = p_manager_id
  );
$$;

create function private.can_access_evaluator_path(p_manager_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.evaluator_sessions s
    join public.managers m on lower(btrim(m.name)) = s.name_key
    where s.user_id = (select auth.uid()) and m.id::text = p_manager_id
  );
$$;
revoke all on function private.can_access_evaluator(uuid), private.can_access_evaluator_path(text) from public, anon;
grant execute on function private.can_access_evaluator(uuid), private.can_access_evaluator_path(text) to authenticated;

create function public.enter_evaluator(p_name text)
returns table(manager_id uuid, evaluator_name text, manager_ids uuid[])
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(p_name);
  v_manager_id uuid;
begin
  if v_uid is null then raise exception 'Sign in before entering an evaluator name'; end if;
  if v_name is null or char_length(v_name) not between 1 and 100 then
    raise exception 'Evaluator name must be 1 to 100 characters';
  end if;
  select m.id into v_manager_id from public.managers m
    where lower(btrim(m.name)) = lower(v_name)
    order by case when m.id = v_uid then 0 else 1 end, m.created_at, m.id limit 1;
  if v_manager_id is null then
    insert into public.managers(id, name) values (v_uid, v_name) returning id into v_manager_id;
  end if;
  insert into public.evaluator_sessions(user_id, name_key)
    values (v_uid, lower(v_name))
    on conflict (user_id) do update set name_key = excluded.name_key;
  return query select v_manager_id, m.name,
    array(select all_m.id from public.managers all_m
      where lower(btrim(all_m.name)) = lower(v_name) order by all_m.created_at, all_m.id)
    from public.managers m where m.id = v_manager_id;
end;
$$;

create function public.current_evaluator()
returns table(manager_id uuid, evaluator_name text, manager_ids uuid[])
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
begin
  if v_uid is null then return; end if;
  select m.name into v_name from public.evaluator_sessions s
    join public.managers m on lower(btrim(m.name)) = s.name_key
    where s.user_id = v_uid order by case when m.id = v_uid then 0 else 1 end, m.created_at, m.id limit 1;
  if v_name is null then
    select m.name into v_name from public.managers m where m.id = v_uid;
  end if;
  if v_name is not null then return query select * from public.enter_evaluator(v_name); end if;
end;
$$;
revoke all on function public.enter_evaluator(text), public.current_evaluator() from public, anon;
grant execute on function public.enter_evaluator(text), public.current_evaluator() to authenticated;

create policy "Same-name evaluators read profiles" on public.managers
  for select to authenticated using ((select private.can_access_evaluator(id)));

do $$
declare t text;
begin
  foreach t in array array[
    'people', 'assessments', 'assessment_videos', 'assessment_posture_inputs',
    'assessment_analysis_results', 'assessment_pose_results'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('create policy "Same-name evaluators read" on public.%I for select to authenticated using ((select private.can_access_evaluator(manager_id)))', t);
    execute format('create policy "Same-name evaluators create" on public.%I for insert to authenticated with check ((select private.can_access_evaluator(manager_id)))', t);
    execute format('create policy "Same-name evaluators update" on public.%I for update to authenticated using ((select private.can_access_evaluator(manager_id))) with check ((select private.can_access_evaluator(manager_id)))', t);
    execute format('create policy "Same-name evaluators delete" on public.%I for delete to authenticated using ((select private.can_access_evaluator(manager_id)))', t);
  end loop;
end $$;

create policy "Same-name evaluators read videos" on storage.objects
  for select to authenticated using (
    bucket_id = 'assessment-videos' and
    (select private.can_access_evaluator_path((storage.foldername(name))[1]))
  );
create policy "Same-name evaluators upload videos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'assessment-videos' and
    (select private.can_access_evaluator_path((storage.foldername(name))[1]))
  );
create policy "Same-name evaluators replace videos" on storage.objects
  for update to authenticated using (
    bucket_id = 'assessment-videos' and
    (select private.can_access_evaluator_path((storage.foldername(name))[1]))
  ) with check (
    bucket_id = 'assessment-videos' and
    (select private.can_access_evaluator_path((storage.foldername(name))[1]))
  );
create policy "Same-name evaluators delete videos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'assessment-videos' and
    (select private.can_access_evaluator_path((storage.foldername(name))[1]))
  );
