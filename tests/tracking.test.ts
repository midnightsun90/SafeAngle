import assert from "node:assert/strict";
import test from "node:test";
import { analyzePoses } from "../lib/engine.ts";
import { pose, changePoint } from "./fixtures.ts";
const size = { width: 1000, height: 1000 };
test("landmarks are preserved, inputs are not mutated", () => {
  const frames = [pose(0), changePoint(pose(0.1), 11, { x: 0.51 }), pose(0.2)];
  const before = structuredClone(frames);
  const result = analyzePoses(frames, size);
  assert.deepEqual(frames, before);
  assert.deepEqual(result.frames[1]!.landmarks, frames[1]!.landmarks);
  assert.equal(result.status, "ready");
  assert.equal(result.frames[1]!.jointStatus[11], "reliable");
});
test("occlusion and multiple people never become valid angles", () => {
  const frames = [pose(0), changePoint(pose(0.1), 11, { visibility: 0.1 }),
    { ...pose(0.2), personCount: 2 }, pose(0.3)];
  const result = analyzePoses(frames, size);
  assert.equal(result.frames[1]!.jointStatus[11], "occluded");
  assert.equal(result.frames[1]!.angles, null);
  assert.ok(result.frames[2]!.reasons.includes("multiple_people"));
  assert.equal(result.status, "partial");
  assert.equal(result.frames[1]!.measurements.left.knee.value, 0);
  assert.equal(result.frames[1]!.measurements.left.trunk.value, null);
});
test("invalid timeline and empty inputs", () => {
  assert.throws(() => analyzePoses([pose(), pose()], size));
  assert.throws(() => analyzePoses([pose()], size, { policy: { minVisibility: NaN } }));
  assert.equal(analyzePoses([], size).status, "retake");
});
