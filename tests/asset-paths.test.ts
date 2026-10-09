import test from "node:test";
import assert from "node:assert/strict";
import { assetPaths } from "../lib/pose/video.ts";
test("same local model paths support root and GitHub Pages base path",()=>{
  assert.deepEqual(assetPaths(),{modelPath:"/models/pose_landmarker_full.task",wasmPath:"/wasm"});
  assert.deepEqual(assetPaths("/SafeAngle/"),{modelPath:"/SafeAngle/models/pose_landmarker_full.task",wasmPath:"/SafeAngle/wasm"});
  for(const invalid of ["https://remote.example","//remote.example","/../secret","/path?query"] )assert.throws(()=>assetPaths(invalid));
});
