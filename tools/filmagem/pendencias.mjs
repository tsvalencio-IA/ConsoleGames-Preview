import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,existsSync,statSync,rmSync,renameSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {multiplayerServer} from '../../tests/helpers/multiplayer-browser-fixture.mjs';
import {installCityInspection} from '../../tests/helpers/world-city-inspection.mjs';

const category=process.env.FILM_CATEGORY||'pilot';
const shard=Number(process.env.FILM_SHARD||0),shards=Number(process.env.FILM_SHARDS||1);
const out=resolve('filmagem-pendencias',category+'-'+shard);
mkdirSync(out,{recursive:true});
const FPS=20, W=640,H=360;
const report={category,shard,shards,format:{width:W,height:H,fps:FPS,method:'offline native WebGL frames at fixed simulation cadence, 20 real samples/sec'},scenes:[],errors:[],limits:['Offline profile and position between scenes.','Camera angles use the real game scene.','Menu visibility is not proof that its options were executed.','No native audio. Fixed simulation cadence, no interpolation. Isolated fixture, no real account.']};
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
 let filmRaceGate=0;
 window.__FILM={
  ready:()=>running&&worldInitializationReady&&!!renderer,
  stop:()=>{cancelAnimationFrame(raf);targetDpr=()=>1;state.settings.quality='low';applyAdaptiveRenderSettings(true);applyPendingRenderBuffer();},
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
  frame:({view='native',x,z,radius=12,angle=0,steps=3,npc=null,followPlayer=false,race=false}={})=>{
   cancelAnimationFrame(raf);
   for(let i=0;i<steps;i++){cityQaMs+=1000/60;if(race&&activeRace){const goal=rioMap.course?.route?.slice(1).find((p,j)=>j>=filmRaceGate&&Math.hypot(player.x-p.x,player.z-p.z)>.35);if(goal){const dx=goal.x-player.x,dz=goal.z-player.z,len=Math.hypot(dx,dz);cameraYaw=0;input.joyId=1;input.joyX=dx/len;input.joyZ=-dz/len;input.touchSprint=true;if(len<.8)filmRaceGate++;}}stepWorldSimulation(1/60);}
   const focus=otGames.active?otGames.body:player;if(followPlayer){x=focus.x;z=focus.z;}
   if(view==='workshop-sweep'){cameraYaw=angle;cameraPitch=.42;cameraZoom=0;}
   if(view==='close-activity'&&characterActivities.session?.phase==='perform'){const p=characterActivities.session.pose||player, yaw=p.yaw||player.facing;cameraYaw=yaw+Math.PI*.45;cameraPitch=.48;cameraZoom=-1.2;}
   if(npc!==null){const p=world.npcs[npc]?.group?.position;if(p){x=p.x;z=p.z;}}
   const m=viewportMetrics();if(renderer.domElement.width!==m.w||renderer.domElement.height!==m.h||renderer.getPixelRatio()!==1)renderer.setDrawingBufferSize(m.w,m.h,1);perf.pendingRenderBuffer=null;camera.aspect=m.w/m.h;
   if(view.startsWith('orbit')||view.startsWith('aerial')){
    const y=followPlayer?Math.max(groundHeightAt(x,z),focus.y):groundHeightAt(x,z),h=view.startsWith('aerial')?radius*1.1:Math.max(4,radius*.45);
    let cx=x+Math.sin(angle)*radius,cz=z+Math.cos(angle)*radius,cy=Math.max(y+h,groundHeightAt(cx,cz)+2);for(const c of world.colliders){if(!c.disabled&&Math.abs(cx-c.x)<c.w/2+1&&Math.abs(cz-c.z)<c.d/2+1)cy=Math.max(cy,groundHeightAt(c.x,c.z)+Number(c.height||8)+2);}camera.position.set(cx,cy,cz);
    camera.up.set(0,1,0);camera.lookAt(x,y+1.7,z);camera.fov=55;camera.near=.08;camera.far=1800;
   }else{updateCamera(1/30);}
   camera.updateProjectionMatrix();__CITY_QA.renderNative();
   return {width:renderer.domElement.width,height:renderer.domElement.height,player:{x:player.x,y:player.y,z:player.z},tier:qualityTier(),context:currentContext?.id||null,jpeg:renderer.domElement.toDataURL('image/jpeg',.91).split(',')[1]};
  },
  aircraftList:()=>world.interactables.filter(a=>/^(board-aircraft-|rio-aircraft-)/.test(a.id)).map(a=>{const id=a.id.replace(/^(board-aircraft-|rio-aircraft-)/,'');const p=campaignAircraftPose(id);return {id,context:a.id,mode:p?.mode||id,label:p?.label||a.label,pose:p};}).filter(a=>a.pose&&Number.isFinite(a.pose.x)&&Number.isFinite(a.pose.z)),
  aircraftApproach:id=>{const a=world.interactables.find(a=>a.id==='board-aircraft-'+id||a.id==='rio-aircraft-'+id);if(!a)return {ok:false,reason:'missing interactable',available:window.__FILM.aircraftList()};const p=filmPoint(a);for(const r of [4,5,3,6,2,1,0])for(let i=0;i<16;i++){const angle=i*Math.PI/8;window.__FILM.move(p.x+Math.cos(angle)*r,p.z+Math.sin(angle)*r);if(currentContext?.id===a.id)return {ok:true,id:a.id};}return {ok:false,actual:currentContext?.id,pose:p};},
  cableDock:()=>{const p=((airNow()/1000)%112+112)%112;cityQaMs+=((1-p+112)%112)*1000;updateCivilCommunity();},
  flightControl:(power,pitch=0)=>{if(!otGames.active)return false;otGames.collective=power;otGames.move.y=pitch;return true;},
  activityCamera:()=>{const a=characterActivities.session;return a?{kind:a.kind,phase:a.phase}:null;},
  runStart:()=>{filmRaceGate=0;cameraYaw=0;input.touchSprint=true;},
  movement:(x,z,sprint=false)=>{clearMovementInputs();cameraYaw=0;input.joyId=1;input.joyX=x;input.joyZ=z;input.touchSprint=sprint;},
  busBoard:()=>{for(let i=0;i<1800;i++){const b=world.buses.find(busAtStop);if(b){OTTHOS_TEST_API.teleport(b.group.position.x+1.5,b.group.position.z);return enterBus(b);}cityQaMs+=1000/60;stepWorldSimulation(1/60);}return false;},
  transit:()=>({...player.transit}),
  missionTarget:()=>civilAvailableTarget(),
  advance:(n)=>{for(let i=0;i<n;i++){cityQaMs+=1000/60;stepWorldSimulation(1/60);}},
  activityEvidence:()=>({player:{x:player.x,y:player.y,z:player.z,swimming:player.swimming},session:OT_CHARACTER_ACTIVITIES.diagnostics().session,completed:OT_CHARACTER_ACTIVITIES.diagnostics().completed,lastAction:OT_CHARACTER_ACTIVITIES.diagnostics().lastAction,coins:state.profile.coins,needs:{...state.needs},race:!!activeRace,boat:OTTHI_DESTINATIONS.diagnostics().activeBoat,air:OT_GAMES.diagnostics(),transit:{...player.transit}}),
  startTake:(options,seconds)=>{
   window.__filmTake?.stop();let running=true,timer=0,last=performance.now(),start=last,count=0,error=null;
   const tick=()=>{if(!running)return;try{
    const now=performance.now(),elapsed=Math.max(1/60,Math.min(.12,(now-last)/1000));last=now;
    const progress=Math.min(1,(now-start)/(seconds*1000));
    const meta=window.__FILM.frame({...options,angle:(options.angle||0)+(options.sweep||0)*progress,steps:Math.max(1,Math.round(elapsed*60))});
    if(meta.width!==640||meta.height!==360)throw Error('Native buffer '+meta.width+'x'+meta.height);
    count++;timer=requestAnimationFrame(tick);
   }catch(e){error=String(e.stack||e);running=false;}};
   window.__filmTake={stop:()=>{running=false;cancelAnimationFrame(timer);return {rendered:count,error};}};
   timer=requestAnimationFrame(tick);
  },
  stopTake:()=>window.__filmTake?.stop(),
  workshop:(mode)=>{const l=world.workshopLifts[0],v=vehicleById('garage-orange');if(!l||!v)return false;workshopSelectBay(l);return mode==='stage'?workshopStageParkedVehicle(v):workshopRaiseLift();},
  workshopStatus:()=>OT_WORKSHOP_BAYS.diagnostics(),
  workshopFocus:()=>{const l=world.workshopLifts[0];return {x:l.x,z:l.z};},
  workshopCamera:(angle)=>{cameraYaw=angle;cameraPitch=.42;cameraZoom=0;},
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
 context=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await context.route(/^https?:\/\//,r=>new URL(r.request().url()).origin===server.origin?r.continue():r.abort());
 await context.addInitScript(()=>localStorage.setItem('otthos_life_world_roleplay_v700',JSON.stringify({version:705,profile:{name:'OTThi Demo',nameConfirmed:true,coins:500000,playerId:'director-local'},inventory:{food:12},settings:{quality:'low',sound:false,lastWorldMap:'rio-preto'},flags:{accountPromptedV635:true},guardian:{sessionLimitMinutes:0}})));
 page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(String(e.stack)));
 await installCityInspection(page,{appSource:app,capDuringBoot:true});
 await page.goto(server.origin+'/games/otthi/?map=rio-preto',{waitUntil:'domcontentloaded'});
 await page.locator('#playBtn').click();
 await page.waitForFunction(()=>window.__FILM?.ready()&&window.__CITY_QA?.cap(),null,{timeout:180000});
 await page.waitForFunction(()=>window.OT_WORLD_AIRPORT?.diagnostics().ready&&window.OTTHI_FAMILY?.diagnostics().ready,null,{timeout:90000});
 await page.evaluate(()=>{if(document.querySelector('[data-journey-explore]')?.offsetWidth)document.querySelector('[data-journey-explore]').click();__FILM.clean();__FILM.stop();});
}
async function clip(id,view,opts={},seconds=3){
 const path=out+'/'+safe(id)+'--'+safe(view)+'.mp4',tmp=path+'.tmp.mp4',dir=path+'.frames';mkdirSync(dir,{recursive:true});
 const {createHash}=await import('node:crypto');const total=Math.round(seconds*FPS),hashes=new Set();
 const before=await page.evaluate(()=>__FILM.activityEvidence());const start=Date.now();
 for(let i=0;i<total;i++){
   const m=await page.evaluate(o=>__FILM.frame(o),{...opts,view,angle:(opts.angle||0)+(opts.sweep||0)*i/Math.max(1,total-1),steps:3});
   if(m.width!==W||m.height!==H)throw Error('Native buffer '+m.width+'x'+m.height);
   // Capture WebGL synchronously after render; use the compositor only for actual UI scenes.
   let data=opts.ui?await page.screenshot({type:'jpeg',quality:90,scale:'css'}):Buffer.from(m.jpeg,'base64');if(data.length<3000&&!opts.ui){await page.evaluate(()=>__CITY_QA.renderNative());data=await page.screenshot({type:'jpeg',quality:90,scale:'css'});}
   if(data.length<3000)throw Error('Empty rendered frame');
   hashes.add(createHash('sha256').update(data).digest('hex'));
   writeFileSync(dir+'/'+String(i).padStart(5,'0')+'.jpg',data);
 }
 const after=await page.evaluate(()=>__FILM.activityEvidence());
 if(!opts.ui&&hashes.size<Math.ceil(total*.9))throw Error('Repeated frames: '+hashes.size+'/'+total);
 execFileSync('ffmpeg',['-nostdin','-v','error','-y','-framerate',String(FPS),'-i',dir+'/%05d.jpg','-an','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',tmp],{timeout:120000});
 const v=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,nb_frames','-of','json',tmp],{encoding:'utf8'})).streams[0];if(v.width!==W||v.height!==H||Number(v.nb_frames)!==total)throw Error('Invalid MP4 dimensions/frame count');
 execFileSync('ffmpeg',['-nostdin','-v','error','-xerror','-i',tmp,'-f','null','-'],{timeout:120000});renameSync(tmp,path);rmSync(dir,{recursive:true,force:true});
 const item={id,view,file:path.split('/').pop(),frames:total,distinct:hashes.size,seconds,wallSeconds:(Date.now()-start)/1000,before,after};report.scenes.push(item);save();console.log('AVENTURA_MP4',id,view,hashes.size+'/'+total);return item;
}
const subset=rows=>rows.filter((_,i)=>i%shards===shard);
async function place(p){
 await page.evaluate(p=>{__FILM.clean();__FILM.move(p.navX,p.navZ);},p);
 const radius=/hotel|castel|mans|shopping|porto|aeroporto/i.test(p.label)?24:12;
 await clip(p.id,'orbit',{x:p.x,z:p.z,radius,angle:-.8,sweep:1.5});
 await clip(p.id,'aerial',{x:p.x,z:p.z,radius:radius*1.5,angle:.8,sweep:1.1});
 await clip(p.id,'native',{},2);
}
async function action(a,{keepMenu=false}={}){
 const ready=await page.evaluate(id=>{__FILM.clean();return __FILM.approach(id);},a.id);
 if(!ready.ok){report.scenes.push({id:a.id,status:'not-executed',reason:ready.reason,actual:ready.actual});save();return;}
 await clip(a.id,'native',{},1);
 const invoked=await page.evaluate(id=>__FILM.invoke(id),a.id);
 if(!invoked){report.scenes.push({id:a.id,status:'not-executed',reason:'native action refused'});save();return;}
 await clip(a.id,'native-action',{},5);
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
 if(!keepMenu)await page.evaluate(()=>__FILM.clean());
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
async function use(id){
 const r=await page.evaluate(id=>{__FILM.clean();return __FILM.approach(id);},id);
 if(!r.ok)throw Error('Context unavailable '+id+' '+JSON.stringify(r));
 if(!await page.evaluate(id=>__FILM.invoke(id),id))throw Error('Action refused '+id);
}
async function click(selector){await page.locator(selector).first().click({timeout:12000});}
async function waitSim(predicate,arg,maxSeconds=45){
 for(let i=0;i<maxSeconds*5;i++){
  if(await page.evaluate(predicate,arg))return;
  await page.evaluate(()=>__FILM.advance(12));
  await page.waitForTimeout(20);
 }
 throw Error('Simulation condition not reached: '+predicate.toString());
}
async function runScene(id,fn){
 const start=report.scenes.length;
 try{await boot();await fn();report.scenes.push({id,status:'sequence-verified'});}
 catch(e){for(const row of report.scenes.slice(start)){if(row.file){rmSync(out+'/'+row.file,{force:true});row.rejectedFile=row.file;delete row.file;row.status='rejected-sequence';}}report.errors.push(id+': '+e.message);console.error('SCENE_FAILED',id,e.message);}
 finally{save();}
}
try{
 if(category.startsWith('voo-')){
  const mode=category.slice(4);
  await boot();
  const fleet=await page.evaluate(()=>__FILM.aircraftList());
  writeFileSync(out+'/frota-real.json',JSON.stringify(fleet,null,2));
  console.log('NATIVE_AIRCRAFT',JSON.stringify(fleet.map(x=>({id:x.id,mode:x.mode,context:x.context}))));
  const rows=fleet.filter(v=>v.mode===mode);
  if(!rows.length)throw Error('No boardable aircraft for '+mode);
  for(const v of rows)await runScene(v.id,async()=>{
   const result=await page.evaluate(id=>__FILM.aircraftApproach(id),v.id);if(!result.ok)throw Error('Boarding context '+JSON.stringify(result));
   await click('#actionBtn');await waitSim(id=>OT_GAMES.diagnostics().active&&OT_GAMES.diagnostics().aircraftId===id,v.id,20);
   const plane=mode==='plane',initial=await page.evaluate(()=>OT_GAMES.diagnostics());
   await page.evaluate(plane=>__FILM.flightControl(plane?1:.85,plane?.45:0),plane);
   const p=await clip(v.id,'decolagem',{},plane?8:6);
   if(!p.after.air.active||p.after.air.body.y<initial.body.y+1)throw Error('Climb not proven');
   await page.evaluate(plane=>__FILM.flightControl(plane?.7:.55,0),plane);
   await clip(v.id,'orbit-flight',{followPlayer:true,radius:mode==='balloon'?23:13,angle:.8,sweep:1.4},5);
   report.scenes.push({id:v.id,status:'flight-verified',altitudeBefore:initial.body.y,altitudeAfter:p.after.air.body.y});
  });
 }else if(category==='oficina'){
  await runScene('oficina-elevador',async()=>{
   if(!await page.evaluate(()=>__FILM.workshop('stage')))throw Error('Workshop staging refused');
   if(!await page.evaluate(()=>__FILM.workshop('raise')))throw Error('Lift refused');
   await clip('oficina','elevacao',{},8);
   await waitSim(()=>OT_WORKSHOP_BAYS.diagnostics().bays[0].raised&&!OT_WORKSHOP_BAYS.diagnostics().bays[0].busy,null,30);
   report.workshop=await page.evaluate(()=>__FILM.workshopStatus());
   save();
  });
  // A different camera take is independently verified; do not discard a successful lift sequence if a second take fails.
  await runScene('oficina-inspecao',async()=>{
   if(!await page.evaluate(()=>__FILM.workshop('stage')))throw Error('Workshop staging refused');
   if(!await page.evaluate(()=>__FILM.workshop('raise')))throw Error('Lift refused');
   await waitSim(()=>OT_WORKSHOP_BAYS.diagnostics().bays[0].raised&&!OT_WORKSHOP_BAYS.diagnostics().bays[0].busy,null,30);
   await clip('oficina','workshop-sweep',{angle:-1.4,sweep:2.8},6);
  });
 }else throw Error('Unknown chapter');
 report.completed=report.errors.length===0;
 if(!report.completed||!report.scenes.some(x=>x.file))process.exitCode=1;
}catch(e){report.errors.push(String(e.stack));process.exitCode=1;}
finally{save();await browser.close();await server.close();}
