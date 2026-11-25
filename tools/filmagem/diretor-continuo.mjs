import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,existsSync,statSync,rmSync,renameSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {multiplayerServer} from '../../tests/helpers/multiplayer-browser-fixture.mjs';
import {installCityInspection} from '../../tests/helpers/world-city-inspection.mjs';

const category=process.env.FILM_CATEGORY||'pilot';
const shard=Number(process.env.FILM_SHARD||0),shards=Number(process.env.FILM_SHARDS||1);
const out=resolve('filmagem-continua',category+'-'+shard);
mkdirSync(out,{recursive:true});
const FPS=30, W=1920,H=1080;
const report={category,shard,shards,format:{width:W,height:H,fps:FPS,method:'continuous Chromium screencast, measured distinct frame rate'},scenes:[],errors:[],limits:['Offline profile and position between scenes.','Camera angles use the real game scene.','Menu visibility is not proof that its options were executed.','No native audio. Output 30 fps may repeat frames; actual cadence is recorded.']};
const save=()=>writeFileSync(out+'/cobertura.json',JSON.stringify(report,null,2));
const source=readFileSync('games/otthi/app.js','utf8');
const end=source.lastIndexOf('})();');if(end<0)throw Error('Compiled closure not found');
const hook=String.raw`
 const filmPoint=a=>{const p=worldPos(a);return {x:Number(p.x),z:Number(p.z)}};
 const filmRows=()=>world.interactables.map(a=>{try{return {id:a.id,label:String(typeof a.getLabel==='function'?a.getLabel():a.label||a.id),type:a.type, ...filmPoint(a),radius:a.radius||2};}catch{return null;}}).filter(a=>a&&a.id&&Number.isFinite(a.x)&&Number.isFinite(a.z));
 function filmCatalog(){
  const locations=new Map();
  const put=p=>{if(p?.id&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.z)))locations.set(p.id,{id:p.id,label:p.name||p.label||p.id,group:p.group||p.kind||'',x:Number(p.x),z:Number(p.z),navX:Number(p.navX??p.x),navZ:Number(p.navZ??p.z)});};
  for(const p of MAP_LOCATIONS)put(p);
  for(const p of worldExploreLocations())put(p);
  if(typeof currentMapLocations==='function')for(const p of currentMapLocations())put(p);
  for(const h of world.houses){const p=h.group?.position;put({id:h.id,name:h.name||h.label||h.id,x:h.x??p?.x,z:h.z??p?.z,group:'Casa'});}
  for(const rec of snowCabinRecords.values())put({...rec.site,navX:rec.site.entry[0],navZ:rec.site.entry[1]});
  for(const room of rioMap.sites.values())if(room.site)put({...room.site,navX:room.site.entry?.[0],navZ:room.site.entry?.[1]});
  return {places:[...locations.values()],actions:filmRows(),npcs:world.npcs.map((n,i)=>({id:n.id||String(i),index:i,label:n.name||n.label||n.id||'NPC '+i,x:n.group.position.x,z:n.group.position.z})),vehicles:OTTHI_PLAYER_VEHICLE_CATALOG.map(v=>({id:v.id,label:v.label||v.id,category:v.category,model:v.model,dealer:OTTHI_DEALERS.find(d=>d.category===neighborhoodVehicleCategory(v))?.id})),boats:Array.from(world.boats.values()).map(b=>({id:b.id,label:b.label,kind:b.kind,x:b.group.position.x,z:b.group.position.z})),air:OT_WORLD_AIRPORT.diagnostics().fleet,controls:[...document.querySelectorAll('#game button')].map(b=>({id:b.id,label:b.getAttribute('aria-label')||b.textContent.trim()})).filter(b=>b.id||b.label)};
 }
 window.__FILM={
  ready:()=>running&&worldInitializationReady&&!!renderer,
  stop:()=>{cancelAnimationFrame(raf);targetDpr=()=>1;state.settings.quality='high';applyAdaptiveRenderSettings(true);applyPendingRenderBuffer();},
  inventory:filmCatalog,
  move:(x,z)=>{clearMovementInputs();OTTHOS_TEST_API.teleport(x,z);playerGroup.position.set(player.x,player.y,player.z);updateWorldExpansion();updateContext(true);},
  clean:()=>{clearMovementInputs();if(!els.modal.hidden)closeModal();},
  approach:id=>{const a=world.interactables.find(a=>a.id===id);if(!a)return {ok:false,reason:'missing'};const p=filmPoint(a);for(const [dx,dz]of[[0,0],[.5,0],[-.5,0],[0,.5],[0,-.5],[1,0],[-1,0],[0,1],[0,-1]]){
   OTTHOS_TEST_API.teleport(p.x+dx,p.z+dz);playerGroup.position.set(player.x,player.y,player.z);updateWorldExpansion();updateContext(true);
   if(currentContext?.id===id)return {ok:true,context:id,x:player.x,z:player.z};}
   return {ok:false,reason:'context not reachable',actual:currentContext?.id};
  },
  invoke:id=>{if(currentContext?.id!==id||!els.modal.hidden)return false;doAction();return true;},
  menu:()=>!els.modal.hidden?{title:els.modalTitle?.textContent||'',options:[...els.modalBody.querySelectorAll('button,select,input')].map(b=>({label:(b.textContent||b.getAttribute('aria-label')||b.placeholder||'').trim(),id:b.id,data:{...b.dataset},disabled:b.disabled}))}:null,
  activity:()=>({session:!!characterActivities.session,completed:OT_CHARACTER_ACTIVITIES.diagnostics().completed,last:OT_CHARACTER_ACTIVITIES.diagnostics().lastAction,indoor:rioMap.indoorRoom?.site?.id||null,vehicle:player.vehicle,boat:player.boating,flight:otGames.active}),
  actor:i=>{const n=world.npcs[i];return n?{x:n.group.position.x,y:n.group.position.y,z:n.group.position.z}:null;},
  frame:({view='native',x,z,radius=12,angle=0,steps=2,npc=null,followPlayer=false}={})=>{
   cancelAnimationFrame(raf);
   for(let i=0;i<steps;i++){stepWorldSimulation(1/60);}
   if(followPlayer){x=player.x;z=player.z;}
   if(npc!==null){const p=world.npcs[npc]?.group?.position;if(p){x=p.x;z=p.z;}}
   const m=viewportMetrics();if(renderer.domElement.width!==m.w||renderer.domElement.height!==m.h||renderer.getPixelRatio()!==1)renderer.setDrawingBufferSize(m.w,m.h,1);perf.pendingRenderBuffer=null;camera.aspect=m.w/m.h;
   if(view.startsWith('orbit')||view.startsWith('aerial')){
    const y=groundHeightAt(x,z),h=view.startsWith('aerial')?radius*1.1:Math.max(4,radius*.45);
    let cx=x+Math.sin(angle)*radius,cz=z+Math.cos(angle)*radius,cy=Math.max(y+h,groundHeightAt(cx,cz)+2);for(const c of world.colliders){if(!c.disabled&&Math.abs(cx-c.x)<c.w/2+1&&Math.abs(cz-c.z)<c.d/2+1)cy=Math.max(cy,groundHeightAt(c.x,c.z)+Number(c.height||8)+2);}camera.position.set(cx,cy,cz);
    camera.up.set(0,1,0);camera.lookAt(x,y+1.7,z);camera.fov=55;camera.near=.08;camera.far=1800;
   }else{updateCamera(1/30);}
   camera.updateProjectionMatrix();__CITY_QA.renderNative();
   return {width:renderer.domElement.width,height:renderer.domElement.height,player:{x:player.x,z:player.z},tier:qualityTier(),context:currentContext?.id||null};
  },
  startTake:(options,seconds)=>{
   window.__filmTake?.stop();let running=true,timer=0,last=performance.now(),start=last,count=0,error=null;
   const tick=()=>{if(!running)return;try{
    const now=performance.now(),elapsed=Math.max(1/60,Math.min(.12,(now-last)/1000));last=now;
    const progress=Math.min(1,(now-start)/(seconds*1000));
    const meta=window.__FILM.frame({...options,angle:(options.angle||0)+(options.sweep||0)*progress,steps:Math.max(1,Math.round(elapsed*60))});
    if(meta.width!==1920||meta.height!==1080)throw Error('Native buffer '+meta.width+'x'+meta.height);
    count++;timer=requestAnimationFrame(tick);
   }catch(e){error=String(e.stack||e);running=false;}};
   window.__filmTake={stop:()=>{running=false;cancelAnimationFrame(timer);return {rendered:count,error};}};
   timer=requestAnimationFrame(tick);
  },
  stopTake:()=>window.__filmTake?.stop(),
  workshop:(mode)=>{const l=world.workshopLifts[0],v=vehicleById('garage-orange');if(!l||!v)return false;workshopSelectBay(l);return mode==='stage'?workshopStageParkedVehicle(v):workshopRaiseLift();},
  workshopStatus:()=>OT_WORKSHOP_BAYS.diagnostics(),
  drive:(x,z)=>OTTHOS_TEST_API.setDriveInput(x,z),
  resetRideCamera:()=>resetVehicleView(),
  rideCamera:(inside,angle)=>{const ride=vehicleViewRide();if(!ride)return false;beginVehicleOrbit();vehicleView.inside=inside;vehicleView.snap=true;cameraYaw=angle;cameraPitch=inside?.035:.28;return true;},
  dealer:id=>{const d=OTTHI_DEALERS.find(d=>d.id===id);if(!d)return false;OTTHOS_TEST_API.teleport(d.entryX,d.entryZ);playerGroup.position.set(player.x,player.y,player.z);updateContext(true);if(currentContext?.id===id)doAction();else openDealer(id);return true;},
  vehicle:()=>({id:currentVehicleRef()?.id||null,catalog:OT_PERSONAL_GARAGE.diagnostics().units.find(e=>e.id===currentVehicleRef()?.id)?.catalogId,x:player.x,z:player.z,ignition:player.car.ignition,speed:player.car.speed,inside:!!vehicleView.inside}),
  engine:()=>{if(!player.car.ignition)document.querySelector('#vehicleEngineSwitch')?.click();return player.car.ignition;}
 };
 `;
const app=source.slice(0,end)+hook+source.slice(end);
const server=await multiplayerServer(),browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let context,page;
const safe=s=>String(s).replace(/[^a-zA-Z0-9_.-]+/g,'_').slice(0,100);
async function boot(){
 if(context)await context.close();
 context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await context.route(/^https?:\/\//,r=>new URL(r.request().url()).origin===server.origin?r.continue():r.abort());
 await context.addInitScript(()=>localStorage.setItem('otthos_life_world_roleplay_v700',JSON.stringify({version:705,profile:{name:'OTThi Demo',nameConfirmed:true,coins:500000,playerId:'director-local'},settings:{quality:'high',sound:false,lastWorldMap:'rio-preto'},flags:{accountPromptedV635:true},guardian:{sessionLimitMinutes:0}})));
 page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(String(e.stack)));
 await installCityInspection(page,{appSource:app,capDuringBoot:true});
 await page.goto(server.origin+'/games/otthi/?map=rio-preto',{waitUntil:'domcontentloaded'});
 await page.locator('#playBtn').click();
 await page.waitForFunction(()=>window.__FILM?.ready()&&window.__CITY_QA?.cap(),null,{timeout:180000});
 await page.evaluate(()=>{if(document.querySelector('[data-journey-explore]')?.offsetWidth)document.querySelector('[data-journey-explore]').click();__FILM.clean();__FILM.stop();});
}
async function clip(id,view,opts={},seconds=2){
 const path=out+'/'+safe(id)+'--'+safe(view)+'.mp4',tmp=path+'.tmp.mp4',framesDir=path+'.frames';
 if(existsSync(path))return;
 mkdirSync(framesDir,{recursive:true});
 const frames=[],hashes=new Set(),cdp=await context.newCDPSession(page);
 const {createHash}=await import('node:crypto');
 let fault=null,live=true;
 const listener=e=>{
  cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});
  if(!live||fault)return;
  try{const data=Buffer.from(e.data,'base64'),hash=createHash('sha256').update(data).digest('hex');
   const file=String(frames.length).padStart(6,'0')+'.jpg';writeFileSync(framesDir+'/'+file,data);
   frames.push({file,ts:e.metadata.timestamp||Date.now()/1000});hashes.add(hash);
  }catch(e){fault=e;}
 };
 cdp.on('Page.screencastFrame',listener);
 let stats=null,start=Date.now();
 try{
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:94,maxWidth:W,maxHeight:H,everyNthFrame:1});
  await page.evaluate(({opts,seconds,view})=>__FILM.startTake({...opts,view},seconds),{opts,seconds,view});
  // Capture real elapsed time, bounded; there is no per-frame screenshot roundtrip.
  const duration=Math.max(5,seconds);
  await new Promise(r=>setTimeout(r,duration*1000));
  stats=await page.evaluate(()=>__FILM.stopTake());
 }finally{
  live=false;await cdp.send('Page.stopScreencast').catch(()=>{});await cdp.detach().catch(()=>{});
  await page.evaluate(()=>__FILM.stopTake()).catch(()=>{});
 }
 if(fault)throw fault;if(stats?.error)throw Error(stats.error);
 if(!frames.length)throw Error('No compositor frames received');
 const staticMenu=/menu/.test(view),elapsed=Math.max(.001,Date.now()-start)/1000,uniqueFps=hashes.size/elapsed;
 // A menu can legitimately stay static. Moving footage must have distinct frames.
 if(!staticMenu&&hashes.size<6)throw Error('Insufficient distinct frames: '+hashes.size);
 const list=frames.map((f,i)=>"file '"+f.file+"'\nduration "+Math.max(.001,Math.min(2,i+1<frames.length?frames[i+1].ts-f.ts:1/Math.max(1,frames.length/elapsed))).toFixed(6)).join('\n')+"\nfile '"+frames.at(-1).file+"'\n";
 writeFileSync(framesDir+'/frames.txt',list);
 const dims=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=width,height','-of','json',framesDir+'/'+frames[0].file],{encoding:'utf8'})).streams[0];
 if(dims.width!==W||dims.height!==H)throw Error('Compositor returned '+dims.width+'x'+dims.height+'; refusing upscale');
 execFileSync('ffmpeg',['-nostdin','-v','error','-y','-f','concat','-safe','0','-i',framesDir+'/frames.txt','-an','-vf','fps=30','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',tmp],{timeout:120000});
 execFileSync('ffmpeg',['-nostdin','-v','error','-xerror','-i',tmp,'-f','null','-'],{timeout:120000});
 renameSync(tmp,path);
 const item={id,view,file:path.split('/').pop(),width:W,height:H,receivedFrames:frames.length,distinctFrames:hashes.size,uniqueFps:+uniqueFps.toFixed(2),rendered:stats?.rendered,seconds:elapsed,bytes:statSync(path).size,quality:staticMenu?'static-menu':uniqueFps>=20?'motion-candidate':'low-cadence-review'};
 report.scenes.push(item);save();rmSync(framesDir,{recursive:true,force:true});console.log('CONTINUOUS_CLIP_OK',JSON.stringify(item));return item;
}
const subset=rows=>rows.filter((_,i)=>i%shards===shard);
async function place(p){
 await page.evaluate(p=>{__FILM.clean();__FILM.move(p.navX,p.navZ);},p);
 const radius=/hotel|castel|mans|shopping|porto|aeroporto/i.test(p.label)?24:12;
 await clip(p.id,'orbit',{x:p.x,z:p.z,radius,angle:-.8,sweep:1.5});
 await clip(p.id,'aerial',{x:p.x,z:p.z,radius:radius*1.5,angle:.8,sweep:1.1});
 await clip(p.id,'native',{},2);
}
async function action(a){
 const ready=await page.evaluate(id=>{__FILM.clean();return __FILM.approach(id);},a.id);
 if(!ready.ok){report.scenes.push({id:a.id,status:'not-executed',reason:ready.reason,actual:ready.actual});save();return;}
 await clip(a.id,'native',{},1);
 const invoked=await page.evaluate(id=>__FILM.invoke(id),a.id);
 if(!invoked){report.scenes.push({id:a.id,status:'not-executed',reason:'native action refused'});save();return;}
 await clip(a.id,'native-action',{},3);
 const menu=await page.evaluate(()=>__FILM.menu()),state=await page.evaluate(()=>__FILM.activity());
 report.scenes.push({id:a.id,status:'action-invoked',menu,state});save();
 // Enter or book via native UI; do not claim arbitrary menu branches executed.
 for(const selector of ['[data-rio-property-enter]','[data-regional-hotel-book]']){
  if(await page.locator(selector).isVisible()){
   await page.locator(selector).click();await clip(a.id,'interior-native',{},4);
   report.scenes.push({id:a.id,status:'entry-attempted',state:await page.evaluate(()=>__FILM.activity())});save();break;
  }
 }
 const active=await page.evaluate(()=>__FILM.activity());
 if(!menu&&(active.session||active.indoor||active.vehicle||active.boat||active.flight)){
  await clip(a.id,'orbit-action',{followPlayer:true,radius:5,sweep:1.2},2);
  await clip(a.id,'aerial-action',{followPlayer:true,radius:9,sweep:1.0},2);
 }
 await page.evaluate(()=>__FILM.clean());
}
async function vehicle(v){
 if(!v.dealer)throw Error('No dealer for '+v.id);
 await page.evaluate(id=>__FILM.dealer(id),v.dealer);
 await page.locator('[data-dealer-vehicle="'+v.id+'"]').click();
 await clip(v.id,'purchase-menu',{},2);
 await page.locator('[data-dealer-purchase]').click();await page.locator('[data-yes]').click();await page.locator('[data-delivery-drive]').click({timeout:60000});
 const a=await page.evaluate(()=>__FILM.vehicle());if(a.catalog!==v.id)throw Error('Delivered wrong vehicle '+JSON.stringify(a));
 await page.evaluate(()=>{__FILM.engine();__FILM.drive(0,1);});
 await clip(v.id,'driving-follow',{},4);
 const b=await page.evaluate(()=>__FILM.vehicle());if(Math.hypot(b.x-a.x,b.z-a.z)<.3)throw Error('Vehicle did not move');
 await page.evaluate(()=>__FILM.rideCamera(false,-.9));await clip(v.id,'driving-external-side',{},3);
 await page.evaluate(()=>__FILM.rideCamera(false,2.4));await clip(v.id,'driving-external-front',{},3);
 const inside=await page.evaluate(()=>__FILM.rideCamera(true,0));if(inside)await clip(v.id,'driving-interior',{},3);
 await page.evaluate(()=>__FILM.drive(0,0));report.scenes.push({id:v.id,status:'purchase-and-drive-verified',distance:Math.hypot(b.x-a.x,b.z-a.z),inside});save();
}
try{
 await boot();const catalog=await page.evaluate(()=>__FILM.inventory());writeFileSync(out+'/catalogo.json',JSON.stringify(catalog,null,2));console.log('CATALOG',JSON.stringify(Object.fromEntries(Object.entries(catalog).map(([k,v])=>[k,v.length]))));
 if(category==='priority-shops'){
  const rows=catalog.actions.filter(a=>/food-court-counter|construction-counter|furniture-counter|market|bakery|restaurant|shopping|loja|padaria|mercado/i.test(a.id+' '+a.label));
  writeFileSync(out+'/prioridades.json',JSON.stringify(rows,null,2));
  for(const a of subset(rows).slice(0,12)){try{await action(a);if(await page.locator('[data-rio-food="burger"]').isVisible()){await page.locator('[data-rio-food="burger"]').click();await clip(a.id,'purchase-food',{},5);}if(await page.locator('[data-rio-construction-buy="paint"]').isVisible()){await page.locator('[data-rio-construction-buy="paint"]').click();await clip(a.id,'purchase-material',{},5);}await page.evaluate(()=>__FILM.clean());}catch(e){report.errors.push(a.id+': '+e.message);save();await boot();}}
 }else if(category==='priority-workshop'){
  const a=catalog.actions.find(a=>/workshop|oficina/i.test(a.id+' '+a.label));if(a)await page.evaluate(a=>__FILM.move(a.x,a.z),a);
  const ok=await page.evaluate(()=>__FILM.workshop('stage'));if(!ok)throw Error('Workshop staging refused');
  await clip('oficina','carro-no-elevador',{},5);if(!await page.evaluate(()=>__FILM.workshop('raise')))throw Error('Lift refused');
  await clip('oficina','elevacao',{},10);report.workshop=await page.evaluate(()=>__FILM.workshopStatus());save();
  for(const a of catalog.actions.filter(a=>/workshop|oficina|conserto|repar|mec.nico/i.test(a.id+' '+a.label)).slice(0,8)){try{await action(a);}catch(e){report.errors.push(a.id+': '+e.message);save();}}
 }else if(category==='pilot'){
  const p=catalog.places.find(p=>p.id==='regional-campos-mansao-1')||catalog.places.find(p=>p.id==='marina-costa');if(!p)throw Error('Pilot destination absent');
  await place(p);const a=catalog.actions.find(a=>a.id===p.id+'-door');if(a)await action(a);
 }else if(category==='vehicle-pilot'||category==='vehicles'){
  const rows=category==='vehicle-pilot'?catalog.vehicles.filter(v=>v.id==='br-ferrari458'):subset(catalog.vehicles);
  if(!rows.length)throw Error('No vehicles selected');
  for(const v of rows){try{await vehicle(v);}catch(e){report.errors.push(v.id+': '+e.message);save();if(category==='vehicle-pilot')throw e;}if(v!==rows.at(-1))await boot();}
 }else if(category==='places'){
  for(const p of subset(catalog.places))try{await place(p);}catch(e){report.errors.push(p.id+': '+e.message);save();}
 }else if(category==='actions'){
  for(const a of subset(catalog.actions)){
   try{await action(a);const s=await page.evaluate(()=>__FILM.activity());if(s.indoor||s.vehicle||s.boat||s.flight||s.session)await boot();}
   catch(e){report.errors.push(a.id+': '+e.message);save();await boot();}
  }
 }else if(category==='npcs'){
  for(const n of subset(catalog.npcs))try{const p=await page.evaluate(i=>__FILM.actor(i),n.index);if(!p)throw Error('NPC absent');await page.evaluate(p=>__FILM.move(p.x+2,p.z+2),p);await clip('npc-'+n.id,'orbit',{npc:n.index,x:p.x,z:p.z,radius:4.2,sweep:2.4},3);}catch(e){report.errors.push(n.id+': '+e.message);save();}
 }else throw Error('Unknown chapter '+category);
 report.completed=true;
}catch(e){report.errors.push(String(e.stack));process.exitCode=1;console.error(e);}
finally{save();await browser.close();await server.close();}
