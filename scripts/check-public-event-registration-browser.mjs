/** Isolated registration smoke: mocked API, no production data or database writes. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
const profile = await mkdtemp(path.join(os.tmpdir(), 'daurah-registration-browser-'));
const fixture = {
  name: 'daurah-registration-fixture',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (new URL(request.url, 'http://127.0.0.1').pathname !== '/public-event-registration-preview') return next();
      response.setHeader('Content-Type', 'text/html');
      response.end(await server.transformIndexHtml(request.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {MemoryRouter, Routes, Route} from 'react-router-dom';
        import {EventPublicPage} from '/src/pages/public/EventPublicPage.tsx';
        import {ParticipantCardPage} from '/src/pages/public/ParticipantCardPage.tsx';
        import {PublicParticipantConfirmationPage} from '/src/pages/public/PublicParticipantConfirmationPage.tsx';
        import '/src/index.css';
        const event = {
          id:'00000000-0000-0000-0000-000000000001',code:'DC-27',slug:'daurah-coba',name:'Daurah Coba Asatidz',
          subtitle:'Kajian dan silaturahmi para asatidz',description:'Daurah untuk para asatidz dengan kajian terjadwal dan presensi per hari.',
          posterUrl:null,posterAlt:null,posterFocalPoint:'CENTER',timezone:'Asia/Makassar',startDate:'2027-02-10',endDate:'2027-02-12',
          venueName:'Masjid Bandung',venueAddress:'Bandung, Jawa Barat',publicContactWhatsapp:'6281234567890',mapsUrl:'https://maps.google.com/',attendanceConfirmationRequired:true,
          status:'REGISTRATION_OPEN',audienceMode:'MIXED',capacity:30,regularQuota:20,invitationQuota:10,regularApproved:0,
          invitationApproved:0,registrationOpenAt:null,registrationCloseAt:'2027-02-09T08:00:00.000Z',
          days:[{id:'day-1',dayNumber:1,date:'2027-02-10',title:'Pembukaan'},{id:'day-2',dayNumber:2,date:'2027-02-12',title:'Penutup'}],
          sessions:[{id:'session-1',eventDayId:'day-1',title:'Materi pertama',sessionType:'MATERIAL',moderatorName:null,
            startAt:'2027-02-10T00:00:00.000Z',endAt:'2027-02-10T02:00:00.000Z',room:'Ruang utama',sortOrder:0}]
        };
        window.__posts = [];
        window.__confirmationRequests = [];
        window.fetch = async (url, options = {}) => {
          if (String(url).includes('/cards/public')) return {ok:true,json:async()=>({data:{ustadzName:'Ustadz Ahmad',eventName:event.name,
            eventSlug:event.slug,participantCode:'P-A1',opaqueQrToken:'pqr_one.signature',approvalStatus:'PENDING_REVIEW',confirmationStatus:'INVITED',attendanceConfirmationRequired:true}})};
          if (String(url).includes('/confirmations/public')) {
            window.__confirmationRequests.push({url:String(url),body:JSON.parse(options.body)});
            window.__confirmation ||= {participantName:'Ustadz Ahmad',participantCode:'P-A1',approvalStatus:'APPROVED',confirmationStatus:'INVITED',
              eventName:event.name,eventSlug:event.slug,eventStatus:'REGISTRATION_OPEN',startDate:event.startDate,endDate:event.endDate,
              timezone:event.timezone,venueName:event.venueName,publicContactWhatsapp:event.publicContactWhatsapp,
              attendanceConfirmationRequired:true,attendanceConfirmationDeadline:'2027-02-09T08:00:00.000Z',lateConfirmationPolicy:'BLOCK',
              canConfirm:true,canDecline:true,cardUrl:null};
            if (String(url).endsWith('/decision')) {
              const decision = JSON.parse(options.body).decision;
              const wasConfirmed = window.__confirmation.confirmationStatus === 'CONFIRMED';
              window.__confirmation = {...window.__confirmation,confirmationStatus:decision === 'CONFIRM' ? 'CONFIRMED' : 'CANCELLED',
                canConfirm:false,canDecline:decision === 'CONFIRM',cardUrl:decision === 'CONFIRM' ? '/card?token=pqr_one.signature' : null,
                cancellationKind:decision === 'DECLINE' ? wasConfirmed ? 'WITHDRAWN' : 'DECLINED' : null};
            }
            return {ok:true,json:async()=>({data:window.__confirmation})};
          }
          if (options.method === 'POST') {
            window.__posts.push(JSON.parse(options.body));
            return {ok:true,json:async()=>({data:{participantCode:'P-A1',approvalStatus:'PENDING_REVIEW',portalLoginUrl:'/login/ustadz',
              passwordSetupRequired:false,emailQueued:2,participants:[
                {fullName:'Ustadz Ahmad',email:'ahmad@example.id',whatsapp:'081234567890',participantCode:'P-A1',qrToken:'pqr_one.signature',cardUrl:'/card?token=pqr_one.signature',confirmationUrl:'/confirm#pcf_first.signature',temporaryPassword:'BukuTaman1234',temporaryPasswordIssued:true,passwordSetupRequired:false},
                {fullName:'Ustadz Hasan',email:'hasan@example.id',whatsapp:'081234567891',participantCode:'P-B2',qrToken:'pqr_two.signature',cardUrl:'/card?token=pqr_two.signature',confirmationUrl:'/confirm#pcf_second.signature',temporaryPassword:'BukuPagi5678',temporaryPasswordIssued:true,passwordSetupRequired:false}
              ]}})};
          }
          const sparse = new URLSearchParams(location.search).has('sparse');
          return {ok:true,json:async()=>({data:sparse ? {...event,description:null,venueName:null,venueAddress:null,
            publicContactWhatsapp:null,mapsUrl:null,timezone:'Asia/Jakarta',days:[],sessions:[]} : event})};
        };
        const initialEntry = new URLSearchParams(location.search).has('confirm') ? '/confirm#pcf_first.signature'
          : new URLSearchParams(location.search).has('card') ? '/card?token=pqr_one.signature' : '/events/daurah-coba';
        createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,{initialEntries:[initialEntry]},
          React.createElement(Routes,null,
            React.createElement(Route,{path:'/events/:slug',element:React.createElement(EventPublicPage)}),
            React.createElement(Route,{path:'/card',element:React.createElement(ParticipantCardPage)}),
            React.createElement(Route,{path:'/confirm',element:React.createElement(PublicParticipantConfirmationPage)}))));
      </script></body></html>`));
    });
  },
};
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: path.join(profile, 'vite-cache'), plugins: [react(), fixture],
  resolve: { alias: { '@': path.join(root, 'src') } }, server: { host: '127.0.0.1', port: 0 } });
let browser;
let socket;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let browserErrors = '';
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk).slice(0, 2000); });
  let debuggerPort;
  for (let i = 0; i < 100; i++) {
    try { debuggerPort = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  assert.ok(debuggerPort, `Chromium debugger started: ${browserErrors.slice(0, 1000)}`);
  const targets = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  const failures = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const [resolve, reject] = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown' && !/^(chrome|edge)-extension:\/\//.test(message.params.exceptionDetails?.url || ''))
      failures.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error'
      && !(message.params.stackTrace?.callFrames?.length > 0 && message.params.stackTrace.callFrames.every((frame) => /^(chrome|edge)-extension:\/\//.test(frame.url || ''))))
      failures.push(message.params.args);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, [resolve, reject]); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const setInput = async (selector, value) => evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/public-event-registration-preview` });
  for (let i = 0; i < 100 && !(await evaluate(`!!document.querySelector('.public-register__form')`)); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate(`document.querySelector('main h1')?.textContent`), 'Daurah Coba Asatidz');
  assert.equal(await evaluate(`document.querySelector('.event-public__information').compareDocumentPosition(document.querySelector('.event-public__schedule')) & Node.DOCUMENT_POSITION_FOLLOWING`), 4);
  assert.equal(await evaluate(`document.querySelector('.event-public__schedule').compareDocumentPosition(document.querySelector('#formulir-reguler')) & Node.DOCUMENT_POSITION_FOLLOWING`), 4);
  assert.match(await evaluate(`document.querySelector('.event-public__section-head p').textContent`), /WITA/);
  assert.match(await evaluate(`document.querySelector('.event-public__sessions time').textContent`), /08/);
  assert.equal(await evaluate(`document.querySelectorAll('.event-public__day').length`), 2);
  const keyContrast = await evaluate(`(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    const rgb = (value) => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3); };
    const luminance = (value) => rgb(value).map((channel) => { const unit = channel / 255; return unit <= .04045 ? unit / 12.92 : ((unit + .055) / 1.055) ** 2.4; })
      .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    const ratio = (foreground, background) => { const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); };
    return [
      ['.event-public-hero h1', '.event-public-hero__identity'],
      ['.event-public__primary', '.event-public__primary'],
      ['.event-public__secondary', '.event-public-hero__identity'],
      ['.event-public__local-nav a', 'body'],
    ].map(([textSelector, surfaceSelector]) => {
      const foreground = getComputedStyle(document.querySelector(textSelector)).color;
      const background = getComputedStyle(document.querySelector(surfaceSelector)).backgroundColor;
      return { textSelector, foreground, background, ratio: ratio(foreground, background) };
    });
  })()`);
  assert.equal(keyContrast.every(({ ratio }) => ratio >= 4.5), true, `key text contrast: ${JSON.stringify(keyContrast)}`);
  const screenshots = [];
  for (const width of [320, 375, 414, 768, 1280, 1920]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 768 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true, `no horizontal overflow at ${width}px`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.event-public__local-nav a, .event-public-hero__actions a, .public-register__primary')).every(el => el.getBoundingClientRect().height <= 56)`), true, `single-line actions at ${width}px`);
    if (width === 375 || width === 1280) {
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const target = path.join(os.tmpdir(), `daurah-event-hero-${width}.png`);
      await writeFile(target, Buffer.from(screenshot.data, 'base64'));
      screenshots.push(target);
    }
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 850, deviceScaleFactor: 1, mobile: true });
  await evaluate(`document.querySelector('.public-register__form').scrollIntoView({block:'start'})`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  let screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  let target = path.join(os.tmpdir(), 'daurah-registration-form-375.png');
  await writeFile(target, Buffer.from(screenshot.data, 'base64')); screenshots.push(target);
  await setInput('#register-name', 'Ustadz Ahmad');
  await setInput('#register-email', 'ahmad@example.id');
  await setInput('#register-whatsapp', '081234567890');
  await setInput('#register-city', 'KOTA BANDUNG');
  await new Promise((resolve) => setTimeout(resolve, 100));
  await setInput('#register-province', 'JAWA BARAT');
  await new Promise((resolve) => setTimeout(resolve, 100));
  await evaluate(`document.querySelector('.public-register__consent input').click()`);
  assert.equal(await evaluate(`document.querySelector('.public-register__consent input').checked`), true);
  await evaluate(`document.querySelector('.public-register__group-head button').click()`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate(`document.querySelector('.public-register__consent input').checked`), false, 'adding a group member resets consent');
  assert.equal(await evaluate(`document.querySelector('.public-register__member input[id$="-city"]').value`), 'KOTA BANDUNG');
  assert.equal(await evaluate(`document.querySelector('.public-register__member input[id$="-province"]').value`), 'JAWA BARAT');
  await setInput('.public-register__member input[id^="group-name-"]', 'Ustadz Hasan');
  await setInput('.public-register__member input[id^="group-email-"]', 'ahmad@example.id');
  await setInput('.public-register__member input[id^="group-whatsapp-"]', '081234567891');
  assert.equal(await evaluate(`document.querySelector('.public-register__form').checkValidity()`), false, 'consent remains required');
  await evaluate(`document.querySelector('.public-register__consent input').click()`);
  await evaluate(`document.querySelector('.public-register__form').requestSubmit()`);
  for (let i = 0; i < 30 && !(await evaluate(`!!document.querySelector('.public-register__error')`)); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.match(await evaluate(`document.querySelector('.public-register__error').textContent`), /email yang dipakai lebih dari satu/);
  assert.equal(await evaluate(`window.__posts.length`), 0);
  await setInput('.public-register__member input[id^="group-email-"]', 'hasan@example.id');
  await evaluate(`document.querySelector('.public-register__form').requestSubmit()`);
  for (let i = 0; i < 50 && !(await evaluate(`!!document.querySelector('.public-receipt')`)); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate(`window.__posts.length`), 1);
  assert.equal(await evaluate(`window.__posts[0].consentConfirmed`), true);
  assert.equal(await evaluate(`window.__posts[0].delegates[0].city`), 'KOTA BANDUNG');
  assert.equal(await evaluate(`document.querySelectorAll('.public-receipt__select option').length`), 2);
  assert.equal(await evaluate(`document.querySelector('.public-receipt__shortcuts a').getAttribute('href')`), '/events/daurah-coba#jadwal-kegiatan');
  assert.equal(await evaluate(`document.querySelector('.public-receipt__confirmation a').getAttribute('href')`), '/confirm#pcf_first.signature');
  assert.equal(await evaluate(`decodeURIComponent(document.querySelector('.public-receipt__confirmation-actions a[target="_blank"]').href).includes('/confirm#pcf_first.signature')`), true, 'group share points to the selected personal link');
  assert.equal(await evaluate(`decodeURIComponent(document.querySelector('.public-receipt__confirmation-actions a[target="_blank"]').href).includes('/card?token=pqr_one.signature')`), true, 'group share includes the selected proof QR link');
  assert.equal(await evaluate(`document.querySelector('.public-receipt__access').compareDocumentPosition(document.querySelector('.participant-qr-card')) & Node.DOCUMENT_POSITION_FOLLOWING`), 4, 'portal access precedes QR in reading order');
  for (const width of [320, 375, 414, 768]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 768 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true, `receipt has no horizontal overflow at ${width}px`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.public-receipt__shortcuts a')).every(el => el.getBoundingClientRect().height <= 56)`), true, `receipt shortcuts stay one line at ${width}px`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 850, deviceScaleFactor: 1, mobile: true });
  await evaluate(`document.querySelector('.public-receipt').scrollIntoView({block:'start'})`);
  assert.equal(await evaluate(`document.querySelector('.public-receipt__access').getBoundingClientRect().top < window.innerHeight`), true, 'portal access is discoverable in the first receipt viewport');
  assert.equal(await evaluate(`sessionStorage.getItem('registration:regular:daurah-coba').includes('BukuTaman1234')`), false, 'one-time password is not stored in session');
  await evaluate(`(() => { window.__downloads = []; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__downloads.push({ name: this.download, href: this.href }); }; document.querySelector('.participant-qr-card button').click(); })()`);
  for (let i = 0; i < 50 && !(await evaluate(`window.__downloads.length`)); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.match(await evaluate(`window.__downloads[0]?.href || ''`), /^data:image\/png;base64,/);
  assert.equal(await evaluate(`window.__downloads[0].name`), 'bukti-pendaftaran-P-A1.png');
  await evaluate(`document.querySelector('.public-receipt__select').querySelector('select').value = 'P-B2'; document.querySelector('.public-receipt__select select').dispatchEvent(new Event('change',{bubbles:true}));`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate(`document.querySelector('.public-receipt__confirmation a').getAttribute('href')`), '/confirm#pcf_second.signature', 'switching members switches the decision link');
  assert.equal(await evaluate(`decodeURIComponent(document.querySelector('.public-receipt__confirmation-actions a[target="_blank"]').href).includes('/confirm#pcf_second.signature')`), true, 'switching members switches the WhatsApp destination link');
  assert.equal(await evaluate(`decodeURIComponent(document.querySelector('.public-receipt__confirmation-actions a[target="_blank"]').href).includes('/card?token=pqr_two.signature')`), true, 'switching members switches the proof QR link');
  await evaluate(`document.querySelector('.participant-qr-card button').click()`);
  for (let i = 0; i < 50 && (await evaluate(`window.__downloads.length`)) < 2; i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate(`window.__downloads[1]?.name`), 'bukti-pendaftaran-P-B2.png');
  await evaluate(`document.querySelector('.public-receipt').scrollIntoView({block:'start'})`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  target = path.join(os.tmpdir(), 'daurah-registration-receipt-375.png');
  await writeFile(target, Buffer.from(screenshot.data, 'base64')); screenshots.push(target);
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/public-event-registration-preview?card=1` });
  for (let i = 0; i < 100 && !(await evaluate(`!!document.querySelector('.participant-card-page__links')`)); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate(`document.querySelector('.participant-card-page__links a').getAttribute('href')`), '/events/daurah-coba#jadwal-kegiatan');
  assert.equal(await evaluate(`document.querySelector('.participant-card-page__links a:last-child').getAttribute('href')`), '/login/ustadz');
  assert.equal(await evaluate(`document.querySelector('.participant-card-page').textContent.includes('BukuTaman1234')`), false, 'shareable QR card never reveals password');
  assert.equal(await evaluate(`!!document.querySelector('.participant-card-page .participant-qr-card')`), true, 'shareable card still renders the QR');
  for (const width of [320, 375, 414, 768]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 768 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true, `card page has no horizontal overflow at ${width}px`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 850, deviceScaleFactor: 1, mobile: true });
  screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  target = path.join(os.tmpdir(), 'daurah-participant-card-375.png');
  await writeFile(target, Buffer.from(screenshot.data, 'base64')); screenshots.push(target);
  await evaluate(`sessionStorage.removeItem('registration:regular:daurah-coba')`);
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/public-event-registration-preview?sparse=1` });
  for (let i = 0; i < 100 && !(await evaluate(`!!document.querySelector('.event-public__schedule-empty')`)); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate(`!!document.querySelector('.event-public__information')`), false, 'empty event information is not shown as filler');
  assert.equal(await evaluate(`document.querySelectorAll('.event-public__local-nav a').length`), 2, 'only live anchors remain');
  assert.match(await evaluate(`document.querySelector('.event-public__pending').textContent`), /Tempat acara belum diumumkan/);
  assert.equal(await evaluate(`!!document.querySelector('.public-register__form')`), true, 'registration remains usable without optional event details');
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true, 'sparse event has no mobile overflow');
  screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  target = path.join(os.tmpdir(), 'daurah-event-sparse-375.png');
  await writeFile(target, Buffer.from(screenshot.data, 'base64')); screenshots.push(target);
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/public-event-registration-preview?confirm=1` });
  for (let i = 0; i < 100 && !(await evaluate(`!!document.querySelector('.public-confirm__primary')`)); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.match(await evaluate(`document.querySelector('.public-confirm__state').textContent`), /Pendaftaran disetujui/);
  assert.equal(await evaluate(`document.querySelectorAll('.public-confirm__primary, .public-confirm__secondary').length`), 2);
  const confirmationContrast = await evaluate(`(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    const luminance = (color) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map(channel => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; })
        .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0); };
    return [['.public-confirm__primary','.public-confirm__primary'],['.public-confirm__secondary','.public-confirm__secondary'],
      ['.public-confirm__identity h2','.public-confirm__identity'],['.public-confirm__state h2','.public-confirm__state']]
      .map(([textSelector,surfaceSelector]) => { const a = luminance(getComputedStyle(document.querySelector(textSelector)).color);
        const b = luminance(getComputedStyle(document.querySelector(surfaceSelector)).backgroundColor);
        return {textSelector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}; });
  })()`);
  assert.equal(confirmationContrast.every(({ratio}) => ratio >= 4.5), true, `confirmation text contrast: ${JSON.stringify(confirmationContrast)}`);
  for (const width of [320, 375, 414, 768]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 768 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true, `confirmation has no horizontal overflow at ${width}px`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.public-confirm__primary, .public-confirm__secondary, .public-confirm__links a')).every(el => el.getBoundingClientRect().height <= 64)`), true, `confirmation actions stay one line at ${width}px`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.public-confirm__primary, .public-confirm__secondary')).every(el => el.getBoundingClientRect().height >= 44)`), true, `confirmation actions are touch sized at ${width}px`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 850, deviceScaleFactor: 1, mobile: true });
  screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  target = path.join(os.tmpdir(), 'daurah-confirmation-before-375.png');
  await writeFile(target, Buffer.from(screenshot.data, 'base64')); screenshots.push(target);
  await evaluate(`document.querySelector('.public-confirm__primary').click()`);
  for (let i = 0; i < 50 && !(await evaluate(`!!document.querySelector('.public-confirm__card')`)); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.match(await evaluate(`document.querySelector('.public-confirm__state').textContent`), /Insya Allah hadir/);
  assert.equal(await evaluate(`!!document.querySelector('.public-confirm__card .participant-qr-card')`), true);
  assert.match(await evaluate(`document.querySelector('.public-confirm__secondary').textContent`), /Mengundurkan diri/);
  assert.equal(await evaluate(`window.__confirmationRequests.every(request => !request.url.includes('pcf_') && request.body.token === 'pcf_first.signature')`), true,
    'confirmation bearer stays out of API request URLs');
  screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  target = path.join(os.tmpdir(), 'daurah-confirmation-after-375.png');
  await writeFile(target, Buffer.from(screenshot.data, 'base64')); screenshots.push(target);
  await evaluate(`document.querySelector('.public-confirm__secondary').click()`);
  assert.match(await evaluate(`document.querySelector('.public-confirm__decline').textContent`), /Tempat Ustadz akan dilepas/);
  assert.match(await evaluate(`document.querySelector('.public-confirm__decline').textContent`), /Ya, saya mengundurkan diri/);
  await evaluate(`document.querySelector('.public-confirm__danger').click()`);
  for (let i = 0; i < 50 && !(await evaluate(`document.querySelector('.public-confirm__state')?.textContent.includes('Pengunduran diri tercatat')`)); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate(`!!document.querySelector('.public-confirm__card')`), false, 'cancelled participant has no QR card');
  screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  target = path.join(os.tmpdir(), 'daurah-confirmation-withdrawn-375.png');
  await writeFile(target, Buffer.from(screenshot.data, 'base64')); screenshots.push(target);
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/public-event-registration-preview?confirm=1` });
  for (let i = 0; i < 100 && !(await evaluate(`!!document.querySelector('.public-confirm__secondary')`)); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.match(await evaluate(`document.querySelector('.public-confirm__secondary').textContent`), /Berhalangan hadir/);
  await evaluate(`document.querySelector('.public-confirm__secondary').click()`);
  assert.match(await evaluate(`document.querySelector('.public-confirm__decline').textContent`), /Ya, saya berhalangan/);
  await evaluate(`document.querySelector('.public-confirm__danger').click()`);
  for (let i = 0; i < 50 && !(await evaluate(`document.querySelector('.public-confirm__state')?.textContent.includes('Berhalangan hadir tercatat')`)); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate(`!!document.querySelector('.public-confirm__card')`), false, 'declined participant has no QR card');
  screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  target = path.join(os.tmpdir(), 'daurah-confirmation-declined-375.png');
  await writeFile(target, Buffer.from(screenshot.data, 'base64')); screenshots.push(target);
  assert.deepEqual(failures, [], 'no browser errors');
  console.log(JSON.stringify({ result: 'PASS', widths: [320, 375, 414, 768, 1280, 1920], keyContrast, confirmationContrast, screenshots }, null, 2));
} finally {
  socket?.close(); browser?.kill(); await server.close();
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (!path.resolve(profile).startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)) throw new Error('Unsafe temporary profile path');
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}
