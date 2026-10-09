import assert from "node:assert/strict";
import test from "node:test";
import { waitForLoad, waitForTask } from "../lib/pose/loading.ts";
import { videoTransform } from "../lib/pose/draw.ts";
test("aborted model loading closes a task even when it resolves late",async()=>{
  const controller=new AbortController();let closeCount=0;
  let finish!:(task:{close():void})=>void;
  const task=new Promise<{close():void}>(resolve=>{finish=resolve;});
  const awaited=waitForTask(task,controller.signal);controller.abort();
  await assert.rejects(awaited,{name:"AbortError"});
  finish({close(){closeCount++;}});await Promise.resolve();
  assert.equal(closeCount,1);
});
test("model timeout closes late tasks and successful tasks remain owned by caller",async()=>{
  let closeCount=0,finish!:(task:{close():void})=>void;
  const pending=new Promise<{close():void}>(resolve=>{finish=resolve;});
  await assert.rejects(waitForTask(pending,undefined,5),/시간이 초과/);
  finish({close(){closeCount++;}});await Promise.resolve();assert.equal(closeCount,1);
  const task=await waitForTask(Promise.resolve({close(){closeCount++;}}));assert.equal(closeCount,1);task.close();assert.equal(closeCount,2);
});
test("contain and cover coordinates include the correct aspect-ratio offsets",()=>{
  assert.deepEqual(videoTransform({width:480,height:640},{width:800,height:600}),{width:450,height:600,offsetX:175,offsetY:0});
  assert.deepEqual(videoTransform({width:480,height:640},{width:800,height:600},"cover"),{width:800,height:640*800/480,offsetX:0,offsetY:(600-640*800/480)/2});
  assert.throws(()=>videoTransform({width:0,height:640},{width:800,height:600}));
});
test("SDK and WASM resolving are cancellable and bounded without a disposable task",async()=>{
  assert.equal(await waitForLoad(Promise.resolve(42)),42);
  const never=new Promise<never>(()=>{});
  await assert.rejects(waitForLoad(never,undefined,5),/시간이 초과/);
  const abort=new AbortController();abort.abort();
  await assert.rejects(waitForLoad(never,abort.signal),{name:"AbortError"});
});
