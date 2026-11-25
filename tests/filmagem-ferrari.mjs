import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {multiplayerServer} from './helpers/multiplayer-browser-fixture.mjs';
import {touchSession} from './helpers/touch-session.mjs';
const out='test-results/filmagem-ferrari';mkdirSync(out,{recursive:true});
const server=await multiplayerServer();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--enable-features=SyntheticPointerActions']});
let page;
try{
 const c=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block'});
 await c.route(/^https?:\/\//,r=>new URL(r.request().url()).origin===server.origin?r.continue():r.abort());
 await c.addInitScript(()=>localStorage.setItem('otthos_life_world_roleplay_v700',JSON.stringify({version:705,lastSaved:Date.now(),profile:{name:'OTThi Demo',nameConfirmed:true,playerId:'filmagem-local',coins:100000},avatar:{bodyStyle:'family-thiago'},flags:{accountPromptedV635:true},settings:{quality:'auto',sound:false},guardian:{sessionLimitMinutes:0},familyAdventure:{party:{controller:'thiago',members:['thiago','luna']}}})));
 page=await c.newPage();page.setDefaultTimeout(60000);await page.goto(server.origin+'/games/otthi/');await page.locator('#playBtn').tap();
 await page.waitForFunction(()=>window.OTTHOS_TEST_API?.getGame().running&&window.OT_PERSONAL_GARAGE&&document.getElementById('modal').hidden,null,{timeout:120000});
 await page.evaluate(()=>OTTHOS_TEST_API.teleport(-311,11));
 await page.waitForFunction(()=>OTTHOS_TEST_API.getContext()?.id==='dealer-cars');
 await page.locator('#actionBtn').tap();await page.locator('[data-dealer-vehicle="br-ferrari458"]').tap();
 await page.screenshot({path:out+'/01-ferrari-concessionaria.png'});
 await page.locator('[data-dealer-purchase]').tap();await page.locator('[data-yes]').tap();await page.locator('[data-delivery-drive]').tap();
 await page.waitForFunction(()=>OTTHOS_TEST_API.getGame().player.vehicle);
 assert.equal(await page.evaluate(()=>OT_PERSONAL_GARAGE.diagnostics().units.find(e=>e.id===OTTHOS_TEST_API.getGame().player.car.id)?.catalogId),'br-ferrari458');
 await page.locator('#vehicleEngineSwitch').tap();
 await page.screenshot({path:out+'/02-ferrari-entregue.png'});
 const fingers=await touchSession(c,page);
 const drive=async(duration)=>{const gas=await fingers.start(page.locator('#runBtn'));const stick=await fingers.start(page.locator('#joystick'),.52,.27);try{await page.waitForTimeout(duration);}finally{await fingers.end(stick);await fingers.end(gas);}};
 await drive(6500);
 await page.screenshot({path:out+'/03-ferrari-exterior.png'});
 await page.locator('[data-vehicle-occupants]').tap();
 await page.waitForFunction(()=>OT_VEHICLE_VIEW.diagnostics().inside);
 await page.screenshot({path:out+'/04-ferrari-interior.png'});
 await drive(5000);
 await page.screenshot({path:out+'/05-ferrari-interior-em-movimento.png'});
 await page.locator('#cameraResetBtn').tap();
 await page.waitForTimeout(3000);
}catch(e){if(page)await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}
finally{await browser.close();await server.close();}
