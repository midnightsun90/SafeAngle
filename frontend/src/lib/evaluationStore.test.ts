import assert from "node:assert/strict";
import test from "node:test";
import { addEvaluation, createDashboardState, updateEvaluation, readDashboardState, fileIdentity } from "./evaluationStore.ts";

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
    work: { company: "예시", worksite: "조립", task: "포장" },
    answers: { ...item.answers, 1: { load: "5" } },
  }));
  const restored = readDashboardState(JSON.stringify(state));

  assert.equal(restored?.evaluatorName, "민서");
  assert.equal(restored?.evaluations[0].lastPath, "/questions/1/2");
  assert.equal(restored?.evaluations[0].work.company, "예시");
  assert.equal(restored?.evaluations[0].answers[1].load, "5");
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
