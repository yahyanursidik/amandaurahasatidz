/** Isolated browser regression: mocked APIs only; no database writes, email, or WhatsApp sends. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
const artifactRoot = path.join(os.tmpdir(), 'opencode');
await mkdir(artifactRoot, { recursive: true });
const temporary = await mkdtemp(path.join(artifactRoot, 'institution-invitations-'));
const eventId = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const institutionId = '33333333-3333-4333-8333-333333333333';
const commandId = '55555555-5555-4555-8555-555555555555', replacementId = '66666666-6666-4666-8666-666666666666';
let commandParticipant = null;
const event = { id: eventId, name: 'Daurah Uji Undangan Lembaga', slug: 'daurah-uji', timezone: 'Asia/Makassar',
  status: 'PUBLISHED', audienceMode: 'MIXED', defaultInstitutionQuota: 3,
  invitationResponseDeadline: '2099-01-20T08:25:59.000Z', attendanceConfirmationDeadline: null,
  startDate: '2099-02-01', endDate: '2099-02-03', venueName: 'Aula Daurah', attendanceConfirmationRequired: true, lateConfirmationPolicy: 'REVIEW' };
const institution = { id: institutionId, code: 'MU-01', name: "Ma'had Ilmu dan Dakwah Nusantara", contactName: 'PIC Lembaga', email: 'kontak@example.invalid', whatsapp: '081234567890' };
let invitations = [{ id, invitationType: 'INSTITUTION', institutionId, institutionName: institution.name, invitationNumber: 'UND-01',
  quota: 3, allowGroup: true, status: 'SENT', sentAt: null, respondedAt: null, responseDeadline: event.invitationResponseDeadline }];
const requests = [], failures = [], screenshots = [];
const fixture = {
  name: 'institution-invitation-fixtures',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname === '/__invitation_smoke') {
        if (url.searchParams.get('mode') === 'commands') commandParticipant = { id: commandId, name: 'Ustadz Uji Status', participantCode: 'P-COMMAND', approvalStatus: 'APPROVED', confirmationStatus: 'CONFIRMED' };
        const entry = url.searchParams.get('mode') === 'commands' ? '/qa/participants' : url.searchParams.get('mode') === 'admin' ? `/admin/events/${eventId}/registrations?view=invitations`
          : `/invitation/institution/${url.searchParams.get('token') || 'group'}`;
        response.setHeader('Content-Type', 'text/html');
        return response.end(await server.transformIndexHtml(request.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
          import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter,Routes,Route} from 'react-router-dom'; import {Refine} from '@refinedev/core';
          import {EventRegistrationsPage} from '/src/pages/admin/events/EventRegistrationsPage.tsx';
          import {InvitationRegistrationPage} from '/src/pages/public/InvitationRegistrationPage.tsx'; import '/src/index.css';
          import {ParticipantManagementDialog} from '/src/components/participants/ParticipantManagementDialog.tsx';
          const authProvider={check:async()=>({authenticated:true}),getIdentity:async()=>({name:'Admin Uji',email:'admin@example.invalid',assignments:[{roleCode:'SUPER_ADMIN'}]}),logout:async()=>({success:true}),login:async()=>({success:true}),onError:async()=>({})};
          window.confirm=()=>true;
          function CommandFixture(){const [participant,setParticipant]=React.useState(${JSON.stringify(commandParticipant)});const [loading,setLoading]=React.useState(false);const [busy,setBusy]=React.useState(false);return React.createElement('main',{className:'mx-auto max-w-2xl p-6'},
            React.createElement('p',{id:'command-state'},participant.approvalStatus+'/'+participant.confirmationStatus),
            React.createElement('p',{id:'command-busy'},String(busy)),loading?React.createElement('p',null,'Memuat ulang…'):
            React.createElement(ParticipantManagementDialog,{eventId:'${eventId}',participant,permissions:['participants.waitlist','participants.approve','participants.cancel','participants.replace'],onBusyChange:setBusy,
              onCompleted:async()=>{setLoading(true);await new Promise(resolve=>setTimeout(resolve,30));const response=await fetch('/api/v1/events/${eventId}/participants');const result=await response.json();setParticipant(result.data[0]);setLoading(false);return true;}}));}
          createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,{initialEntries:[${JSON.stringify(entry)}]},React.createElement(Refine,{authProvider,options:{disableTelemetry:true}},React.createElement(Routes,null,
            React.createElement(Route,{path:'/admin/events/:id/registrations',element:React.createElement(EventRegistrationsPage)}),
            React.createElement(Route,{path:'/invitation/institution/:token',element:React.createElement(InvitationRegistrationPage)}),
            React.createElement(Route,{path:'/qa/participants',element:React.createElement(CommandFixture)})))));
        </script></body></html>`));
      }
      if (!url.pathname.startsWith('/api/v1/')) return next();
      const route = url.pathname.slice('/api/v1'.length), method = request.method;
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      requests.push({ route, method, body });
      let data;
      if (route === `/events/${eventId}/invitations/institutions`) data = [institution];
      else if (route === `/events/${eventId}/participants`) data = commandParticipant ? [commandParticipant] : [];
      else if (route === `/events/${eventId}/participants/${commandId}/replacement-options`) data = [{ id: replacementId, fullName: 'Ustadz Pengganti', email: 'pengganti@example.invalid' }];
      else if (method === 'POST' && route.startsWith(`/events/${eventId}/participants/${commandId}/`)) {
        const action = route.split('/').at(-1);
        commandParticipant = { ...commandParticipant, ...(action === 'waitlist' ? { approvalStatus: 'WAITLISTED' } : action === 'decline' ? { approvalStatus: 'DECLINED' } : { confirmationStatus: action === 'cancel' ? 'CANCELLED' : 'REPLACED' }) };
        data = commandParticipant;
      }
      else if (route === `/events/${eventId}`) data = event;
      else if (route === `/events/${eventId}/invitations` && method === 'GET') data = invitations;
      else if (route === `/events/${eventId}/invitations/${id}` && method === 'PATCH') {
        invitations[0] = { ...invitations[0], ...body }; data = { invitation: invitations[0] };
      } else if (route === `/events/${eventId}/invitations` && method === 'POST') {
        const invitation = { ...body, id: '44444444-4444-4444-8444-444444444444', institutionName: institution.name, status: 'DRAFT', sentAt: null, respondedAt: null };
        invitations.push(invitation); data = { invitation, publicUrl: '/invitation/institution/created' };
      } else if (/^\/invitations\/public\/institution\/\w+$/.test(route)) {
        const token = route.split('/').at(-1);
        data = { invitation: token === 'managed' ? invitations[0] : { ...invitations[0], quota: 3, allowGroup: true }, institution, event };
      } else if (/^\/invitations\/public\/institution\/\w+\/response$/.test(route) && method === 'POST') {
        data = { message: 'Konfirmasi tersimpan', emailQueued: body.delegates.length,
          participants: body.delegates.map((person, index) => ({ id: `person-${index}`, participantCode: `P-TEST-${index}`, qrToken: `pqr_fixture${index}.signature`, cardUrl: `/card?token=pqr_fixture${index}.signature`, whatsapp: person.whatsapp })),
          portalAccounts: body.delegates.map((person, index) => ({ participantId: `person-${index}`, participantName: person.fullName, email: person.email, passwordSetupRequired: true, loginUrl: '/login/ustadz' })) };
      } else { failures.push(`Unexpected fixture ${method} ${route}`); response.statusCode = 404; data = null; }
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ data, error: data === null ? { message: 'Unexpected test route' } : null }));
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
  for (let i = 0; i < 150; i++) {
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
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value;
  };
  const until = async (expression, label) => {
    for (let i = 0; i < 150; i++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise((resolve) => setTimeout(resolve, 100)); }
    throw new Error(`Timeout ${label}; page=${await evaluate('document.body.innerText.slice(0,3000)')}; errors=${JSON.stringify(failures)}`);
  };
  const click = (label) => evaluate(`(()=>{const element=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(label)});if(!element||element.disabled)throw new Error('Unavailable button: ${label}');element.click()})()`);
  const fill = (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing input');const prototype=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  const navigate = (query) => send('Page.navigate', { url: `http://127.0.0.1:${port}/__invitation_smoke?${query}` });
  const checkWidths = async (label) => {
    for (const width of [320, 390, 768, 1280]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 768 });
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'), true, `${label}: no overflow at ${width}px`);
      assert.equal(await evaluate(`!document.querySelector('dialog[open]') || document.querySelector('dialog[open]').scrollWidth<=document.querySelector('dialog[open]').clientWidth`), true, `${label}: dialog does not overflow at ${width}px`);
    }
  };
  const screenshot = async (name) => {
    await evaluate('window.scrollTo(0,0)');
    await new Promise((resolve) => setTimeout(resolve, 150));
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const target = path.join(artifactRoot, `institution-invitation-${name}.png`); await writeFile(target, Buffer.from(result.data, 'base64')); screenshots.push(target);
  };
  await send('Runtime.enable'); await send('Page.enable');
  await navigate('mode=admin');
  await until(`document.querySelector('article h2')?.textContent===${JSON.stringify(institution.name)}`, 'admin invitation list');
  await click('Edit undangan');
  await until(`document.querySelector('form[aria-label="Edit undangan lembaga"]')`, 'edit form');
  assert.equal(await evaluate(`document.querySelector('#institution-invitation-editor input[type="datetime-local"]').value`), '2099-01-20T16:25');
  assert.match(await evaluate(`document.querySelector('[aria-label="Data lembaga terpilih"]').textContent`), /kontak@example.invalid/);
  await evaluate(`document.querySelector('#institution-invitation-editor input[type="checkbox"]').click()`);
  assert.equal(await evaluate(`!!document.querySelector('#institution-invitation-editor input[type="number"]')`), false);
  await click('Simpan perubahan');
  await until(`document.querySelector('[role="status"]')?.textContent.includes('berhasil diperbarui')`, 'saved edit');
  const patch = requests.find((item) => item.method === 'PATCH');
  assert.equal(patch.body.allowGroup, false); assert.equal(patch.body.quota, 1);
  assert.equal(patch.body.responseDeadline, event.invitationResponseDeadline, 'unchanged deadlines preserve seconds and timezone');
  await checkWidths('admin'); await screenshot('admin-desktop');
  await fill('#institution-invitation-editor select', institutionId);
  await fill('#institution-invitation-editor input[placeholder="INV/2027/001"]', 'UND-02');
  await click('Buat tautan undangan');
  await until(`document.querySelectorAll('article').length===2`, 'new invitation');
  assert.equal(requests.filter((item) => item.method === 'POST').length, 1, 'one create request');
  assert.equal(await evaluate(`document.body.textContent.includes('Kode unik lembaga')`), false, 'no unused code verification UI');

  // Reproduce the reported limit explicitly, through the real admin editor and
  // public page backed by the same invitation (not the event's default quota).
  await click('Edit undangan');
  await until(`document.querySelector('form[aria-label="Edit undangan lembaga"]')`, 'edit the existing invitation quota');
  await evaluate(`document.querySelector('#institution-invitation-editor input[type="checkbox"]').click()`);
  await fill('#institution-invitation-editor input[type="number"]', '2');
  await click('Simpan perubahan');
  await until(`document.querySelector('[role="status"]')?.textContent.includes('berhasil diperbarui')`, 'quota two saved');
  assert.equal(requests.filter((item) => item.method === 'PATCH').at(-1).body.quota, 2);
  await navigate('token=managed');
  await until(`document.querySelector('form[aria-label="Formulir konfirmasi undangan"]')`, 'public quota two form');
  assert.equal(await evaluate(`document.body.textContent.includes('Maksimal 2 orang termasuk peserta utama')`), true, 'saved invitation quota is shown publicly');
  assert.equal(await evaluate(`document.querySelectorAll('[data-delegate]').length`), 1, 'unchecked group keeps only the main participant');
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent.trim()==='Tambah peserta')`), false, 'unchecked group has no add button');
  await evaluate(`document.querySelector('input[aria-controls="invitation-delegates"]').click()`);
  await click('Tambah peserta');
  assert.equal(await evaluate(`document.querySelectorAll('[data-delegate]').length`), 2, 'quota two includes the main participant');
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='Tambah peserta').disabled`), true, 'a third participant is blocked');
  await fill('input[name="delegate-1-name"]', 'Anggota yang harus dibersihkan');
  await evaluate(`document.querySelector('input[aria-controls="invitation-delegates"]').click()`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-delegate]').length`), 1, 'unchecking removes additional forms');
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent.trim()==='Tambah peserta')`), false, 'unchecking removes the add button');
  await evaluate(`document.querySelector('input[aria-controls="invitation-delegates"]').click()`);
  await click('Tambah peserta');
  assert.equal(await evaluate(`document.querySelector('input[name="delegate-1-name"]').value`), '', 'removed group data does not reappear');

  await navigate('mode=admin');
  await until(`document.querySelector('article h2')?.textContent===${JSON.stringify(institution.name)}`, 'return to invitation admin');
  await click('Edit undangan');
  await until(`document.querySelector('form[aria-label="Edit undangan lembaga"]')`, 'disable group for the same invitation');
  await evaluate(`document.querySelector('#institution-invitation-editor input[type="checkbox"]').click()`);
  await click('Simpan perubahan');
  await until(`document.querySelector('[role="status"]')?.textContent.includes('berhasil diperbarui')`, 'single participant policy saved');
  await navigate('token=managed');
  await until(`document.querySelector('form[aria-label="Formulir konfirmasi undangan"]')`, 'single-delegate form');
  assert.equal(await evaluate(`document.body.textContent.includes('Saya membawa rombongan')`), false, 'admin group policy reaches public form');
  assert.equal(await evaluate(`document.body.textContent.includes('Nama lembaga/komunitas')`), false, 'institution is not requested twice');
  await checkWidths('single-delegate'); await screenshot('public-single');
  await navigate('token=group');
  await until(`document.querySelector('input[aria-controls="invitation-delegates"]')`, 'group toggle');
  await evaluate(`document.querySelector('input[aria-controls="invitation-delegates"]').click()`);
  await click('Tambah peserta'); await click('Tambah peserta');
  assert.equal(await evaluate(`document.querySelectorAll('[data-delegate]').length`), 3);
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='Tambah peserta').disabled`), true, 'quota includes lead');
  await fill('input[name="delegate-1-name"]', 'Anggota yang dibatalkan');
  await evaluate(`document.querySelector('input[aria-controls="invitation-delegates"]').click()`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-delegate]').length`), 1, 'unchecking removes additional participants');
  await evaluate(`document.querySelector('input[aria-controls="invitation-delegates"]').click()`);
  await click('Tambah peserta');
  assert.equal(await evaluate(`document.querySelector('input[name="delegate-1-name"]').value`), '', 'cleared data does not reappear');
  await evaluate(`document.querySelector('input[aria-controls="invitation-delegates"]').click()`);
  await fill('input[name="delegate-0-name"]', 'Ustadz Ahmad');
  await fill('input[name="delegate-0-email"]', 'ahmad@example.invalid');
  await fill('input[name="delegate-0-whatsapp"]', '081234567890');
  await fill('#invitation-0-city', 'KOTA BANDUNG'); await fill('#invitation-0-province', 'JAWA BARAT');
  await evaluate(`document.querySelector('input[name="consent"]').click()`);
  await checkWidths('public group form'); await screenshot('public-group-desktop');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 850, deviceScaleFactor: 1, mobile: true });
  await screenshot('public-mobile');
  await click('Kirim konfirmasi');
  await until(`document.querySelector('.public-receipt')`, 'registration receipt');
  const accepted = requests.find((item) => item.route.endsWith('/group/response'));
  assert.equal(accepted.body.delegates.length, 1); assert.equal(accepted.body.delegates[0].isLead, true);
  assert.equal('institutionName' in accepted.body, false, 'linked master identity is not resubmitted');
  assert.equal(accepted.body.delegates[0].phone, null, 'empty optional phone is not sent as invalid empty string');
  await navigate('token=decline');
  await until(`document.querySelector('input[value="DECLINED"]')`, 'decline response');
  await evaluate(`document.querySelector('input[value="DECLINED"]').click()`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-delegate]').length`), 0);
  await click('Kirim konfirmasi');
  await until(`document.body.textContent.includes('Jawaban undangan tersimpan')`, 'declined receipt');
  const declined = requests.find((item) => item.route.endsWith('/decline/response'));
  assert.deepEqual(declined.body.delegates, []);

  await navigate('mode=commands');
  await until(`document.querySelector('#command-state')?.textContent==='APPROVED/CONFIRMED'`, 'participant commands');
  await click('Kelola status');
  assert.equal(await evaluate(`document.querySelector('dialog').open`), true);
  assert.equal(await evaluate(`document.querySelector('dialog form').checkValidity()`), false, 'reason is required');
  await fill('dialog select', 'waitlist'); await fill('dialog textarea', 'Kuota peserta perlu ditinjau');
  await click('Simpan perubahan');
  await until(`document.querySelector('#command-state')?.textContent==='WAITLISTED/CONFIRMED'`, 'waitlist saved');
  await until(`document.querySelector('#command-busy')?.textContent==='false'`, 'parent lock released after row unmount during refresh');
  await until(`!document.querySelector('dialog')?.open`, 'waitlist dialog closed');
  await click('Kelola status'); await fill('dialog select', 'decline'); await fill('dialog textarea', 'Dokumen belum memenuhi ketentuan');
  await click('Simpan perubahan');
  await until(`document.querySelector('#command-state')?.textContent==='DECLINED/CONFIRMED'`, 'decline saved');
  await until(`document.querySelector('#command-busy')?.textContent==='false'`, 'decline lock released');
  await until(`!document.querySelector('dialog')?.open`, 'decline dialog closed');
  await click('Kelola status');
  assert.equal(await evaluate(`document.querySelector('dialog select').value`), 'cancel', 'declined participant cannot be silently approved');
  await fill('dialog textarea', 'Peserta membatalkan kehadiran');
  await evaluate(`(()=>{const button=document.querySelector('dialog button[type="submit"]');button.click();button.click()})()`);
  await until(`document.querySelector('#command-state')?.textContent==='DECLINED/CANCELLED'`, 'cancel saved');
  assert.equal(requests.filter((item) => item.method === 'POST' && item.route.endsWith(`/${commandId}/cancel`)).length, 1, 'double click submits once');

  await navigate('mode=commands&scenario=replace');
  await until(`document.querySelector('#command-state')?.textContent==='APPROVED/CONFIRMED'`, 'replacement fixture');
  await click('Kelola status'); await fill('dialog select', 'replace');
  await fill('dialog input', 'Pengganti');
  await until(`document.querySelector('dialog select[required] option[value="${replacementId}"]')`, 'replacement candidates');
  await fill('dialog select[required]', replacementId); await fill('dialog textarea', 'Penggantian perwakilan lembaga');
  await checkWidths('participant dialog'); await screenshot('participant-management');
  await click('Simpan perubahan');
  await until(`document.querySelector('#command-state')?.textContent==='APPROVED/REPLACED'`, 'replacement saved');
  assert.equal(requests.find((item) => item.method === 'POST' && item.route.endsWith(`/${commandId}/replace`)).body.newUstadzId, replacementId);
  assert.deepEqual(failures, [], 'no browser exceptions or unexpected API requests');
  console.log(JSON.stringify({ result: 'PASS', widths: [320, 390, 768, 1280], checks: ['master institution picker', 'edit persists group policy', 'quota two from admin to same public invitation', 'unchecked group hides add button and clears members', 'admin disables public group controls', 'deadline precision', 'create and share', 'group quota', 'clear additional delegates', 'single-person payload', 'decline without participants', 'waitlist/decline/cancel', 'replacement picker', 'double-submit protection'], screenshots }, null, 2));
} finally {
  socket?.close(); browser?.kill(); await server.close();
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (!path.resolve(temporary).startsWith(`${path.resolve(artifactRoot)}${path.sep}`)) throw new Error('Unsafe temporary profile path');
  await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}
