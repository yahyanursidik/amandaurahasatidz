/** Isolated Chromium smoke: no production API or actual WhatsApp messages. */
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
const temporary = await mkdtemp(path.join(os.tmpdir(), 'daurah-whatsapp-browser-'));
const profiles = Array.from({ length: 3 }, (_, index) => ({
  id: `ustadz-${index + 1}`, fullName: ['Ustadz Ahmad', 'Ustadz Hasan', 'Ustadz Yahya'][index],
  profileStatus: 'ACTIVE', whatsapp: `08123456789${index}`, phone: null, primaryInstitution: { institutionName: 'Pesantren Aman' },
}));
const failures = [];
const fixture = {
  name: 'ustadz-whatsapp-isolated-fixture',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (request.url?.startsWith('/admin/ustadz/whatsapp')) {
        const identity = { id: 'admin-test', name: 'Admin Uji', assignments: [{ roleCode: 'SYSTEM_ADMIN' }] };
        response.setHeader('Content-Type', 'text/html');
        response.end(await server.transformIndexHtml(request.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
          import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router-dom'; import {Refine} from '@refinedev/core';
          import '/src/index.css'; import {UstadzWhatsAppWizardPage} from '/src/pages/admin/ustadz/UstadzWhatsAppWizardPage.tsx';
          const authProvider={check:async()=>({authenticated:true}),getIdentity:async()=>(${JSON.stringify(identity)}),logout:async()=>({success:true}),login:async()=>({success:true}),onError:async()=>({})};
          window.addEventListener('click',event=>{if(event.target.closest('a[href^="https://wa.me/"]'))event.preventDefault()},true);
          createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Refine,{authProvider,options:{disableTelemetry:true}},React.createElement(UstadzWhatsAppWizardPage))));
        </script></body></html>`));
        return;
      }
      if (!request.url?.startsWith('/api/v1/')) return next();
      const route = new URL(request.url, 'http://127.0.0.1').pathname;
      if (route !== '/api/v1/ustadz' || request.method !== 'GET') failures.push(`Unexpected API ${request.method} ${route}`);
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ data: profiles, meta: { pageCount: 1 } }));
    });
  },
};
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: path.join(temporary, 'vite-cache'), plugins: [react(), fixture],
  resolve: { alias: { '@': path.join(root, 'src') } }, server: { host: '127.0.0.1', port: 0 } });
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
    if (message.method === 'Runtime.exceptionThrown') failures.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') failures.push(message.params.args);
  };
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async (expression, label) => {
    for (let index = 0; index < 150; index++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise((resolve) => setTimeout(resolve, 100)); }
    throw new Error(`Timeout ${label}: ${await evaluate('document.body.innerText.slice(0,3000)')}; ${JSON.stringify(failures)}`);
  };
  const button = (label) => `[...document.querySelectorAll('button')].find(element=>element.textContent.trim()===${JSON.stringify(label)})`;
  const click = (label) => evaluate(`(()=>{const element=${button(label)};if(!element||element.disabled)throw new Error('Unavailable ${label}');element.click()})()`);
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
  assert.match(await evaluate(`document.querySelector('.wa-batch__preview pre').textContent`), /Aman Daurah Asatidz/);
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
  assert.deepEqual(failures, [], 'No browser exceptions or unexpected API requests');
  console.log(JSON.stringify({ result: 'PASS', checks: ['compose', 'select recipients', 'manual WhatsApp draft', 'explicit sent', 'skip', 'resume after reload', '320–1280px layout', 'key text contrast'], contrastRatios, screenshots: [composerPath, desktopPath, screenshotPath] }, null, 2));
} finally {
  socket?.close(); browser?.kill(); await server.close(); await new Promise((resolve) => setTimeout(resolve, 400));
  await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}
