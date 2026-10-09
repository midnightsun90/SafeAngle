const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {mkdir,writeFile}=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..'), url='http://127.0.0.1:4174';
const records=[], errors=[];
const server=spawn(process.execPath,['scripts/dev-engine.mjs'],{cwd:root,env:{...process.env,PORT:'4174'},stdio:['ignore','pipe','inherit']});
let browser,page;
async function ready(){
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Check server did not start')),30000);
    server.stdout.on('data',chunk=>{if(String(chunk).includes('Engine check:')){clearTimeout(timer);resolve();}});
    server.on('exit',code=>{clearTimeout(timer);reject(new Error('Check server exited: '+code));});
  });
}
async function pageFor(){
  const instance=await chromium.launch({channel:'chrome',headless:true});
  const page=await instance.newPage({viewport:{width:1200,height:1000}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),live=new Set();
    URL.createObjectURL=(blob)=>{const value=create(blob);live.add(value);return value;};
    URL.revokeObjectURL=(value)=>{live.delete(value);return revoke(value);};
    window.liveObjectUrls=live;
  });
  await page.goto(url);return {instance,page};
}
async function choose(page,name){await page.locator('#file').setInputFiles(path.resolve(root,'.local/fixtures',name));}
async function finish(page){
  await page.waitForFunction(()=>document.querySelector('#analyze').disabled===false,null,{timeout:120000});
  return page.evaluate(()=>({result:window.engineResult,status:document.querySelector('#status').textContent,
    videos:document.querySelectorAll('video').length,urls:window.liveObjectUrls.size,rows:document.querySelectorAll('#measurements tr').length}));
}
async function analyze(page,name){
  await choose(page,name);await page.locator('#analyze').click();const value=await finish(page);
  assert.ok(value.result,value.status);assert.equal(value.videos,1);assert.equal(value.urls,1);assert.equal(value.rows,12);
  const r=value.result;
  for(const frame of r.frames){assert.equal(frame.joints.length,33);assert.equal(Object.keys(frame.measurements.left).length,6);assert.equal(Object.keys(frame.measurements.right).length,6);}
  records.push({case:name,status:r.status,frames:r.frames.length,usableRatio:r.usableRatio,measuredFrameRatio:r.measuredFrameRatio,
    coverage:r.measurementCoverage,reasons:r.reasonCounts,personCounts:[...new Set(r.frames.map(f=>f.personCount))],runtime:r.runtime});
  console.log('Verified '+name+': '+r.status+', '+r.frames.length+' frames, '+r.runtime.delegate+', '+Math.round(r.runtime.elapsedMs)+'ms');
  return r;
}
(async()=>{
  await ready();await mkdir(path.resolve(root,'.local/verification'),{recursive:true});
  ({instance:browser,page}=await pageFor());
  const normal=await analyze(page,'squat.webm');assert.equal(normal.frames.length,79);assert.ok(normal.measuredFrameRatio>0);
  await page.locator('#timeline').evaluate(input=>{input.value='20';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>Math.abs(document.querySelector('#video').currentTime-window.engineResult.frames[20].timeSec)<0.001);
  await page.waitForTimeout(150);
  const aligned=await page.evaluate(()=>{
    const video=document.querySelector('#video'),canvas=document.querySelector('#overlay'),v=video.getBoundingClientRect(),c=canvas.getBoundingClientRect();
    return {vw:v.width,vh:v.height,cw:c.width,ch:c.height,width:canvas.width,height:canvas.height,time:document.querySelector('#time').textContent};
  });
  assert.equal(aligned.vw,aligned.cw);assert.equal(aligned.vh,aligned.ch);assert.equal(aligned.width,480);assert.equal(aligned.height,640);assert.match(aligned.time,/2\.00초/);
  await page.screenshot({path:path.resolve(root,'.local/verification/normal.png'),fullPage:true});
  await page.locator('#facing').selectOption('-1');
  assert.equal(await page.evaluate(()=>window.engineResult.facing),-1);assert.match(await page.locator('#summary').innerText(),/coverage/);
  await page.locator('#facing').selectOption('auto');
  const empty=await analyze(page,'empty.webm');assert.equal(empty.status,'retake');assert.equal(empty.reasonCounts.no_person,empty.frames.length);
  const cropped=await analyze(page,'cropped.webm');assert.ok(cropped.frames.every(f=>f.joints.length===33));
  const multiple=await analyze(page,'multiple.webm');assert.ok(multiple.frames.some(f=>f.personCount>1),'Fixture did not exercise actual multiple detection');
  assert.ok(multiple.frames.filter(f=>f.personCount>1).every(f=>f.status==='unusable'&&f.measurements.left.knee.value===null));
  await analyze(page,'occluded.webm');
  // Actual model inference remains active; cancel only when at least one frame has completed.
  await choose(page,'squat.webm');await page.locator('#analyze').click();
  await page.waitForFunction(()=>document.querySelector('#progress').value>0);await page.locator('#cancel').click();
  const cancelled=await finish(page);assert.equal(cancelled.result,undefined);assert.match(cancelled.status,/취소/);assert.equal(cancelled.videos,1);assert.equal(cancelled.urls,1);
  records.push({case:'cancel-during-inference',status:cancelled.status});
  await analyze(page,'short.webm');
  // Fail model fetching, verify recovery without changing source or replacing inference.
  await page.route('**/models/pose_landmarker_full.task',route=>route.fulfill({status:404,body:'missing'}));
  await choose(page,'short.webm');await page.locator('#analyze').click();const failed=await finish(page);
  assert.equal(failed.result,undefined);assert.match(failed.status,/모델/);assert.equal(failed.videos,1);assert.equal(failed.urls,1);
  await page.unroute('**/models/pose_landmarker_full.task');await analyze(page,'short.webm');
  // A delayed model request allows cancellation while initialization is pending.
  await page.route('**/models/pose_landmarker_full.task',async route=>{await new Promise(r=>setTimeout(r,1000));await route.continue().catch(()=>{});});
  await choose(page,'short.webm');await page.locator('#analyze').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('모델'));
  await page.locator('#cancel').click();const loadingCancel=await finish(page);assert.match(loadingCancel.status,/취소/);assert.equal(loadingCancel.result,undefined);
  await page.unroute('**/models/pose_landmarker_full.task');await analyze(page,'short.webm');
  await page.locator('#file').setInputFiles({name:'bad.mp4',mimeType:'video/mp4',buffer:Buffer.from('not video')});
  await page.locator('#analyze').click();const bad=await finish(page);assert.match(bad.status,/디코딩/);assert.equal(bad.videos,1);assert.equal(bad.urls,1);
  await page.locator('#file').setInputFiles({name:'zero.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(0)});
  await page.locator('#analyze').click();const zero=await finish(page);assert.match(zero.status,/비어/);assert.equal(zero.videos,1);assert.equal(zero.urls,1);
  await choose(page,'too-long.webm');await page.locator('#analyze').click();const long=await finish(page);
  assert.match(long.status,/60초/);assert.equal(long.result,undefined);assert.equal(long.videos,1);assert.equal(long.urls,1);
  assert.equal((await page.request.get(url+'/.env')).status(),404);
  assert.notEqual((await page.request.get(url+'/fixtures/%2e%2e%5c%2e%2e%5cpackage.json')).status(),200);
  const userAgent=await page.evaluate(()=>navigator.userAgent);await browser.close();browser=undefined;
  const cpu=await pageFor();browser=cpu.instance;
  // Inject only the GPU initialization exception. CPU model execution stays real.
  await cpu.page.evaluate(async()=>{
    const {PoseLandmarker}=await import('/vendor/vision_bundle.mjs');
    const create=PoseLandmarker.createFromOptions.bind(PoseLandmarker);
    PoseLandmarker.createFromOptions=(fileset,options)=>options.baseOptions?.delegate==='GPU'
      ?Promise.reject(new Error('Forced GPU initialization failure for verification')):create(fileset,options);
  });
  const cpuResult=await analyze(cpu.page,'short.webm');assert.equal(cpuResult.runtime.delegate,'CPU');
  assert.ok(cpuResult.frames.some(f=>f.landmarks.length===33));
  assert.deepEqual(errors,[]);
  await writeFile(path.resolve(root,'.local/verification/results.json'),JSON.stringify({at:new Date().toISOString(),userAgent,records,alignment:aligned,pageErrors:errors,
    checks:['33 joints and bilateral measurements','seek and overlay dimensions','manual facing remeasurement','no person','cropped body','multiple people excluded','occlusion','cancel and repeat','missing model and retry','cancel loading','decode error','empty file','over 60 seconds rejected','resource cleanup','real CPU inference after injected GPU initialization failure','server route boundaries'],accuracy:'unverified: no independent labels'},null,2));
  console.log('Browser verification passed. Results: .local/verification/results.json');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.kill();});
