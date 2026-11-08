/** Isolated kiosk UI smoke. API is mocked; no database or production writes. */
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
const fixture = { name: 'daurah-kiosk-fixture', configureServer(server) {
  server.middlewares.use(async (request, response, next) => {
    if (new URL(request.url, 'http://127.0.0.1').pathname !== '/kiosk-preview') return next();
    response.setHeader('Content-Type', 'text/html');
    response.end(await server.transformIndexHtml(request.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {MemoryRouter, Routes, Route} from 'react-router-dom';
      import {CheckInPublicPage} from '/src/pages/public/CheckInPublicPage.tsx';
      import '/tokens.css'; import '/src/index.css';
      window.__paired = false; window.__posts = [];
      window.fetch = async (url, options = {}) => {
        const pathname = new URL(url, location.origin).pathname;
        const reply = (data, status=200) => ({ok:status<400,status,headers:{get:()=> 'application/json'},json:async()=>({data,error:status<400?null:{message:'Perangkat kiosk belum diaktifkan.'}})});
        if (pathname.endsWith('/pair')) { window.__paired = true; return reply({device:{id:'device-one',label:'Meja utama'}}); }
        if (!window.__paired) return reply(null,401);
        if (pathname.endsWith('/session')) return reply({device:{id:'device-one',label:'Meja utama',deviceExpiresAt:'2027-12-01T00:00:00Z'},event:{slug:'daurah-coba',code:'DC-27',name:'Daurah Coba Asatidz'}});
        if (pathname.endsWith('/units')) return reply({units:[{id:'DAY:00000000-0000-4000-8000-000000000002',type:'DAY',dayId:'00000000-0000-4000-8000-000000000002',sessionId:null,title:'Hari pertama',date:'2027-02-10',isOpen:true,openAt:'2027-02-10T00:00:00Z',closeAt:'2027-02-10T23:59:59Z'}]});
        if (pathname.endsWith('/summary')) return reply({unitId:'DAY:00000000-0000-4000-8000-000000000002',total:30,present:12,absent:18});
        if (pathname.endsWith('/checkin')) { window.__posts.push(JSON.parse(options.body)); return reply({participant:{ustadzName:'Ustadz Ahmad',institutionName:'Ma\u2019had Sunnah'},attendanceUnit:{title:'Hari pertama'},checkinAt:new Date().toISOString()}); }
        return reply(null,404);
      };
      createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,{initialEntries:['/check-in/daurah-coba']},
        React.createElement(Routes,null,React.createElement(Route,{path:'/check-in/:eventSlug',element:React.createElement(CheckInPublicPage)}))));
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
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/kiosk-preview#pair=kpair_fixture` });
  for (let i = 0; i < 100 && !(await evaluate(`!!document.querySelector('.kiosk-page__scan')`)); i++) await new Promise((resolve) => setTimeout(resolve, 100));
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
  await evaluate(`(() => { const el=document.querySelector('#kiosk-qr-input'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(el,'pqr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await evaluate(`document.querySelector('.kiosk-page__scanner-input').requestSubmit()`);
  for (let i = 0; i < 50 && !(await evaluate(`!!document.querySelector('.kiosk-page__success')`)); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.match(await evaluate(`document.querySelector('.kiosk-page__success')?.textContent || ''`), /Ustadz Ahmad/);
  assert.equal(await evaluate(`window.__posts[0]?.dayId`), '00000000-0000-4000-8000-000000000002');
  assert.equal(await evaluate(`window.__posts[0]?.method`), undefined);
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 850, deviceScaleFactor: 1, mobile: true });
  const successShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const successTarget = path.join(os.tmpdir(), 'daurah-kiosk-success-375.png');
  await writeFile(successTarget, Buffer.from(successShot.data, 'base64')); screenshots.push(successTarget);
  assert.deepEqual(failures, [], 'no browser runtime errors');
  console.log(JSON.stringify({ result: 'PASS', widths: [320, 375, 414, 768, 1280, 1920], screenshots }, null, 2));
} finally {
  socket?.close(); browser?.kill(); await server.close();
  if (!path.resolve(profile).startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)) throw new Error('Unsafe temporary profile path');
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}
