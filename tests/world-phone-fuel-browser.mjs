/* Native roadside dispatch, walk, transfer, return and reload in a disposable profile. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {installCityInspection} from './helpers/world-city-inspection.mjs';
import {multiplayerServer} from './helpers/multiplayer-browser-fixture.mjs';

const out=process.env.OT_PHONE_FUEL_OUT||'test-results/phone-fuel';
fs.mkdirSync(out,{recursive:true});
const server=await multiplayerServer();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,serviceWorkers:'block'});
await context.route(/^https?:\/\//,route=>new URL(route.request().url()).origin===server.origin?route.continue():route.abort());
await context.addInitScript(()=>{
  const key='otthos_life_world_roleplay_v700',saved=JSON.parse(localStorage.getItem(key)||'null'),real=Date.now.bind(Date),lead=Math.max(0,Number(saved?.lastSaved||0)-real()+200);
  Date.now=()=>real()+lead;
  if(!saved)localStorage.setItem(key,JSON.stringify({version:705,
    profile:{name:'QA Pane Seca',nameConfirmed:true,playerId:'phone-fuel-fixture',coins:2000},flags:{accountPromptedV635:true},
    settings:{quality:'low',sound:false,lastWorldMap:'rio-preto',worldHud:'clean'},guardian:{sessionLimitMinutes:0},
    vehicles:{owned:['garage-orange']}}));
});
const page=await context.newPage();
page.setDefaultTimeout(25000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const release=JSON.parse(fs.readFileSync('games/otthi/release-manifest.json','utf8'));
const report={build:release.build,revision:release.revision,browser:browser.version(),errors,
  limits:['Chromium e SwiftShader em viewport móvel. Posição inicial controlada, relógio acelerado e perfil local descartável.']};
const source=fs.readFileSync('games/otthi/app.js','utf8'),end=source.lastIndexOf('})();');
assert(end>0);
const hook=`
let qaTrip=0,qaReturn=0,qaMaxJump=0;
const qaAdvance=phoneAdvanceJob;
phoneAdvanceJob=function(job,dt){
  const p={x:job.route.x,z:job.route.z};qaAdvance(job,dt);
  const step=distance2D(p,job.route);if(job.kind==='return')qaReturn+=step;else qaTrip+=step;qaMaxJump=Math.max(qaMaxJump,step);
};
window.__PHONE_FUEL_QA={
  setup(){
    const car=vehicleById('garage-orange'),van=phoneCourierVehicle();
    const stations=rioFunctionalSites().filter(site=>site.kind==='fuel');
    for(const site of stations){
      const road=groundServiceRoadProjection(site),origin=phonePickupPoint(van,site);
      if(!road||!origin)continue;
      const d=distance2D(road.a,road.b),fx=(road.b.x-road.a.x)/d,fz=(road.b.z-road.a.z)/d;
      for(const along of[32,-32,44,-44,57,-57,20,-20])for(const side of[4.5,-4.5,5.8,-5.8,3.1,-3.1]){
        const pose={x:road.point.x+fx*along+fz*side,z:road.point.z+fz*along-fx*side,heading:Math.atan2(fx,fz)};
        const nearby={x:pose.x+fz*Math.sign(side)*2.4,z:pose.z-fx*Math.sign(side)*2.4};
        if(positionBlockedForPlayer(nearby.x,nearby.z,.45,{ignoreActor:car})||!phoneVehiclePoseClear(car,pose.x,pose.z,pose.heading,true))continue;
        car.group.position.set(pose.x,groundHeightAt(pose.x,pose.z),pose.z);
        car.group.rotation.y=pose.heading;
        rioRecordVehiclePose(car,pose.x,pose.z,pose.heading);
        state.vehicles.parked[car.id]={...pose};
        OTTHOS_TEST_API.teleport(nearby.x,nearby.z);
        const stop=phoneFuelDestination(van,{fuelVehicleId:car.id});
        if(!stop||distance2D(car.group.position,stop)>12)continue;
        const path=phoneGroundRoute(van,origin,stop);
        if(path.length<2||routeLength(path)<19||routeLength(path)>140)continue;
        const last=path[path.length-2],heading=Math.atan2(stop.x-last.x,stop.z-last.z);
        if(!phoneVehiclePoseClear(van,stop.x,stop.z,heading,true))continue;
        rioRoadVehicleSave(car.id).fuel=0;
        return {origin,pose,stop,routeLength:routeLength(path),site:site.key};
      }
    }
    throw Error('Não foi encontrado um ponto de pane seca acessível entre o posto e o acostamento.');
  },
  approach(){
    const job=worldPhone.job,van=job.vehicle.group.position,car=vehicleById('garage-orange').group.position;
    const points=Array.from({length:16},(_,i)=>({x:van.x+Math.cos(i*Math.PI/8)*3.9,z:van.z+Math.sin(i*Math.PI/8)*3.9}));
    points.sort((a,b)=>distance2D(a,car)-distance2D(b,car));
    const where=points.find(p=>!positionBlockedForPlayer(p.x,p.z,.5));
    if(!where)throw Error('Acesso a pé ao veículo de socorro indisponível.');
    OTTHOS_TEST_API.teleport(where.x,where.z);updateContext(true);
  },
  view(){updateCamera(2);__CITY_QA.renderNative();},
  receiveAgain:phoneReceiveParcel,
  snapshot(){
    const job=worldPhone.job,t=job?.fuelTransfer,car=vehicleById('garage-orange');
    return {coins:state.profile.coins,fuel:rioFuelLevel(car),tankSave:rioMapSave().roadVehicles['garage-orange']?.fuel,
      orders:OT_WORLD_PHONE_FUEL.diagnostics(),job:OT_WORLD_PHONE.diagnostics(),
      trip:qaTrip,returned:qaReturn,maxJump:qaMaxJump,returning:worldPhone.returning.length,
      vanModel:job?.vehicle.group.userData.brazilModel,driver:job?.driver.group.getWorldPosition(new THREE.Vector3()).toArray(),
      walked:t?.walked.length,kit:!!t?.kit?.visible,stream:!!t?.stream?.visible};
  }
};`;
const snap=()=>page.evaluate(()=>__PHONE_FUEL_QA.snapshot());
const phone=async()=>{
  if(!await page.locator('#quickBar').isVisible())await page.locator('#quickToggleBtn').tap();
  await page.locator('#worldPhoneBtn').tap();
};
const openFuel=async()=>{await phone();await page.locator('[data-phone-fuel-open]').tap();};
const buy=async(amount,accept=true)=>{
  await openFuel();
  await page.locator('[data-phone-fuel-litres="garage-orange"]').fill(String(amount));
  await page.locator('[data-phone-fuel-buy="garage-orange"]').tap();
  if(accept)await page.locator('[data-yes]').tap();
};
async function advanceUntil(condition,label,limit=65,frames=120){
  let current=await snap();
  for(let n=0;n<limit&&!condition(current);n++){
    await page.evaluate(count=>__CITY_QA.simulate(count),frames);current=await snap();
  }
  assert(condition(current),label+' '+JSON.stringify(current));
  return current;
}
async function startGame(){
  await page.locator('#playBtn').tap();
  await page.waitForFunction(()=>__CITY_QA.cap()&&OTTHOS_TEST_API.getGame().running&&document.getElementById('modal').hidden,null,{timeout:120000});
}
try{
  await installCityInspection(page,{appSource:source.slice(0,end)+hook+source.slice(end),capDuringBoot:true});
  assert.equal((await page.goto(server.origin+'/games/otthi/?map=rio-preto')).status(),200);
  await startGame();
  report.fixture=await page.evaluate(()=>__PHONE_FUEL_QA.setup());
  const initial=await snap();
  await buy(5,false);
  await page.locator('#modalClose').tap();
  assert.deepEqual((await snap()).orders.orders,[]);
  await buy(5);
  const dispatched=await snap();
  assert.equal(dispatched.vanModel,'kombi');
  assert.equal(dispatched.coins,initial.coins-10);
  assert.equal(dispatched.fuel,0);
  assert.equal(dispatched.orders.orders.at(-1).status,'en-route');
  report.dispatched=dispatched;
  console.log('PASS dispatch and single debit',JSON.stringify(report.fixture));
  report.arrived=await advanceUntil(s=>s.job.tracking?.ready,'A Kombi precisa chegar fisicamente ao ponto de atendimento.');
  assert(report.arrived.trip>17&&report.arrived.maxJump<.3);
  assert.equal(report.arrived.fuel,0);
  await page.evaluate(()=>__PHONE_FUEL_QA.approach());
  await phone();await page.locator('[data-roadside-receive]').tap();
  report.pour=await advanceUntil(s=>s.stream,'O motorista precisa chegar a pé, abrir o galão e começar a transferir.',55,60);
  assert(report.pour.kit&&report.pour.walked>1);
  assert.equal(report.pour.fuel,0);
  assert.equal(report.pour.coins,dispatched.coins);
  await page.evaluate(()=>__PHONE_FUEL_QA.view());
  await page.screenshot({path:out+'/motorista-abastecendo.png'});
  await page.evaluate(()=>OTTHOS_TEST_API.saveNow());
  await page.reload();
  await startGame();
  report.restored=await advanceUntil(s=>s.job.tracking?.ready,'O socorro pago precisa voltar ao ponto salvo junto ao carro.');
  assert.equal(report.restored.orders.orders.at(-1).id,dispatched.orders.orders.at(-1).id);
  assert.equal(report.restored.orders.orders.at(-1).fuelService,'waiting');
  assert.equal(report.restored.orders.service,null);
  assert.equal(report.restored.coins,dispatched.coins);
  assert.equal(report.restored.fuel,0);
  await page.evaluate(()=>__PHONE_FUEL_QA.approach());
  await phone();await page.locator('[data-roadside-receive]').tap();
  report.delivered=await advanceUntil(s=>s.orders.orders.at(-1)?.status==='delivered','O abastecimento deve encerrar com recibo.');
  assert.equal(report.delivered.fuel,5);
  assert.equal(report.delivered.coins,dispatched.coins);
  assert.equal(report.delivered.orders.orders.at(-1).chargedPrice,10);
  assert.equal(await page.evaluate(()=>__PHONE_FUEL_QA.receiveAgain()),false);
  report.returned=await advanceUntil(s=>s.returned>17&&!s.returning&&!s.job.job,'A Kombi precisa dirigir de volta ao posto após o embarque.');
  assert(report.returned.maxJump<.3);
  await page.evaluate(()=>__PHONE_FUEL_QA.setup());
  const cancelBefore=await snap();
  await buy(4);
  assert.equal((await snap()).coins,cancelBefore.coins-8);
  await openFuel();
  await page.locator('[data-phone-fuel-cancel]').tap();
  report.cancelled=await snap();
  assert.equal(report.cancelled.coins,cancelBefore.coins);
  assert.equal(report.cancelled.fuel,0);
  assert.equal(report.cancelled.orders.orders.at(-1).status,'cancelled');
  assert.equal(await page.locator('[data-phone-fuel-cancel]').count(),0);
  assert.deepEqual(errors,[]);
  report.passed=true;
  console.log('PASS physical arrival, transfer restart on reload, single tank credit, return and full cancellation refund');
}catch(error){
  report.passed=false;report.failure=String(error.stack);report.current=await snap().catch(()=>null);
  await page.screenshot({path:out+'/failure.png',timeout:3000}).catch(()=>{});
  throw error;
}finally{
  fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));
  await browser.close();await server.close();
}
