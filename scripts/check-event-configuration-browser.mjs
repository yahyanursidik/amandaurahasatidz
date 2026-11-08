/** Isolated browser smoke for the admin event form. No auth, database, email, or production API. */
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
const profile = await mkdtemp(path.join(os.tmpdir(), 'event-configuration-browser-'));
const fixture = {
  name: 'event-configuration-fixture',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith('/event-configuration-preview')) return next();
      response.setHeader('Content-Type', 'text/html');
      response.end(await server.transformIndexHtml(request.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {EventForm} from '/src/components/admin/events/EventForm.tsx';
        import '/src/index.css';
        window.__saved=[];
        createRoot(document.getElementById('root')).render(React.createElement(EventForm,{
          submitLabel:'Simpan sebagai draft',onCancel:()=>{},onSubmit:async(values)=>{window.__saved.push(values)},
          initialValues:{code:'DAURAH-2027',slug:'daurah-2027',name:'Daurah Asatidz',startDate:'2027-02-10',endDate:'2027-02-12',capacity:'100',regularQuota:'40',invitationQuota:'60'}
        }));
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
  browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--enable-logging=stderr', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
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
    if (message.method === 'Runtime.exceptionThrown') failures.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') failures.push(message.params.args);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, [resolve, reject]); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/event-configuration-preview#configuration` });
  for (let i = 0; i < 100 && !(await evaluate(`!!document.querySelector('#configuration input[type="radio"]')`)); i++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(await evaluate(`!!document.querySelector('#configuration input[type="radio"]')`), true, 'form rendered');
  assert.equal(await evaluate(`document.querySelector('a[href="#configuration"]').getAttribute('aria-current')`), 'location');
  const initialConfigurationTop = await evaluate(`Math.round(document.getElementById('configuration').getBoundingClientRect().top)`);
  const widths = [320, 375, 414, 768, 1280];
  for (const width of widths) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 768 });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true, `no horizontal overflow at ${width}px`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 850, deviceScaleFactor: 1, mobile: true });
  await evaluate(`document.getElementById('configuration').scrollIntoView({block:'start'})`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const configurationTop = await evaluate(`Math.round(document.getElementById('configuration').getBoundingClientRect().top)`);
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const screenshotPath = path.join(os.tmpdir(), 'event-configuration-mobile.png');
  await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 850, deviceScaleFactor: 1, mobile: false });
  await evaluate(`document.getElementById('configuration').scrollIntoView({block:'start'})`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const desktopScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const desktopScreenshotPath = path.join(os.tmpdir(), 'event-configuration-desktop.png');
  await writeFile(desktopScreenshotPath, Buffer.from(desktopScreenshot.data, 'base64'));
  await evaluate(`document.querySelector('input[value="PUBLIC_OPEN"]').click()`);
  assert.equal(await evaluate(`document.querySelector('.event-config-summary').textContent.includes('Tidak digunakan')`), true, 'audience summary changes');
  await evaluate(`document.querySelector('input[value="MIXED"]').click()`);
  await evaluate(`(()=>{const input=document.getElementById('event-regularQuota');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'80');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate(`document.querySelector('form').requestSubmit()`);
  assert.equal(await evaluate(`document.querySelector('#event-capacity-error')?.textContent.includes('melebihi kapasitas')`), true, 'quota error shown');
  assert.equal(await evaluate(`window.__saved.length`), 0, 'invalid form not saved');
  await evaluate(`(()=>{const input=document.getElementById('event-regularQuota');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'40');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate(`document.querySelector('form').requestSubmit()`);
  assert.equal(await evaluate(`window.__saved.length`), 1, 'corrected form saved');
  assert.equal(await evaluate(`window.__saved[0].audienceMode`), 'MIXED', 'selected route submitted');
  assert.deepEqual(failures, [], 'no browser errors');
  console.log(JSON.stringify({ result: 'PASS', widths, initialConfigurationTop, configurationTop, checks: ['hash navigation', 'mobile overflow', 'audience summary', 'quota validation', 'corrected form submission'], screenshots: [screenshotPath, desktopScreenshotPath] }, null, 2));
} finally {
  socket?.close(); browser?.kill(); await server.close();
  await new Promise((resolve) => setTimeout(resolve, 300));
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}
