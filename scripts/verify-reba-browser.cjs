const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {mkdir,writeFile}=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),frontend=path.join(root,'frontend'),url='http://127.0.0.1:4180';
const dir=path.join(root,'.local/reba-verification'),records=[],errors=[],external=[];
const server=spawn(process.execPath,[path.join(frontend,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','4180'],{cwd:frontend,stdio:['ignore','pipe','pipe']});
let serverOutput='',browser,page;
server.stdout.on('data',v=>serverOutput+=v);server.stderr.on('data',v=>serverOutput+=v);
async function ready(){
  for(let i=0;i<300;i++){
    try{const r=await fetch(url);if(r.ok)return;}catch{}
    if(server.exitCode!==null)throw new Error(serverOutput);
    await new Promise(r=>setTimeout(r,100));
  }throw new Error('Next production server did not start: '+serverOutput);
}
async function choose(name){await page.locator('#evaluation-files').setInputFiles(path.join(root,'.local/fixtures',name));assert.equal(await page.locator('#reba-result').count(),0,'Old score survived file change');}
async function finish(){await page.waitForFunction(()=>/분석 완료|분석 실패|분석 취소/.test(document.querySelector('#analysis-phase')?.textContent??''),null,{timeout:120000});}
async function analyze(name){await choose(name);await page.getByRole('button',{name:'관절 분석 시작',exact:true}).click();await finish();const phase=await page.locator('#analysis-phase').innerText();assert.match(phase,/분석 완료/);records.push({case:name,phase});return phase;}
async function selectFrame(index){await page.locator('#evaluation-timeline').fill(String(index));await page.waitForFunction(()=>document.querySelector('#scene-aligned')?.textContent==='영상·뼈대 시각 일치');}
async function select(name,value){await page.locator(`[data-video-active="true"] [name="${name}"]`).selectOption(String(value));}
async function questions(){
  await page.getByRole('button',{name:'이 장면·쪽으로 확인 질문 작성',exact:true}).click();
  assert.equal(await page.locator('#reba-final').getAttribute('data-score'),'');
  for(const name of ['neckTwist','neckSideBend','trunkTwist','trunkSideBend','unstable','armAbducted','shoulderRaised','armSupported','wristDeviated','wristTwisted','shock','repetitionIsWalking','rapidChange'])await select(name,'false');
  await select('neckBase',1);await select('wristBase',1);await select('trunkUpright','false');await select('legs','bilateral');await select('coupling','good');
  for(const [name,value] of [['loadKg',0],['staticMinutes',0],['repeatsPerMinute',0]])await page.locator(`[data-video-active="true"] [name="${name}"]`).fill(String(value));
  // These are scenario inputs for connection verification, not independent anatomical labels.
  for(const [name,value] of [['trunkBase',2],['kneeExtra',0],['upperArmBase',2],['lowerArmBase',1]])if(await page.locator(`[data-video-active="true"] [name="${name}"]`).count())await select(name,value);
}
async function final(){return Number(await page.locator('#reba-final').getAttribute('data-score'));}
(async()=>{
  await mkdir(dir,{recursive:true});await ready();browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1280,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
  await page.addInitScript(()=>{const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),live=new Set();URL.createObjectURL=b=>{const v=create(b);live.add(v);return v;};URL.revokeObjectURL=v=>{live.delete(v);return revoke(v);};window.liveObjectUrls=live;});
  await page.goto(url);await page.locator('#company').fill('브라우저 검증 회사');await page.locator('#worksite').fill('검증 작업장');await page.locator('#task').fill('연결 검증, 기준 라벨 아님');await page.getByRole('button',{name:'정보 저장',exact:true}).click();await page.getByRole('button',{name:'영상 평가로 이동',exact:true}).click();
  const model=await page.request.get(url+'/models/pose_landmarker_full.task');assert.equal(model.status(),200);assert.equal((await model.body()).length,9398198);
  await analyze('squat.webm');await selectFrame(20);assert.match(await page.locator('#evaluation-time').innerText(),/2\.00초/);
  const geometry=await page.evaluate(()=>{const v=document.querySelector('#evaluation-video'),c=document.querySelector('#evaluation-overlay'),vr=v.getBoundingClientRect(),cr=c.getBoundingClientRect();return {time:v.currentTime,vw:vr.width,vh:vr.height,cw:cr.width,ch:cr.height,width:c.width,height:c.height};});
  assert.equal(geometry.time,2);assert.equal(geometry.vw,geometry.cw);assert.equal(geometry.vh,geometry.ch);assert.deepEqual([geometry.width,geometry.height],[480,640]);
  await questions();const initial=await final();assert.ok(initial>=1&&initial<=15);assert.match(await page.locator('#reba-action').innerText(),/조치 수준/);
  await select('rapidChange','true');assert.equal(await final(),initial+1);assert.match(await page.locator('#reba-calculation').innerText(),/활동 1/);
  records.push({case:'real video Q1-Q4 and input update',sceneSec:2,side:await page.locator('#evaluation-side').inputValue(),initial,changed:await final(),geometry});
  await page.screenshot({path:path.join(dir,'real-video-score.png'),fullPage:true});
  await page.locator('.sa-video-stage').screenshot({path:path.join(dir,'video-overlay.png')});
  await select('shock','');assert.equal(await page.locator('#reba-final').getAttribute('data-score'),'');assert.match(await page.locator('#reba-pending').innerText(),/충격/);await select('shock','false');assert.equal(await final(),initial+1);
  await select('coupling','not_applicable');assert.match(await page.locator('#reba-calculation').innerText(),/손잡이 0/);
  await select('wristBase','unavailable');assert.equal(await page.locator('#reba-final').getAttribute('data-score'),'');assert.match(await page.locator('#reba-action').innerText(),/현장 확인/);await select('wristBase',1);
  await selectFrame(21);assert.equal(await page.locator('#reba-result').count(),0);await questions();assert.ok(await final()>0);
  await page.locator('#evaluation-side').selectOption('right');assert.equal(await page.locator('#reba-result').count(),0);await page.waitForFunction(()=>document.querySelector('#scene-aligned')?.textContent==='영상·뼈대 시각 일치');await questions();
  const rightMissing=await page.locator('#measurement-table').innerText();assert.match(rightMissing,/측정 불가/);assert.ok(await page.locator('[name="upperArmBase"]').count());await select('upperArmBase','unavailable');assert.equal(await page.locator('#reba-final').getAttribute('data-score'),'');records.push({case:'unknown/unavailable, scene/side reset, partial measurement confirmation',passed:true});
  await analyze('empty.webm');assert.equal(await page.getByRole('button',{name:'이 장면·쪽으로 확인 질문 작성',exact:true}).isDisabled(),true);assert.equal(await page.locator('#reba-result').count(),0);assert.match(await page.locator('#measurement-table').innerText(),/측정 불가/);
  await analyze('multiple.webm');assert.equal(await page.getByRole('button',{name:'이 장면·쪽으로 확인 질문 작성',exact:true}).isDisabled(),true);assert.match(await page.locator('.sa-error[role="alert"]').innerText(),/여러 사람/);
  await choose('squat.webm');await page.getByRole('button',{name:'관절 분석 시작',exact:true}).click();await page.waitForFunction(()=>{const p=document.querySelector('progress');return p&&p.value>=1;},null,{timeout:120000});await page.getByRole('button',{name:'분석 취소',exact:true}).click();await finish();assert.match(await page.locator('#analysis-phase').innerText(),/분석 취소/);assert.equal(await page.locator('#reba-result').count(),0);
  await page.getByRole('button',{name:'관절 분석 시작',exact:true}).click();await finish();assert.match(await page.locator('#analysis-phase').innerText(),/분석 완료/);records.push({case:'cancel then real reanalysis',passed:true});
  await choose('short.webm');assert.match(await page.locator('#analysis-phase').innerText(),/분석 전/);assert.equal(await page.locator('#reba-questions').count(),0);
  await page.getByRole('button',{name:'관절 분석 시작',exact:true}).click();await finish();await questions();assert.ok(await final()>0);
  await page.locator('#evaluation-files').setInputFiles({name:'broken.mp4',mimeType:'video/mp4',buffer:Buffer.from('not a video')});assert.equal(await page.locator('#reba-result').count(),0);await page.getByRole('button',{name:'관절 분석 시작',exact:true}).click();await finish();assert.match(await page.locator('.sa-error[role="alert"]').innerText(),/디코딩/);
  await analyze('short.webm');records.push({case:'file reset, invalid file and recovery',passed:true});
  await page.locator('#evaluation-files').setInputFiles(['short.webm','squat.webm','empty.webm'].map(n=>path.join(root,'.local/fixtures',n)));
  assert.equal(await page.locator('#reba-result').count(),0);
  await page.getByRole('button',{name:'관절 분석 시작',exact:true}).click();await finish();await questions();const firstVideoScore=await final();
  await page.getByRole('tab',{name:/영상 2/}).click();assert.equal(await page.locator('#reba-result').count(),0);
  await page.getByRole('button',{name:'관절 분석 시작',exact:true}).click();await finish();await questions();const secondVideoScore=await final();
  await page.getByRole('tab',{name:/영상 3/}).click();await page.getByRole('button',{name:'관절 분석 시작',exact:true}).click();await finish();assert.equal(await page.locator('#reba-result').count(),0);assert.equal(await page.getByRole('button',{name:'이 장면·쪽으로 확인 질문 작성',exact:true}).isDisabled(),true);
  await page.getByRole('tab',{name:/영상 1/}).click();assert.equal(await final(),firstVideoScore);await select('rapidChange','true');assert.equal(await final(),firstVideoScore+1);
  await page.getByRole('tab',{name:/영상 2/}).click();assert.equal(await final(),secondVideoScore);
  assert.equal(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return new Set(ids).size===ids.length;}),true);
  records.push({case:'three independent videos, retained answers, no shared score or duplicate DOM ids',firstVideoScore,secondVideoScore});
  await choose('short.webm');await page.getByRole('button',{name:'관절 분석 시작',exact:true}).click();await finish();
  const resources=await page.evaluate(()=>({videos:document.querySelectorAll('video').length,urls:window.liveObjectUrls.size}));assert.deepEqual(resources,{videos:1,urls:1});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await writeFile(path.join(dir,'results.json'),JSON.stringify({at:new Date().toISOString(),records,resources,errors,external,accuracy:'Unverified: scenario confirmations are not independent labels.'},null,2));console.log(JSON.stringify({records,resources,errors,external},null,2));
})().catch(async e=>{console.error(e);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'failure.txt'),String(e.stack)+'\n'+serverOutput);if(page)await page.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();server.kill();});
