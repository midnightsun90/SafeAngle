import assert from "node:assert/strict";
import test from "node:test";
import { chooseView, measureFrame } from "../lib/engine.ts";
import { changePoint, pose } from "./fixtures.ts";
import type { QualityReason } from "../lib/types.ts";

const SIZE = { width: 1000, height: 1000 };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test("known neutral geometry and elbow flexion", () => {
  const result = measureFrame(pose(), SIZE, "left", 1);
  assert.equal(result.usable, true);
  assert.deepEqual(result.angles, { trunk:0,neck:0,knee:0,upperArm:0,lowerArm:90,wrist:0 });
});

test("mirror and non-square images preserve physical geometry", () => {
  const original = pose();
  const flipped = { ...original, landmarks: original.landmarks.map(point => ({ ...point, x: 1 - point.x })) };
  assert.deepEqual(measureFrame(flipped, SIZE, "left", -1).angles, measureFrame(original, SIZE, "left", 1).angles);
  for (const size of [{ width:1000,height:1400 }, { width:1600,height:1000 }]) {
    const result = measureFrame(pose(0, size), size, "left", 1);
    assert.equal(result.usable, true);
    near(result.angles!.lowerArm, 90);
    near(result.angles!.knee, 0);
  }
});

test("signed trunk and calibrated neck", () => {
  const frame = changePoint(pose(), 11, { x:0.625, y:0.5 - Math.sqrt(3) * 0.125 });
  near(measureFrame(frame, SIZE, "left", 1).angles!.trunk, 30);
  const neutral = measureFrame(pose(), SIZE, "left", 1, { neckNeutralOffsetDeg: 10 });
  near(neutral.angles!.neck, -10);
});

for (const degrees of [-45,90,180,200]) test(`upper arm ${degrees} degrees retains flexion beyond vertical`, () => {
  const theta = degrees * Math.PI / 180;
  let frame = pose();
  for (const [index, distance] of [[13,100],[15,180],[19,220]] as const) {
    frame = changePoint(frame, index, { x:0.5 + distance * Math.sin(theta) / 1000, y:0.25 + distance * Math.cos(theta) / 1000 });
  }
  const result = measureFrame(frame, SIZE, "left", 1);
  assert.equal(result.usable, true);
  near(result.angles!.upperArm, degrees);
});

const failures: [QualityReason, () => ReturnType<typeof pose>][] = [
  ["no_person", () => ({ timeSec:0,landmarks:[] })],
  ["invalid_landmarks", () => ({ timeSec:0,landmarks:pose().landmarks.slice(1) })],
  ["invalid_landmarks", () => changePoint(pose(), 7, { x:NaN })],
  ["occluded", () => changePoint(pose(), 7, { visibility:0.49 })],
  ["out_of_frame", () => changePoint(pose(), 27, { y:0.99 })],
  ["not_side_view", () => changePoint(pose(), 24, { x:0.9, visibility:1 })],
  ["too_far", () => ({ timeSec:0, landmarks:pose().landmarks.map(point => ({ ...point, x:0.5 + (point.x-0.5)*0.1,y:0.5+(point.y-0.5)*0.1 })) })],
  ["invalid_geometry", () => changePoint(pose(), 7, { x:0.5,y:0.25 })],
];
for (const [reason, make] of failures) test(`unusable ${reason} has no angles`, () => {
  const result = measureFrame(make(), SIZE, "left", 1);
  assert.equal(result.usable, false);
  assert.equal(result.angles, null);
  assert.ok(result.reasons.includes(reason));
});

test("weak index does not fabricate a wrist measurement", () => {
  const result = measureFrame(changePoint(pose(), 19, { visibility:0.1 }), SIZE, "left", 1);
  assert.equal(result.usable, true);
  assert.equal(result.wristReliable, false);
  assert.equal(result.angles!.wrist, null);
});

test("orientation is stable across a sequence and unresolved feet require manual direction", () => {
  assert.deepEqual(chooseView([pose(),pose(0.2)]), { side:"left",facing:1 });
  const noDirection = changePoint(pose(),31,{ x:pose().landmarks[29]!.x });
  assert.deepEqual(chooseView([noDirection]), { side:"left",facing:null });
  assert.ok(measureFrame(noDirection,SIZE,"left",null).reasons.includes("unknown_direction"));
  assert.equal(measureFrame(noDirection,SIZE,"left",1).usable,true);
  assert.throws(() => measureFrame(pose(), { width:0,height:1000 }, "left",1));
});
