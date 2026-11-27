import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('games/otthi/src/modules/28b-multiplayer-core-v2.js','utf8');
const start=source.indexOf('  function multiplayerV2MotionCoordinates'),end=source.indexOf('  function multiplayerV2WorldAuthorityId');
assert(start>0&&end>start);

function session(boat=false){
 let now=4000;
 const pose=x=>({x,y:0,z:5,r:0,vehicle:!boat,vehicleRole:boat?'':'driver',vehicleX:x,vehicleY:0,vehicleZ:5,vehicleR:0,boating:boat,boatRole:boat?'driver':'',updatedAt:1000});
 const host=pose(1),passenger={x:100,y:0,z:5,r:0,vehicle:!boat,vehicleRole:boat?'':'passenger',vehiclePassengerOf:boat?'':'driver',boating:boat,boatRole:boat?'passenger':'',passengerOf:boat?'driver':''};
 const ghost=target=>({position:{x:100,y:0,z:5,set(x,y,z){Object.assign(this,{x,y,z});}},rotation:{y:0},userData:{target}});
 const driver=ghost(host),rider=ghost(passenger),motion=new Map([
  ['driver',{items:[{...pose(100),recv:1000}],lastRecv:1000,intervals:[],jitter:0}],
  ['rider',{items:[{...passenger,recv:4000}],lastRecv:4000,intervals:[],jitter:0}]
 ]);
 const runtime={motion,renderSamples:0,extrapolated:0,corrected:0};
 const c=vm.createContext({world:{ghosts:new Map([['driver',driver],['rider',rider]])},remotePresence:new Map([['driver',host],['rider',passenger]]),multiplayerV2Runtime:runtime,multiplayerV2Enabled:()=>true,multiplayerV2OwnUid:()=> 'self',performance:{now:()=>now},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),lerp:(a,b,t)=>a+(b-a)*t,lerpAngle:(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t,animTime:0,player:{vehicle:false,boating:false}});
 vm.runInContext(source.slice(start,end),c);
 driver.userData.v2Pose={x:100,y:0,z:5,r:0};driver.userData.v2PresencePositionKey=c.multiplayerV2PresencePositionKey(host);
 return{c,driver,rider,host,motion,pose,now:n=>{now=n;motion.get('rider').lastRecv=n;motion.get('rider').items[0].recv=n;}};
}

for(const boat of[false,true])test(`${boat?'boat':'vehicle'} passenger follows fresh legacy host after V2 interruption without reviving an obsolete pose`,()=>{
 const s=session(boat);
 s.c.updateMultiplayerRenderV2(1/60);
 assert.equal(s.rider.position.x,100,'unchanged old presence must not pull the rider back to1');
 Object.assign(s.host,s.pose(105),{updatedAt:4000});
 s.c.updateMultiplayerRenderV2(1/60);
 assert.equal(s.rider.position.x,105,'fresh legacy host movement must move its passenger too');
 assert.equal(s.c.multiplayerV2GhostControlled('driver'),false);
 Object.assign(s.host,s.pose(1),{updatedAt:5000});s.now(5000);s.c.updateMultiplayerRenderV2(1/60);
 assert.equal(s.rider.position.x,1,'a later real legacy return must not revive the obsolete V2 position100');
 const channel=s.motion.get('driver');channel.items=[{...s.pose(109),recv:5100}];channel.lastRecv=5100;s.now(5100);s.c.updateMultiplayerRenderV2(1/60);
 assert.equal(s.driver.position.x,109);assert.equal(s.rider.position.x,109,'fresh motion resumes native interpolation for host and rider');
 assert.equal(s.c.multiplayerV2GhostControlled('driver'),true);
});

for(const boat of[false,true])test(`${boat?'boat':'vehicle'} passenger holds the host pose while the V2 buffer is removed`,()=>{
 const s=session(boat);
 s.driver.userData.v2Pose.vx=9;
 s.motion.delete('driver');
 s.host.connectionUnstable=true;
 s.c.updateMultiplayerRenderV2(1/60);
 assert.equal(s.rider.position.x,s.driver.position.x);
 assert.equal(s.rider.userData.v2Pose.source,'held');
 assert.equal(s.rider.userData.v2Pose.vx,0);
 assert.equal(s.c.multiplayerV2GhostControlled('driver'),true);

 Object.assign(s.host,s.pose(106),{connectionUnstable:false,updatedAt:4500});
 s.c.updateMultiplayerRenderV2(1/60);
 assert.equal(s.rider.position.x,106);
 assert.equal(s.rider.userData.v2Pose.source,'legacy');
 assert.equal(s.c.multiplayerV2GhostControlled('driver'),false);
});

test('the local boat passenger uses active and held V2 host coordinates, then resumes legacy movement',()=>{
 const s=session(true),boatSource=fs.readFileSync('games/otthi/src/modules/18-water-fishing-boats.js','utf8');
 const start=boatSource.indexOf('  function updateBoatPhysics('),end=boatSource.indexOf('  function constrainBoat(',start);
 assert(start>0&&end>start);
 vm.runInContext(boatSource.slice(start,end),s.c);
 Object.assign(s.c.player,{x:100,z:5,boating:true,boat:{passengerOf:'driver',heading:1}});

 const channel=s.motion.get('driver');
 channel.items=[{...s.pose(102),r:0,recv:4000}];channel.lastRecv=4000;
 s.c.updateMultiplayerRenderV2(1/60);
 s.c.updateBoatPhysics(1/60,0,0);
 assert.equal(s.c.player.vx,16);
 assert.equal(s.c.player.boat.heading,0);

 s.motion.delete('driver');s.host.connectionUnstable=true;s.c.player.x=102;
 s.c.updateBoatPhysics(1/60,0,0);
 assert.equal(s.c.player.vx,0);
 assert.equal(s.c.player.vz,0);
 assert.equal(s.c.player.boat.hostMissingAt,0);

 Object.assign(s.host,s.pose(105),{connectionUnstable:false,updatedAt:4500});
 s.c.updateBoatPhysics(1/60,0,0);
 assert.equal(s.c.player.vx,18);
});
