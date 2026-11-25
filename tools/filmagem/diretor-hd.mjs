import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,existsSync,statSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {multiplayerServer} from '../../tests/helpers/multiplayer-browser-fixture.mjs';
import {installCityInspection} from '../../tests/helpers/world-city-inspection.mjs';

const category=process.env.FILM_CATEGORY||'pilot';
const shard=Number(process.env.FILM_SHARD||0),shards=Number(process.env.FILM_SHARDS||1);
const out=resolve('filmagem-hd',category+'-'+shard);
mkdirSync(out,{recursive:true});
const FPS=30, W=1920,H=1080;
const report={category,shard,shards,format:{width:W,height:H,fps:FPS,method:'unique rendered frames, fixed simulation steps'},scenes:[],errors:[],limits:['Offline profile and position between scenes.','Camera angles use the real game scene.','Menu visibility is not proof that its options were executed.','No native audio in this frame-by-frame version.']};
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
  return {places:[...locations.values()],actions:filmRows(),npcs:world.npcs.map((n,i)=>({id:n.id||String(i),index:i,label:n.name||n.label||n.id||'NPC '+i,x:n.group.position.x,z:n.group.position.z})),vehicles:OTTHI_PLAYER_VEHICLE_CATALOG.map(v=>({id:v.id,label:v.label||v.id,category:v.category,model:v.model})),boats:Array.from(world.boats.values()).map(b=>({id:b.id,label:b.label,kind:b.kind,x:b.group.position.x,z:b.group.position.z})),air:OT_WORLD_AIRPORT.diagnostics().fleet,controls:[...document.querySelectorAll('#game button')].map(b=>({id:b.id,label:b.getAttribute('aria-label')||b.textContent.trim()})).filter(b=>b.id||b.label)};
 }
 window.__FILM={
  ready:()=>running&&worldInitializationReady&&!!renderer,
  stop:()=>{cancelAnimationFrame(raf);targetDpr=()=>2;state.settings.quality='high';applyAdaptiveRenderSettings(true);applyPendingRenderBuffer();},
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
  frame:({view='native',x,z,radius=12,angle=0,steps=2,npc=null}={})=>{
   cancelAnimationFrame(raf);
   for(let i=0;i<steps;i++){cityQaMs+=1000/60;stepWorldSimulation(1/60);}
   if(npc!==null){const p=world.npcs[npc]?.group?.position;if(p){x=p.x;z=p.z;}}
   const m=viewportMetrics();renderer.setDrawingBufferSize(m.w,m.h,2);perf.pendingRenderBuffer=null;camera.aspect=m.w/m.h;
   if(view==='orbit'||view==='aerial'){
    const y=groundHeightAt(x,z),h=view==='aerial'?radius*.85:Math.max(2,radius*.26);
    camera.position.set(x+Math.sin(angle)*radius,y+h,z+Math.cos(angle)*radius);
    camera.up.set(0,1,0);camera.lookAt(x,y+1.7,z);camera.fov=55;camera.near=.08;camera.far=1800;
   }else{updateCamera(1/30);}
   camera.updateProjectionMatrix();__CITY_QA.renderNative();
   return {width:renderer.domElement.width,height:renderer.domElement.height,player:{x:player.x,z:player.z},tier:qualityTier(),context:currentContext?.id||null};
  },
  drive:(x,z)=>OTTHOS_TEST_API.setDriveInput(x,z),
  resetRideCamera:()=>resetVehicleView(),
  rideCamera:(inside,angle)=>{const ride=vehicleViewRide();if(!ride)return false;beginVehicleOrbit();vehicleView.inside=inside;vehicleView.snap=true;cameraYaw=angle;cameraPitch=inside?.035:.28;return true;},
  dealer:id=>openDealer(id)
 };
 `;
const app=source.slice(0,end)+hook+source.slice(end);
const server=await multiplayerServer(),browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let context,page;
const safe=s=>String(s).replace(/[^a-zA-Z0-9_.-]+/g,'_').slice(0,100);
async function boot(){
 if(context)await context.close();
 context=await browser.newContext({viewport:{width:960,height:540},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
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
 const path=out+'/'+safe(id)+'--'+safe(view)+'.mp4',tmp=path+'.tmp.mp4';
 const ff=spawn('ffmpeg',['-nostdin','-v','error','-y','-f','image2pipe','-vcodec','png','-framerate',String(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',tmp],{stdio:['pipe','ignore','inherit']});
 const exit=once(ff,'close');ff.stdin.on('error',()=>{});
 const total=Math.round(seconds*FPS);let done=0;
 try{
  for(let i=0;i<total;i++){
   const meta=await page.evaluate(o=>__FILM.frame(o),{...opts,view,angle:(opts.angle||0)+(opts.sweep||0)*i/Math.max(1,total-1)});
   if(meta.width!==W||meta.height!==H)throw Error('Native WebGL buffer is '+meta.width+'x'+meta.height+', not Full HD');
   const png=await page.screenshot({type:'png',scale:'device',animations:'allow',timeout:30000});
   if(png.readUInt32BE(16)!==W||png.readUInt32BE(20)!==H)throw Error('Captured pixel dimensions incorrect');
   if(!ff.stdin.write(png))await once(ff.stdin,'drain');done++;
  }
 }finally{ff.stdin.end();const [code]=await exit;if(code!==0||done!==total)throw Error('Encoding incomplete: '+done+'/'+total+' frames, exit '+code);}
 const meta=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,nb_frames,r_frame_rate','-of','json',tmp],{encoding:'utf8'})).streams[0];
 if(meta.width!==W||meta.height!==H||Number(meta.nb_frames)!==total)throw Error('Encoded frame count/dimensions mismatch');
 execFileSync('ffmpeg',['-nostdin','-v','error','-xerror','-i',tmp,'-f','null','-']);
 const {renameSync}=await import('node:fs');renameSync(tmp,path);
 const item={id,view,file:path.split('/').pop(),frames:total,width:W,height:H,bytes:statSync(path).size,seconds};report.scenes.push(item);save();console.log('HD_CLIP_OK',JSON.stringify(item));return item;
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
 await page.evaluate(()=>__FILM.clean());
}
try{
 await boot();const catalog=await page.evaluate(()=>__FILM.inventory());writeFileSync(out+'/catalogo.json',JSON.stringify(catalog,null,2));console.log('CATALOG',JSON.stringify(Object.fromEntries(Object.entries(catalog).map(([k,v])=>[k,v.length]))));
 if(category==='pilot'){
  const p=catalog.places.find(p=>p.id==='regional-campos-mansao-1')||catalog.places.find(p=>p.id==='marina-costa');if(!p)throw Error('Pilot destination absent');
  await place(p);const a=catalog.actions.find(a=>a.id===p.id+'-door');if(a)await action(a);
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
