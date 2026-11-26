import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=n=>fs.readFileSync('games/otthi/src/modules/'+n,'utf8');
const driving=read('23-vehicle-effects-driving.js'),physics=read('26-input-player-physics.js'),water=read('18-water-fishing-boats.js');
function context(){
 const calls=[],created=[],player={vehicle:true,boating:false,car:{id:'fusca',kind:'car',turboUntil:2000},boat:{}},input={mobilityAccelerate:false,mobilityBrake:false,z:0},ctx=vm.createContext({player,input,paused:false,state:{settings:{sound:true}},performance:{now:()=>1000},currentVehicleRef:()=>({brazilModel:player.car.id}),clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),window:{GameAudio:{vehicleVoice:(model,kind)=>{created.push([model,kind]);return {update:(...a)=>calls.push(a),dispose:()=>{}};}}}});
 vm.runInContext(driving.slice(driving.indexOf('  let engineAudio='),driving.indexOf('  function updateVehicleFX('))+';'+physics.slice(physics.indexOf('  function mobilityThrottleIntent('),physics.indexOf('  function smoothPassengerHostPose('))+';globalThis.accept=(axis,speed)=>{const c=mobilityThrottleIntent(axis,speed);mobilityEngineLoad=c.brake?0:c.throttle;return c;};globalThis.audio=updateEngineSound;globalThis.block=()=>{mobilityEngineLoad=0;};',ctx);
 return {ctx,calls,created,player,input};
}
test('audio follows accepted throttle, not stale raw joystick, braking or unused turbo',()=>{
 const {ctx,calls,input}=context();
 input.z=1;ctx.block();ctx.audio(0,'car','fusca');assert.deepEqual(calls.at(-1),[0,0,false,true]);
 ctx.accept(1,0);ctx.audio(2,'car','fusca');assert.deepEqual(calls.at(-1),[2,1,true,true]);
 input.mobilityBrake=true;ctx.accept(1,7);ctx.audio(5,'car','fusca');assert.deepEqual(calls.at(-1),[5,0,false,true]);
 ctx.accept(0,0);ctx.audio(-1,'car','fusca');assert.deepEqual(calls.at(-1),[-1,1,false,true]);
 input.mobilityBrake=false;ctx.accept(0,-1);ctx.audio(-1,'car','fusca');assert.deepEqual(calls.at(-1),[-1,0,false,true]);
});
test('blocked physics resets load and boat does not inherit road turbo',()=>{
 const {ctx,calls,player}=context();
 ctx.accept(1,0);ctx.block();ctx.audio(0,'car','fusca');assert.deepEqual(calls.at(-1),[0,0,false,true]);
 player.boating=true;ctx.accept(.5,0);ctx.audio(1,'boat','boat');assert.deepEqual(calls.at(-1),[1,.5,false,true]);
 assert.match(physics,/function updatePlayer\(dt\)\{[\s\S]{0,300}mobilityEngineLoad=0;/);
 assert.match(physics,/throttle=command\.throttle;mobilityEngineLoad=command\.brake\?0:throttle/);
 assert.match(water,/throttle=command\.throttle;mobilityEngineLoad=command\.brake\?0:throttle/);
});
test('vehicle model changes recreate the actual voice without changing the recorded engine catalog',()=>{
 const {ctx,created,player}=context();
 ctx.audio(0,'car','fusca');player.car.id='ferrari458';ctx.audio(0,'car','ferrari458');player.car.id='hilux';ctx.audio(0,'car','hilux');
 assert.deepEqual(created,[['fusca','car'],['ferrari458','car'],['hilux','car']]);
});
