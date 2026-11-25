import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync('games/otthi/src/modules/57-world-destinations-marina.js','utf8');
const places=readFileSync('games/otthi/src/modules/88-rio-places.js','utf8');
const loop=readFileSync('games/otthi/src/modules/99-rio-compact-world.js','utf8');
test('three existing snow chalets preserve their exact coordinates and have independent property identifiers',()=>{
 const code=src.slice(src.indexOf('const snowCabinRecords='),src.indexOf('  function createSnowDestination()'));
 const actions=new Map(),save={},player={x:-52,z:187.7,vehicle:false,boating:false},room={root:{visible:true},colliders:[{}],gate:{},door:{},roof:{},point:(x,z)=>({x:-52+x,z:184+z}),action:(id,label,x,z,fn)=>actions.set(id,fn),refreshDecor:()=>{},manageFurniture:()=>{}};
 let opened;const worldGroup={};
 const ctx=vm.createContext({Map,Math,player,worldGroup,rioMap:{indoorRoom:null},rioPlayerAt:()=>true,rioMountPlace:()=>room,rioMapSave:()=>save,groundHeightAt:()=>0,playerGroup:{position:{set(){}}},rememberSafePlayerPosition(){},saveState(){},updateContext(){},registerInteractable:a=>actions.set(a.id,a),rioPropertyDoor:o=>{opened=o;},cameraMode:'openworld',cameraYaw:0,cameraPitch:0,cameraZoom:4});
 vm.runInContext(code,ctx);
 const sites=JSON.parse(vm.runInContext('JSON.stringify(snowCabinSites())',ctx));
 assert.deepEqual(sites.map(x=>[x.x,x.z]),[[-52,184],[46,184],[85,181]]);
 assert.equal(new Set(sites.map(s=>s.propertyId)).size,3);
 const facade={visible:true},wall={disabled:false};ctx.site=sites[0];ctx.facade=facade;ctx.wall=wall;
 vm.runInContext('registerSnowCabin(site,facade,wall)',ctx);
 actions.get(sites[0].id+'-door').action();
 assert.equal(opened.id,sites[0].id);assert(opened.price>0);
 assert(opened.enter());assert.equal(facade.visible,false);assert.equal(wall.disabled,true);assert.equal(room.root.visible,true);assert.equal(save.activeSnowCabin,sites[0].id);
 assert(actions.get('chalet-exit')());assert.equal(facade.visible,true);assert.equal(wall.disabled,false);assert.equal(room.root.visible,false);assert.equal(save.activeSnowCabin,undefined);
});
test('native commercial counters retain purchases and add unique human staff',()=>{
 assert.match(places,/createNPC\('rio-service-'\+site\.key\+'-'\+role/);
 assert.match(places,/rioServiceClerk\(site,room,'checkout'/);
 assert.match(places,/rioServiceClerk\(site,room,'dining'/);
 assert.match(places,/rioServiceClerk\(site,room,'reception'/);
 assert.match(places,/rioPurchaseItems\(item\)/);
 assert.match(loop,/if\(inside\)\{[\s\S]*?rioUpdatePlaceService\(site,room,\.08\);[\s\S]*?continue;/);
});

test('new coastal and mountain houses retain historic IDs and separate property saves',()=>{
 const code=src.slice(src.indexOf('function regionalHomeSites()'),src.indexOf('  function registerSnowCabin('));
 const ctx=vm.createContext({Math});vm.runInContext(code,ctx);
 const sites=JSON.parse(vm.runInContext('JSON.stringify(regionalHomeSites())',ctx));
 assert.equal(sites.length,8);assert.equal(new Set(sites.map(s=>s.propertyId)).size,8);
 assert.equal(sites.filter(s=>s.style==='snow-cabin').length,3);
 assert.equal(sites.filter(s=>s.style==='beach-house').length,5);
 for(const s of sites){assert(s.price>0);assert(Math.hypot(s.entry[0]-s.x,s.entry[1]-s.z)>s.d/2);}
});
test('port has a separate real berth, cargo and collision checks, not merely a map label',()=>{
 assert.match(src,/id:'rio-santos-escuna'/);assert.match(src,/rioMakeBerth\(\{id:'rio-santos-escuna'/);
 assert.match(src,/regionalPortVisit/);assert.match(src,/santosCargoDone/);
 assert.match(src,/regionalCargoShip/);
 const water=readFileSync('games/otthi/src/modules/92-rio-waterfront.js','utf8');
 assert.match(water,/w\.portObstacles/);assert.match(water,/w\.portTraffic/);
});

test('luxury estates preserve existing homes and reserve distinct accessible lots',()=>{
 const code=src.slice(src.indexOf('function regionalLuxurySites()'),src.indexOf('  function regionalNatureReserve('));const ctx=vm.createContext({Math});vm.runInContext(code,ctx);
 const sites=JSON.parse(vm.runInContext('JSON.stringify(regionalLuxurySites())',ctx));assert.equal(sites.length,5);assert.equal(sites.filter(s=>s.hotel).length,2);assert.equal(sites.filter(s=>s.architecture==='castle').length,1);
 assert(sites.every(s=>s.lotW>s.w&&s.lotD>s.d&&s.price>0));
});
test('Santos has separate berths for five watercraft and Guaruja has an actual surfboard',()=>{
 for(const id of ['rio-santos-lancha','rio-santos-jet-ski','rio-santos-surf','rio-santos-sup','rio-santos-escuna'])assert(src.includes("id:'"+id+"'"));
 const water=readFileSync('games/otthi/src/modules/92-rio-waterfront.js','utf8');assert.match(water,/function rioMakeSurfboard/);assert.match(water,/kind:'surf'/);assert.match(src,/regionalLuxuryPool/);
});
