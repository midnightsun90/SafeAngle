-- Keep analysis separate from the team's trimmed assessment identity table.
create table if not exists public.assessment_analysis_results (
  id uuid primary key references public.assessments(id) on delete cascade,
  manager_id uuid not null references public.managers(id) on delete cascade,
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  measurements jsonb not null default '{}'::jsonb check (jsonb_typeof(measurements) = 'object'),
  reba_score smallint check (reba_score between 1 and 15),
  status text not null default 'needs_review' check (status in ('needs_review', 'completed')),
  check (status <> 'completed' or (result is not null and reba_score is not null))
);
alter table public.assessment_analysis_results enable row level security;
grant select, insert, update, delete on public.assessment_analysis_results to authenticated;
create policy analysis_results_owner on public.assessment_analysis_results
for all to authenticated
using (manager_id = (select auth.uid()))
with check (
  manager_id = (select auth.uid())
  and exists (
    select 1 from public.assessments a
    where a.id = assessment_analysis_results.id and a.manager_id = (select auth.uid())
  )
);
