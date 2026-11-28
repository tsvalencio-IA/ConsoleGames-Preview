import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import { chromium } from 'playwright';
import { installCityInspection } from './helpers/world-city-inspection.mjs';
import { multiplayerServer } from './helpers/multiplayer-browser-fixture.mjs';
import { touchSession } from './helpers/touch-session.mjs';

const output=process.env.OT_ROOF_RESULT||'test-results/world-terminal-roof';
fs.mkdirSync(output,{recursive:true});
const server=await multiplayerServer();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1100,height:730},hasTouch:true,serviceWorkers:'block'});
await context.route(/^https?:\/\//,route=>new URL(route.request().url()).origin===server.origin?route.continue():route.abort());
await context.addInitScript(()=>{
  localStorage.setItem('otthos_life_world_roleplay_v700',JSON.stringify({version:705,profile:{name:'QA Telhado',nameConfirmed:true,playerId:'airport-roof'},settings:{quality:'low',sound:false,lastWorldMap:'rio-preto'},guardian:{sessionLimitMinutes:0},flags:{accountPromptedV635:true}}));
});
const page=await context.newPage(),errors=[];
const touch=await touchSession(context,page);
page.setDefaultTimeout(60000);
page.on('pageerror',error=>errors.push(error.stack));
const release=JSON.parse(fs.readFileSync('games/otthi/release-manifest.json','utf8'));
const report={browser:browser.version(),platform:process.platform,arch:process.arch,build:release.build,revision:release.revision,errors,limits:[
 'Chromium com SwiftShader e perfil descartável. A renderização do fixture é limitada a 6 quadros/s. O relógio da simulação segue o RAF nativo, sem aceleração.',
 'Embarque, pouso, decolagem, voo até o pátio e desembarque usam controles do jogo. A posição inicial da aproximação é preparada depois do embarque. A mudança de orientação é simulada pelo viewport.'
]};
const diagnostics=()=>page.evaluate(()=>OT_GAMES.diagnostics());
const wait=(condition,arg)=>page.waitForFunction(condition,arg,{timeout:65000});
const lever=async value=>{
 const control=page.locator('[data-ot="collective"]');
 const box=await control.boundingBox();
 assert(box&&box.height>28,'The real collective control must be in view');
 const finger=await touch.start(control,.5,(14+(1-value)*(box.height-28))/box.height);
 const input=await diagnostics();
 await touch.end(finger);
 return {height:box.height,requested:value,applied:input.collective};
};
try{
 const runtime=fs.readFileSync('games/otthi/app.js','utf8'),end=runtime.lastIndexOf('})();');
 report.bundleSha256=createHash('sha256').update(runtime).digest('hex');
 assert.equal(report.bundleSha256,release.files['app.js']);
 assert(runtime.includes("'landed-roof'"),'The bundle must include the terminal roof support');
 const instrumentation=`
 const roofQaClock=performance.now.bind(performance),roofQaUpdate=updateOtGames;
 let roofQaUpdates=0,roofQaSeconds=0;
 updateOtGames=function(dt){roofQaUpdates++;roofQaSeconds+=dt;return roofQaUpdate(dt);};
 window.__ROOF_QA={
  stage(){const g=otGames,roof=worldAirport.terminalRoof;const floor=roof.max.y+g.roofContact.skid;Object.assign(g.body,{x:90,y:floor+3.6,z:-185,yaw:0,vx:0,vy:0,vz:0,roll:0,pitch:0});return {floor,roof,radius:g.roofContact.radius};},
  walkingCamera(){camera.updateMatrixWorld(true);const point=new THREE.Vector3(player.x,player.y+1.0,player.z),ndc=point.clone().project(camera);return {player:{x:player.x,y:player.y,z:player.z},camera:camera.position.toArray(),projection:ndc.toArray(),mode:cameraMode,near:camera.near,far:camera.far,drag:input.cameraDrag?.id??null,orbit:OT_VEHICLE_VIEW.diagnostics(),visible:playerGroup.visible};},
  measure(){const g=otGames;return {now:roofQaClock(),updates:roofQaUpdates,seconds:roofQaSeconds,position:g.aircraft?.position.toArray(),body:g.body?{...g.body}:null,viewport:{width:innerWidth,height:innerHeight},drawCalls:renderer.info.render.calls};}
 };`;
 await installCityInspection(page,{appSource:runtime.slice(0,end)+instrumentation+runtime.slice(end),capDuringBoot:true});
 await page.goto(server.origin+'/games/otthi/?map=rio-preto');
 await page.locator('#playBtn').click();
 await wait(()=>__CITY_QA.cap(6)&&OT_WORLD_AIRPORT?.diagnostics().ready&&OTTHOS_TEST_API.getGame().running&&document.getElementById('modal').hidden);
 const id='heli-ottovias',craft=await page.evaluate(id=>OT_WORLD_AIRPORT.diagnostics().fleet.find(p=>p.id===id),id);
 await page.evaluate(p=>OTTHOS_TEST_API.teleport(p.x+4,p.z),craft);
 await wait(id=>OTTHOS_TEST_API.getContext()?.id==='board-aircraft-'+id,id);
 await page.locator('#actionBtn').click();
 await wait(id=>OT_GAMES.diagnostics().aircraftId===id&&OT_GAMES.diagnostics().active,id);
 report.approach=await page.evaluate(()=>__ROOF_QA.stage());
 report.approachFrame=await page.evaluate(()=>__ROOF_QA.measure());
 await page.locator('[data-ot="land"]').click();
 await wait(()=>OT_GAMES.diagnostics().flightPhase==='landed-roof');
 report.roofContact=await diagnostics();
 assert.equal(report.roofContact.body.y,report.approach.floor);
 assert.equal(report.roofContact.canDisembark,false);
 assert.equal(await page.locator('[data-ot="disembark"]').isEnabled(),false);
 await page.setViewportSize({width:390,height:844});
 await wait(()=>OT_GAMES.diagnostics().flightPhase==='landed-roof'&&!OT_GAMES.diagnostics().landingAssist);
 report.rotated=await diagnostics();
 assert.equal(report.rotated.body.y,report.approach.floor);
 await page.evaluate(()=>__CITY_QA.renderNative());
 report.roofFrame=await page.evaluate(()=>__ROOF_QA.measure());
 assert.equal(report.roofFrame.viewport.width,390);
 assert.equal(report.roofFrame.viewport.height,844);
 assert.equal(report.roofFrame.position[1],report.approach.floor);
 assert(report.roofFrame.drawCalls>0);
 assert(report.roofFrame.updates-report.approachFrame.updates>10);
 assert(report.roofFrame.now-report.approachFrame.now>700);
 await page.screenshot({path:output+'/contato-com-a-laje.png'});
 console.log('PASS roof contact and portrait rendering');
 await page.setViewportSize({width:1100,height:730});
 await wait(()=>innerWidth===1100&&OTTHI_VIEWPORT.current()?.landscape===true&&OTTHI_VIEWPORT.current()?.width===1100);
 await page.waitForTimeout(1000);
 report.takeoffInput=await lever(.9);
 const tookTouch=report.takeoffInput.applied>.52;
 if(!tookTouch)await page.keyboard.down('e');
 try{await wait(y=>OT_GAMES.diagnostics().body.y>y+4,report.approach.floor);}
 finally{if(!tookTouch)await page.keyboard.up('e');}
 report.takeoff=await diagnostics();
 assert.equal(report.takeoff.flightPhase,'airborne');
 report.neutralInput=await lever(.5);
 assert.equal(report.neutralInput.applied,.5);
 console.log('PASS takeoff',JSON.stringify(report.takeoffInput));
 await page.evaluate(()=>document.activeElement?.blur());
 await page.keyboard.down('w');
 try{await wait(()=>OT_GAMES.diagnostics().body.z>=-167);}finally{await page.keyboard.up('w');}
 await page.locator('[data-ot="land"]').click();
 await wait(()=>OT_GAMES.diagnostics().canDisembark);
 report.apron=await diagnostics();
 assert.equal(report.apron.onGround,true);
 assert(report.apron.body.z>=-167);
 // Transfer ownership after using the real touch flight camera.
 const surface=page.locator('#stage canvas').first();
 const orbitFinger=await touch.start(surface,.30,.46);
 await touch.move(orbitFinger,surface,.70,.46);await touch.end(orbitFinger);
 await wait(()=>OT_VEHICLE_VIEW.diagnostics().manual);
 await page.locator('[data-ot="disembark"]').tap();
 await wait(()=>!OT_GAMES.diagnostics().active);
 report.exit=await page.evaluate(()=>OTTHOS_TEST_API.getGame().player);
 const walking=()=>page.evaluate(()=>__ROOF_QA.walkingCamera());
 const framed=(m,label)=>{
   assert.equal(m.mode,'openworld',label);assert.equal(m.orbit.manual,false,label);
   assert.equal(m.orbit.key,'',label);assert.equal(m.orbit.pointerCount,0,label);assert.equal(m.drag,null,label);
   assert(m.visible,label+' player root must remain visible');
   assert(m.camera.every(Number.isFinite)&&m.projection.every(Number.isFinite),label);
   assert(Math.hypot(m.camera[0]-m.player.x,m.camera[1]-m.player.y,m.camera[2]-m.player.z)<25,label+' camera distance');
   assert(Math.abs(m.projection[0])<1&&Math.abs(m.projection[1])<1&&Math.abs(m.projection[2])<1,label+' actor must be in the viewport: '+JSON.stringify(m));
 };
 report.walkingCamera={exit:await walking(),orbits:[]};
 framed(report.walkingCamera.exit,'immediate exit');
 await page.setViewportSize({width:390,height:844});
 await wait(()=>OTTHI_VIEWPORT.current()?.width===390);
 for(let i=0;i<7;i++){
   const finger=await touch.start(surface,.18,.44);await touch.move(finger,surface,.82,.44);await touch.end(finger);
   await page.waitForTimeout(120);
   const frame=await walking();framed(frame,'walking touch orbit '+i);report.walkingCamera.orbits.push(frame);
 }
 const before=await walking(),joy=page.locator('#joystick');
 const finger=await touch.start(joy,.5,.24);
 try{await wait(p=>{const n=OTTHOS_TEST_API.getGame().player;return Math.hypot(n.x-p.x,n.z-p.z)>1.2;},before.player);}
 finally{await touch.end(finger);}
 report.walkingCamera.walked=await walking();framed(report.walkingCamera.walked,'after walking');
 await page.evaluate(()=>__CITY_QA.renderNative());
 await page.screenshot({path:output+'/camera-apos-desembarque.png'});
 console.log('PASS moved helicopter, real flight orbit, disembark, portrait touch orbit and walk');
 assert(tookTouch,'The real touch on the collective should raise power');
 assert.deepEqual(errors,[]);
 report.passed=true;
 console.log('PASS ground landing and disembarkation');
}catch(error){
 report.passed=false;report.failure=error.stack;report.current=await diagnostics().catch(()=>null);
 await page.screenshot({path:output+'/falha.png'}).catch(()=>{});
 throw error;
}finally{
 fs.writeFileSync(output+'/result.json',JSON.stringify(report,null,2));
 await browser.close();await server.close();
}
