import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {multiplayerServer} from './helpers/multiplayer-browser-fixture.mjs';

const out='test-results/rio-regional-interiors';
mkdirSync(out,{recursive:true});
const server=await multiplayerServer();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let page;
const report={cases:[],errors:[]};
try{
  const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.route(/^https?:\/\//,r=>new URL(r.request().url()).origin===server.origin?r.continue():r.abort());
  await context.addInitScript(()=>localStorage.setItem('otthos_life_world_roleplay_v700',
    JSON.stringify({version:705,profile:{name:'Auditoria prédios',nameConfirmed:true,coins:50000,playerId:'rio-mall-smoke'},
      settings:{quality:'low',sound:false,lastWorldMap:'rio-preto'},flags:{accountPromptedV635:true},guardian:{sessionLimitMinutes:0}})));
  page=await context.newPage();
  const source=readFileSync('games/otthi/app.js','utf8'),closing=source.lastIndexOf('})();');
  assert(closing>0);
  const hook=String.raw`
  let rioQaWallClockOffset=0;const rioQaDateNow=Date.now.bind(Date);Date.now=()=>rioQaDateNow()+rioQaWallClockOffset;
  window.__RIO_INTERIOR_TEST={
    advanceClock:ms=>{rioQaWallClockOffset+=ms;},
    action:id=>{const a=world.interactables.find(x=>x.id===id);return a?{x:a.x,z:a.z}:null;},
    floor:id=>{
      const room=rioMap.sites.get(id);if(!room?.floorMesh)return null;
      worldGroup.updateMatrixWorld(true);
      const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
      const owns=o=>{for(let p=o;p;p=p.parent)if(p===room.root)return true;return false;};
      const points=[room.point(0,room.site.d*.10),room.point(0,room.site.d*.22)];
      const ray=new THREE.Raycaster();ray.camera=camera;
      const meshes=[];
      worldGroup.traverseVisible(o=>{
        if(!o.isMesh||o.material?.visible===false||o===contactShadow)return;
        for(let p=o;p;p=p.parent)if(p===playerGroup)return;
        meshes.push(o);
      });
      const probes=points.map(p=>{
        ray.set(new THREE.Vector3(p.x,room.floorY+.11,p.z),new THREE.Vector3(0,-1,0));
        const floor=ray.intersectObject(room.floorMesh,false)[0];
        const first=ray.intersectObjects(meshes,false).find(hit=>visible(hit.object));
        return {slab:!!floor,slabY:floor?.point.y,first:first?.object.name,owned:!!first&&owns(first.object)};
      });
      return {floorY:room.floorY,theme:room.interiorTheme,probes,wallGroups:Object.keys(room.wallGroups||{}),playerY:player.y};
    }
  };`;
  await page.route(/\/games\/otthi\/app\.js(?:\?.*)?$/,route=>route.fulfill({contentType:'application/javascript',body:source.slice(0,closing)+hook+source.slice(closing)}));
  const approach=async(id)=>{
    const pos=await page.evaluate(id=>__RIO_INTERIOR_TEST.action(id),id);assert(pos,'Missing native action '+id);
    await page.evaluate(p=>OTTHOS_TEST_API.teleport(p.x,p.z),pos);
    await page.waitForFunction(id=>OTTHOS_TEST_API.getContext()?.id===id,id,{timeout:15000});
    await page.locator('#actionBtn').click();
  };
  const verifyFloor=async(id)=>{
    const result=await page.evaluate(id=>__RIO_INTERIOR_TEST.floor(id),id);
    assert(result,'Room has no finished floor: '+id);
    assert.equal(result.wallGroups.length,4);
    assert(result.probes.every(p=>p.slab&&p.owned&&Math.abs(p.slabY-result.floorY)<.02),JSON.stringify(result));
    assert(Math.abs(result.playerY-result.floorY)<.15,JSON.stringify(result));
    return result;
  };
  page.on('pageerror',e=>report.errors.push(e.stack));
  await page.goto(server.origin+'/games/otthi/?map=rio-preto');
  await page.locator('#playBtn').click();
  await page.waitForFunction(()=>OTTHOS_TEST_API?.getGame().running&&
    document.getElementById('modal').hidden&&OTTHI_RIO_V51?.diagnostics(),null,{timeout:90000});
  for(const [id,x,z] of [
    ['regional-shopping_cidade_norte',376,-320],
    ['regional-planalto_materiais',432,-321],
    ['regional-upa_norte',420,-341],
    ['regional-estacao_schmitt',735,-440]
  ]){
    await page.evaluate(([x,z])=>OTTHOS_TEST_API.teleport(x,z),[x,z]);
    await page.waitForFunction(id=>OTTHOS_TEST_API.getContext()?.id===id,id,{timeout:18000});
    await page.locator('#actionBtn').click();
    let entry;
    try{
      await page.waitForFunction(id=>OTTHI_RIO_V51.diagnostics().malls.some(m=>m.id===id&&m.inside),id,{timeout:8500});
      entry={id,entered:true};
    }catch(e){
      entry={id,entered:false,trace:await page.evaluate(()=>OTTHI_RIO_V51.diagnostics())};
      report.cases.push(entry);throw new Error('Real interior failed: '+JSON.stringify(entry));
    }
    const detail=await page.evaluate(()=>({player:OTTHOS_TEST_API.getGame().player,context:OTTHOS_TEST_API.getContext()}));
    entry.position={x:detail.player.x,z:detail.player.z};
    const roomId=await page.evaluate(id=>OTTHI_RIO_V51.diagnostics().malls.find(m=>m.id===id).roomId,id);
    entry.floor=await verifyFloor(roomId);
    if(id==='regional-shopping_cidade_norte'){
      await approach(roomId+'-food-court-counter');
      await page.locator('[data-rio-food="burger"]').waitFor();
      const before=await page.evaluate(()=>({coins:OTTHOS_TEST_API.getState().profile.coins,meals:Number(OTTHOS_TEST_API.getState().stats.restaurantMeals||0)}));
      await page.locator('[data-rio-food="burger"]').click();
      assert.equal(await page.evaluate(()=>OTTHOS_TEST_API.getState().profile.coins),before.coins);
      await approach(roomId+'-food-court-table');
      await page.waitForFunction(n=>Number(OTTHOS_TEST_API.getState().stats.restaurantMeals||0)===n+1,before.meals,{timeout:30000});
      entry.foodCourt={paid:true,consumed:true};
    }
    if(id==='regional-planalto_materiais'){
      assert.equal(entry.floor.theme,'construction');
      await approach(roomId+'-construction-counter');
      await page.locator('[data-rio-construction-buy="paint"]').waitFor();
      await page.locator('#modalClose').click();entry.constructionCatalog=true;
    }
    report.cases.push(entry);
    await page.screenshot({path:out+'/'+id+'.png'});
    // Clear the active room without manipulating code or disabling collisions.
    const exit=id+'-exit-regional-mall';
    const exitPos=await page.evaluate(id=>OTTHI_RIO_V51.diagnostics().malls.find(m=>m.id===id)?.exit,id);
    assert(exitPos,'real interior must have an exit door');
    await page.evaluate(p=>OTTHOS_TEST_API.teleport(p.x,p.z),exitPos);
    await page.waitForFunction(id=>OTTHOS_TEST_API.getContext()?.id===id,exit,{timeout:9000});
    await page.locator('#actionBtn').click();
    await page.waitForFunction(id=>!OTTHI_RIO_V51.diagnostics().malls.find(m=>m.id===id)?.inside,id,{timeout:9000});
  }
  // Test a real chalet purchase, entry, persistence and exit in the native scene.
  const cabinId='regional-campos-chale-1';
  await page.evaluate(()=>OTTHOS_TEST_API.teleport(-52,187.7));
  await page.waitForFunction(id=>OTTHOS_TEST_API.getContext()?.id===id+'-door',cabinId,{timeout:20000});
  await page.locator('#actionBtn').click();
  await page.locator('[data-rio-property-buy]').waitFor();
  await page.locator('[data-rio-property-buy]').click();
  await page.locator('[data-rio-property-enter]').click();
  await page.waitForFunction(id=>OTTHI_DESTINATIONS.diagnostics().cabins.some(c=>c.id===id&&c.inside&&c.visible),cabinId,{timeout:15000});
  assert(await page.evaluate(id=>OTTHOS_TEST_API.getState().cityServices.rioMap.properties[id]?.owned,cabinId));
  const cabinFloor=await verifyFloor(cabinId);
  await page.screenshot({path:out+'/campos-chale-interior.png'});
  const cabinExit=await page.evaluate(id=>OTTHI_DESTINATIONS.diagnostics().cabins.find(c=>c.id===id)?.exit,cabinId);
  assert(cabinExit);
  await page.evaluate(p=>OTTHOS_TEST_API.teleport(p.x,p.z),cabinExit);
  await page.waitForFunction(id=>OTTHOS_TEST_API.getContext()?.id===id+'-chalet-exit',cabinId,{timeout:15000});
  await page.locator('#actionBtn').click();
  await page.waitForFunction(id=>!OTTHI_DESTINATIONS.diagnostics().cabins.find(c=>c.id===id)?.inside,cabinId,{timeout:12000});
  report.cases.push({id:cabinId,entered:true,purchased:true,exited:true,floor:cabinFloor});
  await approach('regional-shopping_cidade_norte');
  await page.waitForFunction(()=>OTTHI_RIO_V51.diagnostics().malls.some(m=>m.id==='regional-shopping_cidade_norte'&&m.inside),null,{timeout:20000});
  await approach('regional-shopping_cidade_norte-furniture-counter');
  await page.locator('[data-rio-furniture-buy="sofa-modular"]').click();
  await page.locator('[data-rio-furniture-address="'+cabinId+'"]').click();
  const order=await page.evaluate(id=>OTTHOS_TEST_API.getState().cityServices.rioMap.constructionOrders.find(o=>o.kind==='furniture'&&o.destinationId===id),cabinId);
  assert(order&&order.status==='en-route'&&order.paid===180);
  await page.locator('#modalClose').click();
  await approach('regional-shopping_cidade_norte-exit-regional-mall');
  await page.waitForFunction(()=>!OTTHI_RIO_V51.diagnostics().malls.find(m=>m.id==='regional-shopping_cidade_norte').inside);
  await page.evaluate(()=>__RIO_INTERIOR_TEST.advanceClock(46000));
  await approach('rio-construction-receive-'+cabinId);
  await page.locator('[data-rio-construction-receive]').click();
  const receipt=await page.evaluate(id=>{
    const save=OTTHOS_TEST_API.getState().cityServices.rioMap;
    return {owned:save.properties[id].furniture,layout:save.properties[id].decorLayout['sofa-modular'],order:save.constructionOrders.find(o=>o.kind==='furniture'&&o.destinationId===id)};
  },cabinId);
  assert(receipt.owned.includes('sofa-modular')&&receipt.layout.stored&&receipt.order.status==='delivered');
  report.cases.push({id:'furniture-address-delivery',received:true,destination:cabinId});
  const regions=await page.evaluate(()=>OTTHI_DESTINATIONS.diagnostics().regional);
  assert.equal(regions.rejected.length,0,JSON.stringify(regions.rejected));
  assert.equal(regions.homes.length,8);
  assert(regions.homes.every(h=>Math.abs(h.y-h.ground)<.05));
  assert(regions.port?.ships.length===2&&regions.port.craft.includes('rio-santos-escuna'));
  assert(regions.restaurant);
  await page.waitForFunction(()=>OTTHI_DESTINATIONS.diagnostics().regional.port.trucks.length===2);
  const truckIds=await page.evaluate(()=>OTTHI_DESTINATIONS.diagnostics().regional.port.trucks.map(t=>t.id));
  assert.deepEqual(truckIds,['santos-cargo-truck-0','santos-cargo-truck-1']);
  for(const id of ['regional-campos-serra-2','regional-guaruja-casa-1']){
    await approach(id+'-door');
    await page.locator('[data-rio-property-buy]').click();
    await page.locator('[data-rio-property-enter]').click();
    await page.waitForFunction(id=>OTTHI_DESTINATIONS.diagnostics().regional.homes.some(h=>h.id===id&&h.inside),id);
    assert(await page.evaluate(id=>OTTHOS_TEST_API.getState().cityServices.rioMap.properties[id]?.owned,id));
    const floor=await verifyFloor(id);await page.screenshot({path:out+'/'+id+'.png'});
    await approach(id+'-chalet-exit');
    report.cases.push({id,entered:true,purchased:true,exited:true,floor});
  }
  assert.equal(regions.luxury.length,5,JSON.stringify(regions.rejected));
  assert.equal(regions.luxury.filter(h=>h.hotel).length,2);
  for(const id of ['regional-campos-mansao-1','regional-campos-castelo']){
    await approach(id+'-door');await page.locator('[data-rio-property-buy]').click();await page.locator('[data-rio-property-enter]').click();
    await page.waitForFunction(id=>OTTHI_DESTINATIONS.diagnostics().regional.luxury.some(h=>h.id===id&&h.inside),id);
    assert(await page.evaluate(id=>OTTHOS_TEST_API.getState().cityServices.rioMap.properties[id]?.owned,id));
    await verifyFloor(id);await page.screenshot({path:out+'/'+id+'.png'});await approach(id+'-chalet-exit');
    await approach(id+'-pool');await page.waitForFunction(()=>OT_CHARACTER_ACTIVITIES.diagnostics().lastAction==='rio-pool'&&!OT_CHARACTER_ACTIVITIES.diagnostics().session,null,{timeout:45000});
  }
  await approach('regional-campos-hotel-1-door');
  await page.locator('[data-regional-hotel-book]').click();
  await page.waitForFunction(()=>OTTHI_DESTINATIONS.diagnostics().regional.luxury.some(h=>h.id==='regional-campos-hotel-1'&&h.inside));
  assert(await page.evaluate(()=>OTTHOS_TEST_API.getState().cityServices.rioMap.hotelStays['regional-campos-hotel-1'].until>Date.now()));
  await verifyFloor('regional-campos-hotel-1');await approach('regional-campos-hotel-1-chalet-exit');
  await approach('campos-sled-start');
  await page.waitForFunction(()=>OT_CIVIL_COMMUNITY.diagnostics().sledRide.active);
  await page.keyboard.down('KeyW');
  try{
    await page.waitForFunction(()=>OT_CIVIL_COMMUNITY.diagnostics().sledRide.distance>2,null,{timeout:20000});
    await page.screenshot({path:out+'/campos-treno.png'});
    await page.waitForFunction(()=>!OT_CIVIL_COMMUNITY.diagnostics().sledRide.active,null,{timeout:45000});
  }finally{await page.keyboard.up('KeyW');}
  assert(await page.evaluate(()=>OTTHOS_TEST_API.getState().worldExploration.sled.runs>=1));
  report.cases.push({id:'campos-sled-start',controlled:true,finished:true});
  for(const p of regions.port.tour)await approach(p.id);
  assert.equal(await page.evaluate(()=>OTTHOS_TEST_API.getState().worldExploration.santosVisit.seen.length),3);
  await approach('santos-port-crane');
  await page.waitForFunction(()=>OTTHI_DESTINATIONS.diagnostics().regional.port.job);
  await page.waitForFunction(()=>OTTHOS_TEST_API.getState().worldExploration.santosCargoDone===true,null,{timeout:25000});
  const cargo=await page.evaluate(()=>OTTHI_DESTINATIONS.diagnostics().regional.port.cargo);
  assert(Math.abs(cargo[2]-523)<.1);
  await approach('santos-port-tour');
  for(const id of ['rio-santos-lancha','rio-santos-jet-ski','rio-santos-surf','rio-santos-sup','rio-santos-escuna'])assert(await page.locator('[data-rio-dock-boat="'+id+'"]').isVisible());
  await page.locator('[data-rio-dock-boat="rio-santos-escuna"]').click();
  await page.waitForFunction(()=>OTTHI_DESTINATIONS.diagnostics().activeBoat==='rio-santos-escuna',null,{timeout:45000});
  const start=await page.evaluate(()=>OTTHOS_TEST_API.getGame().player);
  await page.keyboard.down('KeyW');
  try{await page.waitForFunction(p=>Math.hypot(OTTHOS_TEST_API.getGame().player.x-p.x,OTTHOS_TEST_API.getGame().player.z-p.z)>.65,start,{timeout:20000});}
  finally{await page.keyboard.up('KeyW');}
  await page.screenshot({path:out+'/santos-escuna.png'});
  report.cases.push({id:'santos-port-tour',boarded:true,ships:regions.port.ships});
  assert.deepEqual(report.errors,[]);
  report.passed=true;
}finally{
  writeFileSync(out+'/result.json',JSON.stringify(report,null,2));
  await browser.close();await server.close();
}
