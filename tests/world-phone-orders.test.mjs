import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const read=p=>fs.readFileSync('games/otthi/src/modules/'+p,'utf8'),phone=read('73-world-phone-dispatch.js'),orders=read('75-phone-orders.js'),garage=read('62-personal-garage-delivery.js');
function fixture(){const c=vm.createContext({Math,Date,Number,Map,Set,console,window:{},crypto:{randomUUID:()=>String(Math.random())}});vm.runInContext(phone.slice(phone.indexOf(' const worldPhone='),phone.indexOf(' const phonePreviousExpansion='))+orders.slice(orders.indexOf('// @otthi-module-body')+23)+`;globalThis.Q={worldPhone,PhoneDriveRoute};`,c);return c;}
function extract(s,name){const a=s.indexOf(' function '+name+'(');assert(a>=0,name);let i=s.indexOf('{',a),depth=1,j=i+1;for(;depth;j++){if(s[j]==='{')depth++;else if(s[j]==='}')depth--;}return s.slice(a,j);}
test('driver finds a continuous swept detour around a stopped car and still reaches the caller',()=>{
 const c=fixture();const clear=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.15));for(let i=1;i<=n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(Math.abs(x)>4.5||z<-.5||z>25||Math.abs(x)<1.9&&z>6&&z<12)return false;}return true;};
 const result=c.phoneFindDetour({x:0,z:0,yaw:0},[{x:0,z:22}],clear);assert(result);assert(result.points.some(p=>Math.abs(p.x)>=2));for(let i=1;i<result.points.length;i++)assert(clear(result.points[i-1],result.points[i]));
 const r=new c.Q.PhoneDriveRoute(result.points);for(let i=0;i<2400&&!r.arrived;i++)r.step(1/60,(x,z)=>!(Math.abs(x)<1.9&&z>6&&z<12));assert(r.arrived);assert.equal(r.x,0);assert.equal(r.z,22);
});
test('sealed passage has no invented route, and even the last 16cm never snaps through a blocker',()=>{
 const c=fixture();assert.equal(c.phoneFindDetour({x:0,z:0},[{x:0,z:10}],(a,b)=>b.z<4&&Math.abs(b.x)<3,{maxNodes:180}),null);
 const r=new c.Q.PhoneDriveRoute([{x:0,z:0},{x:0,z:.1}]);r.step(.1,()=>false);assert.equal(r.z,0);assert(!r.arrived);assert(r.blocked);
});
test('detour edges cannot accept a turn blocked at the actual curb departure',()=>{
 const c=fixture();
 const v={group:{position:{x:0,z:0}}};
 Object.assign(c,{v704RoadAt:()=>true,phoneVehiclePoseClear:(vehicle,x,z,yaw)=>x>.1||Math.abs(yaw)<.1});
 assert.equal(c.phoneTravelClear(v,{x:0,z:0,yaw:0},{x:5,z:0}),false);
 assert.equal(c.phoneTravelClear(v,{x:0,z:0,yaw:0},{x:0,z:5}),true);
});
test('live detour search yields after at most eight expensive checks, including a completely blocked road',()=>{
 const c=fixture();let calls=0,slices=0;const search=c.phoneDetourSteps({x:0,z:0},[{x:0,z:35}],(a,b)=>{calls++;return b.z<20&&Math.abs(b.x)<14;},{maxNodes:300});let next;
 do{calls=0;next=search.next();assert(calls<=8,'a single frame cannot evaluate the entire search: '+calls);slices++;}while(!next.done);assert(slices>20);assert.equal(next.value,null);
});
test('accepted detours with no actual progress trigger a safe alternate curb and the courier drives there',()=>{
 const c=fixture(),target={x:0,z:20},alternate={x:8,z:0};
 const position={x:0,z:0,set(x,y,z){this.x=x;this.z=z;}};
 const job={id:'van',kind:'parcel',target,caller:{x:0,z:24},
  vehicle:{group:{position,rotation:{y:0},userData:{}}},
  route:new c.Q.PhoneDriveRoute([position,target])};
 let attempts=0,visits=0;
 Object.assign(c,{
  world:{},state:{vehicles:{phoneOrders:[]}},groundHeightAt:()=>0,brazilDepotVehicle:()=>false,
  animateBrazilTransport(){},toast(){},phoneVehiclePoseClear:(v,x,z)=>z<=.01,
  phoneGroundDestination:(v,traffic,avoid,destination)=>{
   assert.equal(v,job.vehicle);assert.equal(traffic,true);assert.equal(avoid.at(-1),target);assert.equal(destination,job.caller);
   visits++;
   return alternate;
  },
  phoneGroundRoute:(v,from,to)=>visits===1?[from]:[from,to],
  phoneRecoverRoute:(j,dt)=>{
   if(!j.route.blocked)return false;
   j.blockedFor=(j.blockedFor||0)+dt;
   if(j.blockedFor<3)return false;
   j.route=new c.Q.PhoneDriveRoute([position,target]);j.blockedFor=0;j.reroutes=(j.reroutes||0)+1;attempts++;
   return true;
  }
 });
 for(let tick=0;tick<130;tick++)c.phoneAdvanceJob(job,.1);
 assert(attempts>=4);assert.equal(visits,1);assert.equal(job.target,target);assert.equal(job.route.arrived,false);
 assert(position.z<=.01,'the blocked van must stay at its actual pose');
 for(let tick=0;tick<120&&!job.route.arrived;tick++)c.phoneAdvanceJob(job,.1);
 assert.equal(visits,2);assert.equal(job.target,alternate);assert(job.route.arrived);assert.equal(position.x,alternate.x);assert.equal(position.z,alternate.z);
});
test('native progress erases failed detour history, and returning jobs choose an alternate near the store',()=>{
 const c=fixture(),origin={x:0,z:0},target={x:0,z:0},alternate={x:6,z:0};
 const previous={x:0,z:20},job={kind:'parcel',target,recentStops:[previous]};
 const p=c.phoneRouteProgress(job,{x:0,z:20,blocked:true},.1);p.detours=3;p.waited=11;
 c.phoneRouteProgress(job,{x:0,z:18,blocked:false},.1);
 assert.equal(p.detours,0);assert.equal(p.waited,0);
 job.kind='return';job.target=origin;job.origin=origin;job.vehicle={x:5,z:5,heading:0};
 c.phoneRouteProgress(job,{x:5,z:5,blocked:true},.1);
 assert.equal(job.recentStops.length,0);
 Object.assign(c,{
  phonePickupPoint:(vehicle,point,avoid)=>{assert.equal(point,origin);assert.equal(avoid.length,1);assert.equal(avoid[0],origin);return alternate;},
  phoneGroundRoute:(v,from,to)=>[from,to]
 });
 assert(c.phoneAlternateStop(job));assert.equal(job.target,alternate);assert.equal(job.route.arrived,false);
});
test('parcel pickup grants exactly the purchased quantity once, with no inventory before arrival or a second debit',()=>{
 const c=fixture();Object.assign(c,{state:{vehicles:{phoneOrders:[{id:'one',kind:'parcel',status:'ready',owner:'me',itemKey:'food',price:15}]},inventory:{food:4},tools:{owned:[]}},player:{x:0,z:0},worldShopItems:()=>[{name:'Comida',key:'food',amount:2,price:15}],sharedWorldOwnId:()=> 'me',addXP:()=>{},saveState:()=>{},updateHUD:()=>{},toast:()=>{},phoneGroundRoute:()=>[{x:0,z:0},{x:0,z:10}]});
 const job={id:'van',orderId:'one',kind:'parcel',ready:true,origin:{x:0,z:10},vehicle:{group:{position:{x:0,z:0},userData:{phoneParcel:{visible:true}}}},route:{x:0,z:0,yaw:0}};c.Q.worldPhone.job=job;
 assert.equal(c.state.inventory.food,4);assert(c.phoneReceiveParcel());assert.equal(c.state.inventory.food,6);assert.equal(c.state.vehicles.phoneOrders[0].status,'delivered');assert.equal(c.phoneReceiveParcel(),false);assert.equal(c.state.inventory.food,6);assert.equal(c.Q.worldPhone.returning.length,1);
 c.Q.worldPhone.job=job;job.ready=true;job.kind='parcel';assert.equal(c.phoneReceiveParcel(),false,'a stale duplicate callback cannot reuse the receipt');assert.equal(c.state.inventory.food,6);
});
test('a parcel cannot be collected remotely or by a different profile; cancellation refunds only once',()=>{
 const c=fixture();let balance=20;Object.assign(c,{state:{vehicles:{phoneOrders:[{id:'one',kind:'parcel',status:'ready',owner:'me',itemKey:'food',price:15}]},inventory:{food:0},tools:{owned:[]}},player:{x:200,z:200},worldShopItems:()=>[{name:'Comida',key:'food',amount:2,price:15}],sharedWorldOwnId:()=> 'me',addCoins:n=>balance+=n,saveState:()=>{},toast:()=>{},phoneReleaseCourier:()=>{}});
 const j={orderId:'one',kind:'parcel',ready:true,vehicle:{group:{position:{x:0,z:0}}}};c.Q.worldPhone.job=j;assert(!c.phoneReceiveParcel());c.player.x=c.player.z=0;c.state.vehicles.phoneOrders[0].owner='other';assert(!c.phoneReceiveParcel());c.state.vehicles.phoneOrders[0].owner='me';c.phoneCancelParcel(j);c.phoneCancelParcel(j);assert.equal(balance,35);assert.equal(c.state.inventory.food,0);
});
test('unique tools cannot be ordered again while paid and pending, or after receipt',()=>{
 const c=fixture();c.state={vehicles:{phoneOrders:[]},inventory:{},tools:{owned:[]}};const item={tool:'shovel'};assert(!c.phoneItemUnavailable(item));c.state.vehicles.phoneOrders.push({kind:'parcel',itemKey:'shovel',status:'en-route'});assert(c.phoneItemUnavailable(item));c.state.vehicles.phoneOrders[0].status='cancelled';assert(!c.phoneItemUnavailable(item));c.state.tools.owned.push('shovel');assert(c.phoneItemUnavailable(item));
});
test('bulk storage handles every duplicate instance, hides collection clones, and preserves active deliveries and workshop disassembly',()=>{
 const vehicles=new Map(),clones=new Map(),g={stored:{},slots:{}};for(const id of ['base','unit-2','unit-3','npc-delivery','workshop','remote']){vehicles.set(id,{id,group:{visible:true}});clones.set(id,{visible:true});g.slots[id]=id;}vehicles.get('npc-delivery').phoneDelivery=true;vehicles.get('workshop').workshopYardStatus='service';
 const state={vehicles:{owned:[...vehicles.keys()],garage:g,partDurability:{'unit-2':37}}},c=vm.createContext({state,world:{playerGarageDisplayFleet:clones,workshopLifts:[{vehicleId:'workshop',disassembly:{engine:true}}]},player:{vehicle:false},remotePresence:new Map([['other',{vehicle:true,vehicleId:'remote'}]]),vehicleById:id=>vehicles.get(id),ensurePlayerGarageState:()=>g,hostedVehiclePassengerUids:()=>[],setGarageVehicleStored:(v,s)=>{if(v){v.garageStored=s;v.group.visible=!s;}},saveState:()=>{},syncOwnedGarageDisplayFleet:()=>{},toast:()=>{}});
 for(const name of['garageStorageBlock','garageStoreHere','garageStoreAll'])vm.runInContext(extract(garage,name),c);c.storeOwnedVehicle=(id)=>c.garageStoreHere(id);const result=c.garageStoreAll();assert.equal(result.stored.length,3);assert.equal(result.blocked.length,3);for(const id of['base','unit-2','unit-3']){assert(g.stored[id]);assert(!vehicles.get(id).group.visible);assert(!clones.get(id).visible);assert.equal(g.slots[id],'');}assert(vehicles.get('npc-delivery').group.visible);assert.equal(state.vehicles.partDurability['unit-2'],37);assert(c.world.workshopLifts[0].disassembly.engine);assert.equal(state.vehicles.owned.length,6);
});
