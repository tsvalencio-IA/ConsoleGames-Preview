/* Real native frame samples. Disposable local profile; never contact production. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {multiplayerServer} from './helpers/multiplayer-browser-fixture.mjs';
import {installCityInspection} from './helpers/world-city-inspection.mjs';
const out=process.env.OT_RENDER_OUT||'test-results/render-stability';fs.mkdirSync(out,{recursive:true});
const server=await multiplayerServer(),browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={cases:[],limits:['Software WebGL, controlled camera and fixed poses, not a physical mobile FPS measurement.','Aerial views exercise the real scenery policy at fixed aircraft positions without piloting.']};
const aerialViews=[
 ['cidade-e-represa',[480,240,-65],[-115,0,85]],
 ['litoral-e-serra',[25,245,50],[-270,10,445]],
];
const hook=`
// Visual comparison is frozen at the same controls-ready boundary in both revisions.
// The independent live benchmark still uses the complete, uncapped game loop.
let stabilityControlsReady=false;
gameLoop=function(){stabilityControlsReady=true;};
function stabilityFrame(){
 const t=performance.now();__CITY_QA.renderNative();
 return {ms:performance.now()-t,seen:world.criticalSurfaces.filter(o=>o.visible).length,draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,programs:renderer.info.programs.length,error:renderer.getContext().getError(),png:renderer.domElement.toDataURL('image/png').split(',')[1]};
}
window.__STABILITY_QA={
 ready:()=>stabilityControlsReady,
 stop:()=>{cancelAnimationFrame(raf);__CITY_QA.cap();},
 inspect:()=>({ground:world.worldEvolution?.groundRecovery?.position.y,groundTop:world.worldEvolution?.groundRecovery?.position.y+world.worldEvolution?.groundRecovery?.geometry.parameters.height/2,baseMatches:world.baseGround===world.worldEvolution?.groundRecovery,depthBits:renderer.getContext().getParameter(renderer.getContext().DEPTH_BITS),critical:world.criticalSurfaces.length,npcs:world.npcs.length,vehicles:world.vehicles.length,interactables:world.interactables.length,actionIds:world.interactables.map(o=>String(o.id||'')).sort(),npcIds:world.npcs.map(o=>String(o.id||o.name||'')).sort()}),
 frame:(label,index)=>{
  const lake=world.reservoir?.main;
  let x,z,y,angle=.4+index*.012;
  if(label==='represa'){x=lake?.x??-88;z=lake?.z??54;y=8;}
  else if(label==='aeroporto'){x=91;z=-216;y=25;}
  else{x=16;z=189;y=30;}
  OTTHOS_TEST_API.teleport(x,z);playerGroup.position.set(player.x,player.y,player.z);
  camera.position.set(x+Math.sin(angle)*22,groundHeightAt(x,z)+y,z+Math.cos(angle)*22);
  camera.lookAt(x,groundHeightAt(x,z),z);camera.near=.05;camera.far=1200;camera.fov=58;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  updateVisualLOD();return stabilityFrame();
 },
 aerialFrame:(eye,target)=>{
  const priorMode={active:otGames.active,mode:otGames.mode,body:otGames.body,armed:otGames.armed,onGround:otGames.onGround};
  const originalFar=camera.far;
  try{
   const [x,y,z]=eye;
   Object.assign(otGames,{active:true,mode:'helicopter',armed:false,onGround:false,body:{x,y,z,yaw:0,pitch:0}});
   worldExpansion.lastLod=-Infinity;compactRio.nextUpdate=-Infinity;
   updateWorldExpansion();updateWorldCampaign(0);updateCompactRio(.09,player);updateOttoviasVisibility(true);
   camera.position.set(x,y,z);
   camera.lookAt(...target);camera.near=1.5;camera.far=1200;camera.fov=66;
   if(typeof syncWorldFlightHorizon==='function')syncWorldFlightHorizon();
   camera.updateProjectionMatrix();camera.updateMatrixWorld(true);updateVisualLOD();
   // Count meshes actually submitted by WebGL from the specified roots.
   const roots=[
    ['cidade',worldExpansion.groups],['marcos',worldCampaign.landmarks.map(item=>item.root)],
    ['serra',cordillera.chunks.map(item=>item.mesh)],['represa',[rioMap.waterfront?.group]],
    ['litoral',[rioMap.coastalDock?.group]],
   ];
   const drawn=Object.fromEntries(roots.map(([id])=>[id,0])),restore=[];
   for(const [id,groups] of roots)for(const root of groups)root?.traverse(node=>{
    if(!node.isMesh)return;
    const previous=node.onBeforeRender;
    node.onBeforeRender=function(...args){drawn[id]++;previous.apply(this,args);};
    restore.push(()=>{node.onBeforeRender=previous;});
   });
   try{return {...stabilityFrame(),eye,target,drawn,cameraFar:camera.far,fogFar:scene.fog?.far};}
   finally{for(const undo of restore)undo();}
  }finally{
   Object.assign(otGames,priorMode);
   camera.far=originalFar;
   if(typeof syncWorldFlightHorizon==='function')syncWorldFlightHorizon();
  }
 }
};`;
try{
 for(const [label,ref]of [['before',process.env.OT_RENDER_BASELINE],['after',null]]){
  const source=ref?execFileSync('git',['show',ref+':games/otthi/app.js'],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(process.env.OT_RENDER_CANDIDATE_APP||'games/otthi/app.js','utf8');
  const end=source.lastIndexOf('})();');assert(end>0);
  const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await ctx.route(url=>url.protocol==='https:'||url.protocol==='http:',r=>new URL(r.request().url()).origin===server.origin?r.continue():r.abort());
  await ctx.addInitScript(()=>{let seed=921;Math.random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};localStorage.setItem('otthos_life_world_roleplay_v700',JSON.stringify({version:705,profile:{name:'QA stability',nameConfirmed:true,playerId:'qa-stability'},avatar:{bodyStyle:'family-thiago'},flags:{accountPromptedV635:true},settings:{quality:'low',sound:false,lastWorldMap:'rio-preto'},guardian:{sessionLimitMinutes:0}}));});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e.stack)));
  await installCityInspection(page,{revision:ref||null,appSource:source.slice(0,end)+hook+source.slice(end),capDuringBoot:true});
  await page.goto(server.origin+'/games/otthi/?map=rio-preto',{waitUntil:'domcontentloaded'});await page.locator('#playBtn').click();
  await page.waitForFunction(()=>OTTHOS_TEST_API.getGame().running&&OTTHI_FAMILY.diagnostics().ready&&__STABILITY_QA.ready()&&__CITY_QA.cap(),null,{timeout:180000});
  await page.evaluate(()=>__STABILITY_QA.stop());const row={label,world:await page.evaluate(()=>__STABILITY_QA.inspect()),frames:[],aerialFrames:[]};
  const places=process.env.OT_RENDER_AERIAL_ONLY==='1'?[]:['represa','aeroporto','serra'];
  for(const place of places)for(let i=0;i<12;i++){
   const f=await page.evaluate(([p,j])=>__STABILITY_QA.frame(p,j),[place,i]);const png=Buffer.from(f.png,'base64');delete f.png;assert(png.length>2000,'nonempty native frame');fs.writeFileSync(out+'/'+label+'-'+place+'-'+String(i).padStart(2,'0')+'.png',png);row.frames.push({place,i,...f});
  }
  for(const [place,eye,target] of aerialViews){
   const f=await page.evaluate(([eye,target])=>__STABILITY_QA.aerialFrame(eye,target),[eye,target]);
   const png=Buffer.from(f.png,'base64');delete f.png;assert(png.length>2000,'nonempty native aerial frame');
   fs.writeFileSync(out+'/'+label+'-voo-'+place+'.png',png);row.aerialFrames.push({place,...f});
  }
  row.errors=errors;report.cases.push(row);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log('RENDER_STABILITY',label,JSON.stringify(row.world));assert.deepEqual(errors,[]);assert(row.frames.every(f=>f.error===0),'WebGL errors');
  assert(row.aerialFrames.every(f=>f.error===0),'WebGL errors in aircraft view');
  if(label==='after'){
   assert(row.world.baseMatches,'original floor reused');assert.equal(row.world.groundTop,0);
   assert(row.aerialFrames.every(f=>f.cameraFar>2500&&f.fogFar===f.cameraFar),'clear aerial sky must keep the full projection range');
   assert(row.aerialFrames[0].drawn.cidade>0&&row.aerialFrames[0].drawn.represa>0,'distant Costa Verde and the reservoir must draw');
   assert(row.aerialFrames[1].drawn.litoral>0&&row.aerialFrames[1].drawn.serra>0,'coastal waterfront and the mountains must draw');
  }
  await ctx.close();
 }
 assert.equal(report.cases[1].world.npcs,report.cases[0].world.npcs);assert.equal(report.cases[1].world.vehicles,report.cases[0].world.vehicles);assert.equal(report.cases[1].world.interactables,report.cases[0].world.interactables);assert.deepEqual(report.cases[1].world.actionIds,report.cases[0].world.actionIds,'all interaction identities retained');assert.deepEqual(report.cases[1].world.npcIds,report.cases[0].world.npcIds,'all NPC identities retained');
}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();await server.close();}
