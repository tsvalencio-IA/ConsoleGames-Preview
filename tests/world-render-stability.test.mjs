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
 const ctx=vm.createContext({world,perf,player:focus,worldFlightHorizon:()=>0,performanceDistanceRanges:()=>({critical:52}),visualWorldMatrix:m=>m.matrix,distanceCullPosition:new V(),distanceCullScale:new V()});
 vm.runInContext(body,ctx);
 ctx.updateCriticalSurfaceDistanceVisibility();assert.equal(mesh.visible,true,'actual geometry is close despite remote origin');
 focus.x=60;ctx.updateCriticalSurfaceDistanceVisibility();assert.equal(mesh.visible,true,'hysteresis retains visible surface');
 focus.x=70;ctx.updateCriticalSurfaceDistanceVisibility();assert.equal(mesh.visible,false);
 focus.x=60;ctx.updateCriticalSurfaceDistanceVisibility();assert.equal(mesh.visible,false,'no threshold oscillation');
 focus.x=50;ctx.updateCriticalSurfaceDistanceVisibility();assert.equal(mesh.visible,true);
});

test('civil flight horizon covers the map and restores the ground camera',()=>{
 const s=read('09-responsive-ar-quality-diagnostics.js'),camera={far:1200,updates:0,updateProjectionMatrix(){this.updates++}},scene={fog:{near:210,far:520}},otGames={active:true,mode:'helicopter',body:{y:90}},rioClimate={kind:'clear'};
 const ctx=vm.createContext({camera,scene,otGames,rioClimate,v704WorldSize:()=>({w:1700,d:1800})});
 vm.runInContext(s.slice(s.indexOf('  function worldFlightHorizon(){'),s.indexOf('  function updateCriticalSurfaceDistanceVisibility(){')),ctx);
 ctx.syncWorldFlightHorizon();assert(camera.far>2500);assert.equal(scene.fog.far,camera.far);const far=camera.far;otGames.body.y=100;ctx.syncWorldFlightHorizon();assert.equal(camera.far,far);assert.equal(camera.updates,1);
 otGames.active=false;ctx.syncWorldFlightHorizon();assert.equal(camera.far,1200);assert.equal(scene.fog.near,210);assert.equal(scene.fog.far,520);
 otGames.active=true;otGames.mode='ground';assert.equal(ctx.worldFlightHorizon(),0);
});
test('road and grass retain a patterned surface when texture download fails',()=>{
 const s=read('33-otthi-world-professional-core.js');
 const ctx=vm.createContext({document:{createElement:()=>({getContext:()=>({fillRect(){}})})},THREE:{CanvasTexture:class{},ImageLoader:class{load(path,ok,progress,fail){fail(new Error('missing'));}}},canvasTexture:(pack,colors)=>({image:{width:256,height:256},pack,colors}),OTTHI_VISUAL_ASSETS:{textures:{road:'road-original',grass:'grass-original'}},otthiWorldRuntime:{textures:new Map(),errors:[]},configureWorldTexture(){},worldPbrPath:(p,c)=>p+'-'+c,registerVisualAsset(){},updateVisualAsset(){}});
 vm.runInContext(s.slice(s.indexOf('  function loadWorldTexture('),s.indexOf('  function ensureUv2(')),ctx);
 for(const pack of ['road','grass']){const t=ctx.loadWorldTexture(pack,'basecolor',{color:true});assert.equal(t.pack,pack);assert.equal(t.image.width,256);assert.notEqual(t.colors[0],'#ffffff');}
});

test('mapped Rio roads reuse asphalt texture and world-space UVs without changing road vertices',()=>{
 const s=read('89-rio-map-world.js'),root={children:[],add(mesh){this.children.push(mesh)}};
 class Material{constructor(options){Object.assign(this,options)}}
 class Geometry{constructor(){this.attributes={}}setAttribute(k,v){this.attributes[k]=v}computeVertexNormals(){}computeBoundingSphere(){}}
 class Attribute{constructor(data,size){this.array=Array.from(data);this.itemSize=size}}
 class Color{convertSRGBToLinear(){return this}}
 const asphalt={name:'existing-asphalt'},water={clone:()=>({repeat:{set(){}}})};
 const ctx=vm.createContext({textures:{water},loadWorldTexture:(p,c,o)=>{assert.equal(p,'road');assert.equal(c,'basecolor');assert.equal(o.color,true);return asphalt;},rioMap:{},THREE:{Color,MeshStandardMaterial:Material,MeshBasicMaterial:Material,BufferGeometry:Geometry,Float32BufferAttribute:Attribute,BufferAttribute:Attribute,Mesh:class{constructor(geometry,material){Object.assign(this,{geometry,material,userData:{}})}},DoubleSide:2}});
 vm.runInContext(s.slice(s.indexOf('  function rioTerrainMaterials(){'),s.indexOf('  function rioDrawRoad(')),ctx);
 ctx.rioMap.materials=ctx.rioTerrainMaterials();const batch=ctx.rioSurfaceBatch();
 const points=[[0,.039,0],[10,.039,0],[10,.039,5],[0,.039,5]];
 batch.quad('street',...points);batch.commit(root);
 const mesh=root.children[0];assert.equal(mesh.material.map,asphalt);assert.deepEqual(mesh.geometry.attributes.position.array,[...points[0],...points[1],...points[2],...points[0],...points[2],...points[3]]);
 assert.equal(mesh.geometry.attributes.uv.array.length,12);
 assert(Math.abs(mesh.geometry.attributes.uv.array[2]-2.2)<1e-6);
 assert(Math.abs(mesh.geometry.attributes.uv.array[5]-1.1)<1e-6);
 for(const k of ['paint','lane']){assert.equal(ctx.rioMap.materials[k].polygonOffset,true);assert(ctx.rioMap.materials[k].polygonOffsetUnits<0);}
 const continuous=read('50-world-road-continuity.js');
 assert.match(continuous,/white:new THREE.MeshStandardMaterial\(\{[^}]*polygonOffset:true/);
 assert.match(continuous,/yellow:new THREE.MeshStandardMaterial\(\{[^}]*polygonOffset:true/);
});
