// Run: node tests/browser-accessibility-check.cjs
// Real Chrome, actual theme scripts/CSS and PHP-stripped panel markup. No WordPress writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const theme = path.resolve(__dirname, '..');
const pwaScenario = process.argv.includes('--pwa') ? require('./browser-pwa-scenario.cjs') : null;
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'osada-a11y-'));
const panels = fs.readFileSync(path.join(theme, 'front-page.php'), 'utf8').replace(/<\?php[\s\S]*?(?:\?>|$)/g, '');
const pixel = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="tan"/></svg>');
const fixture = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head>
<body class="site-language-en"><script>localStorage.setItem('osada-info-panel-seen','true');</script>
${panels}<button id="marker-trigger">Building marker</button><section class="building-section">
<button id="image-one" data-lightbox-image data-lightbox-source="${pixel}" data-lightbox-alt="First">First image</button>
<button id="image-two" data-lightbox-image data-lightbox-source="${pixel}" data-lightbox-alt="Second">Second image</button>
</section><a id="outside-link" href="#outside">Outside</a>
<script src="/dist/assets/main.js"></script><script src="/dist/assets/building-carousel.js"></script></body></html>`;
const allowed = new Map(['/style.css', '/dist/assets/main.js', '/dist/assets/building-carousel.js'].map(url => [url, path.join(theme, url)]));
const server = http.createServer((req, res) => {
  if (pwaScenario?.handleRequest(req, res, theme)) return;
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(fixture); }
  const file = allowed.get(req.url);
  if (!file) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'application/javascript');
  res.end(fs.readFileSync(file));
});
let chrome, socket;
let count = 0;
const checks = (condition, label) => { assert.ok(condition, label); count++; };
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Chrome startup timeout')), 15000);
    chrome.on('error', error => { clearTimeout(timer); reject(error); });
    chrome.stderr.on('data', data => {
      output += data;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0, session;
  const pending = new Map();
  const errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (!message.id) return;
    const job = pending.get(message.id);
    if (!job) return;
    clearTimeout(job.timer); pending.delete(message.id);
    message.error ? job.reject(new Error(message.error.message)) : job.resolve(message.result);
  };
  const send = (method, params = {}, root = false) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(requestId, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: requestId, method, params, ...(!root && session ? { sessionId: session } : {}) }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, true);
  session = (await send('Target.attachToTarget', { targetId, flatten: true }, true)).sessionId;
  await send('Page.enable'); await send('Runtime.enable');
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const key = async (key, code, modifiers = 0) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, modifiers });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code, modifiers });
  };
  if (pwaScenario) {
    await pwaScenario.run({ send, evaluate, checks, baseUrl: `http://127.0.0.1:${server.address().port}` });
    checks(errors.length === 0, `browser errors: ${errors.join(', ')}`);
    console.log(`${count} real-browser PWA checks passed.`);
    return;
  }
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    await evaluate(`new Promise(resolve => {
      if (document.readyState === 'complete') resolve(); else window.addEventListener('load', resolve, {once:true});
    })`);
    checks(await evaluate(`window.innerWidth === ${width}`), 'expected viewport width');
    checks(await evaluate(`document.getElementById('info-panel').inert && document.getElementById('slide-panel').inert`), 'closed panels inert');
    checks(await evaluate(`document.getElementById('outside-link').focus(); document.getElementById('info-panel-close').focus(); document.activeElement.id === 'outside-link'`), 'hidden panel rejects focus');
    checks(await evaluate(`document.getElementById('info-panel-toggle').click(); document.activeElement.id === 'info-panel-close' && !document.getElementById('info-panel').inert`), 'INFO moves focus into panel');
    await key('Escape', 27);
    checks(await evaluate(`document.getElementById('info-panel').inert && document.activeElement.id === 'info-panel-toggle' && document.activeElement.getAttribute('aria-expanded') === 'false'`), 'Escape returns focus to INFO');
    await evaluate(`document.getElementById('marker-trigger').focus(); openPanel({id:1,title:{rendered:'Test building'},acf:{},link:'/'}, {getElement:()=>document.getElementById('marker-trigger')});`);
    checks(await evaluate(`document.activeElement.id === 'panel-close' && !document.getElementById('slide-panel').inert`), 'building panel focus');
    await key('Escape', 27);
    checks(await evaluate(`document.getElementById('slide-panel').inert && document.activeElement.id === 'marker-trigger'`), 'building panel restores marker focus');
    await evaluate(`document.getElementById('image-one').click()`);
    checks(await evaluate(`document.querySelector('.building-lightbox').matches(':modal')`), 'native modal opens');
    for (let i = 0; i < 6; i++) {
      await key('Tab', 9, i > 2 ? 8 : 0);
      checks(await evaluate(`document.activeElement === document.body || document.querySelector('.building-lightbox').contains(document.activeElement)`), 'Tab cannot focus background');
    }
    await key('ArrowRight', 39);
    checks(await evaluate(`document.querySelector('.building-lightbox__image').alt === 'Second'`), 'next image via keyboard');
    await key('Escape', 27);
    // Native dialog close events are queued after key dispatch.
    await evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    checks(await evaluate(`!document.querySelector('.building-lightbox').open && document.activeElement.id === 'image-one'`), 'modal Escape restores trigger focus');
    checks(await evaluate(`!document.documentElement.classList.contains('has-building-lightbox')`), 'page scrolling restored');
  }
  checks(errors.length === 0, `browser errors: ${errors.join(', ')}`);
  console.log(`${count} browser accessibility checks passed (desktop + mobile viewport).`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill();
    await new Promise(resolve => { chrome.once('exit', resolve); setTimeout(resolve, 2000).unref(); });
  }
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  // Only the unique test profile created above may be removed.
  if (path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith('osada-a11y-')) {
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {}
  }
});
