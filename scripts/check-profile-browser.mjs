/** Isolated Chromium smoke: a Vite server with ONLY in-memory fixtures; no DB, email or real API. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(import.meta.dirname, '..');
const chrome = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(existsSync);
if (!chrome) throw new Error('Set CHROME_PATH to an installed Chromium browser.');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'profile-browser-'));
let profile = { id: 'mock-profile', fullName: 'Abdullah Uji', email: 'contact@example.invalid', loginEmail: 'login@example.invalid', titlePrefix: 'Ust.', titleSuffix: 'Lc.', birthPlace: 'Bandung', birthDate: '1985-06-10', phone: '081234567890', whatsapp: '081234567890', address: 'Alamat lama', educationSummary: 'S1', expertiseSummary: 'Fiqih', profileStatus: 'ACTIVE', primaryInstitution: { institutionName: 'Lembaga Uji', institutionCode: 'TEST' } };
const requests = [], failures = [];
const participation = { participantId: 'mock-participant', participantCode: 'TEST-001', registrationSource: 'PUBLIC_INDIVIDUAL', isDelegationLead: false, confirmationStatus: 'CONFIRMED', approvalStatus: 'APPROVED', registeredAt: '2026-07-22T10:30:00Z', eventId: 'mock-event', eventCode: 'TEST-EVENT', eventSlug: 'mock-event', eventName: 'Daurah Uji Browser', eventStatus: 'PUBLISHED', posterUrl: '/images/event-poster-library-interior.png', startDate: '2026-10-03', endDate: '2026-10-05', venueName: 'Aula Uji', sessions: [{ id: 'mock-session', dayNumber: 1, dayDate: '2026-10-03', title: 'Materi Uji Browser', sessionType: 'MATERIAL', startAt: '2026-10-03T08:00:00Z', endAt: '2026-10-03T10:00:00Z', attendanceRequired: true, checkinRequired: true }], attendance: [{ id: 'mock-attendance', attendanceStatus: 'PRESENT', checkinAt: '2026-10-03T08:00:00Z', checkinMethod: 'QR_SCAN', sessionTitle: 'Materi Uji Browser', sessionStartAt: '2026-10-03T08:00:00Z' }] };
const announcement = { id: 'mock-announcement', title: 'Pengumuman Uji Browser', body: 'Informasi peserta uji.', publishedAt: '2026-10-01T10:00:00Z', isRead: false };
let rejectNext = false, delayNext = false, rejectRead = false, rejectAnnouncements = false, rejectQr = false;
const fixtures = {
  name: 'profile-browser-fixtures',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url?.startsWith('/portal')) {
        res.setHeader('Content-Type', 'text/html');
        return res.end(await server.transformIndexHtml(req.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
          import React from 'react';
          import {createRoot} from 'react-dom/client';
          import {BrowserRouter} from 'react-router-dom';
          import {Refine} from '@refinedev/core';
          import '/src/lib/portalNavigationGuard.ts';
          import '/src/index.css';
          const ParticipantPortalPage=React.lazy(()=>import('/src/pages/portal/ParticipantPortalPage.tsx').then(module=>({default:module.ParticipantPortalPage})));
          window.__confirmResult=true;window.__confirmCalls=[];window.confirm=(message)=>{window.__confirmCalls.push(message);return window.__confirmResult;};
          const authProvider={check:async()=>({authenticated:true}),getIdentity:async()=>({id:'mock-user',name:'Abdullah Uji',email:'login@example.invalid'}),logout:async()=>({success:true}),login:async()=>({success:true}),onError:async()=>({})};
          createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Refine,{authProvider,options:{disableTelemetry:true}},React.createElement(React.Suspense,{fallback:'Memuat portal…'},React.createElement(ParticipantPortalPage)))));
        </script></body></html>`));
      }
      // No real API plugin is loaded, and every API path is intercepted, including unexpected paths.
      if (!req.url?.startsWith('/api/')) return next();
      const route = req.url.replace('/api/v1', '').split('?')[0];
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      requests.push({ route, method: req.method, body });
      let data = null, error = null;
      if (route === '/portal/overview' && req.method === 'GET') data = { profile, participations: [participation] };
      else if (route === '/portal/announcements' && req.method === 'GET') {
        if (rejectAnnouncements) { rejectAnnouncements = false; res.statusCode = 503; error = { message: 'Pengumuman sementara tidak tersedia.' }; }
        else data = [announcement];
      }
      else if (route === '/portal/announcements/mock-announcement/read' && req.method === 'POST') {
        if (rejectRead) { rejectRead = false; res.statusCode = 503; error = { message: 'Status baca belum dapat disimpan.' }; }
        else { announcement.isRead = true; data = { success: true }; }
      }
      else if (route === '/portal/qr' && req.method === 'GET') {
        if (rejectQr) { rejectQr = false; res.statusCode = 503; error = { message: 'QR sementara tidak tersedia.' }; }
        else data = { participantId: participation.participantId, eventId: participation.eventId, eventName: participation.eventName, participantCode: participation.participantCode, opaqueQrToken: 'fixture-only-qr-token', status: 'CONFIRMED', ustadzName: profile.fullName };
      }
      else if (route === '/portal/profile' && req.method === 'PATCH') {
        if (delayNext) { delayNext = false; await new Promise((r) => setTimeout(r, 700)); }
        if (rejectNext) { rejectNext = false; res.statusCode = 409; error = { message: 'Email kontak sudah digunakan profil lain.' }; }
        else { profile = { ...profile, ...body, fullName: body.fullName.trim(), loginEmail: 'login@example.invalid' }; data = profile; }
      } else { res.statusCode = 404; error = { message: `Unexpected mocked route: ${req.method} ${route}` }; failures.push(error.message); }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ data, error }));
    });
  },
};
const server = await createServer({ root, configFile: false, envDir: false, plugins: [react(), fixtures],
  resolve: { alias: { '@': path.join(root, 'src') } }, server: { host: '127.0.0.1', port: 0 },
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api/v1') },
});
let browser, socket;
try {
  await server.listen();
  const { findIndonesianRegency } = await server.ssrLoadModule('/src/lib/indonesiaRegionData.ts');
  const bandungRegion = findIndonesianRegency('3273');
  assert.ok(bandungRegion, 'Bundled canonical Bandung record exists');
  const port = server.httpServer.address().port;
  browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${temporary}`, 'about:blank'], { stdio: 'ignore' });
  let debuggerPort;
  for (let i = 0; i < 100; i++) {
    try { debuggerPort = Number((await readFile(path.join(temporary, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  assert.ok(debuggerPort, 'Browser remote debugger started');
  const targets = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) { const [resolve, reject] = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') failures.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') failures.push(message.params.args);
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, [resolve, reject]); socket.send(JSON.stringify({ id, method, params })); });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function until(expression, label) {
    for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await new Promise((r) => setTimeout(r, 100)); }
    throw new Error(`Timed out: ${label}; errors=${JSON.stringify(failures)}; city=${JSON.stringify(await evaluate(`({value:document.getElementById('profile-city')?.value,focus:document.activeElement?.id,expanded:document.getElementById('profile-city')?.getAttribute('aria-expanded')})`))}; page=${await evaluate('document.body.innerText.slice(0,2000)')}`);
  }
  const button = (label) => `[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)})`;
  async function click(label) { await evaluate(`(()=>{const el=${button(label)};if(!el||el.disabled)throw new Error('Unavailable button ${label}');el.click()})()`); }
  async function fill(id, value) {
    await evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});if(!el)throw new Error('Missing field ${id}');const prototype=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  }
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  // Fail closed: block all non-loopback HTTP(S) traffic, even if a regression loads a remote region API.
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
  const previousMessageHandler = socket.onmessage;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Fetch.requestPaused') {
      const url = new URL(message.params.request.url);
      if (url.hostname !== '127.0.0.1') { failures.push(`External request blocked: ${url}`); void send('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'BlockedByClient' }); }
      else void send('Fetch.continueRequest', { requestId: message.params.requestId });
    }
    previousMessageHandler(event);
  };
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/portal` });
  await until(`document.getElementById('portal-greeting-title')?.textContent.includes('Abdullah Uji')`, 'personalized HOME greeting');
  assert.equal(await evaluate(`!!document.querySelector('a[href="/ruang-asatidz"]')`), false, 'No public Ruang link');
  async function navigateTab(tab, text) {
    const href = tab ? '/portal/' + tab : '/portal';
    await evaluate(`document.querySelector('a[href=${JSON.stringify(href)}]').click()`);
    await until(`location.pathname===${JSON.stringify(href)} && document.body.textContent.includes(${JSON.stringify(text)})`, 'tab ' + (tab || 'HOME'));
    if (tab) assert.equal(await evaluate(`!!document.getElementById('portal-greeting-title')`), false, 'Greeting HOME only: ' + tab);
    assert.equal(await evaluate(`!!document.querySelector('a[href="/ruang-asatidz"]')`), false);
  }
  await navigateTab('invitations', 'Pendaftaran saya');
  await navigateTab('activities', 'Kegiatan saya');
  await navigateTab('schedule', 'Materi Uji Browser');
  rejectQr = true;
  await navigateTab('qr', 'QR kehadiran individu');
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('QR sementara tidak tersedia')`, 'visible QR API failure');
  await navigateTab('attendance', 'Riwayat kehadiran');
  await navigateTab('qr', 'QR kehadiran individu');
  await until(`!!document.querySelector('svg title')?.textContent.includes('QR check-in')`, 'QR rendered');
  await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied')}}})`);
  await click('Salin kode');
  await until(`document.body.textContent.includes('salin secara manual')`, 'clipboard failure handled');
  await navigateTab('announcements', 'Pengumuman Uji Browser');
  rejectRead = true;
  await click('Tandai dibaca');
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('Status baca belum dapat disimpan')`, 'visible read API failure');
  assert.equal(announcement.isRead, false);
  await click('Tandai dibaca');
  await until(`document.body.textContent.includes('Sudah dibaca')`, 'announcement read saved');
  assert.equal(announcement.isRead, true);
  await navigateTab('', 'Assalamu');
  rejectAnnouncements = true;
  await send('Page.reload');
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('Pengumuman sementara tidak tersedia')`, 'announcement load error not silently empty');
  await click('Muat ulang portal');
  await until(`!!document.getElementById('portal-greeting-title') && !document.querySelector('[role="alert"]')`, 'announcement retry');
  await evaluate(`document.querySelector('a[href="/portal/profile"]').click()`);
  await until(`document.getElementById('profile-fullName')?.value==='Abdullah Uji'`, 'load portal profile');
  assert.equal(await evaluate(`${button('Simpan profil')}.disabled`), true);
  assert.equal(await evaluate(`document.getElementById('profile-loginEmail').readOnly`), true);
  assert.equal(await evaluate(`document.getElementById('profile-province').readOnly`), true);
  await fill('profile-fullName', 'Draft dibatalkan');
  await evaluate(`window.__confirmResult=false`);
  await click('Batalkan perubahan');
  assert.equal(await evaluate(`document.getElementById('profile-fullName').value`), 'Draft dibatalkan');
  await evaluate(`document.querySelector('a[href="/portal"]').click()`);
  assert.equal(await evaluate(`location.pathname`), '/portal/profile', 'Dirty navigation cancelled');
  const confirmationCount = await evaluate(`window.__confirmCalls.length`);
  await evaluate(`history.back()`);
  await until(`window.__confirmCalls.length>${confirmationCount} && location.pathname==='/portal/profile'`, 'dirty browser back cancelled');
  assert.equal(await evaluate(`document.getElementById('profile-fullName').value`), 'Draft dibatalkan', 'Browser back retains draft');
  await evaluate(`window.__confirmResult=true`);
  await click('Batalkan perubahan');
  assert.equal(await evaluate(`document.getElementById('profile-fullName').value`), 'Abdullah Uji');
  await fill('profile-fullName', 'Nama Baru Browser');
  await fill('profile-email', 'new-contact@example.invalid');
  await fill('profile-titlePrefix', 'Dr.'); await fill('profile-titleSuffix', 'M.A.');
  await fill('profile-birthPlace', 'Jakarta'); await fill('profile-birthDate', '1990-02-05');
  await fill('profile-phone', '+628123450000'); await fill('profile-whatsapp', '081234500001');
  await fill('profile-address', 'Jalan Uji Browser 1'); await fill('profile-educationSummary', 'Pendidikan uji'); await fill('profile-expertiseSummary', 'Keahlian uji');
  await fill('profile-city', 'kota bandung');
  await evaluate(`document.getElementById('profile-fullName').focus()`);
  await new Promise((r) => setTimeout(r, 200));
  await evaluate(`(()=>{const el=document.getElementById('profile-city');el.focus();el.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));})()`);
  await until(`document.querySelector('[role="listbox"]')?.textContent.toLowerCase().includes('bandung')`, 'multi-word city suggestion');
  const patchCount = () => requests.filter((r) => r.method === 'PATCH').length;
  const countBefore = patchCount();
  await click('Simpan profil');
  assert.equal(patchCount(), countBefore, 'Typed city without selected code never submits');
  await evaluate(`(()=>{const el=document.getElementById('profile-city');el.focus();el.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));})()`);
  await until(`!!document.querySelector('[role="listbox"]')`, 'city suggestions after validation');
  await evaluate(`(()=>{const list=document.querySelector('[role="listbox"]');[...list.querySelectorAll('button')].find(e=>/^KOTA BANDUNG\\s*[·,]/i.test(e.textContent.trim())).click()})()`);
  assert.equal(await evaluate(`document.getElementById('profile-province').value`), bandungRegion.province);
  assert.equal(await evaluate(`document.body.textContent.includes('3273')`), true);
  delayNext = true;
  await click('Simpan profil');
  await until(`document.querySelector('form[aria-label="Edit profil peserta"]').getAttribute('aria-busy')==='true'`, 'save pending');
  assert.equal(await evaluate(`document.getElementById('profile-fullName').matches(':disabled')`), true);
  assert.equal(await evaluate(`${button('Batalkan perubahan')}.disabled`), true);
  await evaluate(`document.querySelector('a[href="/portal"]').click()`);
  assert.equal(await evaluate(`location.pathname`), '/portal/profile', 'Pending navigation blocked');
  await until(`document.body.textContent.includes('Perubahan profil tersimpan.')`, 'save profile');
  assert.equal(patchCount(), countBefore + 1);
  const patch = requests.filter((r) => r.method === 'PATCH').at(-1).body;
  assert.deepEqual(patch, { fullName: 'Nama Baru Browser', email: 'new-contact@example.invalid', titlePrefix: 'Dr.', titleSuffix: 'M.A.', birthPlace: 'Jakarta', birthDate: '1990-02-05', phone: '+628123450000', whatsapp: '081234500001', address: 'Jalan Uji Browser 1', educationSummary: 'Pendidikan uji', expertiseSummary: 'Keahlian uji', city: bandungRegion.city, province: bandungRegion.province, cityCode: bandungRegion.id, provinceCode: bandungRegion.provinceId });
  assert.equal(profile.loginEmail, 'login@example.invalid');
  assert.equal(await evaluate(`document.getElementById('profile-loginEmail').value`), 'login@example.invalid');
  assert.equal(await evaluate(`${button('Simpan profil')}.disabled`), true);
  await fill('profile-email', 'conflict@example.invalid');
  rejectNext = true;
  await click('Simpan profil');
  await until(`document.querySelector('form [role="alert"]')?.textContent.includes('Email kontak sudah digunakan')`, 'specific server error');
  assert.equal(await evaluate(`document.getElementById('profile-email').value`), 'conflict@example.invalid', 'Failed save retains edits');
  await click('Batalkan perubahan');
  assert.equal(await evaluate(`document.getElementById('profile-email').value`), 'new-contact@example.invalid', 'Reset uses latest saved state');
  await send('Page.reload');
  await until(`document.getElementById('profile-fullName')?.value==='Nama Baru Browser'`, 'saved fixture reload');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true, 'No mobile overflow');
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const output = path.join(os.tmpdir(), 'profile-browser.png');
  await writeFile(output, Buffer.from(screenshot.data, 'base64'));
  assert.deepEqual(failures, [], 'No browser errors or unexpected/external API requests');
  console.log(JSON.stringify({ result: 'PASS', checks: ['all 8 portal tabs', 'personalized HOME-only greeting', 'no public Ruang links', 'schedule/attendance/QR', 'visible announcement/QR/read API errors and retry', 'clipboard failure', 'editable identity/contact/titles/birth', 'login email unchanged', 'multi-word domicile suggestions', 'selected codes required', 'read-only canonical province', 'dirty navigation/browser-back/discard', 'pending save safety', 'specific server errors', 'saved-state reset/reload', 'mobile overflow', 'no external requests'], mockedApiRequests: requests.length, screenshot: output }, null, 2));
} finally {
  socket?.close(); browser?.kill(); await server.close();
  await new Promise((r) => setTimeout(r, 500));
  await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}