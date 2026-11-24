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
   walk:(direction,frames)=>{
     player.swimming=false;cameraYaw=0;
     let minY=Infinity,swam=false,trace=[];
     for(let i=0;i<frames;i++){
       const desired=direction,axis=[{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}].find(v=>{const p=cameraRelativeVector(v.x,v.z,cameraYaw);return p.x*desired>.9&&Math.abs(p.z)<.1;});
       if(!axis)throw Error('no movement axis');
       input.x=input.targetX=axis.x;input.z=input.targetZ=axis.z;
       updatePlayer(1/60);
       minY=Math.min(minY,player.y);swam||=player.swimming;
       if(i%30===0)trace.push({x:player.x,y:player.y,z:player.z,swim:player.swimming});
     }
     clearMovementInputs();return{x:player.x,y:player.y,z:player.z,minY,swam,trace};
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
     for(let i=1;i<course.route.length;i++){
       const a=course.route[i-1],b=course.route[i],len=distance2D(a,b);
       for(let s=0;s<=len;s+=.5){
         const t=s/(len||1),x=lerp(a.x,b.x,t),z=lerp(a.z,b.z,t);
         if(positionBlockedForPlayer(x,z,.43,{ignoreTraffic:true,ignoreParkedVehicles:true}))obstacles.push({x,z});
       }
     }
     return {buildings:buildings.length,overlaps,snow,pools,course:{gates:course.gates.length,obstacles},vendors:RIO_COMPACT_PARK_STALLS.map(s=>({id:s.id,shop:cityCoast.shops.has(s.id),action:!!worldInteractableById(s.id)}))};
   },
   action:id=>{const a=worldInteractableById(id);return a?{x:a.x,z:a.z}:null;}
 };`;
 // Reuse the fixture's renderer cap but keep native physics and purchases.
 await installCityInspection(page,{appSource:source.slice(0,end)+hook+source.slice(end),capDuringBoot:true});
 await page.goto(server.origin+'/games/otthi/?map=rio-preto');await page.locator('#playBtn').click();
 await page.waitForFunction(()=>window.__CITY_QA?.cap()&&OTTHOS_TEST_API.getGame().running&&OTTHI_CITY_COAST.diagnostics().ready&&document.getElementById('modal').hidden,null,{timeout:120000});
 await page.evaluate(()=>OTTHOS_TEST_API.teleport(-127,69));
 const east=await page.evaluate(()=>__PARK_QA.walk(1,440));
 report.checks.push({bridgeEast:east});
 assert(east.x>-84&&east.x<-68&&!east.swam,JSON.stringify(east));
 const west=await page.evaluate(()=>__PARK_QA.walk(-1,440));
 report.checks.push({bridgeWest:west});
 assert(west.x<-122&&!west.swam,JSON.stringify(west));
 const audit=await page.evaluate(()=>__PARK_QA.audit());report.audit=audit;
 assert.equal(audit.snow.length,0,JSON.stringify(audit.snow));
 assert(audit.pools.every(p=>!p.inside),JSON.stringify(audit.pools));
 assert.equal(audit.course.gates,6);
 assert.equal(audit.course.obstacles.length,0,JSON.stringify(audit.course.obstacles.slice(0,15)));
 assert(audit.vendors.every(v=>v.shop&&v.action));
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
 assert.deepEqual(report.errors,[]);
 // The audit reports all actual building overlaps; don't hide them behind
 // a static-layout exception. This is a diagnostic, not proof of total QA.
 console.log('RIO PARK AUDIT',JSON.stringify(report));
 report.passed=true;
}finally{fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));await browser.close();await server.close();}
