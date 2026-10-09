const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {mkdir,writeFile,readFile}=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:4180',api='http://127.0.0.1:3212/api/vision';
const dir=path.join(root,'.local/vlm-verification'),records=[],errors=[],requests=[],repeats=[];
const server=spawn(process.execPath,['scripts/serve-frontend.mjs'],{cwd:root,env:{...process.env,PORT:'4180'},stdio:['ignore','pipe','pipe']});
let serverOutput='',browser,page,input,proposal,cached;
server.stdout.on('data',v=>serverOutput+=v);server.stderr.on('data',v=>serverOutput+=v);
async function ready(){for(let i=0;i<300;i++){try{if((await fetch(url)).ok)return;}catch{}if(server.exitCode!==null)throw Error(serverOutput);await new Promise(r=>setTimeout(r,100));}throw Error('Preview did not start');}
async function select(name,value){await page.locator(`[data-video-active="true"] [name="${name}"]`).selectOption(String(value));}
async function questions(){
  await page.getByLabel(/선택한 사람·쪽의 관절/).check();
  await page.getByRole('button',{name:'관절 확인 완료, 작업 조건 입력',exact:true}).click();
  assert.equal(await page.locator('#reba-final').getAttribute('data-score'),'');
  for(const name of ['neckTwist','neckSideBend','trunkTwist','trunkSideBend','unstable','armAbducted','shoulderRaised','armSupported','wristDeviated','wristTwisted','shock','repetitionIsWalking','rapidChange'])await select(name,'false');
  for(const [name,value] of [['neckBase',1],['wristBase',1],['trunkUpright','false'],['legs','bilateral'],['coupling','good']])await select(name,value);
  for(const name of ['loadKg','staticMinutes','repeatsPerMinute'])await page.locator(`[data-video-active="true"] [name="${name}"]`).fill('0');
  // Scenario confirmations check integration; they are not independent ground truth.
  for(const [name,value] of [['trunkBase',2],['kneeExtra',0],['upperArmBase',2],['lowerArmBase',1]])if(await page.locator(`[name="${name}"]`).count())await select(name,value);
}
async function finish(){await page.waitForFunction(()=>/GPT 제안 완료|분석 실패|요청 취소/.test(document.querySelector('#analysis-phase')?.textContent??''),null,{timeout:150000});}
async function mockAnalyze(points){
  await page.route(api,async route=>{const request=route.request().postDataJSON();await route.fulfill({json:{...proposal,requestId:request.requestId,capture:request.capture,points,provenance:{...proposal.provenance,responseId:'controlled-fixture',elapsedMs:1}}});});
  await page.getByRole('button',{name:/GPT 관절 분석|이 장면 다시 분석/}).click();await finish();await page.unroute(api);
}
(async()=>{
  await mkdir(dir,{recursive:true});await ready();assert.equal((await fetch('http://127.0.0.1:3212/health')).status,200);
  if(process.env.VERIFY_USE_CAPTURE==='1')cached=JSON.parse(await readFile(path.join(dir,'api-results.json'),'utf8'));
  browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1280,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{requests.push(r.url());if(r.url()===api&&r.method()==='POST'&&!input)input=r.postDataJSON();});
  page.on('response',async r=>{if(r.url()===api&&r.request().method()==='POST'&&!proposal){const value=await r.json().catch(()=>null);if(value?.status==='proposed')proposal=value;}});
  if(cached)await page.route(api,route=>{const r=route.request().postDataJSON();return route.fulfill({json:{...cached.repeats[0],requestId:r.requestId,capture:r.capture}});});
  await page.goto(url+'/');await page.locator('#company').fill('공개 영상 검증');await page.locator('#worksite').fill('로컬 검증');await page.locator('#task').fill('공개 운동 영상, 산업 작업 정확도 미검증');await page.getByRole('button',{name:/다음: 영상 올리기/}).click();
  await page.getByLabel('영상 1 선택',{exact:true}).setInputFiles(path.join(root,'.local/fixtures/squat.webm'));await page.getByRole('button',{name:/현재 선택한 영상으로 평가/}).click();
  await page.locator('#evaluation-timeline').waitFor();await page.waitForFunction(()=>Number(document.querySelector('#evaluation-timeline')?.max)>0);
  await page.locator('#evaluation-timeline').fill('2');await page.locator('#evaluation-side').selectOption('left');await page.locator('#evaluation-facing').selectOption('-1');await page.getByLabel(/한 사람의 측면 장면/).check();
  assert.equal(requests.filter(x=>x===api).length,0);assert.equal(await page.getByRole('button',{name:'GPT 관절 분석',exact:true}).isDisabled(),true);
  await page.getByLabel(/선택한 장면 한 장을 OpenAI/).check();console.log((cached?'REPLAY':'REAL CALL')+' 1: public frame 2.00s, selected anatomical left');
  await page.getByRole('button',{name:'GPT 관절 분석',exact:true}).click();await finish();assert.match(await page.locator('#analysis-phase').innerText(),/GPT 제안 완료/);
  assert.ok(input&&proposal);assert.equal(input.capture.scene.timeSec,2);assert.deepEqual(input.capture.imageSize,{width:480,height:640});assert.equal(await page.locator('#reba-result').count(),0);
  repeats.push(proposal);await writeFile(path.join(dir,'representative-frame.jpg'),Buffer.from(input.imageDataUrl.split(',')[1],'base64'));await page.locator('.sa-video-stage').screenshot({path:path.join(dir,'gpt-overlay.png')});
  if(cached)await page.unroute(api);
  console.log((cached?'REPLAY':'REAL CALL')+' 1 completed: '+proposal.provenance.elapsedMs+'ms');
  const {sceneFromVlm}=await import('../lib/vlm/measure.ts');
  for(let i=2;i<=3;i++){
    console.log((cached?'REPLAY':'REAL CALL')+' '+i+': same pixels, same selected side');const replay={...input,requestId:crypto.randomUUID()};
    let result;if(cached)result=cached.repeats[i-1];else{const response=await fetch(api,{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(replay)});result=await response.json();assert.equal(response.status,200,JSON.stringify(result));}assert.equal(result.status,'proposed');repeats.push(result);console.log((cached?'REPLAY':'REAL CALL')+' '+i+' completed: '+result.provenance.elapsedMs+'ms');
  }
  const measured=repeats.map(p=>sceneFromVlm({requestId:p.requestId,imageDataUrl:input.imageDataUrl,capture:p.capture,provenance:p.provenance,originalPoints:p.points,reviewedPoints:p.points,confirmedBy:'human'}).measurements);
  const spread=Object.fromEntries(Object.keys(proposal.points).map(name=>{const points=repeats.map(p=>p.points[name]).filter(Boolean);let max=0;for(const a of points)for(const b of points)max=Math.max(max,Math.hypot((a.x-b.x)*480,(a.y-b.y)*640));return [name,{visibleRuns:points.length,maxPairwisePixels:Number(max.toFixed(2))}];}));
  records.push({case:'three actual GPT calls',sceneSec:2,selectedSide:'left',latencyMs:repeats.map(p=>p.provenance.elapsedMs),spread,measured,accuracy:'No independent keypoint annotations; repeatability only.'});
  if(!cached)await writeFile(path.join(dir,'api-results.json'),JSON.stringify({repeats,measured,spread},null,2));
  await questions();const initial=Number(await page.locator('#reba-final').getAttribute('data-score'));assert.ok(initial>=1&&initial<=15);await select('rapidChange','true');assert.equal(Number(await page.locator('#reba-final').getAttribute('data-score')),initial+1);
  await page.screenshot({path:path.join(dir,'real-score.png'),fullPage:true});records.push({case:'real GPT proposal -> human confirmation -> code REBA',initial,activityChanged:initial+1});
  const coordinate=page.locator('[aria-label="어깨 X (%)"]');await coordinate.fill(String(Number(await coordinate.inputValue())+0.25));assert.equal(await page.locator('#reba-result').count(),0);await questions();
  records.push({case:'coordinate edit clears previous answers and score',passed:true});
  await page.getByRole('link',{name:/결과 요약 및 상세 평가서/}).click();await page.getByRole('link',{name:/상세 평가서 보기/}).click();await page.locator('#report-final').waitFor();assert.match(await page.locator('main').innerText(),/GPT/);assert.equal(await page.locator('.report-cell-highlight').count(),3);assert.equal(await page.locator('img[alt="평가에 사용한 실제 대표 장면"]').count(),1);await page.screenshot({path:path.join(dir,'real-report.png'),fullPage:true});records.push({case:'report preserves image, model, original and human-corrected coordinates',passed:true});
  await page.getByRole('link',{name:/결과 요약으로/}).click();await page.getByRole('link',{name:/영상·답변 다시 평가/}).click();await page.locator('#evaluation-timeline').waitFor();
  await page.locator('#evaluation-timeline').fill('2');await page.locator('#evaluation-side').selectOption('left');await page.locator('#evaluation-facing').selectOption('-1');await page.getByLabel(/한 사람의 측면 장면/).check();await page.getByLabel(/선택한 장면 한 장을 OpenAI/).check();
  await mockAnalyze(proposal.points);await questions();await page.locator('#evaluation-side').selectOption('right');assert.equal(await page.locator('#reba-result').count(),0);assert.equal(await page.locator('#joint-editor').count(),0);assert.equal(await page.getByRole('button',{name:'GPT 관절 분석',exact:true}).isDisabled(),true);
  await page.getByLabel(/한 사람의 측면 장면/).check();await mockAnalyze(Object.fromEntries(Object.keys(proposal.points).map(k=>[k,null])));await page.getByLabel(/선택한 사람·쪽의 관절/).check();await page.getByRole('button',{name:'관절 확인 완료, 작업 조건 입력',exact:true}).click();assert.equal(await page.locator('#reba-result').count(),0);assert.ok(await page.locator('.sa-error').count());records.push({case:'controlled fixtures: side reset and all-null blocks scoring',passed:true});
  await page.route(api,route=>route.fulfill({status:503,json:{status:'error',requestId:null,error:{code:'not_configured',message:'검증용 미설정 서버'}}}));await page.getByRole('button',{name:/이 장면 다시 분석/}).click();await finish();assert.match(await page.locator('.sa-error').innerText(),/검증용 미설정/);await page.unroute(api);
  let release;const gate=new Promise(r=>release=r);await page.route(api,async route=>{await gate;await route.abort().catch(()=>{});});await page.getByRole('button',{name:'GPT 관절 분석',exact:true}).click();await page.getByRole('button',{name:'요청 취소',exact:true}).click();await finish();assert.match(await page.locator('#analysis-phase').innerText(),/요청 취소/);release();await page.unroute(api);records.push({case:'controlled fixtures: failure and cancellation expose no score',passed:true});
  await mockAnalyze(proposal.points);await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.equal(requests.some(x=>/mediapipe|\.wasm|pose_landmarker/i.test(x)),false);const external=requests.filter(x=>!x.startsWith(url)&&!x.startsWith('blob:')&&!x.startsWith('data:'));assert.ok(external.every(x=>x===api));records.push({case:'390px mobile, no MediaPipe/WASM or other model requests, zero page errors',passed:true});
  await writeFile(path.join(dir,'results.json'),JSON.stringify({at:new Date().toISOString(),records,errors,external:[...new Set(external)],actualCalls:cached?0:3,reusedRealCalls:cached?3:0,controlledFixtures:true},null,2));console.log(JSON.stringify({records,errors,actualCalls:cached?0:3,reusedRealCalls:cached?3:0},null,2));
})().catch(async e=>{console.error(e);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'failure.txt'),String(e.stack)+'\n'+serverOutput);if(page)await page.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();server.kill();});
