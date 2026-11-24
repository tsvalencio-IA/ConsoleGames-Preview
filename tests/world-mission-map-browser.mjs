/* Inspect the actual compact production map, not a synthetic mission book. */
import {chromium} from 'playwright';
import fs from 'node:fs';
import {multiplayerServer} from './helpers/multiplayer-browser-fixture.mjs';
const out='test-results/mission-map-audit';fs.mkdirSync(out,{recursive:true});
const server=await multiplayerServer();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={errors:[],missionResults:[],limits:['Native map catalog and target availability; not full traversal or visual quality.','Disposable local profile; no production Firebase.']};let page;
try{
 const context=await browser.newContext({viewport:{width:1100,height:720},serviceWorkers:'block'});
 await context.route(/^https?:\/\//,r=>new URL(r.request().url()).origin===server.origin?r.continue():r.abort());
 await context.addInitScript(()=>localStorage.setItem('otthos_life_world_roleplay_v700',JSON.stringify({version:705,lastSaved:Date.now(),profile:{name:'QA Missões',playerId:'mission-map-local',nameConfirmed:true,coins:500},settings:{quality:'low',sound:false,lastWorldMap:'rio-preto'},flags:{accountPromptedV635:true},guardian:{sessionLimitMinutes:0}})));
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(server.origin+'/games/otthi/?map=rio-preto',{waitUntil:'domcontentloaded'});
 await page.locator('#playBtn').click();
 await page.waitForFunction(()=>OTTHOS_TEST_API.getGame().running&&document.getElementById('modal').hidden,null,{timeout:150000});
 await page.waitForFunction(()=>window.OT_CIVIL_MISSIONS?.audit?.().ready,null,{timeout:60000});
 report.build=await page.evaluate(()=>({build:window.OTTHI_GAME_BUILD,revision:window.OTTHI_RELEASE_REVISION,map:document.body.dataset.otthiMap,performance:OTTHOS_TEST_API.performance()}));
 const audit=await page.evaluate(()=>OT_CIVIL_MISSIONS.audit());report.catalog=audit.missions;
 await page.evaluate(()=>OT_CIVIL_MISSIONS.open('solo'));
 const visible=await page.locator('[data-civil-create]').evaluateAll(nodes=>nodes.map(n=>n.dataset.civilCreate));
 report.offered=visible;
 for(const mission of audit.missions){
  const issues=mission.steps.flatMap(s=>s.issues.map(issue=>({step:s.id,issue})));
  const offered=visible.includes(mission.id);
  report.missionResults.push({id:mission.id,offered,stepCount:mission.steps.length,status:!offered?'NOT_OFFERED':issues.length?'CATALOG_FAILED':'CATALOG_OK',issues});
 }
 await page.screenshot({path:out+'/mission-menu.png',timeout:60000});
 if(!visible.length||report.missionResults.some(r=>r.status==='CATALOG_FAILED')||report.errors.length)process.exitCode=1;
}catch(e){report.blocked=String(e.stack||e);process.exitCode=1;}
finally{fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.missionResults));await browser.close();await server.close();}
