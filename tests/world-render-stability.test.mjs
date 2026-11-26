import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=n=>fs.readFileSync('games/otthi/src/modules/'+n,'utf8');
test('grass recovery upgrades the one base surface without adding overlapping geometry',()=>{
 const parent={},old={parent,material:{old:true},position:{y:-.15},userData:{},geometry:{parameters:{height:.3}}},material={upgraded:true},world={baseGround:old,criticalSurfaces:[old]};
 const ctx=vm.createContext({world,worldGroup:parent,v702TextureMaterial:()=>material});
 const s=read('40-world-evolution-v702.js');
 vm.runInContext(s.slice(s.indexOf('  function createV702GroundRecovery(){'),s.indexOf('  function terrainVertexColor(')),ctx);
 assert.equal(ctx.createV702GroundRecovery(),true);assert.equal(world.worldEvolution.groundRecovery,old);assert.equal(old.material,material);
 assert.equal(world.criticalSurfaces.length,1);assert.equal(old.position.y+old.geometry.parameters.height/2,0);
 assert.equal(old.userData.alwaysVisible,true);assert.equal(ctx.createV702GroundRecovery(),false);
 const build=read('20-world-build-cloud-houses.js');assert.match(build,/world\.baseGround=ground/);
});
test('critical surface culling uses transformed geometry center and hysteresis',()=>{
 const s=read('09-responsive-ar-quality-diagnostics.js');const body=s.slice(s.indexOf('  function updateCriticalSurfaceDistanceVisibility(){'),s.indexOf('  function updateDynamicEntityVisibility(){'));
 class V{constructor(x=0,y=0,z=0){this.set(x,y,z)}set(x,y,z){Object.assign(this,{x,y,z});return this}copy(v){return this.set(v.x,v.y,v.z)}applyMatrix4(m){this.x+=m.x||0;this.y+=m.y||0;this.z+=m.z||0;return this}setFromMatrixScale(){return this.set(1,1,1)}}
 const focus={x:0,z:0},mesh={parent:{},geometry:{boundingSphere:{center:new V(100,0,0),radius:2}},matrix:{x:-100},userData:{},visible:true},world={criticalSurfaces:[mesh]},perf={};
 const ctx=vm.createContext({world,perf,player:focus,performanceDistanceRanges:()=>({critical:52}),visualWorldMatrix:m=>m.matrix,distanceCullPosition:new V(),distanceCullScale:new V()});
 vm.runInContext(body,ctx);
 ctx.updateCriticalSurfaceDistanceVisibility();assert.equal(mesh.visible,true,'actual geometry is close despite remote origin');
 focus.x=60;ctx.updateCriticalSurfaceDistanceVisibility();assert.equal(mesh.visible,true,'hysteresis retains visible surface');
 focus.x=70;ctx.updateCriticalSurfaceDistanceVisibility();assert.equal(mesh.visible,false);
 focus.x=60;ctx.updateCriticalSurfaceDistanceVisibility();assert.equal(mesh.visible,false,'no threshold oscillation');
 focus.x=50;ctx.updateCriticalSurfaceDistanceVisibility();assert.equal(mesh.visible,true);
});
