create table public.assessment_pose_results (
  assessment_id uuid not null,
  manager_id uuid not null,
  posture_type text not null check (posture_type in ('lift_transfer', 'seated_handwork', 'push_pull')),
  storage_path text not null,
  time_seconds numeric check (time_seconds >= 0),
  selection_source text not null check (selection_source in ('automatic', 'manual')),
  model_version text not null,
  analyzed_at timestamptz not null,
  measurements jsonb check (measurements is null or jsonb_typeof(measurements) = 'object'),
  quality jsonb not null check (jsonb_typeof(quality) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (assessment_id, posture_type),
  foreign key (assessment_id, manager_id)
    references public.assessments (id, manager_id) on delete cascade,
  check (starts_with(storage_path, manager_id::text || '/' || assessment_id::text || '/'))
);

create index assessment_pose_results_manager_idx
  on public.assessment_pose_results (manager_id, assessment_id);

create trigger assessment_pose_results_set_updated_at
before update on public.assessment_pose_results
for each row execute function public.touch_assessment_updated_at();

alter table public.assessment_pose_results enable row level security;
revoke all on public.assessment_pose_results from anon, authenticated;
grant select, insert, update, delete on public.assessment_pose_results to authenticated;

create policy "Managers read their pose results"
  on public.assessment_pose_results for select to authenticated
  using (manager_id = (select auth.uid()));
create policy "Managers create their pose results"
  on public.assessment_pose_results for insert to authenticated
  with check (manager_id = (select auth.uid()));
create policy "Managers update their pose results"
  on public.assessment_pose_results for update to authenticated
  using (manager_id = (select auth.uid()))
  with check (manager_id = (select auth.uid()));
create policy "Managers delete their pose results"
  on public.assessment_pose_results for delete to authenticated
  using (manager_id = (select auth.uid()));
