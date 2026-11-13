/** Isolated real LoginPage/authProvider regression; no database, email, or production requests. */
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
const profile = await mkdtemp(path.join(os.tmpdir(), 'daurah-committee-login-'));
const email = 'committee@login-fixture.invalid';
const fixture = { name: 'committee-login-fixture', configureServer(server) {
  server.middlewares.use(async (request, response, next) => {
    const route = new URL(request.url, 'http://127.0.0.1').pathname;
    if (!['/login/admin', '/login/committee', '/committee'].includes(route)) return next();
    response.setHeader('Content-Type', 'text/html');
    response.end(await server.transformIndexHtml(request.url, `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {BrowserRouter,Routes,Route} from 'react-router-dom';
      import {LoginPage} from '/src/pages/auth/LoginPage.tsx';
      import '/src/index.css';
      window.__requests=JSON.parse(sessionStorage.getItem('login-fixture-requests')||'[]');
      window.__fixtureFailures=[];
      const realFetch=window.fetch.bind(window);
      window.fetch=async(url,options={})=>{
        const pathname=new URL(url,location.origin).pathname;
        if(!pathname.startsWith('/api/v1/'))return realFetch(url,options);
        const body=options.body?JSON.parse(options.body):null;
        window.__requests.push({pathname,body});sessionStorage.setItem('login-fixture-requests',JSON.stringify(window.__requests));
        const reply=(data,status=200,error=null)=>new Response(JSON.stringify({data,error}),{status,headers:{'Content-Type':'application/json'}});
        if(pathname.endsWith('/auth/password/login')){
          if(!['fixture-correct-password','FixtureNewPassword42'].includes(body.password))return reply(null,401,{message:'Email atau password tidak sesuai.'});
          if(body.portal==='admin')return reply(null,403,{message:'Email dan password benar. Gunakan Portal Panitia sesuai tugas akun ini.',details:{recommendedPortal:'committee',loginPath:'/login/committee'}});
          if(body.portal==='committee'){sessionStorage.setItem('login-fixture-session','active');return reply({});}
        }
        if(pathname.endsWith('/auth/password/setup/request')){
          if(body.portal==='admin')return reply(null,401,{message:'Akun aktif untuk portal ini tidak ditemukan.'});
          return reply({challengeToken:'fixture-challenge-not-real',expiresAt:'2099-01-01T00:00:00Z'});
        }
        if(pathname.endsWith('/auth/password/setup/complete'))return reply({passwordUpdated:true});
        if(pathname.endsWith('/auth/session'))return sessionStorage.getItem('login-fixture-session')==='active'
          ?reply({userId:'fixture-user',email:'${email}',assignments:[{roleCode:'CHECKIN_OFFICER'}]})
          :reply(null,401,{message:'Autentikasi diperlukan.'});
        window.__fixtureFailures.push(pathname);return reply(null,404,{message:'Unexpected fixture request'});
      };
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Routes,null,
        React.createElement(Route,{path:'/login/admin',element:React.createElement(LoginPage)}),
        React.createElement(Route,{path:'/login/committee',element:React.createElement(LoginPage)}),
        React.createElement(Route,{path:'/committee',element:React.createElement('h1',{id:'committee-fixture-landing'},'Ruang kerja Panitia uji')})
      )));
    </script></body></html>`));
  });
} };
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: path.join(profile, 'vite-cache'),
  plugins: [react(), fixture], resolve: { alias: { '@': path.join(root, 'src') } }, server: { host: '127.0.0.1', port: 0 } });
let browser, socket;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let debuggerPort;
  for (let index = 0; index < 100; index++) {
    try { debuggerPort = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  assert.ok(debuggerPort, 'Chromium debugger failed to start');
  const targets = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map(), failures = [], screenshots = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const [resolve, reject, timeout] = pending.get(message.id); pending.delete(message.id); clearTimeout(timeout);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') failures.push(message.params.exceptionDetails);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout ${method}`)); }, 30_000);
    pending.set(id, [resolve, reject, timeout]); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async (expression, label) => {
    for (let index = 0; index < 150; index++) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.fail(label);
  };
  const input = (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const click = (text) => evaluate(`(()=>{const el=[...document.querySelectorAll('button,a')].find(el=>el.textContent.trim()===${JSON.stringify(text)});if(!el)throw new Error('Missing action');el.click();})()`);
  const checkWidths = async (label) => {
    for (const width of [320, 375, 414, 768, 1280]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 768 });
      await new Promise((resolve) => setTimeout(resolve, 75));
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true, `${label}: no horizontal overflow ${width}px`);
      const wrapped = await evaluate(`(()=>{const failures=[];for(const el of document.querySelectorAll('[data-login-portal-hint],.login-activation__toggle,.login-submit,.login-activation__action')){if(!el.getBoundingClientRect().width)continue;const tops=new Set(),walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const text=walker.currentNode;if(!text.textContent.trim()||text.parentElement.closest('svg'))continue;const range=document.createRange();range.selectNodeContents(text);for(const rect of range.getClientRects())if(rect.width>1)tops.add(Math.round(rect.top));}if(tops.size>1)failures.push(el.textContent.trim());}return failures;})()`);
      assert.deepEqual(wrapped, [], `${label}: action labels stay on one line ${width}px`);
      const stackedIcons = await evaluate(`(()=>{const failures=[];for(const el of document.querySelectorAll('a.login-activation__toggle')){const svg=el.querySelector('svg');const text=el.querySelector('span')||[...el.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim());if(!svg||!text)continue;const range=document.createRange();range.selectNodeContents(text);const rect=range.getBoundingClientRect(),icon=svg.getBoundingClientRect();if(Math.abs(rect.top+rect.height/2-icon.top-icon.height/2)>6)failures.push(el.textContent.trim());}return failures;})()`);
      assert.deepEqual(stackedIcons, [], `${label}: link arrows share the label row ${width}px`);
    }
  };
  const screenshot = async (name) => {
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 850, deviceScaleFactor: 1, mobile: true });
    await evaluate('scrollTo(0,0)'); await new Promise((resolve) => setTimeout(resolve, 100));
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const target = path.join(os.tmpdir(), `daurah-committee-login-${name}-375.png`);
    await writeFile(target, Buffer.from(shot.data, 'base64')); screenshots.push(target);
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: `${origin}/login/admin` });
  await until(`!!document.querySelector('#admin-email')`, 'admin login renders');
  await input('#admin-email', email); await input('#admin-password', 'wrong-password');
  await evaluate(`document.querySelector('.login-form__fields').requestSubmit()`);
  await until(`document.querySelector('.login-alert')?.textContent.includes('tidak sesuai')`, 'bad password is rejected');
  assert.equal(await evaluate(`!!document.querySelector('[data-login-portal-hint]')`), false, 'unknown credentials never reveal account role');
  await input('#admin-password', 'fixture-correct-password');
  await evaluate(`document.querySelector('.login-form__fields').requestSubmit()`);
  await until(`!!document.querySelector('[data-login-portal-hint]')`, 'correct credentials explain wrong portal');
  assert.equal(await evaluate(`document.querySelector('#admin-email').getAttribute('aria-invalid')`), null, 'verified email is not marked invalid for a portal mismatch');
  assert.equal(await evaluate(`document.querySelector('#admin-password').getAttribute('aria-invalid')`), null, 'verified password is not marked invalid for a portal mismatch');
  await checkWidths('wrong portal'); await screenshot('wrong-portal');
  assert.equal(await evaluate(`document.querySelector('[data-login-portal-hint]').getAttribute('href')`), '/login/committee');
  await click('Buka Portal Panitia');
  await until(`!!document.querySelector('#committee-email')`, 'correct portal opens');
  assert.equal(await evaluate(`document.querySelector('#committee-email').value`), email);
  assert.equal(await evaluate(`document.querySelector('#committee-password').value`), '', 'password is never carried between portals');
  assert.equal(await evaluate(`!!document.querySelector('.login-activation__panel')`), false);
  await input('#committee-password', 'fixture-correct-password');
  await evaluate(`document.querySelector('.login-form__fields').requestSubmit()`);
  await until(`!!document.querySelector('#committee-fixture-landing')`, 'one password submission reaches committee dashboard');
  assert.equal(await evaluate(`location.pathname`), '/committee');
  assert.ok(await evaluate(`window.__requests.some(request=>request.pathname.endsWith('/auth/session'))`), 'session handshake runs before the redirect');
  await evaluate(`sessionStorage.removeItem('login-fixture-session')`);

  await send('Page.navigate', { url: `${origin}/login/admin` });
  await until(`!!document.querySelector('#admin-email')`, 'admin recovery form');
  await input('#admin-email', email); await click('Aktivasi akun / lupa password');
  await evaluate(`document.querySelector('.login-activation__form').requestSubmit()`);
  await until(`!!document.querySelector('.login-activation__error')`, 'wrong portal recovery is generic');
  assert.equal(await evaluate(`document.querySelector('.login-activation__error').textContent`), 'Akun aktif untuk portal ini tidak ditemukan.');
  assert.equal(await evaluate(`document.querySelectorAll('.login-panel a[href^="/login/"]').length`), 1, 'no all-portal chooser is introduced');
  await checkWidths('recovery correction'); await screenshot('recovery-correction');
  await click('Buka Portal Panitia');
  await until(`!!document.querySelector('#committee-activation-panel')`, 'recovery stays open in the correct portal');
  assert.equal(await evaluate(`document.querySelector('#committee-email').value`), email);
  assert.equal(await evaluate(`document.querySelector('.login-activation__field input[type="email"]').value`), email);
  assert.equal(await evaluate(`document.querySelector('#committee-password').value`), '');
  await evaluate(`document.querySelector('.login-activation__form').requestSubmit()`);
  await until(`document.querySelector('.login-activation__panel strong')?.textContent==='Buat password baru'`, 'committee email activation sends');
  assert.equal(await evaluate(`window.__requests.filter(request=>request.pathname.endsWith('/setup/request')).at(-1).body.portal`), 'committee');
  await input('.login-activation__field input[inputmode="numeric"]', '123456');
  await input('.login-activation__field input[type="password"]', 'FixtureNewPassword42');
  await input('.login-activation__field:last-of-type input[type="password"]', 'FixtureNewPassword42');
  await checkWidths('committee activation'); await screenshot('committee-activation');
  await evaluate(`document.querySelector('.login-activation__form').requestSubmit()`);
  await until(`!!document.querySelector('#committee-fixture-landing')`, 'activation saves and signs in once');
  const calls = await evaluate(`window.__requests`);
  assert.equal(calls.filter((request) => request.pathname.endsWith('/setup/complete')).length, 1);
  assert.equal(calls.filter((request) => request.pathname.endsWith('/auth/password/login') && request.body.portal === 'committee').length, 2, 'one ordinary login plus one recovery login, no repeated submission');
  assert.deepEqual(await evaluate('window.__fixtureFailures'), []);
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ result: 'PASS', widths: [320, 375, 414, 768, 1280], checks: [
    'wrong-password privacy', 'verified wrong-portal guidance', 'email-only handoff', 'single-submit committee login and session handshake',
    'generic recovery and static committee guidance', 'committee recovery keeps portal/email', 'no three-portal chooser', 'activation and automatic login',
  ], screenshots }, null, 2));
} finally {
  socket?.close(); browser?.kill(); await server.close();
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (path.dirname(path.resolve(profile)) !== path.resolve(os.tmpdir()) || !path.basename(profile).startsWith('daurah-committee-login-')) throw new Error('Unsafe temporary profile path');
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}
