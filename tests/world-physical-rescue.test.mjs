import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const source=fs.readFileSync('games/otthi/src/modules/16-emergency-services.js','utf8');
const traffic=fs.readFileSync('games/otthi/src/modules/07-navigation-traffic-routes.js','utf8');
const section=(text,from,to)=>text.slice(text.indexOf(from),text.indexOf(to));
function fixture(){
 const world={vehicles:[],policeCars:[],ambulances:[],fireTrucks:[],trafficIncidents:[],interactables:[],emergencyServiceHistory:[]};
 const state={vehicles:{garage:{stored:{}}},career:{activeJob:null},cityServices:{}};
 const context={world,state,player:{x:100,z:100,vehicle:false,boating:false,transit:{mode:''}},currentHouse:null,remotePresence:new Map(),structuredClone,
  groundHeightAt:()=>0,pointOnRoad:(x,z)=>Math.abs(z)<=4.5,nearbyWorldColliders:()=>[],nearbyTrafficActors:()=>[],trafficBody:o=>o.body,
  nearestRoadProjection:p=>({point:{x:p.x,z:0},distance:Math.abs(p.z)}),performance:{now:()=>100000},
  incidentResponderActive:()=>true,releaseIncidentActorStates:()=>{},serviceKindForJob:()=>'',worldGroup:{remove(){}},disposeDetachedVisual(){},
  setTimeout:callback=>callback(),toast(){},saveState(){},completeActiveJob(){},setMissionState(){},MISSION_STATES:{ACCEPTED:'accepted'}};
 vm.createContext(context);
 vm.runInContext(section(traffic,'  function trafficBodiesOverlap(','  function trafficYields('),context);
 vm.runInContext(section(source,'  function incidentResponderBody(','  function incidentResponderRoute('),context);
 vm.runInContext(section(source,'  function recordIncidentContingency(','  function assistTrafficIncident('),context);
 vm.runInContext(section(source,'  function resolveTrafficIncident(','  function updateTrafficIncidents('),context);
 return{world,state,context,run:code=>vm.runInContext(code,context)};
}
function incident(id='test'){
 return{id,startedAt:0,serviceElapsedMs:5000,serviceBudgetMs:30000,backupAt:10000,group:{visible:true},required:{police:true,paramedic:true,firefighter:true},arrived:{},tasks:{},playerAssigned:{},responders:{police:'police1',paramedic:'rescue1',firefighter:'fire1'},physicalArrivals:{},contingencyEvents:[],actorStates:[]};
}

test('a long responder exits a curb along the road instead of rotating its rear outside it',()=>{
 const f=fixture();f.context.vehicle={serviceType:'firefighter',group:{rotation:{y:Math.PI/2}}};f.context.from={x:0,z:3.05};
 assert.equal(f.run('incidentResponderTravelClear(vehicle,from,{x:0,z:1.35},false)'),false,'the old perpendicular connector does not fit');
 const departure=f.run('incidentResponderDeparture(vehicle,from)');assert(departure);assert(departure.x>=8);assert(Math.abs(departure.z-1.35)<1e-8);
 f.context.departure=departure;assert.equal(f.run('incidentResponderTravelClear(vehicle,from,departure,false)'),true);
});

test('a road incident selects a vehicle with a clear departure even outside the rendered area',()=>{
 const f=fixture();
 const near={id:'near',group:{visible:true,position:{x:6,z:0}},speed:8};
 const clear={id:'clear',group:{visible:false,position:{x:0,z:0}},speed:8};
 f.world.policeCars.push(near,clear);
 const i=f.context.i=incident();i.staging={};
 Object.assign(f.context,{currentServiceMissionJob:()=>null,serviceVehiclePools:()=>f.world.policeCars,
  incidentResponderPoint:()=>({x:10,z:0}),incidentResponderRoute:vehicle=>[vehicle.group.position,{x:10,z:0}],
  routeLength:route=>route[1].x-route[0].x,incidentResponderTravelClear:vehicle=>vehicle.id==='clear',
  setIncidentResponderRoute:(vehicle,target,route)=>{vehicle.chosenRoute=route;}});
 f.run(section(source,'  function serviceVehicleAvailable(','  function serviceVehicleAppearance('));
 f.run(section(source,'  function dispatchIncidentResponder(','  function dispatchIncidentResponders('));
 assert.equal(f.run('dispatchIncidentResponder(i,"police")').id,'clear');
 assert.equal(i.responders.police,clear.id);assert.equal(clear.incidentTargetId,i.id);
 assert.equal(near.incidentTargetId,undefined);assert.equal(clear.group.position.x,0);
 assert.equal(Object.keys(i.physicalArrivals).length,0,'dispatch alone cannot mark a physical arrival');
});

test('one building fire leaves a second fire truck free to respond on the road',()=>{
 const f=fixture(),truck=(id,x)=>({id,group:{visible:true,position:{x,z:0}},lightA:{},lightB:{}});
 const near=truck('near',0),spare=truck('spare',30);
 f.world.fireTrucks.push(near,spare);
 f.world.fires=[{id:'building-fire',active:true,navX:4,navZ:0,flames:[],smoke:[]}];
 const movement=[];
 Object.assign(f.context,{clamp:(n,min,max)=>Math.max(min,Math.min(max,n)),currentServiceMissionJob:()=>null,
  moveServiceVehicle:vehicle=>{movement.push(vehicle.id);return 10;},returnServiceVehicleHome:()=>0});
 f.run(section(source,'  function serviceVehicleAvailable(','  function serviceVehicleAppearance('));
 f.run(section(source,'  function updateFireService(','  function createPoliceCar('));
 f.run('updateFireService(.1);updateFireService(.1)');
 assert.equal(near.targetFireId,'building-fire');assert.equal(spare.targetFireId,undefined);
 assert.deepEqual(movement,['near','near']);
});

test('hidden parked instances do not become phantom blockers, and visible bodies still block',()=>{
 const f=fixture();f.context.vehicle={serviceType:'firefighter'};
 const other={id:'parked',group:{visible:false},body:{x:0,z:0,w:1,l:2,s:0,c:1}};f.world.vehicles.push(other);
 assert.equal(f.run('incidentResponderPoseClear(vehicle,0,0,0,false)'),true);
 other.group.visible=true;assert.equal(f.run('incidentResponderPoseClear(vehicle,0,0,0,false)'),false);
});

test('a slow render clock cannot consume the simulated service budget, and real wall safety remains bounded',()=>{
 const f=fixture();f.context.i=incident();
 f.run('autonomousIncidentBackup(i,60000)');assert(!f.context.i.forcedClear);assert.deepEqual(f.context.i.contingencyEvents,[]);
 f.run('autonomousIncidentBackup(i,170000)');assert.equal(f.context.i.forcedClear,true);assert.equal(f.context.i.contingencyEvents.length,3);
 assert(f.context.i.contingencyEvents.every(e=>e.reason==='wall-safety'));assert.equal(Object.keys(f.context.i.physicalArrivals).length,0);
});

test('service-budget fallback is separate from physical arrival and is recorded only once per role',()=>{
 const f=fixture();f.context.i=incident();f.context.i.serviceElapsedMs=31000;
 f.run('autonomousIncidentBackup(i,40000);autonomousIncidentBackup(i,40100)');
 assert.equal(f.context.i.contingencyEvents.length,3);assert(f.context.i.contingencyEvents.every(e=>e.reason==='travel-budget'));
 f.run("recordPhysicalIncidentArrival(i,'police',{id:'police1',group:{position:{x:7,z:0}}},1,40200)");
 assert.equal(f.context.i.physicalArrivals.police.afterContingency,true);
});

test('fallback never increments the physical completion counter, even if every vehicle subsequently arrives',()=>{
 const f=fixture();const p=incident('physical');p.physicalArrivals={police:{},paramedic:{},firefighter:{}};f.context.i=p;f.run('resolveTrafficIncident(i)');
 assert.equal(f.state.cityServices.physicalRescuesCompleted,1);assert.equal(f.world.emergencyServiceHistory.at(-1).mode,'physical');
 const fallback=incident('fallback');fallback.physicalArrivals={police:{},paramedic:{},firefighter:{}};fallback.forcedClear=true;fallback.contingencyEvents=[{kind:'firefighter',reason:'travel-budget'}];f.context.i=fallback;f.run('resolveTrafficIncident(i)');
 assert.equal(f.state.cityServices.physicalRescuesCompleted,1);assert.equal(f.state.cityServices.contingencyRescuesCompleted,1);assert.equal(f.world.emergencyServiceHistory.at(-1).mode,'contingency');
 for(let n=0;n<70;n++){f.context.i=incident('bounded-'+n);f.run('resolveTrafficIncident(i)');}assert.equal(f.world.emergencyServiceHistory.length,64);
});

test('a player-driven response records the player position and its assigned vehicle, not the parked depot pose',()=>{
 const f=fixture();f.context.i=incident();f.context.player.x=7;f.context.player.z=8;f.state.career.activeJob={serviceVehicleId:'my-ambulance'};
 f.run("recordPhysicalIncidentArrival(i,'paramedic',null,2,10000)");const arrival=f.context.i.physicalArrivals.paramedic;
 assert.equal(arrival.source,'player');assert.equal(arrival.vehicleId,'my-ambulance');assert.equal(arrival.x,7);assert.equal(arrival.z,8);assert.equal(arrival.afterContingency,false);
});
