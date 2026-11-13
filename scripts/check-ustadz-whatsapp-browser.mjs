/** Isolated Chromium smoke: no production API or actual WhatsApp messages. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(import.meta.dirname, '..');
const chrome = process.env.CHROME_PATH || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
if (!chrome) throw new Error('Chromium tidak ditemukan; set CHROME_PATH.');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'daurah-whatsapp-browser-'));
const profiles = Array.from({ length: 3 }, (_, index) => ({
  id: `ustadz-${index + 1}`, fullName: ['Ustadz Ahmad', 'Ustadz Hasan', 'Ustadz Yahya'][index],
  profileStatus: 'ACTIVE', whatsapp: `08123456789${index}`, phone: null, primaryInstitution: { institutionName: 'Pesantren Aman' },
}));
const eventA = '10000000-0000-4000-8000-000000000001';
const eventB = '10000000-0000-4000-8000-000000000002';
const routes = [], requests = [];
let eventAhmadNumber = '6281234567801';
const people = [
  { id: '20000000-0000-4000-8000-000000000001', fullName: 'Ustadz Event Ahmad', participantCode: 'P-A', number: '6281234567801', numberSource: 'WhatsApp', institutionName: 'Lembaga Uji', registrationSource: 'DIRECT_PUBLIC', approvalStatus: 'APPROVED', confirmationStatus: 'INVITED' },
  { id: '20000000-0000-4000-8000-000000000002', fullName: 'Ustadz Event Hasan', participantCode: 'P-B', number: '6281234567802', numberSource: 'WhatsApp', institutionName: null, registrationSource: 'DIRECT_PUBLIC', approvalStatus: 'APPROVED', confirmationStatus: 'INVITED' },
  { id: '20000000-0000-4000-8000-000000000003', fullName: 'Ustadz Nomor Ganda', participantCode: 'P-DUP', number: '6281234567801', numberSource: 'WhatsApp', institutionName: null, registrationSource: 'DIRECT_PUBLIC', approvalStatus: 'APPROVED', confirmationStatus: 'INVITED' },
  { id: '20000000-0000-4000-8000-000000000004', fullName: 'Ustadz Tanpa Nomor', participantCode: 'P-N', number: null, numberSource: null, institutionName: null, registrationSource: 'DIRECT_PUBLIC', approvalStatus: 'APPROVED', confirmationStatus: 'INVITED' },
];
const eventFor = (id) => ({ id, code: 'DAURAH-UJI', name: id === eventA ? 'Daurah Uji Satu' : 'Daurah Uji Dua', slug: id === eventA ? 'daurah-uji-satu' : 'daurah-uji-dua',
  startDate: '2099-03-04', endDate: '2099-03-05', timezone: 'Asia/Jakarta', venueName: 'Aula Ilmu', status: 'REGISTRATION_OPEN',
  attendanceConfirmationRequired: true, attendanceConfirmationDeadline: '2099-03-03T10:00:00Z', lateConfirmationPolicy: 'BLOCK' });
const failures = [];
const fixture = {
  name: 'ustadz-whatsapp-isolated-fixture',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname === '/admin/ustadz/whatsapp' || /^\/admin\/events\/[^/]+\/registrations(?:\/whatsapp)?$/.test(url.pathname)) {
        const identity = url.searchParams.has('viewer')
          ? { id: 'viewer-test', name: 'Admin Baca', assignments: [{ roleCode: 'REPORT_VIEWER' }] }
          : { id: 'admin-test', name: 'Admin Uji', assignments: [{ roleCode: 'SUPER_ADMIN' }] };
        response.setHeader('Content-Type', 'text/html');
        response.end(await server.transformIndexHtml(request.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
          import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter,Routes,Route} from 'react-router-dom'; import {Refine} from '@refinedev/core';
          import '/src/index.css'; import {UstadzWhatsAppWizardPage} from '/src/pages/admin/ustadz/UstadzWhatsAppWizardPage.tsx';
          import {EventRegistrationsPage} from '/src/pages/admin/events/EventRegistrationsPage.tsx';
          import {EventParticipantWhatsAppPage} from '/src/pages/admin/events/EventParticipantWhatsAppPage.tsx';
          const authProvider={check:async()=>({authenticated:true}),getIdentity:async()=>(${JSON.stringify(identity)}),logout:async()=>({success:true}),login:async()=>({success:true}),onError:async()=>({})};
          window.addEventListener('click',event=>{if(event.target.closest('a[href^="https://wa.me/"]'))event.preventDefault()},true);
          window.__drafts=[];
          window.open=()=>({closed:false,opener:null,document:{createElement:()=>({}),head:{appendChild:()=>{}}},location:{replace:url=>window.__drafts.push(url)},close:()=>{}});
          const route=(path,Component)=>React.createElement(Route,{path,element:React.createElement(Component)});
          createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,{future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(Refine,{authProvider,options:{disableTelemetry:true}},React.createElement(Routes,null,
            route('/admin/ustadz/whatsapp', UstadzWhatsAppWizardPage),
            route('/admin/events/:id/registrations', EventRegistrationsPage),
            route('/admin/events/:id/registrations/whatsapp', EventParticipantWhatsAppPage)))));
        </script></body></html>`));
        return;
      }
      if (!request.url?.startsWith('/api/v1/')) return next();
      response.setHeader('Content-Type', 'application/json');
      const respond = (data, meta) => response.end(JSON.stringify({ data, meta }));
      routes.push([request.method, url.pathname]);
      if (url.pathname === '/api/v1/ustadz' && request.method === 'GET') return respond(profiles, { pageCount: 1 });
      const event = url.pathname.match(/^\/api\/v1\/events\/([^/]+)\/(.+)$/);
      if (event && [eventA, eventB].includes(event[1])) {
        const id = event[1];
        if (event[2] === 'registration-settings') return respond(eventFor(id));
        if (event[2] === 'participants') return respond([]);
        if (event[2] === 'participants/whatsapp' && request.method === 'GET') {
          requests.push({ id, method: 'GET', query: Object.fromEntries(url.searchParams) });
          const page = url.searchParams.get('page');
          return respond({ recipients: id !== eventA ? [] : page === '1' ? [people[0], people[3]] : [people[1], people[2]], hasNext: id === eventA && page === '1' });
        }
        if (event[2] === 'participants/whatsapp' && request.method === 'POST') {
          let raw = '';
          for await (const chunk of request) raw += chunk;
          const body = JSON.parse(raw);
          requests.push({ id, method: 'POST', body });
          return respond({ event: eventFor(id), recipients: id !== eventA ? [] : body.participantIds.flatMap((participantId) => {
            const person = people.find((item) => item.id === participantId);
            return person ? [{ ...person, ...(person.id === people[0].id ? { number: eventAhmadNumber } : {}), confirmationAvailable: Boolean(body.confirmation && person.number),
              ...(body.statusLinkFor === participantId ? { registrationStatusUrl: `/confirm#prc_${person.participantCode}.signature` } : {}) }] : [];
          }) });
        }
      }
      failures.push(`Unexpected API ${request.method} ${url.pathname}`);
      response.statusCode = 404; respond(null);
    });
  },
};
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: path.join(temporary, 'vite-cache'), plugins: [react(), fixture],
  resolve: { alias: { '@': path.join(root, 'src') } }, optimizeDeps: { include: ['react', 'react-dom/client', 'react-router-dom', '@refinedev/core', 'lucide-react'] },
  server: { host: '127.0.0.1', port: randomInt(48000, 54000), strictPort: true } });
let browser, socket;
try {
  await server.listen(); const port = server.httpServer.address().port;
  browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${temporary}`, 'about:blank'], { stdio: 'ignore' });
  let debuggerPort;
  for (let index = 0; index < 100; index++) {
    try { debuggerPort = Number((await readFile(path.join(temporary, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  assert.ok(debuggerPort, 'Chromium debugger started');
  const targets = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, [resolve, reject]); socket.send(JSON.stringify({ id, method, params })); });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) { const [resolve, reject] = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown' && !/^(chrome|edge)-extension:\/\//.test(message.params.exceptionDetails?.url || '')) failures.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error'
      && !(message.params.stackTrace?.callFrames?.length && message.params.stackTrace.callFrames.every((frame) => /^(chrome|edge)-extension:\/\//.test(frame.url || '')))) failures.push(message.params.args);
  };
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async (expression, label) => {
    for (let index = 0; index < 300; index++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise((resolve) => setTimeout(resolve, 100)); }
    throw new Error(`Timeout ${label}: ${await evaluate('document.body.innerText.slice(0,3000)')}; ${JSON.stringify(failures)}`);
  };
  const button = (label) => `[...document.querySelectorAll('button')].find(element=>element.textContent.trim()===${JSON.stringify(label)})`;
  const click = (label) => evaluate(`(()=>{const element=${button(label)};if(!element||element.disabled)throw new Error('Unavailable ${label}');element.click()})()`);
  const select = (selector, value) => evaluate(`(()=>{const select=document.querySelector(${JSON.stringify(selector)});select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  const navigate = (route) => send('Page.navigate', { url: `http://127.0.0.1:${port}${route}` });
  const checkWidths = async () => {
    for (const width of [320, 375, 414, 768, 1280]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth`), true, `No horizontal overflow at ${width}px`);
      assert.equal(await evaluate(`Array.from(document.querySelectorAll('.wa-batch__actions button,.wa-batch__send-actions button,.wa-batch__send-actions a,.wa-batch__entry')).every(el=>el.getBoundingClientRect().height>=44&&el.scrollWidth<=el.clientWidth+2)`), true, `WhatsApp controls stay readable and touch-sized at ${width}px`);
    }
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/admin/ustadz/whatsapp` });
  await until(`!!document.getElementById('wa-batch-message')`, 'composer');
  await until(`document.getElementById('wa-batch-sender')?.value==='Admin Uji'`, 'admin identity');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 844, deviceScaleFactor: 1, mobile: false });
  await new Promise((resolve) => setTimeout(resolve, 150));
  const composer = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const composerPath = path.join(os.tmpdir(), 'daurah-whatsapp-compose.png');
  await writeFile(composerPath, Buffer.from(composer.data, 'base64'));
  const contrastRatios = await evaluate(`(() => {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');
    const luminance=value=>{context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);
      return Array.from(context.getImageData(0,0,1,1).data).slice(0,3).map(channel=>{const unit=channel/255;return unit<=.04045?unit/12.92:((unit+.055)/1.055)**2.4})
        .reduce((sum,channel,index)=>sum+channel*[.2126,.7152,.0722][index],0)};
    return ['.wa-batch__editor','.wa-batch__preview','.wa-batch__preview pre','.wa-batch__primary'].map(selector=>{
      const style=getComputedStyle(document.querySelector(selector));const levels=[luminance(style.color),luminance(style.backgroundColor)].sort((a,b)=>b-a);
      return {selector,ratio:(levels[0]+.05)/(levels[1]+.05)}});
  })()`);
  for (const { selector, ratio } of contrastRatios) assert.ok(ratio >= 4.5, `Text contrast ${selector}: ${ratio.toFixed(2)}:1`);
  assert.match(await evaluate(`document.querySelector('.wa-batch__preview pre').textContent`), /Daurah Duat dan Pegiat Dakwah/);
  await click('Pilih penerima');
  await until(`document.querySelectorAll('.wa-batch__recipient').length===3`, 'recipient directory');
  await click('Pilih hasil'); await click('Mulai 3 penerima');
  await until(`document.querySelector('.wa-batch__current h3')?.textContent==='Ustadz Ahmad'`, 'first recipient');
  assert.equal(await evaluate(`${button('Sudah kirim & lanjut')}.disabled`), true);
  assert.match(await evaluate(`document.querySelector('.wa-batch__send-actions a').href`), /^https:\/\/wa\.me\/6281234567890\?text=/);
  await evaluate(`document.querySelector('.wa-batch__send-actions a').click()`);
  await until(`${button('Sudah kirim & lanjut')}?.disabled===false`, 'draft opened');
  await click('Sudah kirim & lanjut');
  await until(`document.querySelector('.wa-batch__current h3')?.textContent==='Ustadz Hasan'`, 'second recipient');
  await click('Lewati');
  await until(`document.querySelector('.wa-batch__current h3')?.textContent==='Ustadz Yahya'`, 'third recipient');
  assert.match(await evaluate(`document.querySelector('.wa-batch__progress p').textContent`), /1 ditandai terkirim · 1 dilewati/);
  await send('Page.reload');
  await until(`document.querySelector('.wa-batch__current h3')?.textContent==='Ustadz Yahya'`, 'persisted progress');
  for (const width of [320, 390, 414, 768, 1280]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth`), true, `No horizontal overflow at ${width}px`);
  }
  const desktop = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const desktopPath = path.join(os.tmpdir(), 'daurah-whatsapp-desktop.png');
  await writeFile(desktopPath, Buffer.from(desktop.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise((resolve) => setTimeout(resolve, 150));
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const screenshotPath = path.join(os.tmpdir(), 'daurah-whatsapp-mobile.png');
  await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  const directoryReads = routes.filter(([, route]) => route === '/api/v1/ustadz').length;
  await navigate(`/admin/events/${eventA}/registrations?view=participants&source=REGULAR&search=Ustadz`);
  await until(`!!document.querySelector('a.wa-batch__entry')`, 'WhatsApp entry on the participants tab');
  await evaluate(`document.querySelector('a.wa-batch__entry').click()`);
  await until(`document.querySelector('.wa-batch__preview pre')?.textContent.includes('Daurah Uji Satu')`, 'event composer with context');
  assert.equal(requests.length, 0, 'no recipient query during event compose');
  assert.match(await evaluate(`document.querySelector('[aria-label="Area kerja event"]')?.value || document.querySelector('select option:checked')?.value`), /registrations\?view=participants/);
  assert.match(await evaluate(`document.querySelector('.wa-batch__preview pre').textContent`), /\/events\/daurah-uji-satu#jadwal-kegiatan/);
  await checkWidths();
  await select('#wa-batch-template', 'EVENT_CONFIRMATION');
  assert.match(await evaluate(`document.querySelector('.wa-batch__preview pre').textContent`), /\[tautan bukti pendaftaran\]/);
  await click('Pilih penerima');
  await until(`document.querySelectorAll('.wa-batch__recipient').length===2`, 'event recipient page one');
  assert.deepEqual(requests[0].query, { search: 'Ustadz', source: 'REGULAR', status: 'AWAITING_CONFIRMATION', page: '1', pageSize: '50' });
  assert.equal(await evaluate(`document.querySelector('.wa-batch__recipient:last-child input').disabled`), true);
  await click('Pilih halaman');
  await click('Berikutnya');
  await until(`document.querySelector('.wa-batch__recipient strong')?.textContent==='Ustadz Event Hasan'`, 'event recipient page two');
  await click('Pilih halaman');
  await until(`document.querySelector('.wa-batch__alert')?.textContent.includes('nomor yang sudah dipilih')`, 'duplicate number excluded');
  await click('Mulai 2 penerima');
  await until(`!!${button('Buka WhatsApp')}`, 'first recipient ready');
  assert.equal(await evaluate(`${button('Sudah kirim & lanjut')}.disabled`), true);
  assert.ok(requests.every((item) => !item.body?.statusLinkFor), 'no receipt link until explicit click');
  eventAhmadNumber = '6281234567811';
  await click('Buka WhatsApp');
  await until(`document.querySelector('.wa-batch__alert')?.textContent.includes('Nomor WhatsApp berubah')`, 'changed number requires recheck');
  assert.equal(await evaluate(`window.__drafts.length`), 0, 'stale contact did not open a draft');
  await click('Buka WhatsApp');
  await until(`window.__drafts[0]?.includes('prc_P-A')`, 'first safe receipt draft');
  assert.match(await evaluate(`window.__drafts[0]`), /^https:\/\/wa\.me\/6281234567811/);
  assert.equal(await evaluate(`JSON.stringify(localStorage).includes('prc_P-A')`), false, 'receipt links are not persisted');
  assert.equal(await evaluate(`JSON.stringify(localStorage).includes('6281234567801')`), false, 'phone numbers are not persisted');
  await click('Sudah kirim & lanjut');
  await until(`!!${button('Buka WhatsApp')}`, 'second recipient ready');
  await click('Buka WhatsApp');
  await until(`window.__drafts[1]?.includes('prc_P-B')`, 'second safe receipt draft');
  assert.equal(await evaluate(`window.__drafts[1].includes('prc_P-A')`), false);
  assert.ok(requests.some((item) => item.body?.participantIds.length === 1 && item.body.statusLinkFor === people[1].id));
  await checkWidths();
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 844, deviceScaleFactor: 1, mobile: true });
  const eventScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const eventScreenshotPath = path.join(os.tmpdir(), 'daurah-event-whatsapp-mobile.png');
  await writeFile(eventScreenshotPath, Buffer.from(eventScreenshot.data, 'base64'));
  await navigate(`/admin/events/${eventB}/registrations/whatsapp`);
  await until(`document.querySelector('.wa-batch__preview pre')?.textContent.includes('Daurah Uji Dua')`, 'event two has a separate session');
  await navigate(`/admin/events/${eventA}/registrations/whatsapp`);
  await until(`document.querySelector('.wa-batch__current h3')?.textContent==='Ustadz Event Hasan'`, 'event one resumes its own queue');
  await click('Lewati');
  await until(`document.querySelector('.wa-batch__progress p')?.textContent.includes('1 ditandai terkirim · 1 dilewati')`, 'event queue complete');
  assert.equal(routes.filter(([, route]) => route === '/api/v1/ustadz').length, directoryReads, 'event workflow never loads the global directory');
  await navigate(`/admin/events/${eventA}/registrations?view=participants&viewer=1`);
  await until(`document.querySelector('[aria-label="Filter status peserta"]')`, 'read-only participants tab');
  assert.equal(await evaluate(`!!document.querySelector('a.wa-batch__entry')`), false, 'read-only admin has no wizard entry');
  const scopedReads = requests.length;
  await navigate(`/admin/events/${eventA}/registrations/whatsapp?viewer=1`);
  await until(`document.querySelector('.wa-batch__alert')?.textContent.includes('hanya tersedia untuk admin')`, 'direct read-only route rejected');
  assert.equal(requests.length, scopedReads);
  assert.deepEqual(failures, [], 'No browser exceptions or unexpected API requests');
  console.log(JSON.stringify({ result: 'PASS', checks: ['directory regression', 'event entry and scope', 'two-page selection', 'duplicate and invalid contact handling', 'personal status links', 'manual send and skip', 'isolated progress', 'read-only guard', '320–1280px layout'], contrastRatios, screenshots: [composerPath, desktopPath, screenshotPath, eventScreenshotPath] }, null, 2));
} finally {
  socket?.close(); browser?.kill(); await server.close(); await new Promise((resolve) => setTimeout(resolve, 400));
  if (path.dirname(path.resolve(temporary)) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith('daurah-whatsapp-browser-')) throw new Error('Unsafe temporary profile path');
  await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}
