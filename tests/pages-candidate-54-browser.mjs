import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import {browserNetwork,browserContextNetwork} from './helpers/browser-network.mjs';
const mount='/ConsoleGames-Preview/';
const candidate='65484d1f70b8d7df12e9149f9decbba1063c6c3b';
const dir=path.resolve('_pages_preview'),out=process.env.OT_PLAYTEST_OUT||'test-results/pages-candidate-54';
await mkdir(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm','.jpg':'image/jpeg','.webp':'image/webp','.ogg':'audio/ogg'};
let server;
if(!process.env.OT_PAGES_URL){
 server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');assert(url.pathname.startsWith(mount));
  let f=path.resolve(dir,decodeURIComponent(url.pathname.slice(mount.length)));assert(f===dir||f.startsWith(dir+'/'));
  if((await stat(f)).isDirectory())f=path.join(f,'index.html');
  res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'}).end(await readFile(f));
 }catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
}
const base=new URL(process.env.OT_PAGES_URL||'http://127.0.0.1:'+server.address().port+mount);
const href=p=>new URL(p,base).href;
const browser=await chromium.launch({...browserNetwork(base.href),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const c=await browser.newContext({...browserContextNetwork(base.href),viewport:{width:393,height:852},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block'});
const report={candidate,errors:[]};
let p;
try{
 const get=async url=>{const r=await c.request.get(href(url));assert(r.ok(),url);return r;};
 // The live Pages CDN can take a short time to expose the new path.
 let ready=false;
 for(let i=0;i<12&&!ready;i++){const r=await c.request.get(href('teste-54/preview-release.json')).catch(()=>null);ready=!!r?.ok();if(!ready)await new Promise(r=>setTimeout(r,2500));}
 assert(ready,'Playtest metadata missing');
 const stable=await (await get('preview-release.json')).json(),meta=await (await get('teste-54/preview-release.json')).json();
 assert.equal(stable.build,'705.28.53-camera-multiplayer');
 assert.equal(meta.commit,candidate);assert.equal(meta.build,'705.28.54-simulador-servicos');assert.equal(meta.firebase,'enabled');assert.equal(meta.storagePrefix,'consolegames-preview-54-live:');
 const release=await (await get('teste-54/games/otthi/release-manifest.json')).json();
 assert.equal(release.revision,meta.revision);
 const app=await (await get('teste-54/games/otthi/app.js')).body();
 assert.equal(createHash('sha256').update(app).digest('hex'),release.files['app.js']);
 await c.route(/^https?:\/\//,r=>new URL(r.request().url()).origin===base.origin?r.continue():r.abort());
 await c.addInitScript(()=>{
  if(!location.pathname.includes('/teste-54/'))return;
  localStorage.setItem('consolegames-preview:qa-playtest-sentinel','stable');
  localStorage.setItem('consolegames-preview-54-live:otthos_life_world_roleplay_v700',JSON.stringify({version:705,profile:{name:'QA 54',nameConfirmed:true,playerId:'qa54-local',coins:2345},flags:{accountPromptedV635:true},settings:{quality:'low',sound:false,lastWorldMap:'rio-preto'},guardian:{sessionLimitMinutes:0}}));
 });
 p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 p.setDefaultTimeout(60000);
 assert.equal((await p.goto(href('teste-54/games/otthi/?map=rio-preto'),{waitUntil:'domcontentloaded'})).status(),200);
 await p.waitForFunction(()=>window.OTTHI_RELEASE_COHERENT&&window.OTTHI_RELEASE_REVISION);
 assert.equal(await p.locator('html').getAttribute('data-otthi-build'),meta.build);
 const isolation=await p.evaluate(()=>({mount:CONSOLEGAMES_PREVIEW.mount,prefix:CONSOLEGAMES_PREVIEW.prefix,stable:localStorage.getItem('qa-playtest-sentinel'),firebase:window.OTTHOS_FIREBASE_CONFIG?.enabled,console:OTTHI_CANONICAL.consoleUrl}));
 assert.equal(isolation.mount,mount+'teste-54/');assert.equal(isolation.prefix,meta.storagePrefix);assert.equal(isolation.stable,null);assert.equal(isolation.firebase,true);assert.equal(isolation.console,href('teste-54/arcade/'));
 // Exercise the original account screen, not the test-profile shortcut.
 await p.locator('#accountBtn').click();
 await p.locator('[data-account-login]').waitFor({state:'visible'});
 await p.locator('[data-account-login]').click();
 await p.locator('[data-account-user]').waitFor({state:'visible'});
 assert.equal(await p.locator('[data-account-password]').getAttribute('type'),'password');
 assert.equal(await p.locator('[data-account-form]').count(),1);
 assert.equal(await p.evaluate(()=>window.OTTHOS_FIREBASE_CONFIG?.projectId),'otthi-656c5');
 const policy=await p.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
 assert(policy.includes('https://identitytoolkit.googleapis.com')&&policy.includes('wss://*.firebasedatabase.app'));
 await p.screenshot({path:out+'/real-account-form.png',timeout:60000});
 report.accountForm=true;report.authNetwork='blocked deliberately; no real credentials submitted or cloud progress written';
 await p.locator('#modalClose').click();
 await p.locator('#playBtn').click();
 await p.waitForFunction(()=>window.OTTHOS_TEST_API?.getGame().running&&!OTTHOS_TEST_API.getGame().paused&&document.getElementById('modal').hidden,null,{timeout:180000});
 assert.equal(await p.locator('body').getAttribute('data-otthi-map'),'rio-preto-compacto');
 assert.deepEqual(report.errors,[]);
 report.release=meta;report.isolation=isolation;report.passed=true;
 await p.screenshot({path:out+'/playtest.png',timeout:60000});
 console.log('PASS isolated playable .54',JSON.stringify(meta));
}catch(e){report.failure=e.stack;await p?.screenshot({path:out+'/failure.png',timeout:10000}).catch(()=>{});throw e;}
finally{await writeFile(out+'/result.json',JSON.stringify(report,null,2));await browser.close();if(server)await new Promise(r=>server.close(r));}
