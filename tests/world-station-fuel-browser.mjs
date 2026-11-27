/* Native vehicle movement, visible service and settlement using a disposable local profile. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {installCityInspection} from './helpers/world-city-inspection.mjs';
import {multiplayerServer} from './helpers/multiplayer-browser-fixture.mjs';

const out=process.env.OT_STATION_FUEL_OUT||'test-results/station-fuel';
fs.mkdirSync(out,{recursive:true});
const server=await multiplayerServer();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
await context.route(/^https?:\/\//,route=>new URL(route.request().url()).origin===server.origin?route.continue():route.abort());
await context.addInitScript(()=>{
  if(localStorage.getItem('fuel-qa-prepared'))return;
  localStorage.setItem('fuel-qa-prepared','1');
  localStorage.setItem('otthos_life_world_roleplay_v700',JSON.stringify({version:705,
    profile:{name:'QA Posto',nameConfirmed:true,playerId:'fuel-station-qa',coins:2000},flags:{accountPromptedV635:true},
    settings:{quality:'low',sound:false,lastWorldMap:'rio-preto'},guardian:{sessionLimitMinutes:0},
    vehicles:{owned:['garage-orange']}}));
});
const page=await context.newPage();
page.setDefaultTimeout(25000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const report={browser:browser.version(),errors,limits:['Chromium com SwiftShader e viewport móvel. Posição inicial preparada pela API de teste. Movimento, atendimento, interface e relógio executados pelo jogo.']};
const source=fs.readFileSync('games/otthi/app.js','utf8'),end=source.lastIndexOf('})();');
assert(end>0);
const hook=`
window.__FUEL_STATION_QA={
  setup(){
    const site=rioSiteByKey('posto_brasilia'),room=rioMap.sites.get(site.id),car=vehicleById('garage-orange');
    const start=room.point(5.15,6.7),heading=site.yaw+Math.PI;
    car.group.position.set(start.x,groundHeightAt(start.x,start.z),start.z);car.group.rotation.y=heading;
    car.x=start.x;car.z=start.z;car.heading=heading;car.group.visible=true;
    rioRoadVehicleSave(car.id).fuel=8;
    OTTHOS_TEST_API.teleport(start.x+1.65,start.z);
    updateContext(true);return room.fuelPump.parking;
  },
  input(throttle){
    input.virtualActive=!!throttle;input.virtualX=0;input.virtualZ=throttle;resolveMovementInput();
  },
  empty(){rioRoadVehicleSave('garage-orange').fuel=0;},
  view(){updateCamera(1);__CITY_QA.renderNative();},
  snapshot(){
    const session=rioStationFuelSession,rig=session?.rig,vehicle=vehicleById('garage-orange');
    return {coins:state.profile.coins,fuel:rioFuelLevel(vehicle),vehicle:player.car.id,x:player.x,z:player.z,speed:player.car.speed,
      vehicleContext:currentVehicleContext?.id,mode:cameraMode,geometry:rig?.props.visible?{
        attendant:rig.attendant.group.position.toArray(),nozzle:rig.nozzle.position.toArray(),port:session.port.toArray(),
        hoseSegments:rig.hose.filter(link=>link.visible).length}:null};
  }
};`;
const snapshot=()=>page.evaluate(()=>__FUEL_STATION_QA.snapshot());
const input=value=>page.evaluate(t=>__FUEL_STATION_QA.input(t),value);
const selectAmount=async litres=>{
  await page.locator('#vehicleActionBtn').tap();
  await page.locator('[data-rio-litres]').fill(String(litres));
  await page.locator('[data-rio-refuel]').tap();
  await page.locator('#rioFuelService').waitFor();
};
try{
  await installCityInspection(page,{appSource:source.slice(0,end)+hook+source.slice(end),capDuringBoot:true});
  assert.equal((await page.goto(server.origin+'/games/otthi/?map=rio-preto')).status(),200);
  await page.locator('#playBtn').tap();
  await page.waitForFunction(()=>__CITY_QA.cap(12)&&OTTHOS_TEST_API.getGame().running&&document.getElementById('modal').hidden,null,{timeout:150000});
  const pump=await page.evaluate(()=>__FUEL_STATION_QA.setup());
  await page.waitForFunction(()=>OTTHOS_TEST_API.getContext()?.id==='vehicle-garage-orange');
  await page.locator('#actionBtn').tap();
  await page.waitForFunction(()=>OTTHOS_TEST_API.getGame().player.vehicle);
  const start=await snapshot();
  await input(.26);
  await page.waitForFunction(([x,z])=>{const p=__FUEL_STATION_QA.snapshot();return Math.hypot(p.x-x,p.z-z)<1.9;},[pump.x,pump.z]);
  await input(0);
  await page.waitForFunction(()=>Math.abs(__FUEL_STATION_QA.snapshot().speed)<.18);
  await page.waitForFunction(()=>__FUEL_STATION_QA.snapshot().vehicleContext==='regional-posto_brasilia-pump');
  report.parked=await snapshot();
  assert(Math.hypot(report.parked.x-start.x,report.parked.z-start.z)>4,'car moves into pump lane');
  assert(report.parked.fuel<start.fuel,'fuel consumed while driving');
  await page.evaluate(()=>__FUEL_STATION_QA.empty());
  await input(.8);await page.waitForTimeout(550);
  const dry=await snapshot();await input(0);
  assert.equal(dry.fuel,0);assert.equal(dry.speed,0);
  assert(Math.hypot(dry.x-report.parked.x,dry.z-report.parked.z)<.2);
  report.dry=dry;

  await selectAmount(10);
  await page.locator('#rioFuelService [data-rio-fuel-cancel]').tap();
  await page.locator('#rioFuelService').waitFor({state:'detached'});
  assert.equal((await snapshot()).coins,dry.coins);
  assert.equal((await snapshot()).fuel,0);

  await selectAmount(10);
  await page.waitForFunction(()=>{
    const p=__FUEL_STATION_QA.snapshot(),meter=document.querySelector('#rioFuelService progress');
    return p.geometry?.hoseSegments===7&&meter?.value>.12&&meter.value<.92&&p.geometry.nozzle.every((n,i)=>Math.abs(n-p.geometry.port[i])<.01);
  });
  report.connected=await snapshot();
  assert.equal(report.connected.coins,dry.coins);assert.equal(report.connected.fuel,0);
  await page.evaluate(()=>__FUEL_STATION_QA.view());
  await page.screenshot({path:out+'/mangueira-conectada.png'});
  await page.locator('#rioFuelService').waitFor({state:'detached'});
  report.filled=await snapshot();
  assert.equal(report.filled.coins,dry.coins-20);assert.equal(report.filled.fuel,10);
  assert.equal(report.filled.vehicle,'garage-orange');
  assert.equal(report.filled.mode,dry.mode);
  await input(.37);
  await page.waitForFunction(([x,z])=>{const p=__FUEL_STATION_QA.snapshot();return Math.hypot(p.x-x,p.z-z)>.7&&p.fuel<10;},[report.filled.x,report.filled.z]);
  await input(0);await page.waitForFunction(()=>Math.abs(__FUEL_STATION_QA.snapshot().speed)<.18);
  const final=await snapshot();
  await page.evaluate(()=>OTTHOS_TEST_API.saveNow());
  await page.reload();
  await page.waitForFunction(()=>!!window.__FUEL_STATION_QA);
  report.restored=await page.evaluate(()=>{
    const saved=OTTHOS_TEST_API.getState();
    return {coins:saved.profile.coins,fuel:saved.cityServices.rioMap.roadVehicles['garage-orange'].fuel};
  });
  assert.equal(report.restored.coins,final.coins);
  assert(Math.abs(report.restored.fuel-final.fuel)<.1,'fuel balance survives reload');
  assert.deepEqual(errors,[]);
  report.passed=true;
  console.log('PASS native approach, dry tank, physical pump, cancellation, one payment, resumed driving and reload');
}catch(error){
  report.passed=false;report.failure=String(error.stack);report.current=await snapshot().catch(()=>null);
  await page.screenshot({path:out+'/failure.png',timeout:3000}).catch(()=>{});throw error;
}finally{
  fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));
  await browser.close();await server.close();
}
