/** Isolated visual smoke for public pages. Fetch is mocked; no production API or database. */
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
const profile = await mkdtemp(path.join(os.tmpdir(), 'public-pages-browser-'));
const fixture = {
  name: 'public-pages-fixture',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith('/public-page-preview/')) return next();
      response.setHeader('Content-Type', 'text/html');
      response.end(await server.transformIndexHtml(request.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {MemoryRouter} from 'react-router-dom';
        import {PublicProgramsPage} from '/src/pages/public/PublicProgramsPage.tsx';
        import {RuangAsatidzPublicPage} from '/src/pages/public/RuangAsatidzPublicPage.tsx';
        import '/src/index.css';
        window.fetch = async () => ({ok:true,json:async () => ({data:[
          {slug:'daurah-bandung',code:'DB-27',name:'Daurah Asatidz Bandung',subtitle:'Kajian dan silaturahmi asatidz',posterUrl:null,posterAlt:null,startDate:'2027-02-10',endDate:'2027-02-12',venueName:'Bandung',audienceMode:'MIXED',status:'REGISTRATION_OPEN',regularQuota:40,registrationOpenAt:null,registrationCloseAt:null},
          {slug:'daurah-undangan',code:'DU-27',name:'Daurah Undangan Lembaga',subtitle:null,posterUrl:null,posterAlt:null,startDate:'2027-03-10',endDate:'2027-03-10',venueName:'Cimahi',audienceMode:'INSTITUTION_INVITATION',status:'PUBLISHED',regularQuota:0,registrationOpenAt:null,registrationCloseAt:null},
          {slug:'daurah-lalu',code:'DL-26',name:'Daurah Asatidz Sebelumnya',subtitle:null,posterUrl:null,posterAlt:null,startDate:'2026-02-10',endDate:'2026-02-10',venueName:'Bandung',audienceMode:'PUBLIC_OPEN',status:'COMPLETED',regularQuota:40,registrationOpenAt:null,registrationCloseAt:null}
        ]})});
        const route = location.pathname.replace('/public-page-preview', '') || '/';
        createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,{initialEntries:[route]},React.createElement(route === '/ruang-asatidz' ? RuangAsatidzPublicPage : PublicProgramsPage)));
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
  const screenshots = [];
  for (const route of ['/', '/programs', '/ruang-asatidz']) {
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/public-page-preview${route}` });
    for (let i = 0; i < 100 && !(await evaluate(`!!document.querySelector('main h1')`)); i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(await evaluate(`!!document.querySelector('main h1')`), true, `${route} rendered`);
    if (route === '/programs') {
      for (let i = 0; i < 50 && !(await evaluate(`document.querySelectorAll('.public-home__program-card').length === 3`)); i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(await evaluate(`document.querySelectorAll('.public-home__program-card').length`), 3);
      assert.equal(await evaluate(`document.querySelector('main h1').textContent`), 'Temukan daurah yang sesuai');
      assert.equal(await evaluate(`document.querySelector('.public-home__program-card a[href$="/register"]') !== null`), true);
    }
    for (const width of [320, 375, 414, 768, 1280]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 768 });
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true, `${route}: no horizontal overflow at ${width}px`);
      assert.equal(await evaluate(`Array.from(document.querySelectorAll('.public-home__button, .public-home__program-action, .public-home__program-detail, .public-ruang__path a')).every(el => el.getBoundingClientRect().height <= 56)`), true, `${route}: action labels stay on one line at ${width}px`);
      if (width === 375 || width === 1280) {
        const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        const screenshotPath = path.join(os.tmpdir(), `public-${route.replaceAll('/', '') || 'home'}-${width}.png`);
        await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
        screenshots.push(screenshotPath);
      }
    }
    if (route === '/programs') {
      await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 850, deviceScaleFactor: 1, mobile: true });
      await evaluate(`document.querySelector('.public-home__program-card').scrollIntoView({block:'start'})`);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const screenshotPath = path.join(os.tmpdir(), 'public-program-card-375.png');
      await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
      screenshots.push(screenshotPath);
      await evaluate(`Array.from(document.querySelectorAll('.public-home__filters button')).find(button => button.textContent === 'Reguler').click()`);
      assert.equal(await evaluate(`document.querySelectorAll('.public-home__program-card').length`), 2, 'regular filter includes mixed and regular programs');
      await evaluate(`Array.from(document.querySelectorAll('.public-home__filters button')).find(button => button.textContent === 'Undangan').click()`);
      assert.equal(await evaluate(`document.querySelectorAll('.public-home__program-card').length`), 2, 'invitation filter includes mixed and invitation programs');
    }
  }
  assert.deepEqual(failures, [], 'no browser errors');
  console.log(JSON.stringify({ result: 'PASS', routes: ['/', '/programs', '/ruang-asatidz'], widths: [320, 375, 414, 768, 1280], screenshots }, null, 2));
} finally {
  socket?.close(); browser?.kill(); await server.close();
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (!path.resolve(profile).startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)) throw new Error('Unsafe temporary profile path');
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}
