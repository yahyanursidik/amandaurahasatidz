/** Isolated browser smoke test: all API routes use in-memory fixtures, never production. */
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
].find(existsSync);
if (!chrome) throw new Error('Set CHROME_PATH to an installed Chromium browser.');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'event-communications-browser-'));
const eventId = '11111111-1111-4111-8111-111111111111';
const draftId = '22222222-2222-4222-8222-222222222222';
const templateId = '33333333-3333-4333-8333-333333333333';
let drafts = [], templates = [];
const requests = [];
function preview(fields) {
  const values = { eventName: 'Daurah Uji Browser', eventDates: '3 Oktober 2026', eventVenue: 'Aula Uji',
    portalLink: 'https://example.invalid/portal', ustadzName: 'Ustadz Uji', participantCode: 'TEST-001', institutionName: 'Lembaga Uji' };
  const render = (text) => (text || '').replace(/{{\s*(\w+)\s*}}/g, (_, key) => values[key] || `{{${key}}}`);
  const title = render(fields.title), body = render(fields.body), emailSubject = render(fields.emailSubject);
  const escape = (text) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const emailHtml = `<html><body><h1>${escape(title)}</h1><p>${escape(body)}</p></body></html>`;
  return { title, body, emailSubject, emailHtml, recipientCount: 3, emailRecipientCount: 2, missingEmailCount: 1,
    duplicateEmailCount: 0, warnings: ['1 penerima tanpa email; pesan portal tetap tersedia.'], unresolvedVariables: [],
    updatedAt: fields.updatedAt, expectedUpdatedAt: fields.updatedAt, previewToken: 'browser-fixture-token',
    samples: [{ name: values.ustadzName, email: 'test@example.invalid', title, body, emailSubject, emailHtml }] };
}
const fixtures = {
  name: 'communication-browser-fixtures',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url === '/__communication_smoke') {
        res.setHeader('Content-Type', 'text/html');
        return res.end(await server.transformIndexHtml(req.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
          import React from 'react';
          import {createRoot} from 'react-dom/client';
          import {EventCommunicationCenter} from '/src/components/admin/events/EventCommunicationCenter.tsx';
          import '/src/index.css';
          window.confirm=()=>true;
          createRoot(document.getElementById('root')).render(React.createElement(EventCommunicationCenter,{eventId:'${eventId}'}));
        </script></body></html>`));
      }
      if (!req.url?.startsWith('/api/v1')) return next();
      const route = req.url.replace('/api/v1', '').split('?')[0];
      const method = req.method;
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      requests.push({ route, method, body });
      let data;
      if (route === '/me/permissions') data = { effectivePermissions: ['announcements.read', 'announcements.manage', 'announcements.publish'], assignments: [{ roleCode: 'EVENT_ADMIN', eventId }] };
      else if (route.endsWith('/announcements/institutions')) data = [{ id: templateId, name: 'Lembaga Uji' }];
      else if (route.endsWith('/communication-templates') && method === 'GET') data = templates;
      else if (route.endsWith('/communication-templates') && method === 'POST') { data = { ...body, id: templateId }; templates = [data]; }
      else if (route.endsWith(`/communication-templates/${templateId}`) && method === 'PATCH') { data = { ...body, id: templateId }; templates = [data]; }
      else if (route.endsWith(`/communication-templates/${templateId}`) && method === 'DELETE') { templates = []; data = { archived: true }; }
      else if (route.endsWith('/announcements') && method === 'GET') data = drafts;
      else if (route.endsWith('/announcements') && method === 'POST') { data = { ...body, id: draftId, status: 'DRAFT', updatedAt: new Date().toISOString() }; drafts = [data]; }
      else if (route.endsWith(`/announcements/${draftId}`) && method === 'PATCH') { data = { ...body, id: draftId, status: 'DRAFT', updatedAt: new Date().toISOString() }; drafts = [data]; }
      else if (route.endsWith(`/announcements/${draftId}/preview`)) data = preview(drafts[0]);
      else if (route.endsWith('/announcements/preview')) data = preview(body);
      else if (route.endsWith(`/announcements/${draftId}/publish`)) { assert.equal(body.expectedUpdatedAt, drafts[0].updatedAt); drafts[0] = { ...drafts[0], status: 'PUBLISHED' }; data = { announcement: drafts[0], emailEnqueuedCount: 2, emailFailedCount: 0 }; }
      else if (route.endsWith(`/announcements/${draftId}/unpublish`)) { drafts[0] = { ...drafts[0], status: 'UNPUBLISHED', updatedAt: new Date(Date.parse(drafts[0].updatedAt) + 1000).toISOString() }; data = drafts[0]; }
      else { res.statusCode = 404; data = null; }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ data, error: data === null ? { message: `Unexpected fixture ${method} ${route}` } : null }));
    });
  },
};
const server = await createServer({ root, configFile: false, envDir: false, plugins: [react(), fixtures],
  resolve: { alias: { '@': path.join(root, 'src') } }, server: { host: '127.0.0.1', port: 0 },
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api/v1') },
});
let browser, socket;
const failures = [];
try {
  await server.listen();
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
    throw new Error(`Timed out: ${label}; errors=${JSON.stringify(failures)}; page=${await evaluate('document.body.innerText.slice(0,1500)')}`);
  }
  const button = (label) => `[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)})`;
  async function click(label) { await evaluate(`(()=>{const el=${button(label)}; if(!el||el.disabled) throw new Error('Unavailable button ${label}'); el.click()})()`); }
  async function fill(label, value) {
    await evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(e=>e.textContent===${JSON.stringify(label)});if(!label)throw new Error('Missing field');const el=document.getElementById(label.htmlFor);const prototype=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  }
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/__communication_smoke` });
  await until(`document.body.textContent.includes('Pustaka template') && !document.body.textContent.includes('Memuat draft')`, 'load editor');
  assert.equal(await evaluate(`document.querySelector('[role="alert"]')?.textContent || ''`), '');
  await evaluate(`(()=>{const article=[...document.querySelectorAll('article')].find(e=>e.querySelector('h4')?.textContent==='Undangan peserta');article.querySelector('button').click()})()`);
  await until(`document.querySelector('textarea')?.value.includes('{{ustadzName}}')`, 'apply template');
  await fill('Subjek email (terpisah dari judul portal)', 'Subjek khusus {{eventName}}');
  await click('Simpan draft');
  await until(`document.body.textContent.includes('Draft tersimpan.')`, 'save draft');
  assert.equal(drafts.length, 1); assert.equal(drafts[0].emailSubject, 'Subjek khusus {{eventName}}');
  assert.equal(requests.filter((r) => r.route.endsWith('/publish')).length, 0);
  await click('Simpan sebagai template');
  await fill('Nama template', 'Template Uji Browser');
  await click('Simpan template');
  await until(`document.body.textContent.includes('Template khusus tersimpan')`, 'save template');
  assert.equal(templates.length, 1);
  await click('Pratinjau tersimpan');
  await until(`document.querySelector('iframe')?.getAttribute('srcdoc')?.includes('Ustadz Uji')`, 'saved personalized preview');
  await evaluate(`document.querySelectorAll('input[type=checkbox]')[document.querySelectorAll('input[type=checkbox]').length-1].click()`);
  await until(`!${button('Publikasikan pengumuman')}.disabled`, 'confirmation gate');
  await fill('Judul pengumuman portal', 'Judul diubah setelah pratinjau');
  assert.equal(await evaluate(`${button('Publikasikan pengumuman')}.disabled`), true, 'Edits invalidate publication');
  assert.equal(await evaluate(`!!document.querySelector('iframe')`), false, 'Edits clear stale preview');
  await click('Simpan perubahan draft');
  await until(`document.body.textContent.includes('Draft tersimpan.')`, 'update draft');
  await click('Pratinjau tersimpan');
  await until(`!!document.querySelector('iframe')`, 'fresh preview');
  await evaluate(`document.querySelectorAll('input[type=checkbox]')[document.querySelectorAll('input[type=checkbox]').length-1].click()`);
  await until(`!${button('Publikasikan pengumuman')}.disabled`, 'fresh confirmation');
  await click('Publikasikan pengumuman');
  await until(`document.body.textContent.includes('2 email diantrekan')`, 'publication queue summary');
  assert.equal(drafts[0].status, 'PUBLISHED');
  assert.equal(requests.filter((r) => r.route.endsWith('/publish')).length, 1);
  await click('Tarik publikasi');
  await until(`document.body.textContent.includes('Pengumuman ditarik')`, 'unpublish');
  assert.equal(drafts[0].status, 'UNPUBLISHED');
  await click('Pratinjau tersimpan');
  await until(`!!document.querySelector('iframe')`, 'preview after unpublish uses new server revision');
  await evaluate(`document.querySelectorAll('input[type=checkbox]')[document.querySelectorAll('input[type=checkbox]').length-1].click()`);
  await until(`!${button('Publikasikan pengumuman')}.disabled`, 'republish gate after unpublish');
  assert.equal(requests.filter((r) => r.route.endsWith('/publish')).length, 1, 'Preview after unpublish does not resend');
  await click('Arsipkan');
  await until(`!document.body.textContent.includes('Template Uji Browser')`, 'archive template');
  assert.equal(templates.length, 0);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`), true, 'No mobile overflow');
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const output = path.join(os.tmpdir(), 'event-communications-browser.png');
  await writeFile(output, Buffer.from(screenshot.data, 'base64'));
  assert.deepEqual(failures, [], 'No browser JavaScript errors');
  console.log(JSON.stringify({ result: 'PASS', checks: ['template apply', 'custom subject', 'save/edit draft', 'save/archive template', 'personalized preview', 'edit invalidates preview', 'confirmation before publish', 'queue result', 'unpublish', 'preview after unpublish', 'mobile overflow', 'no console errors'], mockedApiRequests: requests.length, screenshot: output }, null, 2));
} finally {
  socket?.close();
  browser?.kill();
  await server.close();
  await new Promise((r) => setTimeout(r, 500));
  await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}