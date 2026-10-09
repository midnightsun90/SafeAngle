import assert from "node:assert/strict";
import test from "node:test";
import { MAX_VIDEO_BYTES, storagePathForVideo, validateVideoFile } from "./videoStorage.ts";

test("영상은 50MB까지 받고 초과하거나 빈 파일은 거절한다", () => {
  assert.equal(validateVideoFile({ name: "work.mp4", type: "video/mp4", size: MAX_VIDEO_BYTES }), null);
  assert.match(validateVideoFile({ name: "work.mp4", type: "video/mp4", size: MAX_VIDEO_BYTES + 1 }) ?? "", /50MB/);
  assert.match(validateVideoFile({ name: "work.mp4", type: "video/mp4", size: 0 }) ?? "", /비어/);
  assert.match(validateVideoFile({ name: "work.txt", type: "text/plain", size: 1 }) ?? "", /영상/);
});

test("저장 위치는 관리자와 평가 폴더 안에 자세별 고유 이름을 사용한다", () => {
  const path = storagePathForVideo("manager-id", "assessment-id", "lift_transfer", "work.mov");
  assert.match(path, /^manager-id\/assessment-id\/lift_transfer-[0-9a-f-]+\.mov$/);
  assert.notEqual(path, storagePathForVideo("manager-id", "assessment-id", "lift_transfer", "work.mov"));
});
