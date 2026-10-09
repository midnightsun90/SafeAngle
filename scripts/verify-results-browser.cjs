const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const url = 'http://127.0.0.1:4181/SafeAngle';
const api = 'http://127.0.0.1:3212/api/vision';
const video = path.join(root, '.local/fixtures/squat.webm');
const server = spawn(process.execPath, ['scripts/serve-frontend.mjs'], { cwd: root, env: { ...process.env, PORT: '4181', BASE_PATH: '/SafeAngle' }, stdio: 'pipe' });
let output = '';
server.stdout.on('data', value => output += value);
server.stderr.on('data', value => output += value);

async function ready() {
  for (let i = 0; i < 300; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    if (server.exitCode !== null) throw new Error(output);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Preview did not start');
}

(async () => {
  await ready();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = [];
    const requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    const manager = '00000000-0000-4000-8000-000000000001';
    const person = '00000000-0000-4000-8000-000000000002';
    const assessment = '00000000-0000-4000-8000-000000000004';
    const createdAt = '2026-10-09T00:00:00.000Z';
    const user = { id: manager, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: createdAt };
    const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: manager, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url'), 'controlled-verification'].join('.');
    const videoRows = [];
    const postureRows = new Map();
    let uploadOffset = 0;
    await page.route('https://*.supabase.co/**', async route => {
      const request = route.request();
      const requestUrl = new URL(request.url());
      const pathname = requestUrl.pathname;
      const method = request.method();
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Location,Upload-Offset,Tus-Resumable,Upload-Length', 'Tus-Resumable': '1.0.0' };
      if (pathname.startsWith('/storage/v1/upload/resumable')) {
        uploadOffset += request.postDataBuffer()?.length ?? 0;
        return route.fulfill({ status: method === 'POST' ? 201 : 204, body: '', headers: { ...headers, Location: requestUrl.origin + '/storage/v1/upload/resumable/fixture', 'Upload-Offset': String(uploadOffset) } });
      }
      if (pathname.startsWith('/storage/v1/object/sign/') && method === 'POST') return route.fulfill({ json: { signedURL: '/object/sign/assessment-videos/fixture.webm?token=fixture' }, headers });
      if (pathname.startsWith('/storage/v1/object/sign/') && method === 'GET') return route.fulfill({ body: await readFile(video), contentType: 'video/webm', headers });
      if (pathname.endsWith('/rpc/current_evaluator')) return route.fulfill({ json: { evaluator_name: '검증 평가자', manager_ids: [manager], manager_id: manager }, headers });
      if (method === 'POST' && pathname.endsWith('/assessment_videos')) videoRows.push(JSON.parse(request.postData()));
      if (method === 'POST' && pathname.endsWith('/assessment_posture_inputs')) for (const row of JSON.parse(request.postData())) postureRows.set(row.posture_type, row);
      const json = pathname.startsWith('/auth/') ? pathname.endsWith('/user') ? user : { access_token: token, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user }
        : method !== 'GET' ? [] : pathname.endsWith('/managers') ? [{ name: '검증 평가자' }]
          : pathname.endsWith('/people') ? [{ id: person, name: '검증 대상자', created_at: createdAt }]
            : pathname.endsWith('/assessments') ? [{ id: assessment, person_id: person, created_at: createdAt }]
              : pathname.endsWith('/assessment_videos') ? videoRows
                : pathname.endsWith('/assessment_posture_inputs') ? [...postureRows.values()] : [];
      return route.fulfill({ json, headers });
    });
    await page.route(api, route => {
      const input = route.request().postDataJSON();
      route.fulfill({ json: {
        status: 'proposed', schemaVersion: 'safeangle-joints-v1', requestId: input.requestId, capture: input.capture,
        provenance: { provider: 'openai', model: 'controlled-fixture', promptVersion: 'fixture-v1', responseId: 'fixture', elapsedMs: 1 },
        points: { ear: { x: .5, y: .15 }, shoulder: { x: .5, y: .25 }, elbow: { x: .5, y: .4 }, wrist: { x: .7, y: .4 }, index_mcp: { x: .75, y: .4 }, hip: { x: .5, y: .5 }, knee: { x: .5, y: .65 }, ankle: { x: .5, y: .8 } },
      } });
    });
    await page.addInitScript(({ person, assessment, createdAt, token, user }) => {
      localStorage.setItem('sb-ixocecrvriaprwynhnst-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user }));
      if (!localStorage.getItem('safeangle.dashboard.v1')) localStorage.setItem('safeangle.dashboard.v1', JSON.stringify({ evaluatorName: '검증 평가자', activeId: person, evaluations: [{ id: person, assessmentId: assessment, name: '검증 대상자', createdAt, lastPath: '/analysis', selectedTimes: { 1: null, 2: null, 3: null }, answers: { 1: {}, 2: {}, 3: {} }, skipped: { 1: false, 2: true, 3: true }, fileKeys: { 1: null, 2: null, 3: null }, confirmedScenes: { 1: false, 2: false, 3: false } }] }));
    }, { person, assessment, createdAt, token, user });

    await page.goto(url + '/upload/1');
    await page.getByLabel('영상 1 선택', { exact: true }).setInputFiles(video, { timeout: 5000 });
    await page.locator('.upload-content .next-button').click();
    for (const number of [2, 3]) { await page.waitForURL('**/upload/' + number + '/'); await page.locator('.upload-skip').click(); }
    await page.waitForURL('**/review/');
    await page.locator('.review-footer .next-button').click();
    for (const group of [2, 3, 4]) {
      await page.waitForURL('**/questions/1/' + group + '/');
      for (const field of await page.locator('.question-form fieldset').all()) await field.locator('input[type="radio"]').first().check();
      await page.locator('.question-form [type="submit"]').click();
    }
    await page.locator('#evaluation-timeline').waitFor();
    await page.waitForFunction(() => Number(document.querySelector('#evaluation-timeline')?.max) > 0);
    await page.locator('#evaluation-timeline').fill('2');
    await page.locator('#evaluation-side').selectOption('left');
    await page.locator('#evaluation-facing').selectOption('-1');
    await page.getByLabel(/한 사람의 측면 장면/).check();
    await page.getByLabel(/선택한 장면 한 장을 OpenAI/).check();
    await page.getByRole('button', { name: 'GPT 관절 분석', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#analysis-phase')?.textContent?.includes('GPT 제안 완료'));
    await page.getByLabel(/선택한 사람·쪽의 관절/).check();
    await page.getByRole('button', { name: '관절 확인 완료, 작업 조건 입력', exact: true }).click();
    await page.locator('#measurement-result').waitFor();
    assert.equal(await page.locator('#reba-final, #reba-result').count(), 0);
    await page.getByRole('link', { name: '측정 결과 보기' }).click();
    await page.waitForURL('**/results/');
    assert.equal(await page.locator('.pose-results-angle').count(), 6);
    assert.equal(await page.locator('.pose-results-angle b').first().innerText(), '0.0°');
    assert.match(await page.locator('.pose-results-selected-side').innerText(), /왼쪽/);
    await page.getByRole('link', { name: /상세 평가서 보기/ }).click();
    await page.waitForURL('**/report/');
    assert.equal(await page.locator('.report-detail-measurement').count(), 6);
    assert.equal(await page.locator('.report-detail-points > div').count(), 9);
    assert.match(await page.locator('.report-detail-metadata').innerText(), /controlled-fixture/);
    assert.equal(await page.getByRole('button', { name: '인쇄 / PDF 저장' }).isEnabled(), true);
    await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printed = 'true'; }; });
    await page.getByRole('button', { name: '인쇄 / PDF 저장' }).click();
    await page.waitForFunction(() => document.documentElement.dataset.printed === 'true');
    assert.equal(await page.locator('.report-detail-scene img').count(), 1);
    assert.equal(await page.locator('#report-final, #summary-final').count(), 0);
    assert.equal(requests.some(request => /mediapipe|\.wasm|pose_landmarker/i.test(request)), false);
    assert.deepEqual(errors, []);
    console.log('PASS: upload → GPT joint fixture → selected-side angles → report, with no final score or MediaPipe request');
  } catch (error) {
    console.error('Page:', page?.url(), (await page?.locator('body').innerText().catch(() => ''))?.slice(0, 1000), 'HTML:', (await page?.content().catch(() => ''))?.slice(0, 600));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.kill());
