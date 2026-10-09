-- v6 screens 2-4: one row for each of the three postures in an assessment.
-- Analysis measurements, scores, and reports remain in the existing assessment fields.
alter table public.assessments
  add column company_name text;

create table public.assessment_posture_inputs (
  assessment_id uuid not null,
  manager_id uuid not null,
  posture_type text not null
    check (posture_type in ('lift_transfer', 'seated_handwork', 'push_pull')),
  is_skipped boolean not null default false,
  selected_time_seconds numeric check (selected_time_seconds >= 0),
  answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(answers) = 'object'),
  question_schema_version integer not null default 1
    check (question_schema_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (assessment_id, posture_type),
  foreign key (assessment_id, manager_id)
    references public.assessments (id, manager_id) on delete cascade,
  check (not is_skipped or
    (selected_time_seconds is null and answers = '{}'::jsonb))
);

create index assessment_posture_inputs_manager_idx
  on public.assessment_posture_inputs (manager_id, assessment_id);

create trigger assessment_posture_inputs_set_updated_at
before update on public.assessment_posture_inputs
for each row execute function public.touch_assessment_updated_at();

alter table public.assessment_posture_inputs enable row level security;
revoke all on public.assessment_posture_inputs from anon, authenticated;
grant select, insert, update, delete on public.assessment_posture_inputs to authenticated;

create policy "Managers read their posture inputs"
  on public.assessment_posture_inputs for select to authenticated
  using (manager_id = (select auth.uid()));
create policy "Managers create their posture inputs"
  on public.assessment_posture_inputs for insert to authenticated
  with check (manager_id = (select auth.uid()));
create policy "Managers update their posture inputs"
  on public.assessment_posture_inputs for update to authenticated
  using (manager_id = (select auth.uid()))
  with check (manager_id = (select auth.uid()));
create policy "Managers delete their posture inputs"
  on public.assessment_posture_inputs for delete to authenticated
  using (manager_id = (select auth.uid()));

-- v6 screen 2 displays the original file name and length for each uploaded video.
alter table public.assessment_videos
  add column original_filename text,
  add column duration_seconds numeric check (duration_seconds >= 0);

comment on column public.assessments.company_name is 'v6 1-1 회사명';
comment on column public.assessments.workplace is 'v6 1-2 사업장·작업 위치';
comment on column public.assessments.work_name is 'v6 1-3 공정·작업명';
comment on column public.assessment_videos.posture_type is 'v6 2-1~2-3 촬영 자세';
comment on column public.assessment_videos.original_filename is 'v6 2-1~2-3 원본 영상 파일명';
comment on column public.assessment_videos.duration_seconds is 'v6 2-1~2-3 영상 길이(초)';
comment on column public.assessment_posture_inputs.is_skipped is 'v6 2-1~2-3 해당 작업 건너뛰기';
comment on column public.assessment_posture_inputs.selected_time_seconds is 'v6 3-1~3-3 선택 장면 시각(초)';
comment on column public.assessment_posture_inputs.answers is 'v6 Q2-1, Q2-2, Q3, Q4-1, Q4-2 자세별 답변';
