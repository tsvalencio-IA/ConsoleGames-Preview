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

test('releasing flight camera clears both vehicle and pedestrian pointer capture',()=>{
 const vehicle=read('69-vehicle-camera-passengers.js'),a=vehicle.indexOf(' function releaseVehicleViewPointers(){'),b=vehicle.indexOf('\n for(const type',a);assert(a>=0&&b>a);
 const released=[],input={cameraDrag:{id:8}},vehicleView={pointers:new Map([[7,{}],[8,{}]]),pinch:33},ctx=vm.createContext({input,vehicleView,els:{stage:{hasPointerCapture:()=>true,releasePointerCapture:id=>released.push(id)}}});
 vm.runInContext(vehicle.slice(a,b),ctx);ctx.releaseVehicleViewPointers();
 assert.equal(input.cameraDrag,null);assert.equal(vehicleView.pointers.size,0);assert.equal(vehicleView.pinch,0);assert.deepEqual(released,[7,8]);
});
test('walking camera handoff restores pedestrian projection only after vehicle ownership and family seating are released',()=>{
 const flight=read('42-ot-games-modes.js'),a=flight.indexOf('  function otGamesReanchorWalkingCamera('),b=flight.indexOf('  function otGamesLeave(',a);assert(a>=0&&b>a);
 const order=[],player={x:90,y:0,z:-167,facing:Math.PI/2},camera={near:1.5,far:2000,up:{set:()=>{}},updateProjectionMatrix:()=>{},updateMatrixWorld:()=>order.push('matrix')};
 const ctx=vm.createContext({player,camera,cameraMode:'flight',cameraYaw:0,cameraPitch:1.35,cameraZoom:35,cameraFollowSnap:false,cameraWalkCentered:false,vehicleViewRestore:()=>order.push('restore'),releaseVehicleViewPointers:()=>order.push('release'),familyWorld:{portraitUntil:Infinity},document:{body:{classList:{remove:()=>{}}}},updateFamilyCarry:()=>order.push('family'),playerGroup:{position:{set:()=>order.push('position')},rotation:{}},clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),updateCamera:()=>order.push('camera')});
 vm.runInContext(flight.slice(a,b),ctx);ctx.otGamesReanchorWalkingCamera({near:.05,far:600,cameraPitch:1.35,cameraZoom:35});
 assert.equal(ctx.cameraMode,'openworld');assert.equal(ctx.cameraWalkCentered,true);assert.equal(ctx.cameraFollowSnap,true);assert.equal(ctx.cameraYaw,Math.PI/2);assert.equal(ctx.cameraPitch,.85);assert.equal(ctx.cameraZoom,4);assert.equal(camera.near,.05);assert.equal(camera.far,600);assert.equal(ctx.familyWorld.portraitUntil,0);assert.deepEqual(order,['restore','release','family','position','camera','matrix']);
});

test('aircraft walking camera is centered after geometry correction and cannot interpolate through the actor',()=>{
 const camera=read('27-npc-enemies-combat-camera-action.js');
 assert.match(camera,/centerWalking=cameraWalkCentered&&!player\.vehicle&&!player\.boating/);
 assert.match(camera,/const forwardLook=centerWalking\?0:/);
 assert.match(camera,/if\(centerWalking\)\{[\s\S]*?camera\.position\.copy\(desiredPos\);look\.copy\(walkingCameraFocus\(\)\);[\s\S]*?camera\.lookAt\(look\)/);
});
