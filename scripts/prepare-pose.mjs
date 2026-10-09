import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
await cp(new URL("node_modules/@mediapipe/tasks-vision/wasm/", root), new URL("public/wasm/", root), { recursive: true });
const target = new URL("public/models/pose_landmarker_full.task", root);
const source = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const expectedHash = "5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1";
await mkdir(dirname(fileURLToPath(target)), { recursive: true });
let bytes;
try { bytes = await readFile(target); }
catch (error) { if (error.code !== "ENOENT") throw error; }
if (!bytes) {
  const response = await fetch(source, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`모델 다운로드 실패: ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new Error("공식 모델 파일의 SHA256이 일치하지 않습니다.");
  const temporary = new URL(target.href + ".part");
  try { await writeFile(temporary, bytes); await rename(temporary, target); }
  finally { await rm(temporary, { force: true }); }
}
if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new Error("로컬 모델 파일이 손상됐습니다. 파일을 지우고 다시 준비하십시오.");
await mkdir(new URL("frontend/public/models/",root), {recursive:true});
await cp(target,new URL("frontend/public/models/pose_landmarker_full.task",root));
await cp(new URL("public/wasm/",root),new URL("frontend/public/wasm/",root),{recursive:true});
console.log(`MediaPipe full 모델 준비: ${bytes.length} bytes, SHA256 ${createHash("sha256").update(bytes).digest("hex")}`);
