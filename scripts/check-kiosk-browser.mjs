/** Kiosk and self-check-in browser smoke. API is mocked; no database or production writes. */
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
const profile = await mkdtemp(path.join(os.tmpdir(), 'daurah-kiosk-browser-'));
const eventId = '00000000-0000-4000-8000-000000000001';
const dayId = '00000000-0000-4000-8000-000000000002';
const participantId = '00000000-0000-4000-8000-000000000003';
const locationToken = `loc_qr_${'a'.repeat(64)}`;
const fixture = { name: 'daurah-kiosk-fixture', configureServer(server) {
  server.middlewares.use(async (request, response, next) => {
    const route = new URL(request.url, 'http://127.0.0.1').pathname;
    if (!['/check-in/daurah-coba', '/committee/location-qr', '/portal/attendance', '/login/ustadz'].includes(route)) return next();
    response.setHeader('Content-Type', 'text/html');
    response.end(await server.transformIndexHtml(request.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import jsQR from 'jsqr';
      import {App} from '/src/App.tsx';
      import '/src/index.css';
      const eventId = '${eventId}', dayId = '${dayId}', participantId = '${participantId}';
      const date = '2026-11-13', checkinAt = '2026-11-13T01:00:00Z';
      const unit = {id:'DAY:'+dayId,type:'DAY',dayId,sessionId:null,title:'Hari pertama',date,isOpen:true,openAt:date+'T00:00:00Z',closeAt:date+'T23:59:59Z'};
      const schedule = {units:[unit], timezone:'Asia/Makassar', attendanceMode:'DAILY_ONLY', manualUnitCount:0, eventAllowsCheckin:true};
      window.__paired = false; window.__posts = []; window.__selfPosts = []; window.__issued = [];
      if (location.search.includes('fixture=committee')) sessionStorage.setItem('fixture-role','CHECKIN_OFFICER');
      if (location.search.includes('fixture=anonymous')) sessionStorage.removeItem('fixture-role');
      const imageForQr = (svg) => new Promise((resolve,reject) => { const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject;
        img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg))); });
      window.__decodeQr = async (svg) => {
        const img=await imageForQr(svg); const canvas=document.createElement('canvas'); canvas.width=600; canvas.height=600;
        const ctx=canvas.getContext('2d'); ctx.fillStyle='white'; ctx.fillRect(0,0,600,600); ctx.drawImage(img,0,0,600,600);
        return jsQR(ctx.getImageData(0,0,600,600).data,600,600)?.data;
      };
      window.__fakeCamera = async (svg) => {
        Object.defineProperty(window,'BarcodeDetector',{value:undefined,configurable:true});
        const img=await imageForQr(svg); const canvas=document.createElement('canvas'); canvas.width=600; canvas.height=600;
        const ctx=canvas.getContext('2d');
        const draw=()=>{ctx.fillStyle='white';ctx.fillRect(0,0,600,600);ctx.drawImage(img,0,0,600,600);};
        Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
          const stream=canvas.captureStream(5); draw(); window.__cameraStream=stream;
          const interval=setInterval(()=>{if(stream.getTracks().some(track=>track.readyState==='live'))draw();else clearInterval(interval);},150);
          return stream;
        }});
      };
      const realFetch = window.fetch.bind(window);
      window.fetch = async (url, options = {}) => {
        const pathname = new URL(url, location.origin).pathname;
        if (!pathname.startsWith('/api/v1/')) return realFetch(url, options);
        const reply = (data, status=200, message='Perangkat kiosk belum diaktifkan.') => new Response(
          JSON.stringify({data,error:status<400?null:{message}}), {status,headers:{'Content-Type':'application/json'}});
        if (pathname.endsWith('/auth/session')) {
          const roleCode=sessionStorage.getItem('fixture-role');
          return roleCode ? reply({userId:participantId,name:'Ustadz Uji',email:'ustadz@example.test',assignments:[{roleCode,eventId}]}) : reply(null,401);
        }
        if (pathname.endsWith('/auth/password/login')) { sessionStorage.setItem('fixture-role','USTADZ'); return reply({}); }
        if (pathname.endsWith('/committee/context')) return reply({assignments:[{id:'task-one',eventId,eventName:'Daurah Coba Asatidz',
          eventCode:'DC-27',eventSlug:'daurah-coba',eventStatus:'ONGOING',committeeRole:'CHECKIN_OFFICER',effectivePermissions:['attendance.read','attendance.record']}]});
        if (pathname.endsWith('/sessions/active')) return reply(schedule);
        if (pathname.endsWith('/location-qr')) { window.__issued.push(JSON.parse(options.body)); return reply({
          eventId,dayId,sessionId:null,rawToken:'${locationToken}',validForMs:30000,
        }); }
        if (pathname.endsWith('/portal/overview')) return reply({profile:{id:participantId,fullName:'Ustadz Uji',affiliations:[]},
          participations:[{participantId,eventId,eventCode:'DC-27',eventSlug:'daurah-coba',eventName:'Daurah Coba Asatidz',
            eventStatus:'ONGOING',startDate:date,endDate:date,timezone:'Asia/Makassar',registeredAt:checkinAt,registrationSource:'PUBLIC_REGISTRATION',
            participantCode:'PAR-UJI-1',approvalStatus:'APPROVED',confirmationStatus:'CONFIRMED',sessions:[],attendance:[]}]});
        if (pathname.endsWith('/portal/announcements')) return reply([]);
        if (pathname.endsWith('/portal/self-checkin')) { window.__selfPosts.push(JSON.parse(options.body)); return reply({
          status:'SUCCESS',attendanceStatus:'PRESENT',attendanceRecordId:'mock-record',attendanceUnit:unit,
          checkinAt,participantCode:'PAR-UJI-1',method:'SELF_SCAN',timezone:'Asia/Makassar',
        }); }
        if (pathname.endsWith('/pair')) { window.__paired = true; return reply({device:{id:'device-one',label:'Meja utama'}}); }
        if (!window.__paired) return reply(null,401);
        if (pathname.endsWith('/session')) return reply({device:{id:'device-one',label:'Meja utama',deviceExpiresAt:'2027-12-01T00:00:00Z'},event:{slug:'daurah-coba',code:'DC-27',name:'Daurah Coba Asatidz'}});
        if (pathname.endsWith('/units')) return reply(schedule);
        if (pathname.endsWith('/summary')) return reply({unitId:unit.id,total:30,present:12,excused:1,absent:17});
        if (pathname.endsWith('/checkin')) { window.__posts.push(JSON.parse(options.body)); return reply({
          participant:{ustadzName:'Ustadz Ahmad'},attendanceUnit:unit,attendanceStatus:'PRESENT',checkinAt,
        }); }
        return reply(null,404);
      };
      createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(App)));
    </script></body></html>`));
  });
} };
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: path.join(profile, 'vite-cache'), plugins: [react(), fixture],
  resolve: { alias: { '@': path.join(root, 'src') } }, server: { host: '127.0.0.1', port: 0 } });
let browser; let socket;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let debuggerPort;
  for (let i = 0; i < 100; i++) { try { debuggerPort = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); } }
  assert.ok(debuggerPort, 'Chromium debugger failed to start');
  const targets = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const pending = new Map(); const failures = [];
  socket.onmessage = ({ data }) => { const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) { const [resolve, reject] = pending.get(message.id); pending.delete(message.id);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') failures.push(message.params.exceptionDetails); };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, [resolve, reject]); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const waitFor = async (expression, message) => {
    for (let i = 0; i < 120; i++) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.fail(message);
  };
  const input = (selector, value) => evaluate(`(() => {
    const field=document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)});
    field.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  const click = (text) => evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.includes(${JSON.stringify(text)}))?.click()`);
  const origin = `http://127.0.0.1:${port}`;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: `${origin}/check-in/daurah-coba#pair=kpair_fixture` });
  await waitFor(`!!document.querySelector('.kiosk-page__scan')`, 'kiosk did not activate');
  assert.equal(await evaluate(`document.querySelector('main h1')?.textContent`), 'Daurah Coba Asatidz');
  assert.equal(await evaluate(`location.hash`), '', 'one-time pairing token removed from browser address');
  assert.equal(await evaluate(`!!document.querySelector('input[placeholder*="nama"], input[placeholder*="kode peserta"]')`), false);
  const screenshots = [];
  for (const width of [320, 375, 414, 768, 1280, 1920]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 768 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true, `horizontal overflow at ${width}px`);
    if (width === 375 || width === 1280) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const target = path.join(os.tmpdir(), `daurah-kiosk-${width}.png`); await writeFile(target, Buffer.from(shot.data, 'base64')); screenshots.push(target); }
  }
  await input('#kiosk-qr-input', 'pqr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  await evaluate(`document.querySelector('.kiosk-page__scanner-input').requestSubmit()`);
  await waitFor(`!!document.querySelector('.kiosk-page__success')`, 'kiosk did not acknowledge scan');
  assert.match(await evaluate(`document.querySelector('.kiosk-page__success')?.textContent || ''`), /Hadir tercatat/);
  assert.equal(await evaluate(`document.body.textContent.includes('Ustadz Ahmad')`), false);
  assert.equal(await evaluate(`window.__posts[0]?.dayId`), dayId);
  assert.equal(await evaluate(`window.__posts[0]?.method`), undefined);
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 850, deviceScaleFactor: 1, mobile: true });
  const successShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const successTarget = path.join(os.tmpdir(), 'daurah-kiosk-success-375.png');
  await writeFile(successTarget, Buffer.from(successShot.data, 'base64')); screenshots.push(successTarget);

  await evaluate(`window.__paired=false; document.dispatchEvent(new Event('visibilitychange'));`);
  await waitFor(`document.body.textContent.includes('Kiosk belum aktif')`, 'kiosk did not lock after revocation');
  await send('Page.navigate', { url: `${origin}/committee/location-qr?fixture=committee` });
  await waitFor(`[...document.querySelectorAll('button')].some(button=>button.textContent.includes('Tampilkan QR')&&!button.disabled)`, 'QR Lokasi did not find the open unit');
  await click('Tampilkan QR');
  await waitFor(`!!document.querySelector('svg.attendance-workspace__qr')`, 'location QR not rendered');
  assert.deepEqual(await evaluate(`window.__issued`), [{ dayId, rotate: false }]);
  const svg = await evaluate(`new XMLSerializer().serializeToString(document.querySelector('svg.attendance-workspace__qr'))`);
  const decoded = await evaluate(`window.__decodeQr(${JSON.stringify(svg)})`);
  assert.equal(decoded, `${origin}/portal/attendance#e=${eventId}&qr=${locationToken}&d=${dayId}`);
  await click('Putar QR');
  await waitFor(`window.__issued.length === 2`, 'rotation was not sent');
  assert.deepEqual(await evaluate(`window.__issued[1]`), { dayId, rotate: true });
  await click('Jeda layar');
  assert.equal(await evaluate(`!!document.querySelector('svg.attendance-workspace__qr')`), false);

  await send('Page.navigate', { url: `${origin}/portal/attendance?fixture=anonymous${new URL(decoded).hash}` });
  await waitFor(`location.pathname === '/login/ustadz' && !!document.querySelector('#ustadz-email')`, 'anonymous QR did not open login');
  assert.equal(await evaluate(`location.hash`), '');
  await input('#ustadz-email', 'ustadz@example.test');
  await input('#ustadz-password', 'Password-Uji-2026');
  await evaluate(`document.querySelector('#ustadz-email').form.requestSubmit()`);
  await waitFor(`location.pathname === '/portal/attendance' && document.body.textContent.includes('QR Lokasi terbaca')`, 'QR was not carried through login');
  assert.equal(await evaluate(`location.hash`), '', 'bearer was removed from address');
  assert.deepEqual(await evaluate(`window.__selfPosts`), [], 'scanning does not automatically write');
  await click('Catat kehadiran');
  await waitFor(`document.body.textContent.includes('Hadir tercatat · Hari pertama')`, 'participant never saw the check-in result');
  assert.deepEqual(await evaluate(`window.__selfPosts[0]`), { eventId, dayId, rawLocationQrToken: locationToken });
  assert.match(await evaluate(`document.body.textContent`), /Check-in mandiri/);

  await evaluate(`window.__fakeCamera(${JSON.stringify(svg)})`);
  await click('Pindai QR Lokasi');
  await waitFor(`document.body.textContent.includes('QR Lokasi terbaca')`, 'software camera fallback failed to decode the actual QR');
  assert.equal(await evaluate(`window.__cameraStream.getTracks().every(track=>track.readyState==='ended')`), true);
  assert.equal(await evaluate(`window.__selfPosts.length`), 1);
  for (const width of [320, 375, 414, 768]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 768 });
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true, `portal overflow at ${width}px`);
  }
  assert.deepEqual(failures, [], 'no browser runtime errors');
  console.log(JSON.stringify({ result: 'PASS', flows: ['kiosk pairing and revocation', 'rendered QR, login and self check-in', 'camera fallback'], widths: [320, 375, 414, 768, 1280, 1920], screenshots }, null, 2));
} finally {
  socket?.close(); browser?.kill(); await server.close();
  if (!path.resolve(profile).startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)) throw new Error('Unsafe temporary profile path');
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}
