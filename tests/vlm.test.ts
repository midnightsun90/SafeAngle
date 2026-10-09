import test from "node:test";
import assert from "node:assert/strict";
import { parseCapture, parsePoints, parseVlmRequest, sameCapture, VlmError } from "../lib/vlm/validation.ts";
import { VLM_JOINTS, type VlmEvidence, type VlmPoints, type VlmRequest } from "../lib/vlm/contract.ts";
import { proposeJoints } from "../lib/vlm/openai.ts";
import { sceneFromVlm } from "../lib/vlm/measure.ts";
import { confirmed, emptyAnswers, scorePostureScene } from "../lib/reba/score.ts";
import type { AnswerValues } from "../lib/reba/types.ts";
import { createVisionServer, jpegSize } from "../server/vision.ts";

const points:VlmPoints={ear:{x:.5,y:.15},shoulder:{x:.5,y:.25},elbow:{x:.5,y:.4},wrist:{x:.7,y:.4},index_mcp:{x:.75,y:.4},hip:{x:.5,y:.5},knee:{x:.5,y:.65},ankle:{x:.5,y:.8}};
// SOF header fixture only, never used as a real API image.
const jpeg="data:image/jpeg;base64,"+Buffer.from([255,216,255,192,0,8,8,0,10,0,10,1,255,217]).toString("base64");
function request():VlmRequest{return {schemaVersion:"safeangle-joints-v1",requestId:"test-request",capture:{scene:{videoId:"test-video",frameIndex:1,timeSec:2,side:"left"},revision:1,imageSize:{width:10,height:10},facing:1},imageDataUrl:jpeg,consent:{granted:true,noticeVersion:"representative-frame-v1"}};}
function evidence():VlmEvidence{const r=request();return {requestId:r.requestId,imageDataUrl:jpeg,capture:r.capture,provenance:{provider:"openai",model:"gpt-6.1-sol",promptVersion:"test",responseId:"resp-test",elapsedMs:1},originalPoints:structuredClone(points),reviewedPoints:structuredClone(points),confirmedBy:"human"};}
const goodFetch:typeof fetch=async()=>new Response(JSON.stringify({status:"completed",id:"resp-test",model:"gpt-6.1-sol",output:[{content:[{type:"output_text",text:JSON.stringify(points)}]}]}));
test("VLM requests bind side/direction/frame and require exact fields and consent",()=>{
  assert.deepEqual(parseVlmRequest(request()),request());
  assert.throws(()=>parseVlmRequest({...request(),model:"other"}));
  assert.throws(()=>parseVlmRequest({...request(),consent:{granted:false,noticeVersion:"representative-frame-v1"}}),/동의/);
  assert.throws(()=>parseCapture({...request().capture,facing:0}));
  const changed=structuredClone(request().capture);changed.scene.side="right";assert.equal(sameCapture(request().capture,changed),false);
  changed.scene.side="left";changed.revision++;assert.equal(sameCapture(request().capture,changed),false);
});
test("VLM missing points remain null, extra keys, NaN and out-of-frame values are rejected",()=>{
  assert.equal(parsePoints({...points,wrist:null}).wrist,null);
  for(const invalid of [{...points,other:null},{...points,ear:{x:NaN,y:.2}},{...points,ear:{x:1.1,y:.2}},{...points,ear:{x:.2,y:.2,visibility:1}}])assert.throws(()=>parsePoints(invalid));
});
test("human-reviewed coordinates use geometry without fabricated visibility or 33 landmarks",()=>{
  const input=evidence(),scene=sceneFromVlm(input);
  assert.equal(scene.measurements!.trunk.value,0);assert.equal(scene.measurements!.lowerArm.value,90);
  assert.equal(scene.measurements!.knee.value,0);assert.equal(scene.measurements!.lowerArm.minVisibility,null);
  assert.equal(scene.evidence!.reviewedPoints.shoulder!.x,.5);
  input.reviewedPoints.wrist=null;
  const partial=sceneFromVlm(input);assert.equal(partial.measurements!.lowerArm.value,null);assert.equal(partial.measurements!.wrist.value,null);assert.equal(partial.measurements!.knee.value,0);
  for(const joint of VLM_JOINTS)input.reviewedPoints[joint]=null;
  assert.equal(sceneFromVlm(input).availability.state,"unavailable");
});
test("same human-confirmed coordinates and inputs reproduce REBA, edits and missing fields are tracked",()=>{
  const input=evidence(),scene=sceneFromVlm(input),answers=emptyAnswers(scene.key);
  assert.equal(scorePostureScene(scene,answers).final,null);
  const values:AnswerValues={neckBase:1,trunkUpright:true,trunkBase:1,kneeExtra:0,upperArmBase:1,lowerArmBase:1,wristBase:1,neckTwist:false,neckSideBend:false,trunkTwist:false,trunkSideBend:false,legs:"bilateral",unstable:false,armAbducted:false,shoulderRaised:false,armSupported:false,wristDeviated:false,wristTwisted:false,loadKg:0,shock:false,coupling:"good",staticMinutes:0,repeatsPerMinute:0,repetitionIsWalking:false,rapidChange:false};
  for(const [name,value] of Object.entries(values))Object.assign(answers.fields,{[name]:confirmed(value,true)});
  const result=scorePostureScene(scene,answers);assert.equal(result.final,1);assert.equal(result.parts.lowerArm.source,"vlm");assert.deepEqual(result.evidence!.originalPoints,points);
  input.reviewedPoints.elbow={x:.7,y:.25};const edited=scorePostureScene(sceneFromVlm(input),answers);assert.equal(edited.parts.upperArm.base,3);assert.notDeepEqual(edited.evidence!.reviewedPoints,result.evidence!.reviewedPoints);
  assert.throws(()=>scorePostureScene({...scene,availability:{state:"ready",source:"pose",reasons:[]}},answers),/사람 확인/);
  const mismatch=structuredClone(answers);mismatch.scene.side="right";assert.throws(()=>scorePostureScene(scene,mismatch),/다른/);
  const pending=scorePostureScene({...scene,availability:{state:"pending",source:"human",reasons:["검토 중"]}},answers);assert.equal(pending.status,"pending");assert.equal(pending.final,null);
});
test("GPT request fixes side, original detail and strict coordinates; only completed valid output accepted",async()=>{
  let body:any;
  const fetcher:typeof fetch=async(url,init)=>{assert.equal(url,"https://api.openai.com/v1/responses");body=JSON.parse(String(init!.body));return goodFetch(url,init);};
  const r=await proposeJoints(request(),{apiKey:"test-key-not-real",fetcher});
  assert.equal(r.capture.scene.side,"left");assert.equal(r.points.elbow!.x,.5);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.input[0].content[1].detail,"original");assert.match(body.input[0].content[0].text,/ANATOMICAL left/);
  for(const [payload,code] of [[{status:"incomplete"},"incomplete"],[{status:"completed",output:[{content:[{type:"refusal"}]}]},"refused"],[{status:"completed",id:"r",model:"gpt-6.1-sol",output:[{content:[{type:"output_text",text:"{}"}]}]},"invalid_output"]] as const){
    await assert.rejects(proposeJoints(request(),{apiKey:"test-key",fetcher:async()=>new Response(JSON.stringify(payload))}),e=>e instanceof VlmError&&e.code===code);
  }
  await assert.rejects(proposeJoints(request(),{apiKey:""}),/키/);
  await assert.rejects(proposeJoints(request(),{apiKey:"test-key",fetcher:async()=>new Response("",{status:429})}),e=>e instanceof VlmError&&e.code==="rate_limited");
});
test("API checks CORS, JPEG size, missing configuration and returns only safe errors",async()=>{
  const server=createVisionServer({apiKey:"",allowedOrigins:["http://localhost:3000"]});await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();assert.ok(address&&typeof address==="object");const url=`http://127.0.0.1:${address.port}/api/vision`;
  try{
    assert.deepEqual(jpegSize(jpeg),{width:10,height:10});
    assert.equal((await fetch(url,{method:"POST"})).status,403);
    const headers={Origin:"http://localhost:3000","Content-Type":"application/json"};
    const sizeMismatch=request();sizeMismatch.capture.imageSize.width=11;
    assert.equal((await fetch(url,{method:"POST",headers,body:JSON.stringify(sizeMismatch)})).status,400);
    const response=await fetch(url,{method:"POST",headers,body:JSON.stringify(request())});assert.equal(response.status,503);assert.equal(response.headers.get("access-control-allow-origin"),headers.Origin);
    const error=await response.json();assert.equal(error.error.code,"not_configured");assert.ok(!JSON.stringify(error).includes("Authorization"));
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
