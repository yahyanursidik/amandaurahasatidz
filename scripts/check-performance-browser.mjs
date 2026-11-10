/** StrictMode browser regression with fixture APIs only: no database, real mail, or production requests. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(import.meta.dirname, '..');
const chrome = process.env.CHROME_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!chrome) throw new Error('Chromium tidak ditemukan; set CHROME_PATH.');
const artifactRoot = path.join(os.tmpdir(), 'opencode');
await mkdir(artifactRoot, { recursive: true });
const temporary = await mkdtemp(path.join(artifactRoot, 'performance-browser-'));
const eventId = '11111111-1111-4111-8111-111111111111';
const institutionA = '22222222-2222-4222-8222-222222222222', institutionB = '33333333-3333-4333-8333-333333333333';
const event = { id: eventId, code: 'QA-PERF', name: 'Daurah QA Performa', slug: 'qa-performa', status: 'REGISTRATION_OPEN', timezone: 'Asia/Jakarta',
  audienceMode: 'MIXED', defaultInstitutionQuota: 2, startDate: '2099-01-01', endDate: '2099-01-02', venueName: 'Aula QA',
  invitationResponseDeadline: '2098-12-31T16:00:00.000Z', attendanceConfirmationRequired: false };
const makeParticipants = () => Array.from({ length: 155 }, (_, index) => ({
  id: `44444444-4444-4444-8444-${String(index + 1).padStart(12, '0')}`, ustadzId: `ustadz-${index + 1}`,
  ustadzName: `Ustadz QA ${String(index + 1).padStart(3, '0')}`, participantCode: `QA-${String(index + 1).padStart(3, '0')}`,
  institutionId: index < 100 ? institutionA : institutionB, institutionName: index < 100 ? 'Lembaga A' : 'Lembaga B',
  confirmationStatus: 'CONFIRMED', approvalStatus: 'PENDING_REVIEW', ustadzEmail: `qa${index + 1}@example.invalid`,
  ustadzPhone: '081234567890', ustadzWhatsapp: '081234567890', ustadzAddress: 'Bandung',
  registrationSource: 'PUBLIC_REGULAR', registeredAt: new Date(Date.UTC(2026, 10, 10) - index * 1000).toISOString(), portalPasswordConfigured: false,
}));
const makeProgram = (number, completed) => ({ slug: `qa-${completed ? 'history' : 'agenda'}-${number}`, code: `QA-${number}`,
  name: `${completed ? 'History' : 'Agenda'} ${String(number).padStart(2, '0')}`, subtitle: null, posterUrl: null, posterAlt: null,
  startDate: '2026-01-01', endDate: '2026-01-02', venueName: 'Bandung', audienceMode: 'MIXED',
  status: completed ? 'COMPLETED' : 'REGISTRATION_OPEN', regularQuota: 100, registrationOpenAt: null, registrationCloseAt: null });
const history = Array.from({ length: 28 }, (_, index) => makeProgram(28 - index, true));
const agenda = Array.from({ length: 9 }, (_, index) => makeProgram(index + 1, false));
let people = makeParticipants(), role = 'REPORT_VIEWER', scenario = 0, selectionDelay = 0;
let invitation = { invitationNumber: 'QA-LIVE', quota: 3, allowGroup: true, responseDeadline: event.invitationResponseDeadline, status: 'SENT' };
const requests = [], failures = [], checks = [], screenshots = [];
const eligible = person => ['PENDING_REVIEW', 'WAITLISTED'].includes(person.approvalStatus) && ['INVITED', 'CONFIRMED'].includes(person.confirmationStatus);
const fixture = { name: 'performance-fixtures', configureServer(server) { server.middlewares.use(async (request, response, next) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/__performance_smoke') {
    scenario++; people = makeParticipants(); role = url.searchParams.get('role') || 'REPORT_VIEWER'; selectionDelay = 0;
    invitation = { ...invitation, quota: 3, allowGroup: true };
    const mode = url.searchParams.get('mode') || 'admin';
    const entry = mode === 'committee' ? '/committee/participants' : mode === 'programs' ? '/programs' : mode === 'home' ? '/'
      : mode === 'policy' ? '/invitation/institution/live' : `/admin/events/${eventId}/registrations?view=participants${url.searchParams.has('pending') ? '&status=PENDING_REVIEW' : ''}`;
    response.setHeader('Content-Type', 'text/html');
    return response.end(await server.transformIndexHtml(request.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
      import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter,Routes,Route} from 'react-router-dom'; import {Refine} from '@refinedev/core';
      import {authProvider} from '/src/lib/refine/authProvider.ts'; import {accessControlProvider} from '/src/lib/refine/accessControlProvider.ts';
      import {ProtectedRoute} from '/src/components/common/ProtectedRoute.tsx';
      import {EventRegistrationsPage} from '/src/pages/admin/events/EventRegistrationsPage.tsx'; import {CommitteeParticipantsPage} from '/src/pages/committee/CommitteeParticipantsPage.tsx';
      import {PublicProgramsPage} from '/src/pages/public/PublicProgramsPage.tsx'; import {InvitationRegistrationPage} from '/src/pages/public/InvitationRegistrationPage.tsx'; import '/src/index.css';
      window.confirm=()=>true; const originalURL=URL.createObjectURL.bind(URL); URL.createObjectURL=blob=>{if(blob.type.startsWith('text/csv'))blob.text().then(text=>window.__lastCsv=text);return originalURL(blob)};
      const click=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){if(!this.download)return click.call(this)};
      const secure=Component=>React.createElement(ProtectedRoute,null,React.createElement(Component));
      createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,{initialEntries:[${JSON.stringify(entry)}]},React.createElement(Refine,{authProvider,accessControlProvider,options:{disableTelemetry:true}},React.createElement(Routes,null,
        React.createElement(Route,{path:'/admin/events/:id/registrations',element:secure(EventRegistrationsPage)}), React.createElement(Route,{path:'/committee/participants',element:secure(CommitteeParticipantsPage)}),
        React.createElement(Route,{path:'/programs',element:React.createElement(PublicProgramsPage)}),React.createElement(Route,{path:'/',element:React.createElement(PublicProgramsPage)}),
        React.createElement(Route,{path:'/invitation/institution/:token',element:React.createElement(InvitationRegistrationPage)}))))));
    </script></body></html>`));
  }
  if (!url.pathname.startsWith('/api/v1/')) return next();
  const route = url.pathname.slice('/api/v1'.length), method = request.method;
  const chunks = []; for await (const chunk of request) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  const params = Object.fromEntries(url.searchParams);
  requests.push({ scenario, route, method, params, body });
  let data, meta;
  if (route === '/auth/session') data = { userId: 'qa-user', name: 'Penguji QA', email: 'qa@example.invalid', assignments: [{ roleCode: role, eventId }] };
  else if (route === '/me/permissions') data = { assignments: [{ roleCode: role, eventId }], effectivePermissions: ['events.read', 'participants.read'] };
  else if (route === '/events/options') data = [event];
  else if (route === `/events/${eventId}/registration-settings`) data = event;
  else if (route === `/events/${eventId}/participants` && method === 'GET') {
    assert.ok(params.page && params.pageSize, 'Workspaces must never request the legacy unbounded list');
    let filtered = people.filter(person => (!params.search || [person.ustadzName, person.participantCode, person.institutionName].join(' ').toLowerCase().includes(params.search.toLowerCase()))
      && (!params.status || params.status === 'ALL' || person.approvalStatus === params.status)
      && (!params.institution || params.institution === 'ALL' || person.institutionName === params.institution)
      && (params.eligible !== 'true' || eligible(person)));
    if (params.sort === 'PRIORITY') filtered = [...filtered].sort((a, b) => Number(a.approvalStatus !== 'PENDING_REVIEW') - Number(b.approvalStatus !== 'PENDING_REVIEW'));
    const page = Number(params.page), pageSize = Number(params.pageSize);
    meta = { page, pageSize, total: filtered.length, pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)), filteredEligible: filtered.filter(eligible).length,
      filteredPendingEligible: filtered.filter(person => person.approvalStatus === 'PENDING_REVIEW' && eligible(person)).length,
      summary: { total: people.length, approved: people.filter(person => person.approvalStatus === 'APPROVED').length,
        pending: people.filter(person => person.approvalStatus === 'PENDING_REVIEW').length, institution: people.length,
        pendingEligible: people.filter(person => person.approvalStatus === 'PENDING_REVIEW' && eligible(person)).length, completeContacts: people.length, portalReady: 0 }, institutions: ['Lembaga A', 'Lembaga B'] };
    data = filtered.slice((page - 1) * pageSize, page * pageSize);
    if (params.projection === 'selection') {
      data = data.map(({ id, ustadzName, participantCode, approvalStatus, confirmationStatus }) => ({ id, ustadzName, participantCode, approvalStatus, confirmationStatus }));
      if (selectionDelay) await new Promise(resolve => setTimeout(resolve, selectionDelay));
    }
  } else if (route === `/events/${eventId}/participants/bulk-approve` && method === 'POST') {
    assert.ok(body.participantIds.length <= 25);
    people = people.map(person => body.participantIds.includes(person.id) ? { ...person, approvalStatus: 'APPROVED' } : person);
    data = { summary: { total: body.participantIds.length, succeeded: body.participantIds.length, failed: 0 }, results: body.participantIds.map(participantId => ({ participantId, status: 'SUCCESS', message: 'Disetujui' })) };
  } else if (route === '/events/public') {
    const source = params.view === 'featured' ? agenda.slice(0, 3) : params.view === 'history' ? history : agenda;
    const filtered = source.filter(item => !params.search || item.name.toLowerCase().includes(params.search.toLowerCase()));
    const page = Number(params.page), pageSize = Number(params.pageSize);
    data = filtered.slice((page - 1) * pageSize, page * pageSize); meta = { page, pageSize, total: filtered.length, pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)) };
  } else if (route === '/invitations/public/institution/live') data = { invitation, event, institution: { name: 'Lembaga QA', code: 'QA' } };
  else if (route === '/invitations/public/institution/live/policy') data = invitation;
  else { failures.push(`Unexpected ${method} ${route}`); response.statusCode = 404; }
  response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ data, meta, error: data === undefined ? { message: 'Unexpected fixture route' } : null }));
}); } };
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: path.join(temporary, 'vite-cache'), plugins: [react(), fixture], resolve: { alias: { '@': path.join(root, 'src') } }, server: { host: '127.0.0.1', port: 0 } });
let browser, socket;
try {
  await server.listen(); const port = server.httpServer.address().port;
  browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${temporary}`, 'about:blank'], { stdio: 'ignore' });
  let debuggerPort;
  for (let index = 0; index < 150; index++) { try { debuggerPort = Number((await readFile(path.join(temporary, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
  assert.ok(debuggerPort);
  const targets = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, [resolve, reject]); socket.send(JSON.stringify({ id, method, params })); });
  socket.onmessage = ({ data }) => { const message = JSON.parse(data); if (message.id && pending.has(message.id)) { const [resolve, reject] = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') failures.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') failures.push(message.params.args);
  };
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const until = async (expression, label) => { for (let index = 0; index < 200; index++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error(`Timeout ${label}: ${await evaluate('document.body.innerText.slice(0,4000)')}; ${JSON.stringify(failures)}`); };
  const click = label => evaluate(`(()=>{const el=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(label)});if(!el||el.disabled)throw new Error('Unavailable button: '+${JSON.stringify(label)});el.click()})()`);
  const fill = (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`);
  const labelClick = prefix => evaluate(`(()=>{const el=[...document.querySelectorAll('label')].find(el=>el.textContent.trim().startsWith(${JSON.stringify(prefix)}))?.querySelector('input');if(!el||el.disabled)throw new Error('Unavailable checkbox');el.click()})()`);
  const navigate = query => send('Page.navigate', { url: `http://127.0.0.1:${port}/__performance_smoke?${query}` });
  const currentRequests = () => requests.filter(item => item.scenario === scenario);
  const fullReads = () => currentRequests().filter(item => item.route.endsWith('/participants') && item.method === 'GET' && item.params.projection !== 'selection');
  const mutations = () => currentRequests().filter(item => item.method !== 'GET');
  const waitAdmin = page => until(`document.querySelectorAll('tbody tr').length===25 && document.querySelector('[aria-label="Halaman peserta event"]')?.textContent.includes('Halaman ${page}/')`, 'admin page '+page);
  const waitCommittee = page => until(`document.querySelector('[aria-label="Daftar peserta"] ul')?.children.length===25 && document.querySelector('[aria-label="Halaman peserta panitia"]')?.textContent.includes('Halaman ${page}/')`, 'committee page '+page);
  const approveAdmin = async count => { await click(`Setujui terpilih (${count})`); await until(`document.querySelector('dialog[open]')?.textContent.includes('Setujui ${count} peserta?')`, 'approval confirmation'); await evaluate(`(()=>{const el=[...document.querySelectorAll('dialog[open] button')].find(el=>el.textContent.trim()==='Ya, setujui peserta');el.click();el.click()})()`); await until(`document.body.textContent.includes('Hasil persetujuan: ${count} berhasil') && !document.querySelector('dialog[open]')`, 'approval outcome'); };
  const screenshot = async name => { const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); const file = path.join(artifactRoot, `performance-${name}.png`); await writeFile(file, Buffer.from(image.data, 'base64')); screenshots.push(file); };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 850, deviceScaleFactor: 1, mobile: false });

  await navigate('mode=admin&role=REPORT_VIEWER'); await waitAdmin(1);
  assert.equal(fullReads().length, 1, 'one initial participant request under StrictMode');
  assert.equal(currentRequests().filter(item => item.route === '/auth/session').length, 1, 'shared check/identity session request');
  assert.ok(!currentRequests().some(item => item.route.includes('/invitations') || item.route === `/events/${eventId}`));
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Persetujuan massal peserta"]')`), false);
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(el=>['Setujui','Buat login','Reset login'].includes(el.textContent.trim()))`), false);
  await click('Berikutnya'); await waitAdmin(2); assert.equal(fullReads().at(-1).params.page, '2'); assert.equal(mutations().length, 0);
  checks.push('REPORT_VIEWER: permitted endpoints only, one StrictMode request, server pagination, no mutation controls');

  await navigate('mode=admin&role=SUPER_ADMIN'); await waitAdmin(1);
  assert.equal(currentRequests().filter(item => item.params.projection === 'selection').length, 0, 'no eager full selection read');
  await labelClick('Pilih semua di halaman'); await click('Berikutnya'); await waitAdmin(2);
  await evaluate(`document.querySelector('tbody input[type="checkbox"]').click()`);
  await until(`document.body.textContent.includes('Setujui terpilih (26)')`, 'cross-page selection');
  await labelClick('Pilih semua hasil filter'); await until(`document.body.textContent.includes('Setujui terpilih (155)')`, 'all 155 selected');
  assert.deepEqual(currentRequests().filter(item => item.params.projection === 'selection').map(item => [item.params.page, item.params.pageSize]), [['1', '100'], ['2', '100']]);
  await approveAdmin(155); assert.deepEqual(mutations().map(item => item.body.participantIds.length), [25, 25, 25, 25, 25, 25, 5]);
  checks.push('admin: lazy minimal cross-page selection, 155 approvals in seven batches, double-click protection');

  await navigate('mode=admin&role=SUPER_ADMIN&pending'); await waitAdmin(1);
  for (let page = 2; page <= 7; page++) { await click('Berikutnya'); await until(`document.querySelector('[aria-label="Halaman peserta event"]')?.textContent.includes('Halaman ${page}/7') && document.querySelectorAll('tbody tr').length===${page === 7 ? 5 : 25}`, 'last-page navigation'); }
  await labelClick('Pilih semua di halaman'); await approveAdmin(5); await waitAdmin(6);
  assert.equal(fullReads().at(-1).params.page, '6', 'last page is refetched after the filter shrinks');
  checks.push('admin: valid lower page refetched after approval empties the last page');

  await navigate('mode=committee&role=CHECKIN_OFFICER'); await waitCommittee(1);
  assert.equal(fullReads().length, 1); assert.equal(currentRequests().filter(item => item.route === '/events/options').length, 1);
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(el=>['Setujui','Tolak','Batalkan','Buat login','Reset login','Ekspor CSV'].includes(el.textContent.trim()))`), false);
  checks.push('committee: CHECKIN_OFFICER can read, without decision, export, or portal-account controls');

  await navigate('mode=committee&role=COMMITTEE_LEAD'); await waitCommittee(1);
  await fill('aside[aria-label="Kontrol daftar peserta"] select:nth-of-type(1)', eventId); // Event remains unchanged.
  await evaluate(`(()=>{const labels=[...document.querySelectorAll('aside[aria-label="Kontrol daftar peserta"] label')];const el=labels.find(el=>el.textContent.startsWith('Lembaga')).querySelector('select');el.value='Lembaga A';el.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await until(`document.body.textContent.includes('sesuai filter (100)') && document.querySelector('[aria-label="Halaman peserta panitia"]')?.textContent.includes('/4')`, 'institution A filter');
  await labelClick('Pilih semua yang menunggu'); await until(`document.body.textContent.includes('Setujui 100 peserta')`, 'institution A selection');
  await evaluate(`(()=>{const el=[...document.querySelectorAll('aside label')].find(el=>el.textContent.startsWith('Lembaga')).querySelector('select');el.value='Lembaga B';el.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await until(`document.body.textContent.includes('sesuai filter (55)')`, 'institution B filter');
  await until(`document.querySelector('[aria-label="Daftar peserta"] ul')?.textContent.includes('QA-101')`, 'institution B rows');
  await evaluate(`document.querySelectorAll('input[aria-label^="Pilih Ustadz QA"]').forEach(el=>el.click())`);
  await until(`document.body.textContent.includes('Setujui 125 peserta')`, 'manual B page selection');
  assert.equal(await evaluate(`[...document.querySelectorAll('label')].find(el=>el.textContent.startsWith('Pilih semua yang menunggu')).querySelector('input').checked`), false, 'outside-filter count never implies complete membership');
  await labelClick('Pilih semua yang menunggu'); await until(`document.body.textContent.includes('Setujui 155 peserta')`, 'all institutions selected');
  await click('Berikutnya'); await waitCommittee(2);
  assert.equal(await evaluate(`[...document.querySelectorAll('input[aria-label^="Pilih Ustadz QA"]')].every(el=>el.checked)`), true, 'cross-page selection persists');
  await evaluate(`(()=>{const el=[...document.querySelectorAll('aside label')].find(el=>el.textContent.startsWith('Lembaga')).querySelector('select');el.value='ALL';el.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await waitCommittee(1); const beforeExport = fullReads().length;
  await click('Ekspor CSV'); await until(`window.__lastCsv?.split(${JSON.stringify('\r\n')}).length===156`, 'complete 155-row export');
  assert.deepEqual(fullReads().slice(beforeExport).map(item => [item.params.page, item.params.pageSize]), [['1', '100'], ['2', '100']]);
  assert.equal(await evaluate(`window.__lastCsv.includes('QA-155') && window.__lastCsv.includes('QA-001')`), true);
  await click('Setujui 155 peserta'); await until(`document.body.textContent.includes('155 peserta berhasil disetujui')`, 'committee bulk approval');
  assert.equal(mutations().length, 7);
  checks.push('committee: exact filter membership, cross-page approval, full 155-row CSV via bounded explicit requests');
  await screenshot('committee-desktop');

  await navigate('mode=committee&role=COMMITTEE_LEAD'); await waitCommittee(1); selectionDelay = 750;
  await labelClick('Pilih semua yang menunggu'); await fill('input[placeholder="Nama, kode, lembaga"]', 'Ustadz QA 001');
  await until(`document.querySelector('[aria-label="Daftar peserta"] ul')?.children.length===1 && !document.body.textContent.includes('Setujui 155 peserta')`, 'new filter wins over old scope read');
  await until(`![...document.querySelectorAll('label')].find(el=>el.textContent.startsWith('Pilih semua yang menunggu'))?.querySelector('input').disabled`, 'old read released its lock');
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(el=>/^Setujui [0-9]+ peserta$/.test(el.textContent.trim()))`), false, 'no stale selection applied');
  assert.equal(currentRequests().filter(item => item.params.projection === 'selection').length, 1, 'no further old-filter pages are requested');
  assert.equal(mutations().length, 0);
  checks.push('stale full-filter selection cannot apply after filters change');

  await navigate('mode=programs'); await until(`document.querySelectorAll('.public-home__history-row').length===12 && document.querySelectorAll('#agenda-daurah article').length===6`, 'bounded public catalog');
  assert.deepEqual(currentRequests().filter(item => item.route === '/events/public').map(item => [item.params.view, item.params.pageSize]).sort(), [['agenda', '6'], ['history', '12']]);
  await click('Berikutnya'); await until(`document.querySelector('[aria-label="Halaman riwayat daurah"]')?.textContent.includes('Halaman 2/3') && document.querySelectorAll('.public-home__history-row').length===12`, 'public history page two');
  assert.equal(currentRequests().filter(item => item.params.view === 'agenda').length, 1, 'history page does not reload agenda');
  await click('Lihat agenda berikutnya'); await until(`document.querySelectorAll('#agenda-daurah article').length===9`, 'load more agenda');
  await fill('#program-search', 'History 28'); await until(`document.querySelectorAll('.public-home__history-row').length===1 && document.body.textContent.includes('1 kegiatan selesai')`, 'public search resets page');
  checks.push('public: paginated history, independent agenda load-more, debounced server search');
  await navigate('mode=home'); await until(`document.querySelectorAll('.public-home__program-card').length===3`, 'featured three');
  assert.equal(currentRequests().filter(item => item.route === '/events/public').length, 1); assert.equal(currentRequests().find(item => item.route === '/events/public').params.pageSize, '3');
  assert.match(await evaluate(`document.querySelector('.public-home__hero-image img').srcset`), /800w/);
  checks.push('home: three featured records only and responsive WebP hero');

  await navigate('mode=policy'); await until(`document.querySelector('form[aria-label="Formulir konfirmasi undangan"]')`, 'live policy form');
  await fill('input[name="delegate-0-name"]', 'Peserta Utama Tetap');
  await evaluate(`document.querySelector('input[aria-controls="invitation-delegates"]').click()`); await click('Tambah peserta'); await click('Tambah peserta');
  await fill('input[name="delegate-2-name"]', 'Anggota Berlebih'); await evaluate(`document.querySelector('input[name="consent"]').click()`);
  invitation = { ...invitation, quota: 2 };
  await evaluate(`window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))`);
  await until(`document.querySelectorAll('[data-delegate]').length===2 && document.body.textContent.includes('Pengaturan undangan diperbarui')`, 'live reduced quota');
  assert.equal(await evaluate(`document.querySelector('input[name="delegate-0-name"]').value`), 'Peserta Utama Tetap');
  assert.equal(await evaluate(`document.querySelector('input[name="consent"]').checked`), false);
  invitation = { ...invitation, quota: 1, allowGroup: false }; await evaluate(`window.dispatchEvent(new Event('focus'))`);
  await until(`document.querySelectorAll('[data-delegate]').length===1 && !document.querySelector('input[aria-controls="invitation-delegates"]')`, 'live single-person policy');
  assert.equal(await evaluate(`document.querySelector('input[name="delegate-0-name"]').value`), 'Peserta Utama Tetap');
  assert.equal(currentRequests().filter(item => item.route === '/invitations/public/institution/live').length, 1, 'no duplicate full invitation/open audit request');
  assert.equal(mutations().length, 0, 'policy revalidation never submits a response');
  checks.push('same open invitation: live quota changes, excess members cleared, primary preserved, consent reset, read-only deduplicated refresh');
  for (const width of [320, 390, 768, 1280]) { await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 768 }); assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'), true, `policy layout ${width}px`); }
  await screenshot('policy-refresh');
  assert.deepEqual(failures, [], 'No unexpected endpoints or browser errors');
  const report = { result: 'PASS', strictMode: true, participants: 155, checks, screenshots };
  await writeFile(path.join(artifactRoot, 'performance-browser-results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally {
  socket?.close(); browser?.kill(); await server.close(); await new Promise(resolve => setTimeout(resolve, 400));
  if (!path.resolve(temporary).startsWith(`${path.resolve(artifactRoot)}${path.sep}`)) throw new Error('Unsafe temporary browser profile path');
  await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}
