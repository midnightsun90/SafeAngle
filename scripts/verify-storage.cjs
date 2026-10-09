const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
// shortcut: reuse the sibling engine's browser and public fixtures; replace paths for standalone CI.
const { chromium } = createRequire(path.resolve('../SafeAngle-engine/package.json'))('playwright');
const { createClient } = createRequire(path.resolve('frontend/package.json'))('@supabase/supabase-js');

async function main() {
  const source = await fs.readFile('frontend/src/lib/supabaseClient.ts', 'utf8');
  const url = source.match(/https:\/\/[a-z]+\.supabase\.co/)?.[0];
  const key = source.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
  assert(url && key, 'Public client configuration required; never use service keys here');
  const mockAnalysis = process.env.VERIFY_ANALYSIS_MOCK === '1';
  const analysisRows = new Map();
  async function analysisResponse(request) {
    const u = new URL(request.url);
    const id = u.searchParams.get('id')?.replace(/^eq\./, '');
    if (request.method === 'POST') {
      const row = await request.json();
      analysisRows.set(row.id, row);
    } else if (request.method === 'PATCH') {
      const patch = await request.json();
      if (analysisRows.has(id)) analysisRows.set(id, { ...analysisRows.get(id), ...patch });
    } else if (request.method === 'DELETE') {
      analysisRows.clear();
    }
    let rows = [...analysisRows.values()].filter(row => !id || row.id === id);
    if (request.method === 'POST') rows = [rows.at(-1)];
    const body = request.headers.get('Accept')?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const verificationFetch = (input, options) => {
    const request = new Request(input, options);
    return mockAnalysis && request.url.includes('/rest/v1/assessment_analysis_results') ? analysisResponse(request) : fetch(request);
  };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  if (mockAnalysis) await page.route('**/rest/v1/assessment_analysis_results*', async route => {
    const r = route.request();
    const response = await analysisResponse(new Request(r.url(), { method: r.method(), headers: r.headers(), body: ['GET','HEAD'].includes(r.method()) ? undefined : r.postData() }));
    await route.fulfill({ status: response.status, body: await response.text(), contentType: 'application/json' });
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let db, manager;
  const outsider = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const summary = { checks: [], errors, cleanup: false, analysisStorage: mockAnalysis ? 'intercepted, migration not applied' : 'actual Supabase' };
  const fixture = path.resolve('../SafeAngle-engine/.local/fixtures/short.webm');
  try {
    await page.goto(process.env.VERIFY_STORAGE_URL ?? 'http://127.0.0.1:3198/', { waitUntil: 'networkidle' });
    await page.locator('#dashboard-name').fill(`저장 연결 확인 ${Date.now()}`);
    await page.getByRole('button', { name: '시작하기' }).click();
    await page.locator('.dashboard-modal').waitFor({ state: 'hidden', timeout: 30000 });
    const session = await page.evaluate(() => {
      const name = Object.keys(localStorage).find((key) => key.startsWith('sb-') && key.endsWith('-auth-token'));
      return name ? JSON.parse(localStorage.getItem(name)) : null;
    });
    assert(session?.access_token && session?.refresh_token, 'Owned verification session missing');
    db = createClient(url, key, { global: { fetch: verificationFetch }, auth: { persistSession: false, autoRefreshToken: false } });
    const connected = await db.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    assert(!connected.error); manager = connected.data.user.id;
    await page.locator('.sidebar-add').click();
    await page.locator('#dashboard-name').fill('공개 영상 연결 확인');
    await page.getByRole('button', { name: '평가 시작' }).click();
    await page.waitForURL('**/upload/1/');
    await page.locator('.upload-file-input').setInputFiles(fixture);
    await page.getByText(/영상이 저장(됐|되었)습니다/).waitFor({ timeout: 60000 });
    let item = await page.evaluate(() => JSON.parse(localStorage.getItem('safeangle.dashboard.v1')).evaluations[0]);
    const video = await db.from('assessment_videos').select('storage_path,duration_seconds').eq('assessment_id', item.assessmentId).single();
    assert(!video.error && video.data.storage_path.startsWith(`${manager}/${item.assessmentId}/`));
    const storagePath = video.data.storage_path;
    summary.checks.push('actual private resumable upload, video record');
    const original = await fs.readFile(fixture);
    const download = await db.storage.from('assessment-videos').download(storagePath);
    assert(!download.error);
    assert.deepEqual(Buffer.from(await download.data.arrayBuffer()), original);
    summary.checks.push('owner download matches original bytes');
    await page.getByRole('button', { name: /다음: 앉아서/ }).click();
    await page.waitForURL('**/upload/2/');
    await page.getByRole('button', { name: /건너뛰기/ }).click();
    await page.waitForURL('**/upload/3/');
    await page.getByRole('button', { name: /건너뛰기/ }).click();
    await page.waitForURL('**/review/');
    await page.getByRole('button', { name: /다음: 작업 조건 입력/ }).click();
    await page.waitForURL('**/questions/1/2/');
    await page.locator('input[name="1-force"][value="under5"]').check();
    await page.locator('input[name="1-impact"][value="no"]').check();
    await page.getByRole('button', { name: /다음 질문으로/ }).click();
    await page.waitForURL('**/questions/1/3/');
    await page.locator('input[name="1-coupling"][value="good"]').check();
    await page.getByRole('button', { name: /다음 질문으로/ }).click();
    await page.waitForURL('**/questions/1/4/');
    await page.locator('input[name="1-static"][value="no"]').check();
    const inputSaved = page.waitForResponse((response) => response.url().includes('/rest/v1/assessment_posture_inputs') && response.request().method() === 'POST' && response.ok() && response.request().postDataJSON()?.some((row) => row.answers?.repeated === 'unknown'));
    await page.locator('input[name="1-repeated"][value="unknown"]').check();
    await inputSaved;
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('input[name="1-repeated"][value="unknown"]').waitFor();
    assert(await page.locator('input[name="1-repeated"][value="unknown"]').isChecked());
    await page.waitForFunction(() => document.querySelector('.scene-preview video')?.readyState >= 1);
    await page.locator('.scene-preview video').evaluate(async (video) => { video.muted = true; await video.play(); });
    await page.waitForFunction(() => document.querySelector('.scene-preview video').currentTime > 0.1);
    await page.locator('.scene-preview video').evaluate((video) => video.pause());
    summary.checks.push('answers, skips, unknown, video restored after reload');
    const inputs = await db.from('assessment_posture_inputs').select('*').eq('assessment_id', item.assessmentId);
    assert(!inputs.error && inputs.data.length === 3);
    assert(inputs.data.find((x) => x.posture_type === 'push_pull').is_skipped);
    assert.equal(inputs.data.find((x) => x.posture_type === 'lift_transfer').answers.repeated, 'unknown');
    const storage = await import(pathToFileURL(path.resolve('frontend/src/lib/analysisStorage.ts')).href);
    item = await page.evaluate(() => JSON.parse(localStorage.getItem('safeangle.dashboard.v1')).evaluations[0]);
    item.selectedTimes[1] = 2;
    await storage.saveAssessmentInputs(db, manager, item);
    const selected = await db.from('assessment_posture_inputs').select('selected_time_seconds,answers').eq('assessment_id', item.assessmentId).eq('posture_type', 'lift_transfer').single();
    assert.equal(Number(selected.data.selected_time_seconds), 2);
    assert.equal(selected.data.answers.repeated, 'unknown');
    const parts = Object.fromEntries(['trunk','neck','knee','upperArm','lowerArm','wrist'].map((key) => [key, { score: 1, source: 'human' }]));
    const fixtureResult = { status: 'pending', final: null, scene: { videoId: 'storage-verification-fixture', frameIndex: 10, timeSec: 2, side: 'left' }, parts, verificationOnly: true };
    await storage.persistAnalysisResult(db, manager, item, 1, fixtureResult, storagePath);
    let assessment = await db.from('assessment_analysis_results').select('result,reba_score,status').eq('id', item.assessmentId).single();
    assert(!assessment.error); assert.equal(assessment.data.reba_score, null); assert.equal(assessment.data.status, 'needs_review');
    assert.equal((await storage.restoreAnalysisResults(db, manager, item))[1].scene.timeSec, 2);
    await assert.rejects(storage.persistAnalysisResult(db, manager, item, 1, { ...fixtureResult, final: 0 }, storagePath));
    await assert.rejects(storage.persistAnalysisResult(db, manager, item, 1, { ...fixtureResult, scene: { ...fixtureResult.scene, timeSec: 3 } }, storagePath));
    await assert.rejects(storage.persistAnalysisResult(db, manager, item, 1, { ...fixtureResult, parts: { ...parts, trunk: { score: 1, source: 'vlm' } } }, storagePath));
    await assert.rejects(storage.persistAnalysisResult(db, manager, item, 1, fixtureResult, 'wrong-path'));
    item.answers[1].repeated = 'no';
    await storage.saveAssessmentInputs(db, manager, item);
    await storage.persistAnalysisResult(db, manager, item, 1, { ...fixtureResult, status: 'complete', final: 1 }, storagePath);
    assessment = await db.from('assessment_analysis_results').select('reba_score,status').eq('id', item.assessmentId).single();
    assert(!assessment.error); assert.equal(assessment.data.reba_score, 1); assert.equal(assessment.data.status, 'completed');
    await storage.saveAssessmentInputs(db, manager, item);
    assessment = await db.from('assessment_analysis_results').select('reba_score').eq('id', item.assessmentId).single();
    assert.equal(assessment.data.reba_score, 1, 'unchanged JSONB answers must preserve score');
    item.answers[1].repeated = 'yes';
    await storage.saveAssessmentInputs(db, manager, item);
    assessment = await db.from('assessment_analysis_results').select('result,reba_score').eq('id', item.assessmentId).single();
    assert.equal(assessment.data.result, null); assert.equal(assessment.data.reba_score, null);
    const files = await import(pathToFileURL(path.resolve('frontend/src/lib/videoStorage.ts')).href);
    assert(files.validateVideoFile(new File([], 'empty.webm', { type: 'video/webm' })));
    assert(files.validateVideoFile({ name: 'big.webm', type: 'video/webm', size: files.MAX_VIDEO_BYTES + 1 }));
    summary.checks.push('selected time restored, pending stays null, result fixtures round trip, stale result rejected, input edits invalidate score, empty/oversize rejected');
    const cached = JSON.parse(await fs.readFile('../SafeAngle-engine/.local/vlm-verification/api-results.json', 'utf8')).repeats[0];
    await page.route('http://127.0.0.1:3212/api/vision', route => {
      const request = route.request().postDataJSON();
      return route.fulfill({ json: { ...cached, requestId: request.requestId, capture: request.capture } });
    });
    await page.locator('.question-form [type="submit"]').click();
    await page.locator('#evaluation-timeline').waitFor();
    await page.waitForFunction(() => Number(document.querySelector('#evaluation-timeline')?.max) > 0);
    await page.locator('#evaluation-timeline').fill('0.5');
    await page.locator('#evaluation-side').selectOption('left');
    await page.locator('#evaluation-facing').selectOption('-1');
    await page.getByLabel(/한 사람의 측면 장면/).check();
    await page.getByLabel(/선택한 장면 한 장을 OpenAI/).check();
    await page.getByRole('button', { name: 'GPT 관절 분석', exact: true }).click();
    await page.getByLabel(/선택한 사람·쪽의 관절/).check();
    await page.getByRole('button', { name: '관절 확인 완료, 작업 조건 입력', exact: true }).click();
    for (const name of ['neckTwist','neckSideBend','trunkTwist','trunkSideBend','unstable','armAbducted','shoulderRaised','armSupported','wristDeviated','wristTwisted','shock','repetitionIsWalking','rapidChange']) await page.locator(`[data-video-active="true"] [name="${name}"]`).selectOption('false');
    for (const [name, value] of [['neckBase','1'],['wristBase','1'],['trunkUpright','false'],['legs','bilateral'],['coupling','good']]) await page.locator(`[data-video-active="true"] [name="${name}"]`).selectOption(value);
    for (const name of ['loadKg','staticMinutes','repeatsPerMinute']) await page.locator(`[data-video-active="true"] [name="${name}"]`).fill('0');
    for (const [name,value] of [['trunkBase','2'],['kneeExtra','0'],['upperArmBase','2'],['lowerArmBase','1']]) if (await page.locator(`[name="${name}"]`).count()) await page.locator(`[name="${name}"]`).selectOption(value);
    await page.waitForFunction(() => Number(document.querySelector('#reba-final')?.getAttribute('data-score')) >= 1);
    const actualScore = Number(await page.locator('#reba-final').getAttribute('data-score'));
    for (let attempt = 0; attempt < 100; attempt++) {
      const row = await db.from('assessment_analysis_results').select('result,reba_score,status').eq('id', item.assessmentId).single();
      if (row.data?.reba_score === actualScore && row.data.result?.videos?.[1]?.result?.status === 'complete') {
        assert.equal(row.data.result.videos[1].result.evidence.imageDataUrl, '');
        break;
      }
      assert(attempt < 99, 'UI did not persist completed VLM result');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await page.goto('http://127.0.0.1:3198/results/', { waitUntil: 'networkidle' });
    await page.waitForFunction(score => document.querySelector('#summary-final')?.textContent === `${score}점`, actualScore);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(score => document.querySelector('#summary-final')?.textContent === `${score}점`, actualScore);
    summary.checks.push('cached VLM proposal -> human confirmation -> REBA -> analysis storage automatic save -> summary survives reload, frame JPEG omitted');
    await page.evaluate(() => document.fonts.ready);
    const font = await page.evaluate(() => ({ body: getComputedStyle(document.body).fontFamily, input: getComputedStyle(document.querySelector('input, button')).fontFamily, loaded: [...document.fonts].some((x) => /pretendard/i.test(x.family) && x.status === 'loaded') }));
    assert.match(font.body, /pretendard/i); assert.equal(font.body, font.input); assert(font.loaded);
    summary.font = font;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('.dashboard-main-wrap').getBoundingClientRect().left < 1 && document.querySelector('.dashboard-sidebar').getBoundingClientRect().right < 1);
    await fs.mkdir('.local/storage-verification', { recursive: true });
    await page.screenshot({ path: '.local/storage-verification/mobile.png', fullPage: true, animations: 'disabled' });
    summary.mobile = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('body *')].filter((x) => x.getBoundingClientRect().right > innerWidth + 1).map((x) => x.className).slice(0, 12) }));
    assert.equal(summary.mobile.scrollWidth, summary.mobile.width);
    summary.checks.push('self-hosted Pretendard loaded, inherited controls, 390px screenshot');
    const outsiderLogin = await outsider.auth.signInAnonymously();
    assert(!outsiderLogin.error);
    const denied = await outsider.storage.from('assessment-videos').download(storagePath);
    assert(denied.error && !denied.data);
    const hidden = await outsider.from('assessments').select('id').eq('id', item.assessmentId);
    assert(!hidden.error && hidden.data.length === 0);
    if (!mockAnalysis) {
      const hiddenResult = await outsider.from('assessment_analysis_results').select('id').eq('id', item.assessmentId);
      assert(!hiddenResult.error && hiddenResult.data.length === 0);
      const deniedEdit = await outsider.from('assessment_analysis_results').update({ status: 'needs_review' }).eq('id', item.assessmentId).select('id');
      assert(!deniedEdit.error && deniedEdit.data.length === 0);
      const forgedOwner = await outsider.from('assessment_analysis_results').upsert({ id: item.assessmentId, manager_id: manager }, { onConflict: 'id' });
      assert.equal(forgedOwner.error?.code, '42501');
      summary.checks.push('actual analysis RLS: other manager cannot read, update, or forge owner');
    }
    const publicGet = await fetch(`${url}/storage/v1/object/public/assessment-videos/${storagePath}`);
    assert(!publicGet.ok);
    summary.checks.push('other authenticated manager and public URL cannot read video/assessment');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    if (db && manager) {
      const rows = await db.from('assessment_videos').select('storage_path').eq('manager_id', manager);
      const paths = (rows.data ?? []).map((x) => x.storage_path);
      assert(paths.every((x) => x.startsWith(`${manager}/`)));
      if (paths.length) { const removed = await db.storage.from('assessment-videos').remove(paths); assert(!removed.error); }
      for (const table of ['assessment_analysis_results', 'assessment_videos', 'assessment_posture_inputs', 'assessments', 'people']) {
        const removed = await db.from(table).delete().eq('manager_id', manager); assert(!removed.error, table);
      }
      const removed = await db.from('managers').delete().eq('id', manager); assert(!removed.error);
      summary.cleanup = true;
    }
    await fs.mkdir('.local/storage-verification', { recursive: true });
    await fs.writeFile('.local/storage-verification/results.json', JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  }
}
main().catch((error) => { console.error(error.name, error.message); process.exitCode = 1; });
