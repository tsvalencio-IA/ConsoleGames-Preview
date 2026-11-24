import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const files=name=>readFileSync('games/otthi/src/modules/'+name,'utf8');
test('the camera cutaway hides only the occluding walls and restores their visibility',()=>{
 const source=files('89-rio-map-world.js'),start=source.indexOf('  function rioInteriorRender(){'),end=source.indexOf('\n  }',start)+4;
 const walls=Object.fromEntries(['front','back','left','right'].map(k=>[k,{visible:true}]));
 const room={site:{x:0,z:0,w:10,d:8,yaw:0,kind:'residence'},wallGroups:walls},renderer={clippingPlanes:['original']};
 const ctx=vm.createContext({Math,rioMap:{indoorRoom:room},otGames:{active:false},player:{vehicle:false},camera:{position:{x:5.1,z:4.1}},renderer});
 vm.runInContext(source.slice(start,end),ctx);
 const restore=vm.runInContext('rioInteriorRender()',ctx);
 assert.equal(walls.right.visible,false);assert.equal(walls.front.visible,false);assert(walls.left.visible&&walls.back.visible);
 assert.deepEqual(renderer.clippingPlanes,['original']);restore();assert(Object.values(walls).every(g=>g.visible));
});
test('physical floor and its furnishings share the same datum, with native collision geometry preserved',()=>{
 const places=files('88-rio-places.js'),homes=files('95-rio-open-buildings.js'),physics=files('25-render-init-resize-position-collision.js');
 assert.match(places,/floorY=rioPlaceStyles\[site\.kind\]\?baseY\+\.24:baseY/);
 assert.match(places,/RIO_FINISHED_FLOOR_/);assert.match(places,/room\.collider\(x,z,ww,dd,hh\)/);
 assert.match(physics,/top=Math\.max\(top,room\.floorY\)/);
 assert.match(homes,/group\.position\.set\(point\.x,room\.floorY,point\.z\)/);
 assert.match(homes,/beginCharacterActivity\('cook'/);assert.match(homes,/beginCharacterActivity\('shower'/);assert.match(homes,/beginCharacterActivity\('tv'/);
 const npc=files('13-houses-npcs-vehicles-base.js');assert.match(npc,/rioModernNpc\?new THREE\.LatheGeometry/);assert.match(npc,/makeLimb\(arm,\.092,\.31,skinMat/);
});
