-- SafeAngle core: one manager owns many people; each person has many assessments.
-- Names are display data, never an authorization credential.

create table public.managers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.managers (id),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (id, manager_id)
);

create index people_manager_id_idx on public.people (manager_id);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.managers (id),
  person_id uuid not null,
  workplace text,
  work_process text,
  work_name text,
  status text not null default 'draft'
    check (status in ('draft', 'analyzing', 'needs_review', 'completed')),
  answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(answers) = 'object'),
  measurements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(measurements) = 'object'),
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  reba_score smallint check (reba_score between 1 and 15),
  schema_version integer not null default 1 check (schema_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (person_id, manager_id)
    references public.people (id, manager_id),
  unique (id, manager_id),
  check (status <> 'completed' or (result is not null and reba_score is not null))
);

create index assessments_person_created_idx
  on public.assessments (person_id, created_at desc);
create index assessments_manager_created_idx
  on public.assessments (manager_id, created_at desc);

create function public.touch_assessment_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger assessments_set_updated_at
before update on public.assessments
for each row execute function public.touch_assessment_updated_at();

create table public.assessment_videos (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null,
  assessment_id uuid not null,
  posture_type text not null
    check (posture_type in ('lift_transfer', 'seated_handwork', 'push_pull')),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  foreign key (assessment_id, manager_id)
    references public.assessments (id, manager_id),
  unique (assessment_id, posture_type),
  check (starts_with(
    storage_path,
    manager_id::text || '/' || assessment_id::text || '/'
  ))
);

create index assessment_videos_assessment_id_idx
  on public.assessment_videos (assessment_id);

alter table public.managers enable row level security;
alter table public.people enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_videos enable row level security;

revoke all on public.managers, public.people, public.assessments,
  public.assessment_videos from anon, authenticated;
grant select, insert, update, delete on public.managers, public.people,
  public.assessments, public.assessment_videos to authenticated;

create policy "Managers read their profile"
  on public.managers for select to authenticated
  using (id = (select auth.uid()));
create policy "Managers create their profile"
  on public.managers for insert to authenticated
  with check (id = (select auth.uid()));
create policy "Managers update their profile"
  on public.managers for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy "Managers delete their profile"
  on public.managers for delete to authenticated
  using (id = (select auth.uid()));

create policy "Managers read their people"
  on public.people for select to authenticated
  using (manager_id = (select auth.uid()));
create policy "Managers create their people"
  on public.people for insert to authenticated
  with check (manager_id = (select auth.uid()));
create policy "Managers update their people"
  on public.people for update to authenticated
  using (manager_id = (select auth.uid()))
  with check (manager_id = (select auth.uid()));
create policy "Managers delete their people"
  on public.people for delete to authenticated
  using (manager_id = (select auth.uid()));

create policy "Managers read their assessments"
  on public.assessments for select to authenticated
  using (manager_id = (select auth.uid()));
create policy "Managers create their assessments"
  on public.assessments for insert to authenticated
  with check (manager_id = (select auth.uid()));
create policy "Managers update their assessments"
  on public.assessments for update to authenticated
  using (manager_id = (select auth.uid()))
  with check (manager_id = (select auth.uid()));
create policy "Managers delete their assessments"
  on public.assessments for delete to authenticated
  using (manager_id = (select auth.uid()));

create policy "Managers read their assessment videos"
  on public.assessment_videos for select to authenticated
  using (manager_id = (select auth.uid()));
create policy "Managers create their assessment videos"
  on public.assessment_videos for insert to authenticated
  with check (manager_id = (select auth.uid()));
create policy "Managers update their assessment videos"
  on public.assessment_videos for update to authenticated
  using (manager_id = (select auth.uid()))
  with check (manager_id = (select auth.uid()));
create policy "Managers delete their assessment videos"
  on public.assessment_videos for delete to authenticated
  using (manager_id = (select auth.uid()));

-- Create the private assessment-videos bucket with the Storage API or dashboard.
-- The first path segment is the manager's Auth user ID.
create policy "Managers read their stored videos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'assessment-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy "Managers upload their stored videos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assessment-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy "Managers replace their stored videos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'assessment-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'assessment-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy "Managers delete their stored videos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'assessment-videos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Some new projects include this unused SECURITY DEFINER helper in public.
-- It does not need to be callable through the Data API.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
