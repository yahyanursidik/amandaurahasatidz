/** Actual directory/detail components in Chromium, isolated in-memory API; no database/email. */
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
if (!chrome) throw new Error('Set CHROME_PATH to an installed Chromium browser.');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'yts-notes-browser-'));
const profileId = '22222222-2222-4222-8222-222222222222', userId = '11111111-1111-4111-8111-111111111111';
const profile = { id: profileId, fullName: 'Asatidz Uji Browser', normalizedName: 'asatidz uji browser', profileStatus: 'ACTIVE', email: 'mock@example.invalid', cityCode: '3273', provinceCode: '32', completenessPercent: 80, affiliations: [], eventHistory: [] };
const notes = [], requests = [], failures = [];
let role = 'SYSTEM_ADMIN', conflictNext = false, rejectNext = false;
const now = () => new Date().toISOString();
const summary = () => { const active = notes.filter(n => !n.archivedAt); return [{ ustadzId: profileId, activeCount: active.length, flag: ['RED', 'YELLOW', 'BLUE', 'GREEN'].find(flag => active.some(n => n.flag === flag)) ?? null }]; };
const fixtures = {
  name: 'yts-notes-isolated-fixtures',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url?.startsWith('/admin/ustadz')) {
        const identity = { id: userId, name: 'YTS Uji', email: 'admin@example.invalid', assignments: [{ roleCode: role }] };
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'no-store');
        return res.end(await server.transformIndexHtml(req.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
          import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter,Routes,Route} from 'react-router-dom'; import {Refine} from '@refinedev/core';
          import '/src/lib/portalNavigationGuard.ts'; import '/src/index.css'; import {UstadzListPage} from '/src/pages/admin/ustadz/UstadzListPage.tsx'; import {UstadzShowPage} from '/src/pages/admin/ustadz/UstadzShowPage.tsx';
          window.__confirmResult=true;window.__confirmCalls=[];window.confirm=message=>{window.__confirmCalls.push(message);return window.__confirmResult;};
          const authProvider={check:async()=>({authenticated:true}),getIdentity:async()=>(${JSON.stringify(identity)}),logout:async()=>({success:true}),login:async()=>({success:true}),onError:async()=>({})};
          createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Refine,{authProvider,options:{disableTelemetry:true}},React.createElement(Routes,null,React.createElement(Route,{path:'/admin/ustadz',element:React.createElement(UstadzListPage)}),React.createElement(Route,{path:'/admin/ustadz/:id',element:React.createElement(UstadzShowPage)})))));
        </script></body></html>`));
      }
      if (!req.url?.startsWith('/api/')) return next();
      const url = new URL(req.url, 'http://127.0.0.1'), route = url.pathname.replace('/api/v1', '');
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      requests.push({ route, method: req.method, body });
      let data, meta, error;
      if (route === '/ustadz') { data = [profile]; meta = { page: 1, pageSize: 25, total: 1, pageCount: 1, summary: { total: 1, active: 1, inactive: 0, merged: 0, incomplete: 0, duplicateCandidates: 0 } }; }
      else if (route === `/ustadz/${profileId}`) data = profile;
      else if (route.startsWith('/admin/ustadz-notes')) {
        if (!['SYSTEM_ADMIN', 'SUPER_ADMIN'].includes(role)) { failures.push('Unauthorized notes request'); res.statusCode = 403; error = { message: 'Tidak berwenang.' }; }
        else if (rejectNext && req.method === 'GET') { rejectNext = false; res.statusCode = 503; error = { message: 'Catatan uji sementara tidak tersedia.' }; }
        else if (route.endsWith('/summary')) data = summary();
        else if (req.method === 'GET') {
          const archived = url.searchParams.get('archived') === 'true', flag = url.searchParams.get('flag');
          const rows = notes.filter(n => !!n.archivedAt === archived && (!flag || n.flag === flag));
          data = { data: rows, meta: { page: 1, pageSize: 20, total: rows.length, totalPages: rows.length ? 1 : 0 } };
        } else if (req.method === 'POST') {
          data = { ...body, id: '33333333-3333-4333-8333-333333333333', ustadzId: profileId, version: 1, archivedAt: null, createdAt: now(), updatedAt: now(), createdByName: 'YTS Uji', updatedByName: 'YTS Uji', sourceProfileName: profile.fullName }; notes.push(data);
        } else if (req.method === 'PATCH') {
          const note = notes.find(n => n.id === route.split('/')[4]);
          if (conflictNext || note.version !== body.expectedVersion) { conflictNext = false; res.statusCode = 409; error = { message: 'Revisi catatan berubah. Muat ulang.' }; }
          else { if (route.endsWith('/archive')) note.archivedAt = body.archived ? now() : null; else Object.assign(note, { title: body.title, body: body.body, flag: body.flag }); note.version++; note.updatedAt = now(); data = note; }
        }
      } else { res.statusCode = 404; error = { message: `Unexpected API ${req.method} ${route}` }; failures.push(error.message); }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data, meta, error }));
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
  assert.ok(debuggerPort);
  const targets = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/list`)).json(); socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
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
      else { failures.push(`External request blocked ${url}`); void send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'BlockedByClient' }); }
    }
  };
  async function evaluate(expression) { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
  async function until(expression, label) { for (let i = 0; i < 200; i++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Timeout ${label}: ${await evaluate('document.body.innerText.slice(0,4000)')}; errors=${JSON.stringify(failures)}`); }
  const button = label => `[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)})`;
  async function click(label) { await evaluate(`(()=>{const e=${button(label)};if(!e||e.disabled)throw new Error('Unavailable ${label}');e.click()})()`); }
  async function fill(id, value) { await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)throw new Error('Missing ${id}');const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`); }
  let navigationId = 0;
  const navigate = relative => send('Page.navigate', { url: `http://127.0.0.1:${port}${relative}${relative.includes('?') ? '&' : '?'}fixtureSession=${++navigationId}` });
  await send('Runtime.enable'); await send('Page.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
  await navigate('/admin/ustadz'); await until(`document.body.textContent.includes('Tanpa catatan aktif')`, 'directory summary');
  await evaluate(`document.querySelector('a[aria-label="Buka catatan internal YTS"]').click()`);
  await until(`${button('Tambah catatan YTS')}`, 'detail notes tab from badge');
  await click('Tambah catatan YTS'); await fill('yts-note-title', 'Klarifikasi koordinasi privat'); await fill('yts-note-body', 'Catatan privat uji: sumber dan tindak lanjut.'); await fill('yts-note-flag', 'RED');
  await evaluate(`window.__confirmResult=false;${button('Profil')}.click()`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Editor catatan YTS"]')!==null`), true, 'Dirty tab navigation protected');
  await evaluate('window.__confirmResult=true'); await click('Simpan catatan');
  await until(`document.querySelector('[aria-label="Catatan YTS"]')?.textContent.includes('Klarifikasi koordinasi privat')`, 'created note');
  assert.equal(notes[0].flag, 'RED');
  await click('Edit catatan'); await fill('yts-note-flag', 'GREEN'); await fill('yts-note-body', 'Tindak lanjut selesai, catatan privat diperbarui.'); conflictNext = true; await click('Simpan catatan');
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('Revisi catatan berubah')`, 'stale save error');
  assert.equal(await evaluate(`document.getElementById('yts-note-body').value`), 'Tindak lanjut selesai, catatan privat diperbarui.', 'Edits retained');
  await click('Simpan catatan'); await until(`!document.querySelector('[aria-label="Editor catatan YTS"]')`, 'updated save'); assert.equal(notes[0].flag, 'GREEN');
  await click('Arsipkan catatan'); await until(`document.body.textContent.includes('Belum ada catatan aktif')`, 'archived note');
  assert.equal(summary()[0].flag, null); await fill('yts-note-status', 'true'); await until(`${button('Pulihkan catatan')}`, 'archive list');
  await click('Pulihkan catatan'); await until(`document.body.textContent.includes('Belum ada catatan di arsip')`, 'restored note'); assert.equal(summary()[0].flag, 'GREEN');
  await fill('yts-note-status', 'false'); await until(`${button('Edit catatan')}`, 'active again');
  await navigate('/admin/ustadz'); await until(`document.body.textContent.includes('Hijau · Tindak lanjut selesai')`, 'updated directory badge');
  assert.equal(await evaluate(`document.body.textContent.includes('Klarifikasi koordinasi privat')`), false, 'Directory omits note text');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await new Promise(r => setTimeout(r, 250));
  assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'), true, 'Directory mobile no overflow');
  await navigate(`/admin/ustadz/${profileId}?tab=notes`); await until(`${button('Edit catatan')}`, 'mobile notes detail');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'), true, 'Notes mobile no overflow');
  rejectNext = true; await click('Muat ulang catatan'); await until(`document.body.textContent.includes('Catatan uji sementara')`, 'read error'); await click('Coba muat ulang');
  await until(`!document.body.textContent.includes('Catatan uji sementara')`, 'retry');
  const noteRequestCount = () => requests.filter(r => r.route.startsWith('/admin/ustadz-notes')).length;
  await send('Page.navigate', { url: 'about:blank' });
  await new Promise(r => setTimeout(r, 500));
  const before = noteRequestCount(); role = 'DATA_STEWARD'; await navigate(`/admin/ustadz/${profileId}?tab=notes`);
  await until(`document.body.textContent.includes('Identitas dan keahlian')`, 'unauthorized user profile fallback');
  assert.equal(await evaluate(`document.body.textContent.includes('Catatan internal YTS')`), false); assert.equal(noteRequestCount(), before, 'No notes request for DATA_STEWARD');
  await navigate('/admin/ustadz'); await until(`document.body.textContent.includes('Asatidz Uji Browser')`, 'unauthorized directory'); assert.equal(noteRequestCount(), before);
  assert.equal(await evaluate(`!!document.querySelector('a[aria-label="Buka catatan internal YTS"]')`), false);
  assert.deepEqual(failures, [], 'No browser exceptions, unexpected API, or external requests');
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); const output = path.join(os.tmpdir(), 'yts-notes-browser.png'); await writeFile(output, Buffer.from(screenshot.data, 'base64'));
  console.log(JSON.stringify({ result: 'PASS', mockedApiRequests: requests.length, screenshot: output, checks: ['directory badge + notes deeplink', 'create red note', 'dirty tab guard', 'edit green note', 'stale save keeps edits', 'archive removes active flag', 'restore flag', 'no note body in directory', 'mobile directory/detail', 'API retry', 'DATA_STEWARD no note request/UI', 'no real DB/email/network'] }, null, 2));
} finally {
  socket?.close(); browser?.kill(); await server.close(); await new Promise(r => setTimeout(r, 500)); await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}