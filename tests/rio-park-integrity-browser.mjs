import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {multiplayerServer} from './helpers/multiplayer-browser-fixture.mjs';
import {installCityInspection} from './helpers/world-city-inspection.mjs';
const out='test-results/rio-park-integrity';fs.mkdirSync(out,{recursive:true});
const server=await multiplayerServer(),browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let page;const report={errors:[],checks:[]};
try{
 const c=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await c.route(/^https?:\/\//,r=>new URL(r.request().url()).origin===server.origin?r.continue():r.abort());
 await c.addInitScript(()=>localStorage.setItem('otthos_life_world_roleplay_v700',JSON.stringify({version:705,profile:{name:'QA Represa',nameConfirmed:true,playerId:'park-qa',coins:1000},settings:{quality:'low',sound:false,lastWorldMap:'rio-preto'},flags:{accountPromptedV635:true},guardian:{sessionLimitMinutes:0}})));
 page=await c.newPage();page.on('pageerror',e=>report.errors.push(e.stack));
 const source=fs.readFileSync('games/otthi/app.js','utf8'),end=source.lastIndexOf('})();');
 const hook=String.raw`
 window.__PARK_QA={
   walk:(direction,frames,targetX)=>{
     player.swimming=false;cameraYaw=0;
     let minY=Infinity,swam=false,trace=[];
     for(let i=0;i<frames;i++){
       const desired=direction,axis=[{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}].find(v=>{const p=cameraRelativeVector(v.x,v.z,cameraYaw);return p.x*desired>.9&&Math.abs(p.z)<.1;});
       if(!axis)throw Error('no movement axis');
       input.x=input.targetX=axis.x;input.z=input.targetZ=axis.z;
       updatePlayer(1/60);
       minY=Math.min(minY,player.y);swam||=player.swimming;
       if(i%60===0)trace.push({x:player.x,y:player.y,z:player.z,swim:player.swimming});
       if(direction*(player.x-targetX)>=0)break;
     }
     clearMovementInputs();return{x:player.x,y:player.y,z:player.z,minY,swam,trace};
   },
   finishCourse:()=>{
     const course=rioMap.course,previous=rioStreetRecord()?.runs||0;
     let overLake=0,swam=false,photo=null,avatarDraws=0;
     cameraYaw=0;input.touchSprint=true;
     for(const goal of course.route.slice(1)){
       let frames=0;
       while(activeRace&&distance2D(player,goal)>.18){
         if(++frames>2400)throw Error('Runner stopped at '+JSON.stringify({x:player.x,z:player.z,goal}));
         const dx=goal.x-player.x,dz=goal.z-player.z,len=Math.hypot(dx,dz);
         input.joyId=1;input.joyX=dx/len;input.joyZ=-dz/len;
         cityQaMs+=1000/60;const before={x:player.x,z:player.z};updatePlayer(1/60);
         if(!photo){
           rioFottoObserveRun(1/60,before);
           if(rioFotto.pending){
             __CITY_QA.renderNative();
             const saved=renderer.render,restores=[];
             // Restore native rendering for the shutter only. Record actual
             // avatar draw calls, not merely the presence of a JPEG.
             for(const root of [playerModel,avatarLayer])root?.traverseVisible(o=>{if(!o.isMesh)return;const previous=o.onBeforeRender;o.onBeforeRender=function(...args){if(args[2]!==camera)avatarDraws++;previous?.apply(this,args);};restores.push(()=>o.onBeforeRender=previous);});
             try{renderer.render=cityQaRender;rioFottoCaptureFrame();if(rioFotto.busy)photo={sprinting:input.isSprinting,avatarDraws};}
             finally{renderer.render=saved;for(const restore of restores)restore();}
           }
         }
         updateRioStreetRun(1/60);
         if(waterAt(player.x,player.z)&&rioCompactBridgeSurface(player.x,player.z)>.24)overLake++;
         swam||=player.swimming;
       }
       if(!activeRace)break;
     }
     clearMovementInputs();
     return {id:course.id,gates:course.gates.length,completed:(rioStreetRecord()?.runs||0)-previous,overLake,swam,photo,photoDiagnostics:{stations:rioFotto.stations.map(s=>({id:s.id,gate:s.gate,pos:s.pos,course:s.course})),...JSON.parse(JSON.stringify(rioFotto.stats))}};
   },
   photoEvidence:async()=>{const rows=await rioFottoRows(rioFottoOwner());return Promise.all(rows.map(async row=>{const image=await createImageBitmap(row.blob);const info={id:row.id,size:row.blob.size,type:row.blob.type,width:image.width,height:image.height};image.close();return info;}));},
   photoGallery:()=>openRioFottoGallery(),
   renderedBuildings:()=>{
     // An InstancedMesh stores its real building parts in per-instance matrices.
     // Its unit geometry's bounding box alone would miss the overhanging roofs.
     worldGroup.updateMatrixWorld(true);
     const buildings=[],one=new THREE.Box3(),local=new THREE.Matrix4(),matrix=new THREE.Matrix4();
     function record(id,objects){
       const bounds=new THREE.Box3();
       for(const root of objects.filter(Boolean))root.traverse(mesh=>{
         if(!mesh.isMesh)return;
         const g=mesh.geometry;if(!g.boundingBox)g.computeBoundingBox();
         if(mesh.isInstancedMesh){
           for(let i=0;i<mesh.count;i++){
             mesh.getMatrixAt(i,local);matrix.multiplyMatrices(mesh.matrixWorld,local);
             bounds.union(one.copy(g.boundingBox).applyMatrix4(matrix));
           }
         }else bounds.union(one.copy(g.boundingBox).applyMatrix4(mesh.matrixWorld));
       });
       if(!bounds.isEmpty())buildings.push({id,bounds});
     }
     for(const h of world.houses)record(h.id,[h.roof,h.front,h.workshopShell]);
     for(const r of rioMap.sites.values())if(!r.legacyResidence&&r.roof)record(r.site.id,[r.roof]);
     const overlaps=[];
     for(const [i,a] of buildings.entries())for(const b of buildings.slice(i+1)){
       if(a.bounds.intersectsBox(b.bounds))overlaps.push([a.id,b.id]);
     }
     const signOverlaps=[],signBounds=new THREE.Box3();
     for(const sign of world.navigationSigns){
       signBounds.setFromObject(sign.group);
       for(const house of buildings)if(signBounds.intersectsBox(house.bounds))signOverlaps.push([sign.label,house.id]);
     }
     const inlet=rioMap.sites.get('regional-mcdonalds_andalo').site.entry;
     const sign=world.navigationSigns.filter(s=>s.kind==='highway').map(s=>distance2D(s,{x:inlet[0],z:inlet[1]}));
     return {count:buildings.length,overlaps,signOverlaps,nearestRoadSign:Math.min(...sign)};
   },
   boardCar:()=>{
     const v=world.vehicles.find(v=>v.id==='garage-orange');
     OTTHOS_TEST_API.teleport(v.group.position.x+1.4,v.group.position.z);
     __CITY_QA.simulate(30);
     return enterVehicle(v);
   },
   showBridge:()=>{
     OTTHOS_TEST_API.teleport(RIO_COMPACT_BRIDGE.x,RIO_COMPACT_BRIDGE.z);
     cameraYaw=1.05;cameraPitch=.38;cameraZoom=-2;
     __CITY_QA.simulate(35);updateCamera(1);__CITY_QA.renderNative();
   },
   audit:()=>{
     const roof=world.houses.map(h=>({id:h.id,x:h.x,z:h.z,w:h.w+.8,d:h.d+.75}));
     const rooms=[...rioMap.sites.values()].filter(r=>r.floorMesh&&!r.legacyResidence).map(r=>({id:r.site.id,x:r.site.x,z:r.site.z,w:Math.abs(Math.sin(r.site.yaw))>.5?r.site.d:r.site.w,d:Math.abs(Math.sin(r.site.yaw))>.5?r.site.w:r.site.d}));
     const buildings=[...roof,...rooms],overlaps=[];
     for(let i=0;i<buildings.length;i++)for(let j=i+1;j<buildings.length;j++){
       const a=buildings[i],b=buildings[j],ox=(a.w+b.w)/2-Math.abs(a.x-b.x),oz=(a.d+b.d)/2-Math.abs(a.z-b.z);
       if(ox>.15&&oz>.15)overlaps.push({a:a.id,b:b.id,ox,oz});
     }
     const snow=[];worldGroup.traverse(o=>{if(o.userData?.backdropFootprint&&rioCompactSnowBackdrop(o.position))snow.push(o.name);});
     const pools=[...rioMap.sites.values()].filter(r=>r.poolPlan).map(r=>({id:r.site.id,inside:r.forSite(r.poolPlan.x,r.poolPlan.z,0),approach:r.poolPlan.approach}));
     const course=rioMap.course,obstacles=[];
     for(const record of compactRio.courses.values())for(let i=1;i<record.course.route.length;i++){
       const course=record.course;
       const a=course.route[i-1],b=course.route[i],len=distance2D(a,b);
       for(let s=0;s<=len;s+=.5){
         const t=s/(len||1),x=lerp(a.x,b.x,t),z=lerp(a.z,b.z,t);
         if(positionBlockedForPlayer(x,z,.43,{ignoreTraffic:true,ignoreParkedVehicles:true}))obstacles.push({x,z});
       }
     }
     return {buildings:buildings.length,overlaps,snow,pools,lakes:world.hazards.filter(h=>h.reservoir).map(h=>h.id),course:{gates:course.gates.length,obstacles,count:compactRio.courses.size},vendors:RIO_COMPACT_PARK_STALLS.map(s=>({id:s.id,shop:cityCoast.shops.has(s.id),action:!!worldInteractableById(s.id)}))};
   },
   action:id=>{const a=worldInteractableById(id);return a?{x:a.x,z:a.z}:null;}
 };`;
 // Reuse the fixture's renderer cap but keep native physics and purchases.
 await installCityInspection(page,{appSource:source.slice(0,end)+hook+source.slice(end),capDuringBoot:true});
 await page.goto(server.origin+'/games/otthi/?map=rio-preto');await page.locator('#playBtn').click();
 await page.waitForFunction(()=>window.__CITY_QA?.cap()&&OTTHOS_TEST_API.getGame().running&&OTTHI_CITY_COAST.diagnostics().ready&&document.getElementById('modal').hidden,null,{timeout:120000});
 await page.evaluate(()=>OTTHOS_TEST_API.teleport(-127,69));
 const east=await page.evaluate(()=>__PARK_QA.walk(1,1800,-82));
 report.checks.push({bridgeEast:east});
 assert(east.x>-84&&east.x<-68&&!east.swam,JSON.stringify(east));
 const west=await page.evaluate(()=>__PARK_QA.walk(-1,1800,-125));
 report.checks.push({bridgeWest:west});
 assert(west.x<-122&&!west.swam,JSON.stringify(west));
 await page.evaluate(()=>__PARK_QA.showBridge());
 await page.screenshot({path:out+'/ponte-estaiada.png'});
 const audit=await page.evaluate(()=>__PARK_QA.audit());report.audit=audit;
 assert.equal(audit.snow.length,0,JSON.stringify(audit.snow));
 assert(audit.pools.every(p=>!p.inside),JSON.stringify(audit.pools));
 assert.equal(audit.course.gates,6);assert.equal(audit.course.count,2);assert.equal(new Set(audit.lakes).size,3);
 assert.equal(audit.course.obstacles.length,0,JSON.stringify(audit.course.obstacles.slice(0,15)));
 assert(audit.vendors.every(v=>v.shop&&v.action));
 assert.deepEqual(audit.overlaps,[],'Real registered house and building overlap: '+JSON.stringify(audit.overlaps));
 for(const [id,sku,price]of[['rio-represa-coco','coconut-water',6],['rio-represa-milho','green-corn',8]]){
   const p=await page.evaluate(id=>__PARK_QA.action(id),id);assert(p);
   await page.evaluate(p=>OTTHOS_TEST_API.teleport(p.x,p.z),p);
   await page.waitForFunction(id=>OTTHOS_TEST_API.getContext()?.id===id,id,{timeout:15000});
   await page.locator('#actionBtn').click();const before=await page.evaluate(()=>OTTHOS_TEST_API.getState().profile.coins);
   await page.locator('[data-city-order="'+sku+'"]').click();
   assert.equal(await page.evaluate(()=>OTTHOS_TEST_API.getState().profile.coins),before-price);
   await page.evaluate(()=>__CITY_QA.simulate(240));
   report.checks.push({vendor:id,purchased:true});
 }
 const shells=await page.evaluate(()=>__PARK_QA.renderedBuildings());
 assert(shells.count>=50&&shells.nearestRoadSign>5,JSON.stringify(shells));assert.deepEqual(shells.overlaps,[]);
 assert.deepEqual(shells.signOverlaps,[],'Rendered sign and building bounds must remain separated');
 report.renderedBuildings=shells;
 for(const [id,bridge] of [['regional-portaria_damha',false],['rio-orla-largada',true]]){
   const start=await page.evaluate(id=>__PARK_QA.action(id),id);
   await page.evaluate(p=>OTTHOS_TEST_API.teleport(p.x,p.z),start);
   await page.waitForFunction(id=>OTTHOS_TEST_API.getContext()?.id===id,id,{timeout:15000});
   await page.locator('#actionBtn').tap();
   await page.locator('[data-rio-run-start]').tap();
   const finish=await page.evaluate(()=>__PARK_QA.finishCourse());
   assert(finish.completed===1&&finish.gates===6&&!finish.swam,JSON.stringify(finish));
   if(bridge)assert(finish.overLake>60,JSON.stringify(finish));
   report.checks.push({race:finish});
 }
 const captured=report.checks.filter(x=>x.race?.photo?.sprinting&&x.race.photo.avatarDraws>0);
 assert(captured.length>0,'No running athlete was rendered by a photographer: '+JSON.stringify(report.checks.filter(x=>x.race)));
 await page.waitForFunction(async()=> (await __PARK_QA.photoEvidence()).length>0,null,{timeout:30000});
 const photos=await page.evaluate(()=>__PARK_QA.photoEvidence());assert(photos.every(p=>p.type==='image/jpeg'&&p.width===768&&p.height===512&&p.size>3000),JSON.stringify(photos));report.photos=photos;
 await page.evaluate(()=>__PARK_QA.photoGallery());await page.locator('[data-fotto-list] img').first().waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('[data-fotto-list] img')?.naturalWidth>0);await page.screenshot({path:out+'/fotto-running-gallery.png'});await page.evaluate(()=>OTTHOS_TEST_API.closeModal());
 assert(await page.evaluate(()=>__PARK_QA.boardCar()));
 for(const [width,height] of [[393,852],[360,740],[852,393]]){
   await page.setViewportSize({width,height});
   await page.waitForFunction(({width,height})=>{
     const view=window.OTTHI_VIEWPORT?.current(),game=document.querySelector('#game').getBoundingClientRect();
     return view?.width===width&&view.height===height&&Math.abs(game.width-width)<1&&Math.abs(game.height-height)<1&&
       document.body.classList.contains(height>width?'ui-portrait':'ui-landscape')&&!document.body.classList.contains('ui-orientation-changing');
   },{width,height});
   const boxes=await page.evaluate(()=>{
     const read=id=>{const b=document.getElementById(id).getBoundingClientRect();return {x:b.x,y:b.y,r:b.right,b:b.bottom,w:b.width,h:b.height};};
     return Object.fromEntries(['missionCard','miniNav','quickToggleBtn','vehicleBadge','joystick','runBtn','jumpBtn'].map(id=>[id,read(id)]));
   });
   const overlaps=(a,b)=>a.w>0&&b.w>0&&a.x<b.r&&a.r>b.x&&a.y<b.b&&a.b>b.y;
   for(const [a,b] of [['missionCard','miniNav'],['miniNav','quickToggleBtn'],['vehicleBadge','joystick'],['vehicleBadge','runBtn'],['vehicleBadge','jumpBtn']]){
     assert(!overlaps(boxes[a],boxes[b]),width+' '+a+' / '+b+' '+JSON.stringify(boxes));
   }
   for(const [id,box] of Object.entries(boxes)){
     assert(box.w>0&&box.h>0&&box.x>=0&&box.y>=0&&box.r<=width+1&&box.b<=height+1,id+' outside viewport '+JSON.stringify(box));
   }
   assert(boxes.runBtn.w>=44&&boxes.jumpBtn.w>=44,width+' '+JSON.stringify(boxes));
   report.checks.push({driving:{width,height,boxes}});
 }
 assert.deepEqual(report.errors,[]);
 // Both race entrances, actual geometry and ten profile slots are checked separately.
 console.log('RIO PARK AUDIT',JSON.stringify(report));
 report.passed=true;
}finally{fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));await browser.close();await server.close();}
