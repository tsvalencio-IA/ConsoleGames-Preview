import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=n=>fs.readFileSync('games/otthi/src/modules/'+n,'utf8');
const source=read('28b-multiplayer-core-v2.js');
const body=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b));
test('a stalled V2 stream cannot move a visible peer back to an unchanged legacy location',()=>{
 const target={x:1,y:0,z:2,r:0},ghost={userData:{target,v2Pose:{x:100,y:0,z:100}}},motion=new Map([['peer',{items:[{}],lastRecv:1000}]]),ctx=vm.createContext({world:{ghosts:new Map([['peer',ghost]])},multiplayerV2Runtime:{motion},performance:{now:()=>4000}});
 vm.runInContext(body('  function multiplayerV2PresencePositionKey','  function updateMultiplayerRenderV2'),ctx);
 ghost.userData.v2PresencePositionKey=ctx.multiplayerV2PresencePositionKey(target);
 assert.equal(ctx.multiplayerV2GhostControlled('peer'),true);
 motion.delete('peer');assert.equal(ctx.multiplayerV2GhostControlled('peer'),true);
 target.x=105;assert.equal(ctx.multiplayerV2GhostControlled('peer'),false);
 target.connectionUnstable=true;assert.equal(ctx.multiplayerV2GhostControlled('peer'),true);
});
test('a reconnect with fresh server timestamp resets an obsolete V2 sequence, but delayed packets do not',()=>{
 let now=1000;const motion=new Map(),runtime={motion,dropped:0,maxBuffer:0};
 const ctx=vm.createContext({multiplayerV2Runtime:runtime,multiplayerV2OwnUid:()=> 'self',performance:{now:()=>now},lerp:(a,b,t)=>a+(b-a)*t});
 vm.runInContext(body('  function multiplayerV2PushMotion','  function multiplayerV2MotionCoordinates'),ctx);
 ctx.multiplayerV2PushMotion('peer',{seq:99,updatedAt:10000});
 now=1100;ctx.multiplayerV2PushMotion('peer',{seq:1,updatedAt:10001});assert.equal(motion.get('peer').lastSeq,99);
 now=4000;ctx.multiplayerV2PushMotion('peer',{seq:1,updatedAt:9999});assert.equal(motion.get('peer').lastSeq,99);
 ctx.multiplayerV2PushMotion('peer',{seq:1,updatedAt:14000});assert.equal(motion.get('peer').lastSeq,1);assert.equal(motion.get('peer').items.length,1);
});
test('aircraft exit reanchors the camera at the actual disembark point and releases orbit input',()=>{
 const leave=read('42-ot-games-modes.js'),camera=read('27-npc-enemies-combat-camera-action.js'),vehicle=read('69-vehicle-camera-passengers.js');
 assert.match(leave,/if\(!options\.exitPoint\)\{camera\.position\.copy\(g\.entry\.camera\)/);
 assert.match(leave,/playerGroup\.position\.set\(player\.x,player\.y,player\.z\);cameraMode='openworld';cameraFollowSnap=true/);
 assert.match(camera,/const t=cameraFollowSnap\?1:1-Math\.exp\(-dt\*7\.5\);cameraFollowSnap=false/);
 assert.match(vehicle,/vehicleView\.manual=vehicleView\.inside=vehicleView\.snap=false;releaseVehicleViewPointers\(\)/);
});
