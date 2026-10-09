-- The evaluation now starts with video upload; company and work fields are no longer collected.
alter table public.assessments
  drop column if exists company_name,
  drop column if exists workplace,
  drop column if exists work_process,
  drop column if exists work_name;

comment on column public.assessment_videos.posture_type is '화면 1-1~1-3 촬영 자세';
comment on column public.assessment_videos.original_filename is '화면 1-1~1-3 원본 영상 파일명';
comment on column public.assessment_videos.duration_seconds is '화면 1-1~1-3 영상 길이(초)';
comment on column public.assessment_posture_inputs.is_skipped is '화면 1-1~1-3 해당 작업 건너뛰기';
comment on column public.assessment_posture_inputs.selected_time_seconds is '화면 2-1~2-3 선택 장면 시각(초)';
