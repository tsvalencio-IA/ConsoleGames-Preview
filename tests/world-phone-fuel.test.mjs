import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('games/otthi/src/modules/75-phone-orders.js','utf8');

function fixture({fuel=0,routed=true}={}){
  const car={id:'my-car',label:'Meu carro',group:{visible:true,position:{x:16,z:0},rotation:{y:0},userData:{}}};
  const courier={id:'van',group:{visible:false,position:{x:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}},rotation:{y:0},userData:{}}};
  const state={vehicles:{owned:[car.id],phoneOrders:[]},profile:{coins:80}};
  const worldPhone={job:null,pending:false,returning:[]};
  const tank={fuel};
  const events=[];
  let modal, owner='owner-a';
  const c=vm.createContext({
    state,worldPhone,world:{vehicles:[car,courier],interactables:[]},player:{x:17,z:0},
    RIO_FUEL_PRICE:2,MAP_LOCATIONS:[],crypto:{randomUUID:()=>String(Math.random())},
    inRioMap:()=>true,sharedWorldOwnId:()=>owner,vehicleStoredOnMap:()=>false,phoneDispatchAllowed:()=>true,
    distance2D:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),escapeHtml:x=>x,
    rioFuelCapacity:()=>42,rioFuelLevel:()=>tank.fuel,rioRoadVehicleSave:()=>tank,
    rioFuelQuote:(capacity,level,coins,litres)=>{
      const q=Math.floor(Math.min(capacity-level,litres,coins/2)*10+1e-6);
      return {litres:q/10,price:Math.ceil(q/5-1e-9)};
    },
    vehicleById:id=>id===car.id?car:null,
    rioFunctionalSites:()=>[{x:0,z:0,kind:'fuel'}],
    groundHeightAt:()=>0,phoneVehiclePoseClear:()=>true,
    phoneGroundRoute:(_v,a,b)=>routed?[a,b]:[],
    PhoneDriveRoute:class{constructor(points,yaw){this.points=points;this.yaw=yaw;Object.assign(this,points[0]);}},
    phoneMakeDriver:()=>({}),phoneDriverInVehicle:()=>{},phoneUpdateTrackingUI:()=>{},phoneWaypoint:()=>{},
    campaignMaterial:()=>({}),campaignBox:()=>({visible:false}),registerInteractable:item=>c.world.interactables.push(item),
    openModal(title,html,onReady){
      const buttons={'[data-yes]':{isConnected:true},'[data-no]':{isConnected:true}};
      modal={title,html,buttons};
      onReady({querySelector:key=>buttons[key]});
    },
    closeModal(){if(modal)for(const button of Object.values(modal.buttons))button.isConnected=false;},
    updateHUD:()=>{},saveState:()=>{},toast:()=>{},
    addCoins:delta=>{state.profile.coins+=delta;events.push({delta,fuel:tank.fuel,status:state.vehicles.phoneOrders.at(-1)?.status});},
    addXP:xp=>events.push({xp}),
  });
  vm.runInContext(source,c);
  c.phoneCourierVehicle=()=>courier;
  c.phonePickupPoint=(_v,p)=>({x:p.x-4,z:p.z,yaw:0});
  const buy=litres=>{assert.equal(c.phoneBuyFuel(car.id,litres),true);const confirm=modal.buttons['[data-yes]'];confirm.onclick();return {confirm,order:state.vehicles.phoneOrders.at(-1)};};
  const switchOwner=uid=>{owner=uid;};
  return {c,buy,car,courier,events,state,tank,worldPhone,switchOwner};
}

test('roadside order charges once only after a route is accepted and remembers the original station',()=>{
  const failed=fixture({routed:false});
  failed.buy(6);
  assert.equal(failed.state.vehicles.phoneOrders.length,0);
  assert.equal(failed.state.profile.coins,80);
  assert.equal(failed.worldPhone.job,null);
  const {c,buy,state,tank,events,worldPhone}=fixture();
  assert(c.phoneBuyFuel('my-car',6));
  c.closeModal();
  const {confirm,order}=buy(6);
  assert(order.paidAt>0);
  assert.equal(order.status,'en-route');
  assert.equal(order.origin.x,-4);
  assert.equal(order.target.x,12);
  assert.equal(worldPhone.job.caller,null);
  assert.deepEqual(events,[{delta:-12,fuel:0,status:'en-route'}]);
  confirm.onclick();
  assert.equal(state.profile.coins,68);
  assert.equal(tank.fuel,0);
});

test('a paid roadside order resumes after reload while incomplete transfer resets and only physical completion adds fuel',()=>{
  const {c,buy,car,state,tank,events,worldPhone}=fixture({fuel:39});
  const {order}=buy(3);
  c.phoneParcelArrived(worldPhone.job);
  order.fuelService='preparing';
  worldPhone.job=null;
  assert(c.phoneStartParcel(order));
  const job=worldPhone.job;
  assert(job.ready);
  assert.equal(order.fuelService,'waiting');
  assert.equal(state.profile.coins,74);
  tank.fuel=40.9;
  const t={phase:'pour',progress:.9,initial:40.9,litres:1.1};
  job.fuelTransfer=t;
  assert.equal(c.phoneFuelFinish(job,order,t,car),false);
  assert.equal(tank.fuel,40.9);
  t.progress=1;
  assert(c.phoneFuelFinish(job,order,t,car));
  assert.equal(tank.fuel,42);
  assert.equal(order.deliveredLitres,1.1);
  assert.equal(order.chargedPrice,3);
  assert.equal(order.refundedPrice,3);
  assert.equal(order.status,'delivered');
  assert.equal(state.profile.coins,77);
  assert.equal(c.phoneFuelFinish(job,order,t,car),false);
  assert.equal(c.phoneCancelFuelOrder(order.id),false);
  assert.deepEqual(events,[{delta:-6,fuel:39,status:'en-route'},{delta:3,fuel:42,status:'delivered'},{xp:5}]);
});

test('another profile cannot cancel or settle the order and local cancellation refunds exactly once',()=>{
  const {c,buy,car,events,state,tank,worldPhone,switchOwner}=fixture();
  const {order}=buy(4);
  c.phoneParcelArrived(worldPhone.job);
  const job=worldPhone.job,t={phase:'pour',progress:1,initial:0,litres:4};
  job.fuelTransfer=t;
  switchOwner('owner-b');
  assert.equal(c.phoneCancelFuelOrder(order.id),false);
  assert.equal(c.phoneFuelFinish(job,order,t,car),false);
  assert.equal(tank.fuel,0);
  switchOwner('owner-a');
  job.fuelTransfer=null;
  assert(c.phoneCancelFuelOrder(order.id));
  assert.equal(order.status,'cancelled');
  assert.equal(state.profile.coins,80);
  assert.equal(worldPhone.returning[0],job);
  assert.equal(c.phoneCancelFuelOrder(order.id),false);
  assert.deepEqual(events,[{delta:-8,fuel:0,status:'en-route'},{delta:8,fuel:0,status:'cancelled'}]);
});

test('a parked obstacle at the original exit makes the technician walk to another side and board',()=>{
  const {c,buy,courier,state,tank,worldPhone}=fixture();
  const {order}=buy(4);
  const job=worldPhone.job;
  c.phoneParcelArrived(job);
  const seat={x:courier.group.position.x,y:.8,z:0};
  const originalExit={x:seat.x+1.9,z:0};
  const position={x:seat.x-3,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}};
  const limb=()=>({rotation:{x:0}});
  job.driver={group:{position,rotation:{y:0}},leftLeg:limb(),rightLeg:limb()};
  job.fuelTransfer={phase:'back',unwinding:true,release:true,seat,exit:originalExit,
    pose:{yaw:0},points:[{...position},originalExit],index:1,elapsed:0};
  order.status='delivered';tank.fuel=4;
  c.lerp=(a,b,t)=>a+(b-a)*t;
  c.clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  c.nearbyTrafficActors=()=>[];
  c.positionBlockedForPlayer=(x,z,_radius,{ignoreActor})=>(ignoreActor!==courier&&Math.abs(x-seat.x)<1.15&&Math.abs(z)<1.7)||
    Math.hypot(x-originalExit.x,z)<1.2;
  c.phoneFuelFootRoute=function*(vehicle,from,goals){
    assert(goals.length>1);
    assert(goals.every(exit=>exit.x<seat.x));
    const goalIndex=goals.findIndex(exit=>c.phoneFuelFootClear(vehicle,from,exit));
    return goalIndex<0?null:{points:[{...from},goals[goalIndex]],goalIndex};
  };
  let boarded=0;
  c.phoneDriverInVehicle=()=>{boarded++;assert.equal(position.x,seat.x);assert.equal(position.y,seat.y);};
  for(let i=0;i<90&&worldPhone.job;i++)c.phoneFuelUpdateTransfer(job,.1);
  assert.equal(boarded,1);
  assert.equal(worldPhone.returning[0],job);
  assert.equal(worldPhone.job,null);
  assert.equal(order.status,'delivered');
  assert.equal(tank.fuel,4);
  assert.equal(state.profile.coins,72);
});
