import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import {browserContextNetwork, browserNetwork} from './helpers/browser-network.mjs';

const mount = '/ConsoleGames-Preview/';
const routeTable = {
  otthi: ['games/otthi/', 'app.js'], familia: ['games/familia/3d/', 'console-world.js'],
  kart: ['games/kart/', 'js/game_kart.js'], boxe: ['games/boxe/', 'js/game_box.js'],
  tenis: ['games/tenis/', 'js/game_tennis.js'], ar: ['games/ar/', 'js/game_ar.js'],
  voo: ['games/voo/', 'js/game_flight.js'], danca: ['games/danca/', 'app.js'],
};
const mime = {
  '.html': 'text/html; charset=UTF-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.wasm': 'application/wasm',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.task': 'application/octet-stream',
};
const root = path.resolve('_pages_preview');
const hosted = process.env.OT_PAGES_URL;
const out = process.env.OT_PAGES_OUT || 'test-results/pages-preview';
await mkdir(out, {recursive: true});

let server;
if (!hosted) {
  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/ConsoleGames/qa.html') {
        res.writeHead(200, {'Content-Type': mime['.html']}).end('<!DOCTYPE html><title>Production sentinel</title>');
        return;
      }
      if (url.pathname === '/ConsoleGames/sw.js') {
        res.writeHead(200, {'Content-Type': mime['.js']}).end('self.skipWaiting();');
        return;
      }
      if (!url.pathname.startsWith(mount)) throw new Error('Invalid mount');
      let file = path.resolve(root, decodeURIComponent(url.pathname.slice(mount.length)));
      if (file !== root && !file.startsWith(root + '/')) throw new Error('Invalid asset path');
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}).end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}
const base = new URL(hosted || `http://127.0.0.1:${server.address().port}${mount}`);
assert.equal(base.pathname, mount);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const browser = await chromium.launch({...browserNetwork(base.href), args: [
  '--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
]});
const report = {base: base.href, browser: browser.version(), checks: [], pages: [], layouts: [], errors: []};
const context = await browser.newContext({...browserContextNetwork(base.href), viewport: {width: 393, height: 852},
  isMobile: true, deviceScaleFactor: 1, hasTouch: true});
const page = await context.newPage();
page.setDefaultTimeout(45000);
page.on('pageerror', error => report.errors.push(error.message));
const backend = /(?:firebaseio\.com|firebasedatabase\.app|firebaseapp\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com)$/;
const backendRequests = [];
await context.route(/^https?:\/\//, route => {
  const url = new URL(route.request().url());
  if (backend.test(url.hostname)) backendRequests.push(url.hostname);
  return url.origin === base.origin ? route.continue() : route.abort();
});
const href = relative => new URL(relative, base).href;
const go = async relative => {
  const response = await page.goto(href(relative), {waitUntil: 'domcontentloaded', timeout: 90000});
  assert.equal(response.status(), 200, relative);
};
const waitPath = relative => page.waitForURL(url => url.origin === base.origin && url.pathname === new URL(relative, base).pathname, {timeout: 90000});
const saveReport = () => writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2));

async function inspectConsole() {
  await waitPath('arcade/');
  await page.waitForFunction(() => window.THIAGUINHO_CONSOLE?.count === 8);
  assert.equal(await page.locator('.game-card').count(), 8);
  assert.equal(await page.evaluate(() => OTTHI_CANONICAL.consoleUrl), href('arcade/'));
}

try {
  if (hosted) {
    let available = false;
    for (let attempt = 0; attempt < 12 && !available; attempt++) {
      const response = await context.request.get(href('preview-release.json'), {timeout: 10000}).catch(() => null);
      if (response?.ok()) {
        const metadata = await response.json().catch(() => null);
        available = Boolean(metadata?.revision && (!process.env.GITHUB_SHA || metadata.commit === process.env.GITHUB_SHA));
      }
      if (!available) await new Promise(resolve => setTimeout(resolve, 2500));
    }
    assert(available, 'The deployed commit never became available at the Pages URL');
  }
  if (!hosted) {
    await page.goto(new URL('/ConsoleGames/qa.html', base).href);
    await page.evaluate(async () => {
      localStorage.setItem('qa-profile', 'real'); sessionStorage.setItem('qa-profile', 'real');
      await (await caches.open('qa-assets')).put('/qa-shared', new Response('real'));
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('qa-profile', 3);
        request.onupgradeneeded = () => request.result.createObjectStore('real');
        request.onsuccess = () => { request.result.close(); resolve(); };
        request.onerror = reject;
      });
      await navigator.serviceWorker.register('/ConsoleGames/sw.js');
    });
  }
  await go('arcade/');
  await inspectConsole();
  report.release = await (await context.request.get(href('preview-release.json'))).json();
  if (process.env.GITHUB_SHA) assert.equal(report.release.commit, process.env.GITHUB_SHA);
  const releaseUrl = href('games/otthi/release-manifest.json');
  const release = await (await context.request.get(releaseUrl)).json();
  assert.equal(release.revision, report.release.revision);
  assert.equal(release.build, report.release.build);
  const firebaseEnabled = report.release.firebase === 'enabled';
  assert(['enabled','disabled'].includes(report.release.firebase), 'Unknown Firebase publishing mode');
  const networkDenied = await page.evaluate(() => new Promise(resolve => {
    const timeout = setTimeout(() => resolve(false), 2000);
    document.addEventListener('securitypolicyviolation', event => {
      if (event.violatedDirective === 'connect-src' && event.blockedURI.includes('identitytoolkit.googleapis.com')) {
        clearTimeout(timeout); resolve(true);
      }
    }, {once: true});
    fetch('https://identitytoolkit.googleapis.com/consolegames-preview-probe', {credentials: 'omit'}).catch(() => {});
  }));
  assert.equal(networkDenied, !firebaseEnabled);
  if(firebaseEnabled){
    assert(backendRequests.includes('identitytoolkit.googleapis.com'), 'Firebase network probe must reach the intercepted QA route');
    assert.equal(await page.evaluate(()=>window.OTTHOS_FIREBASE_CONFIG?.projectId), 'otthi-656c5');
    assert.equal(await page.evaluate(()=>window.OTTHOS_FIREBASE_CONFIG?.enabled), true);
    await page.locator('#profile-btn').tap();
    await page.locator('#login-form').waitFor({state:'visible'});
    await page.locator('#profile-dialog').evaluate(dialog=>dialog.close());
  }
  report.checks.push(firebaseEnabled?'firebase-config-and-policy-with-remote-network-blocked':'firebase-network-policy');
  for (const name of ['index.html', 'app.js', 'sw.js', 'src/module-order.json', '../danca/index.html']) {
    const resource = await context.request.get(new URL(name, releaseUrl).href);
    assert.equal(resource.status(), 200, name);
    assert.equal(sha256(await resource.body()), release.files[name], name);
  }

  if (!hosted) {
    const isolated = await page.evaluate(async () => {
      const absent = [localStorage.getItem('qa-profile'), sessionStorage.getItem('qa-profile'), await caches.match('/qa-shared')];
      localStorage.setItem('qa-profile', 'test'); sessionStorage.setItem('qa-profile', 'test');
      await (await caches.open('qa-assets')).put('/qa-shared', new Response('test'));
      const cache = await (await caches.match('/qa-shared')).text();
      const stored = [localStorage.getItem('qa-profile'), sessionStorage.getItem('qa-profile'), cache];
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('qa-profile', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('test');
        request.onsuccess = () => { const result = [...request.result.objectStoreNames]; request.result.close(); resolve(result); };
        request.onerror = reject;
      });
      const onlyPreviewWorkers = (await navigator.serviceWorker.getRegistrations()).every(r => r.scope.includes('/ConsoleGames-Preview/'));
      localStorage.clear(); sessionStorage.clear(); await caches.delete('qa-assets'); indexedDB.deleteDatabase('qa-profile');
      return {absent, stored, db, onlyPreviewWorkers};
    });
    assert.deepEqual(isolated, {absent: [null, null, undefined], stored: ['test', 'test', 'test'], db: ['test'], onlyPreviewWorkers: true});
    await page.goto(new URL('/ConsoleGames/qa.html', base).href);
    const original = await page.evaluate(async () => ({
      local: localStorage.getItem('qa-profile'), session: sessionStorage.getItem('qa-profile'),
      assets: await (await caches.match('/qa-shared')).text(),
      db: (await indexedDB.databases()).find(entry => entry.name === 'qa-profile')?.version,
      worker: Boolean(await navigator.serviceWorker.getRegistration()),
    }));
    assert.deepEqual(original, {local: 'real', session: 'real', assets: 'real', db: 3, worker: true});
    report.checks.push('same-origin-separation');
    await go('arcade/');
  }

  for (const [id, [relative, script]] of Object.entries(routeTable)) {
    await page.locator(`[data-game="${id}"] [data-launch="${id}"]`).tap();
    await waitPath(relative);
    await page.waitForFunction(() => !!window.OTTHI_CANONICAL && !!window.CONSOLEGAMES_PREVIEW);
    const gameAsset = await page.locator('body').evaluate((body, suffix) => [...body.ownerDocument.scripts]
      .find(script => script.src && new URL(script.src).pathname.endsWith('/' + suffix))?.src, script);
    assert(gameAsset?.startsWith(href(relative)), id);
    assert.equal((await context.request.get(gameAsset)).status(), 200, id);
    if (id === 'otthi') assert.equal(await page.evaluate(() => window.OTTHOS_FIREBASE_CONFIG?.enabled === true), firebaseEnabled);
    if (firebaseEnabled && ['kart','boxe','tenis','ar','voo'].includes(id)) {
      assert.equal(await page.locator('script[src*="firebasejs/"][src*="firebase-auth"]').count(), 1, id+' must retain original Firebase Auth SDK');
      assert.match(await page.locator('script:not([src])').allTextContents().then(parts=>parts.join('\n')), /projectId:\s*["']thiaguinhogame-ac91b["']/);
    }
    report.pages.push({id, url: page.url()});

    if (id === 'otthi') {
      await page.waitForFunction(revision => window.OTTHI_RELEASE_COHERENT && window.OTTHI_RELEASE_REVISION === revision, release.revision);
      await page.locator('#playBtn').tap();
      if(firebaseEnabled){
        await page.locator('[data-account-create]').waitFor({state:'visible'});
        await page.locator('[data-account-login]').waitFor({state:'visible'});
      }
      await page.locator('[data-account-offline]').tap();
      await page.locator('#playerNameInput').fill('Rio Preto QA');
      await page.locator('#playerNameInput').press('Enter');
      await page.waitForFunction(() => OTTHOS_TEST_API.getGame().running && document.querySelector('#modal').hidden, null, {timeout: 160000});
      assert.equal(await page.evaluate(() => OTTHOS_TEST_API.getState().profile.name), 'Rio Preto QA');
      assert.equal(await page.evaluate(() => OTTHOS_RTDB.configured), firebaseEnabled);

      for (const viewport of [{width: 320, height: 568}, {width: 393, height: 852}, {width: 568, height: 320}, {width: 740, height: 360}]) {
        await page.setViewportSize(viewport);
        await page.waitForFunction(({width, height}) => innerWidth === width && innerHeight === height, viewport);
        for (const mode of ['clean', 'full']) {
          await page.evaluate(mode => OT_EXPLORATION_HUD.setMode(mode), mode);
          await page.locator('#quickToggleBtn').tap();
          const layout = await page.locator('#quickBar').evaluate(bar => {
            const rect = bar.getBoundingClientRect();
            const tiles = [...bar.querySelectorAll(':scope > button, :scope > a')].filter(el => el.getBoundingClientRect().width);
            const boxes=tiles.map(el=>({id:el.id,rect:el.getBoundingClientRect()}));
            const overlaps=[];for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){const p=boxes[a],q=boxes[b];if(Math.min(p.rect.right,q.rect.right)-Math.max(p.rect.left,q.rect.left)>1&&Math.min(p.rect.bottom,q.rect.bottom)-Math.max(p.rect.top,q.rect.top)>1)overlaps.push([p.id,q.id]);}
            return {left: rect.left, right: rect.right, bottom: rect.bottom, scrollWidth: bar.scrollWidth,
              clientWidth: bar.clientWidth, small: tiles.filter(el => el.offsetWidth < 44 || el.offsetHeight < 44).map(el => el.id),
              tiles: tiles.map(el => el.id), overlaps};
          });
          assert(layout.left >= 0 && layout.right <= viewport.width && layout.bottom <= viewport.height, JSON.stringify(layout));
          assert(layout.scrollWidth <= layout.clientWidth + 1, JSON.stringify(layout));
          assert.deepEqual(layout.small, []);
          assert.deepEqual(layout.overlaps, [], JSON.stringify(layout));
          for (const id of ['worldHomeBtn', 'worldPhoneBtn', 'mapBtn', 'worldCampaignBtn', 'avatarGameBtn', 'worldChooseAvatarBtn', 'worldLobbyBtn']) assert(layout.tiles.includes(id), id);
          if (viewport.width !== 320) await page.screenshot({path: path.join(out, `${viewport.width}-${mode}.png`)});
          await page.locator('#worldMenuClose').tap();
          report.layouts.push({viewport, mode, tiles: layout.tiles.length});
        }
      }
      await page.setViewportSize({width: 393, height: 852});
      await page.locator('#quickToggleBtn').tap();
      await page.locator('#worldHomeBtn').tap();
      const p = await page.evaluate(() => OTTHOS_TEST_API.getGame().player);
      await page.keyboard.down('KeyD');
      try {
        await page.waitForFunction(({x, z}) => {
          const player = OTTHOS_TEST_API.getGame().player;
          return Math.hypot(x - player.x, z - player.z) > .15;
        }, p, {timeout: 15000});
      } finally { await page.keyboard.up('KeyD'); }

      await page.evaluate(() => {
        const table = OTTHI_VENUES.locations().find(venue => venue.id === 'venue-pingpong');
        OTTHOS_TEST_API.teleport(table.navX, table.navZ);
      });
      await page.waitForFunction(() => OTTHOS_TEST_API.getContext()?.id === 'activity-venue-pingpong');
      await page.locator('#actionBtn').tap();
      const table = page.frameLocator('#worldVenueDialog iframe');
      await table.locator('#phase-screen:not(.hidden)').waitFor();
      const embedded = await table.locator('body').evaluate(() => ({
        preview: window.CONSOLEGAMES_PREVIEW?.mount, base: document.baseURI, console: window.OTTHI_CANONICAL?.consoleUrl,
      }));
      assert.deepEqual(embedded, {preview: mount, base: href('games/tenis/'), console: href('arcade/')});
      await page.locator('[data-venue-close]').tap();
      await page.waitForFunction(() => !OTTHI_VENUES.diagnostics().active && !OTTHOS_TEST_API.getGame().paused);
      report.checks.push('world-pingpong-portal-and-return');
      await page.evaluate(() => OTTHI_NAVIGATION.toConsole());
      await inspectConsole();
      await go(relative);
      await page.waitForFunction(() => OTTHOS_TEST_API.getState().profile.name === 'Rio Preto QA');
      report.checks.push('native-world-first-entry-motion-layout-and-save');
      await page.locator('#lobby .console-world-link').tap();
    } else if (id === 'familia') {
      await page.locator('#start').tap();
      await page.locator('#menuBtn').tap();
      await page.locator('.family-console-return').tap();
    } else if (id === 'danca') {
      await page.locator('[data-youtube-url]').waitFor();
      await page.locator('#worldVenueDialog header a').tap();
    } else {
      await page.locator('a.arcade-return:visible').first().tap();
    }
    await inspectConsole();
    await saveReport();
  }
  if(!firebaseEnabled) assert.deepEqual(backendRequests, []);
  else report.remoteFirebaseAttemptsBlocked = backendRequests.length;
  assert.deepEqual(report.errors, []);
  report.passed = true;
  await saveReport();
  console.log(`Pages ${release.build} / ${release.revision}. ${report.pages.length} jogos, ${report.layouts.length} layouts.`);
} catch (error) {
  report.passed = false;
  report.failure = error.stack;
  report.url = page.url();
  await page.screenshot({path: path.join(out, 'failure.png'), timeout: 2000}).catch(() => {});
  await saveReport();
  throw error;
} finally {
  await browser.close();
  if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
}
