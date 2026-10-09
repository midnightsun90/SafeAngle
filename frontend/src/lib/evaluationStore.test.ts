import assert from "node:assert/strict";
import test from "node:test";
import { addEvaluation, createDashboardState, updateEvaluation, readDashboardState, fileIdentity, mergeStoredPeople, mergeStoredAssessments, postureInputRows } from "./evaluationStore.ts";

test("새 대상자를 추가하면 기존 대상자의 답변을 보존한다", () => {
  const first = addEvaluation(createDashboardState("민서"), "김하늘", "first");
  const answered = updateEvaluation(first, "first", (item) => ({
    ...item,
    answers: { ...item.answers, 1: { force: "light" } },
  }));
  const second = addEvaluation(answered, "이서준", "second");

  assert.equal(second.activeId, "second");
  assert.deepEqual(second.evaluations.find((item) => item.id === "first")?.answers[1], { force: "light" });
  assert.deepEqual(second.evaluations.find((item) => item.id === "second")?.answers[1], {});
});

test("저장한 평가를 다시 읽으면 이름, 답변, 진행 경로가 남는다", () => {
  const state = updateEvaluation(addEvaluation(createDashboardState("민서"), "김하늘", "first"), "first", (item) => ({
    ...item,
    lastPath: "/questions/1/2",
    answers: { ...item.answers, 1: { load: "5" } },
  }));
  const restored = readDashboardState(JSON.stringify(state));

  assert.equal(restored?.evaluatorName, "민서");
  assert.equal(restored?.evaluations[0].lastPath, "/questions/1/2");
  assert.equal(restored?.evaluations[0].answers[1].load, "5");
});

test("새 평가는 영상 1에서 시작하고 예전 회사 입력은 복원하지 않는다", () => {
  const state = addEvaluation(createDashboardState("민서"), "김하늘", "first");
  assert.equal(state.evaluations[0].lastPath, "/upload/1");
  const legacy = JSON.parse(JSON.stringify(state));
  legacy.evaluations[0].lastPath = "/evaluation";
  legacy.evaluations[0].work = { company: "예전 회사", worksite: "예전 사업장", task: "예전 작업" };
  const restored = readDashboardState(JSON.stringify(legacy));
  assert.equal(restored?.evaluations[0].lastPath, "/upload/1");
  assert.equal("work" in (restored?.evaluations[0] ?? {}), false);
});

test("손상된 브라우저 저장값은 사용하지 않는다", () => {
  assert.equal(readDashboardState("{"), null);
  assert.equal(readDashboardState(JSON.stringify({ evaluatorName: "A", evaluations: "bad" })), null);
});

test("이름이 같은 다른 영상은 이전 영상과 구별한다", () => {
  assert.notEqual(fileIdentity({ name: "work.mp4", size: 100, lastModified: 1 }),
    fileIdentity({ name: "work.mp4", size: 200, lastModified: 1 }));
});

test("건너뛴 작업은 다른 평가 대상자에게 적용되지 않는다", () => {
  const first = addEvaluation(createDashboardState("민서"), "김하늘", "first");
  const skipped = updateEvaluation(first, "first", (item) => ({ ...item,
    skipped: { ...item.skipped, 2: true },
  }));
  const second = addEvaluation(skipped, "이서준", "second");

  assert.equal(second.evaluations.find((item) => item.id === "first")?.skipped[2], true);
  assert.equal(second.evaluations.find((item) => item.id === "second")?.skipped[2], false);
});

test("DB 대상자 목록을 복원하면서 이 브라우저의 기존 답변을 보존한다", () => {
  const local = updateEvaluation(addEvaluation(createDashboardState("관리자"), "이전 이름", "first"), "first", (item) => ({
    ...item, answers: { ...item.answers, 1: { load: "5" } },
  }));
  const merged = mergeStoredPeople(local, "DB 관리자", [
    { id: "second", name: "새 대상자", created_at: "2026-10-09T02:00:00Z" },
    { id: "first", name: "DB 이름", created_at: "2026-10-09T01:00:00Z" },
  ]);
  assert.equal(merged.evaluatorName, "DB 관리자");
  assert.deepEqual(merged.evaluations.map((item) => item.name), ["새 대상자", "DB 이름"]);
  assert.equal(merged.evaluations[1].answers[1].load, "5");
});

test("추천 장면 확인 상태는 대상자별로 보존하고 예전 저장값은 미확인으로 읽는다", () => {
  const first = updateEvaluation(addEvaluation(createDashboardState("관리자"), "A", "first"), "first", (item) => ({
    ...item, lastPath: "/confirmation", confirmedScenes: { ...item.confirmedScenes, 1: true },
  }));
  const second = addEvaluation(first, "B", "second");
  const restored = readDashboardState(JSON.stringify(second));
  assert.equal(restored?.evaluations.find((item) => item.id === "first")?.confirmedScenes[1], true);
  assert.equal(restored?.evaluations.find((item) => item.id === "second")?.confirmedScenes[1], false);
  const legacy = JSON.parse(JSON.stringify(first));
  delete legacy.evaluations[0].confirmedScenes;
  assert.deepEqual(readDashboardState(JSON.stringify(legacy))?.evaluations[0].confirmedScenes, { 1: false, 2: false, 3: false });
});

test("DB 평가와 자세별 답변을 대상자에 복원한다", () => {
  const state = addEvaluation(createDashboardState("관리자"), "김하늘", "person-1");
  const restored = mergeStoredAssessments(state,
    [{ id: "assessment-1", person_id: "person-1", created_at: "2026-10-09T01:00:00Z" }],
    [{ assessment_id: "assessment-1", posture_type: "lift_transfer", is_skipped: false,
      selected_time_seconds: 12.5, answers: { q2_1: "under_5" } },
    { assessment_id: "assessment-1", posture_type: "seated_handwork", is_skipped: true,
      selected_time_seconds: null, answers: {} }]);
  assert.equal(restored.evaluations[0].assessmentId, "assessment-1");
  assert.equal(restored.evaluations[0].selectedTimes[1], 12.5);
  assert.deepEqual(restored.evaluations[0].answers[1], { q2_1: "under_5" });
  assert.equal(restored.evaluations[0].skipped[2], true);
});

test("건너뛴 자세의 장면과 답변은 DB로 보내지 않는다", () => {
  const state = updateEvaluation(addEvaluation(createDashboardState("관리자"), "김하늘", "person-1", "assessment-1"), "person-1", (item) => ({
    ...item,
    skipped: { ...item.skipped, 1: true },
    selectedTimes: { ...item.selectedTimes, 1: 12 },
    answers: { ...item.answers, 1: { q2_1: "under_5" } },
  }));
  const rows = postureInputRows(state.evaluations[0], "manager-1");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].posture_type, "lift_transfer");
  assert.equal(rows[0].selected_time_seconds, null);
  assert.deepEqual(rows[0].answers, {});
  assert.equal(rows[0].manager_id, "manager-1");
});

test("DB 저장을 기다리는 로컬 답변은 새로고침 후에도 보존한다", () => {
  const local = updateEvaluation(addEvaluation(createDashboardState("관리자"), "김하늘", "person-1", "assessment-1"), "person-1", (item) => ({
    ...item, answers: { ...item.answers, 1: { q2_1: "over_10" } },
  }));
  const restored = mergeStoredAssessments(local,
    [{ id: "assessment-1", person_id: "person-1", created_at: "2026-10-09T01:00:00Z" }],
    [{ assessment_id: "assessment-1", posture_type: "lift_transfer", is_skipped: false,
      selected_time_seconds: null, answers: { q2_1: "under_5" } }],
    new Set(["assessment-1"]));
  assert.equal(restored.evaluations[0].answers[1].q2_1, "over_10");
});
