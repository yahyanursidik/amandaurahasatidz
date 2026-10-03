/** Real Chromium UI with isolated in-memory API; never connects to DB or external providers. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(import.meta.dirname, '..');
const chrome = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);
if (!chrome) throw new Error('Set CHROME_PATH to a Chromium browser.');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ukhuwah-browser-'));
const locations = [], reports = [], requests = [], failures = [], tiles = [];
let role = 'SYSTEM_ADMIN', actorId = '11111111-1111-4111-8111-111111111111', rejectNext = false;
const otherId = '33333333-3333-4333-8333-333333333333';
const now = () => new Date().toISOString();
function locationDto(row, admin) {
  if (admin) return row;
  const { officialPhone, picName, picPhone, officialContactShared, picContactShared, contactConsentConfirmed, contactConsentSource, contactConfirmedAt, ...safe } = row;
  return { ...safe, ...(officialContactShared && contactConsentConfirmed ? { officialPhone } : {}), ...(picContactShared && contactConsentConfirmed ? { picName, picPhone } : {}) };
}
function reportDto(row, admin) {
  const { authorUserId, ...safe } = row;
  return { ...safe, isOwner: authorUserId === actorId, authorName: row.hideAuthor && !admin && authorUserId !== actorId ? null : 'Penulis Uji' };
}
function paged(data) { return { data, meta: { page: 1, pageSize: 20, total: data.length, totalPages: data.length ? 1 : 0 } }; }
const fixtures = {
  name: 'ukhuwah-isolated-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url?.startsWith('/admin/peta-ukhuwah') || req.url?.startsWith('/portal/peta-ukhuwah')) {
        const identity = { id: actorId, name: 'Asatidz Uji', email: 'browser@example.invalid', assignments: [{ roleCode: role }] };
        res.setHeader('Content-Type', 'text/html');
        return res.end(await server.transformIndexHtml(req.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
          import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router-dom'; import {Refine} from '@refinedev/core';
          import '/src/lib/portalNavigationGuard.ts'; import '/src/index.css'; import {UkhuwahPage} from '/src/pages/shared/UkhuwahPage.tsx';
          window.__confirmResult=true;window.__confirmCalls=[];window.confirm=message=>{window.__confirmCalls.push(message);return window.__confirmResult;};
          const authProvider={check:async()=>({authenticated:true}),getIdentity:async()=>(${JSON.stringify(identity)}),logout:async()=>({success:true}),login:async()=>({success:true}),onError:async()=>({})};
          createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Refine,{authProvider,options:{disableTelemetry:true}},React.createElement(UkhuwahPage,{admin:location.pathname.startsWith('/admin/')}))));
        </script></body></html>`));
      }
      if (!req.url?.startsWith('/api/')) return next();
      const url = new URL(req.url, 'http://127.0.0.1');
      const route = url.pathname.replace('/api/v1', ''), admin = route.startsWith('/admin/');
      const tail = route.replace(/^\/(admin\/)?ukhuwah/, '');
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      requests.push({ route, method: req.method, body });
      let data, error;
      if (rejectNext && req.method === 'GET') { rejectNext = false; res.statusCode = 503; error = { message: 'API uji sementara tidak tersedia.' }; }
      else if (tail === '/institutions') data = paged([{ id: otherId, name: 'Lembaga Master Uji' }]);
      else if (tail === '/locations' && req.method === 'GET') data = paged(locations.filter(l => admin || l.isPublished).filter(l => !url.searchParams.get('cityCode') || l.cityCode === url.searchParams.get('cityCode')).map(l => locationDto(l, admin)));
      else if (tail === '/locations' && req.method === 'POST') {
        data = { ...body, id: '22222222-2222-4222-8222-222222222222', version: 1, createdAt: now(), updatedAt: now(), contactConfirmedAt: body.contactConsentConfirmed ? now() : null };
        locations.push(data);
      } else if (/^\/locations\/[^/]+$/.test(tail)) {
        const row = locations.find(l => l.id === tail.split('/')[2]);
        if (req.method === 'PATCH') Object.assign(row, body, { version: row.version + 1, updatedAt: now() });
        data = locationDto(row, admin);
      } else if ((tail === '/reports' || tail === '/my-reports') && req.method === 'GET') {
        const status = url.searchParams.get('publicationStatus');
        data = paged(reports.filter(r => tail === '/my-reports' ? r.authorUserId === actorId : admin || (r.audience === 'SHARED' && r.publicationStatus === 'APPROVED')).filter(r => !status || r.publicationStatus === status).map(r => reportDto(r, admin)));
      } else if (tail === '/reports' && req.method === 'POST') {
        const row = { ...body, id: '44444444-4444-4444-8444-444444444444', authorUserId: actorId, version: 1, publicationStatus: 'DRAFT', workStatus: 'OPEN', followupSummary: '', coordinatorName: '', dueDate: null, createdAt: now(), updatedAt: now() };
        reports.push(row); data = reportDto(row, admin);
      } else if (/^\/reports\/[^/]+(?:\/(submit|moderate|followup))?$/.test(tail)) {
        const row = reports.find(r => r.id === tail.split('/')[2]); const action = tail.split('/')[3];
        if (req.method !== 'GET') {
          if (row.version !== body.expectedVersion) { res.statusCode = 409; error = { message: 'Revisi berubah.' }; }
          else {
            if (action === 'submit') { assert.equal(body.reviewed, true); row.publicationStatus = 'PENDING'; }
            else if (action === 'moderate') { row.publicationStatus = body.decision; row.moderationReason = body.reason; }
            else if (action === 'followup') Object.assign(row, body);
            else Object.assign(row, body, { publicationStatus: 'DRAFT' });
            row.version++; row.updatedAt = now();
          }
        }
        data = reportDto(row, admin);
      } else { res.statusCode = 404; error = { message: `Unexpected API ${req.method} ${route}` }; failures.push(error.message); }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data, error }));
    });
  },
};
const server = await createServer({ root, configFile: false, envDir: false, plugins: [react(), fixtures], resolve: { alias: { '@': path.join(root, 'src') } }, server: { host: '127.0.0.1', port: 0 }, define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api/v1') } });
let browser, socket;
try {
  await server.listen(); const port = server.httpServer.address().port;
  browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${temporary}`, 'about:blank'], { stdio: 'ignore' });
  let debuggerPort;
  for (let i = 0; i < 100; i++) { try { debuggerPort = Number((await readFile(path.join(temporary, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  assert.ok(debuggerPort, 'Remote debugging started');
  const targets = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/list`)).json();
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const pending = new Map();
  function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, [resolve, reject]); socket.send(JSON.stringify({ id, method, params })); }); }
  socket.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.id && pending.has(m.id)) { const [resolve, reject] = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') failures.push(m.params.exceptionDetails);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') failures.push(m.params.args);
    if (m.method === 'Fetch.requestPaused') {
      const url = new URL(m.params.request.url);
      if (url.hostname === '127.0.0.1') void send('Fetch.continueRequest', { requestId: m.params.requestId });
      else if (url.hostname === 'tile.openstreetmap.org') {
        tiles.push(m.params.request);
        void send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/png' }], body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAXsAAAAASUVORK5CYII=' });
      } else { failures.push(`External request blocked ${url}`); void send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'BlockedByClient' }); }
    }
  };
  async function evaluate(expression) { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
  async function until(expression, label) { for (let i = 0; i < 200; i++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Timeout ${label}: ${await evaluate('document.body.innerText.slice(0,3000)')}; errors=${JSON.stringify(failures)}`); }
  const button = label => `[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)})`;
  async function click(label) { await evaluate(`(()=>{const e=${button(label)};if(!e||e.disabled)throw new Error('Unavailable button: ${label}');e.click()})()`); }
  async function fill(id, value) { await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)throw new Error('Missing ${id}');const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`); }
  async function navigate(relative) { await send('Page.navigate', { url: `http://127.0.0.1:${port}${relative}` }); }
  await send('Runtime.enable'); await send('Page.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
  await navigate('/admin/peta-ukhuwah/lembaga');
  await until(`${button('Tambah lokasi lembaga')} && !document.body.textContent.includes('Memuat…')`, 'admin location list');
  assert.equal(tiles.length, 0, 'No provider contact before explicit consent');
  await click('Tambah lokasi lembaga'); await fill('location-name', 'Masjid Browser Uji'); await fill('location-address', 'Alamat Uji Bandung');
  await fill('location-latitude', '-6.91'); await fill('location-longitude', '107.61');
  await fill('location-picName', 'PIC PRIVAT UJI'); await fill('location-picPhone', '081234567890');
  await evaluate(`document.getElementById('location-isPublished').click()`); await click('Simpan lokasi');
  await until(`document.body.textContent.includes('Lokasi dan cakupan kontak tersimpan.')`, 'save location');
  assert.equal(locations[0].picContactShared, false); await click('Tutup editor');
  await click('Aktifkan latar peta'); await until(`document.querySelectorAll('img[src*="tile.openstreetmap.org"]').length>0`, 'tile layer');
  await new Promise(r => setTimeout(r, 300)); assert.ok(tiles.length > 0); await click('Nonaktifkan latar peta');
  role = 'USTADZ'; await navigate('/portal/peta-ukhuwah');
  await until(`!![...document.querySelectorAll('button')].find(e=>e.textContent.includes('Masjid Browser Uji'))`, 'portal directory');
  await evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Masjid Browser Uji')).click()`);
  await until(`document.querySelector('[aria-label="Detail lokasi"]')`, 'location detail');
  assert.equal(await evaluate(`document.body.textContent.includes('PIC PRIVAT UJI')`), false, 'Private contact absent');
  await navigate('/portal/peta-ukhuwah/laporan/baru'); await until(`document.getElementById('ukhuwah-title')`, 'editor');
  await fill('ukhuwah-title', 'Kebutuhan Pengajar Browser'); await fill('ukhuwah-body', 'Diperlukan pengajar untuk pembinaan berkala.'); await fill('ukhuwah-source', 'Pengamatan langsung uji browser');
  await evaluate(`window.__confirmResult=false;document.querySelector('a[href="/portal/peta-ukhuwah/laporan"]').click()`);
  assert.equal(await evaluate('location.pathname'), '/portal/peta-ukhuwah/laporan/baru', 'Dirty navigation denied');
  await evaluate('window.__confirmResult=true'); await click('Simpan draf');
  await until(`document.body.textContent.includes('Draf tersimpan.')`, 'draft save');
  await click('Pratinjau revisi tersimpan'); assert.equal(await evaluate(`${button('Ajukan untuk moderasi')}.disabled`), true);
  await evaluate(`document.getElementById('ukhuwah-reviewed').click()`); await click('Ajukan untuk moderasi');
  await until(`document.body.textContent.includes('Laporan diajukan.')`, 'submit'); assert.equal(reports[0].publicationStatus, 'PENDING');
  role = 'SYSTEM_ADMIN'; actorId = otherId;
  await navigate(`/admin/peta-ukhuwah/laporan/${reports[0].id}`); await until(`document.getElementById('ukhuwah-moderationReason')`, 'moderation');
  await fill('ukhuwah-moderationReason', 'Ditinjau, layak dibagikan sesuai cakupan.'); await click('Simpan keputusan moderasi');
  await until(`document.body.textContent.includes('Disetujui')`, 'approval');
  await fill('ukhuwah-followupSummary', 'Koordinasi pengajar sedang dilaksanakan.'); await click('Simpan tindak lanjut');
  await until(`document.querySelector('article').textContent.includes('Koordinasi pengajar sedang dilaksanakan.')`, 'followup');
  role = 'USTADZ'; await navigate('/portal/peta-ukhuwah/laporan');
  await until(`document.body.textContent.includes('Kebutuhan Pengajar Browser')`, 'shared board');
  assert.equal(await evaluate(`document.body.textContent.includes('Koordinasi pengajar sedang dilaksanakan.')`), true);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise(r => setTimeout(r, 200)); assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'), true, 'Mobile no overflow');
  rejectNext = true; await navigate('/portal/peta-ukhuwah'); await until(`document.body.textContent.includes('API uji sementara')`, 'error state'); await click('Coba muat ulang');
  await until(`document.body.textContent.includes('Masjid Browser Uji')`, 'retry');
  role = 'EVENT_ADMIN'; await navigate('/admin/peta-ukhuwah'); await until(`document.body.textContent.includes('Akses Peta Ukhuwah tidak tersedia')`, 'unauthorized role');
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); const output = path.join(os.tmpdir(), 'ukhuwah-browser.png'); await writeFile(output, Buffer.from(screenshot.data, 'base64'));
  assert.deepEqual(failures, [], 'No browser errors, unexpected API, or external traffic');
  console.log(JSON.stringify({ result: 'PASS', mockedApiRequests: requests.length, mockedTileRequests: tiles.length, screenshot: output,
    checks: ['admin location create', 'private PIC excluded from portal', 'map opt-in/opt-out mocked tiles', 'draft save and dirty navigation', 'preview + review + submit', 'admin moderation', 'manual followup', 'shared report board', 'mobile overflow', 'API retry', 'scoped role denied', 'no real DB or external provider traffic'] }, null, 2));
} finally {
  socket?.close(); browser?.kill(); await server.close(); await new Promise(r => setTimeout(r, 500)); await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}