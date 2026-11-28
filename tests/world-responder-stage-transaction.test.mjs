import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('games/otthi/src/modules/16-emergency-services.js','utf8');
function fn(name){const a=source.indexOf('  function '+name+'(');assert(a>=0,name);const b=source.indexOf('\n  function ',a+3);return source.slice(a,b<0?undefined:b);}
test('failed staging search preserves the prior accepted physical target and route',()=>{
 const previous={x:10,z:20,yaw:0},alternate={x:20,z:20,yaw:0},incident={staging:{paramedic:previous}},vehicle={serviceType:'paramedic',group:{position:{x:0,z:0},rotation:{y:0}}},job={target:previous,reroutes:2,stationaryFor:9};
 const c=vm.createContext({incidentResponderPoint:(i,k)=>{i.staging[k]=alternate;return alternate;},incidentResponderRoute:()=>[{x:0,z:0},{x:1,z:1},alternate],incidentResponderPoseClear:()=>true,incidentResponderTravelClear:()=>false,setIncidentResponderRoute:()=>{throw Error('invalid replacement must not be accepted');}});
 vm.runInContext(fn('replanIncidentResponderStage'),c);
 assert.equal(c.replanIncidentResponderStage(incident,vehicle,job),job);assert.equal(incident.staging.paramedic,previous);
 c.incidentResponderTravelClear=()=>true;c.incidentResponderPoseClear=()=>false;
 assert.equal(c.replanIncidentResponderStage(incident,vehicle,job),job);assert.equal(incident.staging.paramedic,previous);
 c.incidentResponderPoseClear=()=>true;c.setIncidentResponderRoute=(v,target,route)=>({target,route});
 const accepted=c.replanIncidentResponderStage(incident,vehicle,job);
 assert.equal(accepted.target,alternate);assert.equal(accepted.reroutes,3);assert.equal(accepted.stationaryFor,9);assert.equal(incident.staging.paramedic.x,20);
});
test('blocked ambulance and fire truck can request a real alternate responder, without pretending to arrive',()=>{
 for(const kind of ['police','paramedic','firefighter']){
  const current={id:'old',incidentTargetId:'i',responseJob:{stationaryFor:9}},next={id:'new',incidentTargetId:'i'},incident={id:'i',required:{[kind]:true},arrived:{},tasks:{},playerAssigned:{},responders:{[kind]:'old'},dispatches:{[kind]:[{}]},travelProgress:{[kind]:{}}};
  let attempts=0;const c=vm.createContext({serviceVehiclePools:k=>k===kind?[current,next]:[],dispatchIncidentResponder:(i,k,clear)=>{attempts++;assert.equal(clear,true);return null;},releaseIncidentResponder:()=>{throw Error('must keep current vehicle when no replacement');}});
  vm.runInContext(fn('retryIncidentResponders'),c);c.retryIncidentResponders(incident,10000);c.retryIncidentResponders(incident,13000);assert.equal(attempts,1);assert.equal(incident.responders[kind],'old');
  c.dispatchIncidentResponder=(i,k,clear)=>{assert.equal(clear,true);i.responders[k]=next.id;return next;};c.releaseIncidentResponder=v=>{assert.equal(v,current);v.incidentTargetId='';};c.retryIncidentResponders(incident,19000);
  assert.equal(incident.responders[kind],'new');assert.equal(current.incidentTargetId,'');assert.equal(incident.arrived[kind],undefined);assert.equal(incident.tasks[kind],undefined);assert.equal(incident.travelProgress[kind],undefined);
 }
});
