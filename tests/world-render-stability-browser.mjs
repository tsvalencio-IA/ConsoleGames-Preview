/* Real native frame samples. Disposable local profile; never contact production. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {multiplayerServer} from './helpers/multiplayer-browser-fixture.mjs';
import {installCityInspection} from './helpers/world-city-inspection.mjs';
const out='test-results/render-stability';fs.mkdirSync(out,{recursive:true});
const server=await multiplayerServer(),browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={cases:[],limits:['Software WebGL, controlled camera and fixed poses, not a physical mobile FPS measurement.']};
const hook=`
window.__STABILITY_QA={
 stop:()=>{cancelAnimationFrame(raf);__CITY_QA.cap();},
 inspect:()=>({ground:world.worldEvolution?.groundRecovery?.position.y,groundTop:world.worldEvolution?.groundRecovery?.position.y+world.worldEvolution?.groundRecovery?.geometry.parameters.height/2,baseMatches:world.baseGround===world.worldEvolution?.groundRecovery,depthBits:renderer.getContext().getParameter(renderer.getContext().DEPTH_BITS),critical:world.criticalSurfaces.length,npcs:world.npcs.length,vehicles:world.vehicles.length,interactables:world.interactables.length}),
 frame:(label,index)=>{
  const lake=world.reservoir?.main,airport=worldAirport?.root;
  let x,z,y,angle=.4+index*.012;
  if(label==='represa'){x=lake?.x??-88;z=lake?.z??54;y=8;}
  else if(label==='aeroporto'){x=91;z=-216;y=25;}
  else{x=16;z=189;y=30;}
  OTTHOS_TEST_API.teleport(x,z);playerGroup.position.set(player.x,player.y,player.z);
  camera.position.set(x+Math.sin(angle)*22,groundHeightAt(x,z)+y,z+Math.cos(angle)*22);
  camera.lookAt(x,groundHeightAt(x,z),z);camera.near=.05;camera.far=1200;camera.fov=58;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  updateVisualLOD();const t=performance.now();__CITY_QA.renderNative();const ms=performance.now()-t;
  const seen=world.criticalSurfaces.filter(o=>o.visible).length,gl=renderer.getContext();
  return {ms,seen,draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,programs:renderer.info.programs.length,error:gl.getError(),png:renderer.domElement.toDataURL('image/png').split(',')[1]};
 }
};`;
try{
 for(const [label,ref]of [['before',process.env.OT_RENDER_BASELINE],['after',null]]){
  const source=ref?execFileSync('git',['show',ref+':games/otthi/app.js'],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync('games/otthi/app.js','utf8');
  const end=source.lastIndexOf('})();');assert(end>0);
  const ctx=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await ctx.route(/^https?:\\/\\//,r=>new URL(r.request().url()).origin===server.origin?r.continue():r.abort());
  await ctx.addInitScript(()=>{let seed=921;Math.random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};localStorage.setItem('otthos_life_world_roleplay_v700',JSON.stringify({version:705,profile:{name:'QA stability',nameConfirmed:true,playerId:'qa-stability'},avatar:{bodyStyle:'family-thiago'},flags:{accountPromptedV635:true},settings:{quality:'low',sound:false,lastWorldMap:'rio-preto'},guardian:{sessionLimitMinutes:0}}));});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e.stack)));
  await installCityInspection(page,{revision:ref||null,appSource:source.slice(0,end)+hook+source.slice(end),capDuringBoot:true});
  await page.goto(server.origin+'/games/otthi/?map=rio-preto',{waitUntil:'domcontentloaded'});await page.locator('#playBtn').click();
  await page.waitForFunction(()=>OTTHOS_TEST_API.getGame().running&&OTTHI_FAMILY.diagnostics().ready&&__CITY_QA.cap(),null,{timeout:180000});
  await page.evaluate(()=>__STABILITY_QA.stop());const row={label,world:await page.evaluate(()=>__STABILITY_QA.inspect()),frames:[]};
  for(const place of ['represa','aeroporto','serra'])for(let i=0;i<12;i++){
   const f=await page.evaluate(([p,j])=>__STABILITY_QA.frame(p,j),[place,i]);const png=Buffer.from(f.png,'base64');delete f.png;assert(png.length>2000,'nonempty native frame');fs.writeFileSync(out+'/'+label+'-'+place+'-'+String(i).padStart(2,'0')+'.png',png);row.frames.push({place,i,...f});
  }
  row.errors=errors;report.cases.push(row);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log('RENDER_STABILITY',label,JSON.stringify(row.world));assert.deepEqual(errors,[]);assert(row.frames.every(f=>f.error===0),'WebGL errors');
  if(label==='after'){assert(row.world.baseMatches,'original floor reused');assert.equal(row.world.groundTop,0);}
  await ctx.close();
 }
 assert.equal(report.cases[1].world.npcs,report.cases[0].world.npcs);assert.equal(report.cases[1].world.vehicles,report.cases[0].world.vehicles);assert.equal(report.cases[1].world.interactables,report.cases[0].world.interactables);
}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();await server.close();}
