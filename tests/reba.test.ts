import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzePoses } from "../lib/analysis.ts";
import { pose } from "./fixtures.ts";
import { activityPoints, actionLevel, confirmed, emptyAnswers, kneeExtra, loadPoints, lowerArmBase, neckBase, sceneFromAnalysis, scoreScene, trunkBase, upperArmBase, wristBase } from "../lib/reba/score.ts";
import { lookupA, lookupB, lookupC, TABLE_A, TABLE_B, TABLE_C } from "../lib/reba/tables.ts";
import type { AnswerValues, RebaAnswers } from "../lib/reba/types.ts";

function fixture() {
  const analysis=analyzePoses([pose(),pose(0.1)],{width:1000,height:1000},{side:"left",facing:1});
  const scene=sceneFromAnalysis(analysis,"fixture-video",0,"left"), answers=emptyAnswers(scene.key);
  const values:AnswerValues={neckBase:1,trunkUpright:true,trunkBase:1,kneeExtra:0,upperArmBase:1,lowerArmBase:1,wristBase:1,
    neckTwist:false,neckSideBend:false,trunkTwist:false,trunkSideBend:false,legs:"bilateral",unstable:false,armAbducted:false,shoulderRaised:false,armSupported:false,wristDeviated:false,wristTwisted:false,loadKg:0,shock:false,coupling:"good",staticMinutes:0,repeatsPerMinute:0,repetitionIsWalking:false,rapidChange:false};
  for(const [name,value] of Object.entries(values))Object.assign(answers.fields,{[name]:confirmed(value,true)});
  return {analysis,scene,answers};
}
test("all 240 table cells match independent markdown rows and row/column direction",()=>{
  const doc=readFileSync(new URL("../docs/evaluation-axes.md",import.meta.url),"utf8");
  function rows(section:string,end:string){return doc.split(section)[1]!.split(end)[0]!.split(/\r?\n/).filter(l=>/^\| \d+ \|/.test(l)).map(l=>l.split("|").slice(1,-1).map(Number).slice(1));}
  const a=rows("### 1-2.","### 1-3."),b=rows("### 1-3.","### 1-4."),c=rows("### 1-4.","## 2.");
  assert.deepEqual(TABLE_A,a);assert.deepEqual(TABLE_B,b);assert.deepEqual(TABLE_C,c);
  let checked=0;
  for(let t=1;t<=5;t++)for(let n=1;n<=3;n++)for(let l=1;l<=4;l++){assert.equal(lookupA(t,n,l),a[t-1]![(n-1)*4+l-1]);checked++;}
  for(let u=1;u<=6;u++)for(let l=1;l<=2;l++)for(let w=1;w<=3;w++){assert.equal(lookupB(u,l,w),b[u-1]![(l-1)*3+w-1]);checked++;}
  for(let x=1;x<=12;x++)for(let y=1;y<=12;y++){assert.equal(lookupC(x,y),c[x-1]![y-1]);checked++;}assert.equal(checked,240);
});
test("author example has A8 B5 C10 activity1 final11, including part evidence",()=>{
  const {scene,answers}=fixture(),m=scene.frame.measurements.left;
  m.trunk.value=70;m.neck.value=-10;m.knee.value=70;m.upperArm.value=60;m.lowerArm.value=40;m.wrist.value=10;
  answers.fields.neckBase=confirmed(2,true);answers.fields.trunkUpright=confirmed(false);
  answers.fields.trunkSideBend=confirmed(true);answers.fields.armAbducted=confirmed(true);answers.fields.armSupported=confirmed(true);
  answers.fields.coupling=confirmed("fair");answers.fields.rapidChange=confirmed(true);
  const r=scoreScene(scene,answers);
  assert.deepEqual(Object.fromEntries(Object.entries(r.parts).map(([k,v])=>[k,v.score])),{neck:2,trunk:5,knee:3,upperArm:3,lowerArm:2,wrist:1});
  assert.deepEqual([r.tableA,r.load,r.scoreA,r.tableB,r.coupling,r.scoreB,r.tableC,r.activity,r.final],[8,0,8,4,1,5,10,1,11]);assert.equal(r.action!.level,4);
});
const edges:[string,(n:number)=>number,number,number,number,number][]=[
  ["neck20",neckBase,20,1,1,2],["neck extension",neckBase,0,2,1,1],
  ["trunk20",trunkBase,20,2,2,3],["trunk60",trunkBase,60,3,3,4],["trunk extension20",trunkBase,-20,3,2,2],
  ["knee30",kneeExtra,30,0,1,1],["knee60",kneeExtra,60,1,1,2],
  ["arm-20",upperArmBase,-20,2,1,1],["arm20",upperArmBase,20,1,1,2],["arm45",upperArmBase,45,2,2,3],["arm90",upperArmBase,90,3,3,4],
  ["elbow60",lowerArmBase,60,2,1,1],["elbow100",lowerArmBase,100,1,1,2],
  ["wrist15",wristBase,15,1,1,2],["load5",loadPoints,5,0,1,1],["load10",loadPoints,10,1,1,2],
];
for(const [name,fn,edge,below,equal,above] of edges)test(`boundary ${name} below/equal/above`,()=>{assert.deepEqual([fn(edge-0.0001),fn(edge),fn(edge+0.0001)],[below,equal,above]);});
test("neutral requires human confirmation, no guessed degree tolerance; overhead arm and actions",()=>{
  const {scene,answers}=fixture();scene.frame.measurements.left.trunk.value=0.1;
  assert.equal(scoreScene(scene,answers).parts.trunk.base,1);
  answers.fields.trunkUpright=confirmed(false);assert.equal(scoreScene(scene,answers).parts.trunk.base,2);
  assert.equal(upperArmBase(180),4);assert.equal(upperArmBase(270),4);
  for(const [score,level] of [[1,0],[2,1],[3,1],[4,2],[7,2],[8,3],[10,3],[11,4],[15,4]])assert.equal(actionLevel(score!).level,level);
});
test("sitting removes knee adjustment; unstable support affects legs and one activity point",()=>{
  const {scene,answers}=fixture();scene.frame.measurements.left.knee.value=100;
  answers.fields.legs=confirmed("sitting");answers.fields.unstable=confirmed(true);answers.fields.rapidChange=confirmed(true);
  const r=scoreScene(scene,answers);assert.equal(r.parts.knee.base,2);assert.equal(r.parts.knee.adjustment,0);assert.equal(r.activity,1);
});
test("twist+side bend are one increment, arm flags separate, support floors only upper arm at one",()=>{
  const {scene,answers}=fixture();
  answers.fields.neckTwist=confirmed(true);answers.fields.neckSideBend=confirmed(true);answers.fields.trunkTwist=confirmed(true);answers.fields.trunkSideBend=confirmed(true);
  answers.fields.wristDeviated=confirmed(true);answers.fields.wristTwisted=confirmed(true);answers.fields.armSupported=confirmed(true);
  let r=scoreScene(scene,answers);assert.equal(r.parts.neck.adjustment,1);assert.equal(r.parts.trunk.adjustment,1);assert.equal(r.parts.wrist.adjustment,1);assert.equal(r.parts.upperArm.score,1);assert.match(r.parts.upperArm.notes.join(),/최소/);
  answers.fields.armAbducted=confirmed(true);answers.fields.shoulderRaised=confirmed(true);r=scoreScene(scene,answers);assert.equal(r.parts.upperArm.score,2);
});
test("activity strictly exceeds one minute/four repeats; walking excluded; rapid OR unstable counted once",()=>{
  for(const minutes of [0.9999,1,1.0001])for(const repeats of [3.9999,4,4.0001]){
    const r=activityPoints(minutes,repeats,false,true,true);assert.equal(r.static,minutes>1?1:0);assert.equal(r.repeated,repeats>4?1:0);assert.equal(r.rapidOrUnstable,1);
  }
  assert.equal(activityPoints(2,10,true,false,false).repeated,0);
});
test("all missing mandatory answers keep final/action null, preserving available evidence and actual zero",()=>{
  const {scene,answers}=fixture();assert.equal(scoreScene(scene,answers).final,1);
  const optional=["trunkBase","kneeExtra","upperArmBase","lowerArmBase"];
  for(const name of (Object.keys(answers.fields) as (keyof AnswerValues)[]).filter(k=>!optional.includes(k))){
    const next=structuredClone(answers);next.fields[name]={state:"unknown",source:"human",value:null,observable:false};
    const r=scoreScene(scene,next);assert.equal(r.final,null,name);assert.equal(r.action,null);assert.ok(r.pending.some(p=>p.field===name));assert.equal(r.parts.lowerArm.base,1);
  }
  answers.fields.coupling={state:"not_applicable",value:null,source:"human",observable:false};assert.equal(scoreScene(scene,answers).coupling,0);
  answers.fields.loadKg={state:"unavailable",value:null,source:"human",observable:false};assert.equal(scoreScene(scene,answers).status,"unavailable");
});
test("partial measurement stays null; only observed human band fills it, not arbitrary zero",()=>{
  const {scene,answers}=fixture();const m=scene.frame.measurements.left.upperArm;m.value=null;m.status="unavailable";m.reasons=["occluded"];
  answers.fields.upperArmBase=confirmed(2,false);assert.equal(scoreScene(scene,answers).final,null);
  answers.fields.upperArmBase=confirmed(2,true);let r=scoreScene(scene,answers);assert.equal(r.parts.upperArm.score,2);assert.equal(r.parts.upperArm.source,"human");assert.equal(m.value,null);
  answers.fields.upperArmBase={state:"unavailable",source:"human",value:null,observable:false};r=scoreScene(scene,answers);assert.equal(r.final,null);
});
test("bad global scene and persistent subject review cannot be overridden with human answers",()=>{
  for(const reason of ["no_person","multiple_people","not_side_view","too_far","tracking_uncertain"] as const){const {scene,answers}=fixture();scene.frame.reasons=[reason];assert.equal(scoreScene(scene,answers).status,"unavailable");assert.equal(scoreScene(scene,answers).final,null);}
  const {scene,answers}=fixture();scene.frame.requiresReview=true;assert.equal(scoreScene(scene,answers).final,null);
});
test("video, frame, timestamp, side mismatch rejected; input preserved; changes recalculate",()=>{
  const {analysis,scene,answers}=fixture(),before=structuredClone({scene,answers});assert.deepEqual(scoreScene(scene,answers),scoreScene(scene,answers));assert.deepEqual({scene,answers},before);
  const detached=scoreScene(scene,answers);detached.parts.neck.measurement.value=99;detached.inputs.shock=confirmed(true);assert.deepEqual({scene,answers},before);
  for(const key of ["videoId","frameIndex","timeSec","side"] as const){const bad=structuredClone(answers);Object.assign(bad.scene,{[key]:key==="videoId"?"other":key==="side"?"right":1});assert.throws(()=>scoreScene(scene,bad),/섞을/);}
  assert.throws(()=>scoreScene(sceneFromAnalysis(analysis,"fixture-video",1,"left"),answers),/섞을/);
  answers.fields.loadKg=confirmed(12);assert.equal(scoreScene(scene,answers).load,2);assert.notEqual(scoreScene(scene,answers).final,1);
});
test("invalid enums, ranges, NaN, null and states rejected at public boundary",()=>{
  const {scene,answers}=fixture();
  const invalid:[string,unknown][]=[["legs","floating"],["coupling","none"],["legs",{toString:()=>"bilateral"}],["loadKg",NaN],["loadKg",-1],["neckBase",3],["wristBase",0],["kneeExtra",3],["shoulderRaised",null],["staticMinutes",Infinity],["loadKg","5"]];
  for(const [key,value] of invalid){const bad=structuredClone(answers);Object.assign(bad.fields,{[key]:confirmed(value,true)});assert.throws(()=>scoreScene(scene,bad));}
  const missing=structuredClone(answers);delete (missing.fields as Partial<RebaAnswers["fields"]>).shock;assert.throws(()=>scoreScene(scene,missing));
  const na=structuredClone(answers);na.fields.shock={state:"not_applicable",source:"human",value:null,observable:false};assert.throws(()=>scoreScene(scene,na));
  for(const bad of [0,13,NaN])assert.throws(()=>lookupC(bad,1));
  scene.frame.measurements.left.trunk.value=NaN;assert.throws(()=>scoreScene(scene,answers));
});
