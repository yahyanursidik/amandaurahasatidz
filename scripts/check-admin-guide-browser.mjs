/** Isolated admin-guide layout smoke; no database or production API calls. */
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

const profile = await mkdtemp(path.join(os.tmpdir(), 'daurah-admin-guide-browser-'));
const eventId = '7b62644d-91ee-43cf-b7c3-0514657fc01c';
const fixture = { name: 'admin-guide-fixture', configureServer(server) {
  server.middlewares.use(async (request, response, next) => {
    if (new URL(request.url, 'http://127.0.0.1').pathname !== '/__admin_guide_smoke') return next();
    response.setHeader('Content-Type', 'text/html');
    response.end(await server.transformIndexHtml(request.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { MemoryRouter } from 'react-router-dom';
      import { Refine } from '@refinedev/core';
      import { AdminGuidePage } from '/src/pages/admin/AdminGuidePage.tsx';
      import '/src/index.css';
      const authProvider = {
        login: async () => ({ success: true }),
        logout: async () => ({ success: true }),
        check: async () => ({ authenticated: true }),
        getIdentity: async () => ({ id: 'admin-fixture', name: 'Admin Uji', email: 'admin@example.invalid', assignments: [{ roleCode: 'SUPER_ADMIN' }] }),
      };
      createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,{initialEntries:['/admin/panduan?eventId=${eventId}']},
        React.createElement(Refine,{authProvider},React.createElement(AdminGuidePage))));
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
  for (let i = 0; i < 100; i++) {
    try { debuggerPort = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  assert.ok(debuggerPort, 'Chromium debugger failed to start');
  const targets = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });

  let sequence = 0; const pending = new Map(); const failures = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const [resolve, reject] = pending.get(message.id); pending.delete(message.id);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') failures.push(message.params.exceptionDetails);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, [resolve, reject]); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/__admin_guide_smoke` });
  for (let i = 0; i < 100 && !(await evaluate(`!!document.querySelector('.admin-guide-stage')`)); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate(`document.querySelectorAll('.admin-guide-stage').length`), 7);
  assert.equal(await evaluate(`document.querySelector('.admin-guide-stage__actions a[href="/admin/events/${eventId}/kiosk"]') !== null`), true);

  const screenshots = [];
  for (const width of [320, 375, 414, 768, 1280, 1920]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 768 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true, `horizontal overflow at ${width}px`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.admin-guide a, .admin-guide summary, .admin-guide-create')).every((link) => link.scrollWidth <= link.clientWidth)`), true, `clickable text overflow at ${width}px`);
    if (width === 375 || width === 1280) {
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const target = path.join(os.tmpdir(), `daurah-admin-guide-${width}.png`);
      await writeFile(target, Buffer.from(shot.data, 'base64')); screenshots.push(target);
    }
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 850, deviceScaleFactor: 1, mobile: true });
  await evaluate(`document.querySelector('a[href="#attendance"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(await evaluate(`location.hash`), '#attendance');
  assert.equal(await evaluate(`document.querySelector('#attendance').getBoundingClientRect().top >= 60`), true, 'anchor sits below sticky header');
  const attendanceShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const attendanceTarget = path.join(os.tmpdir(), 'daurah-admin-guide-attendance-375.png');
  await writeFile(attendanceTarget, Buffer.from(attendanceShot.data, 'base64')); screenshots.push(attendanceTarget);
  assert.deepEqual(failures, [], 'no browser runtime errors');
  console.log(JSON.stringify({ result: 'PASS', widths: [320, 375, 414, 768, 1280, 1920], screenshots }, null, 2));
} finally {
  socket?.close(); browser?.kill(); await server.close();
  if (!path.resolve(profile).startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)) throw new Error('Unsafe temporary profile path');
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}
