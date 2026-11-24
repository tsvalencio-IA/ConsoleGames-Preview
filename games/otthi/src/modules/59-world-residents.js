/** Residents use the same physical walkways and interaction places as players. */
// @otthi-module-body
 const worldResidents={ready:false,lastAt:0,actors:[],ticks:0};
 function cityOrderPerformance(shop,item){
  const seat=shop.seat||null;
  const kind=item.hunger&&seat?(/juice|breakfast/.test(item.id)?'drink':'meal'):'bag';
  const target=seat&&kind!=='bag'?seat.approach:{x:player.x,z:player.z};
  const pose=seat&&kind!=='bag'?{...seat.chair,y:seat.y,yaw:seat.yaw,sitting:true}:
    {...target,y:player.y,yaw:player.facing};
  const commit=()=>{if(item.hunger&&seat){setFlag('ateMeal');state.stats.restaurantMeals=(state.stats.restaurantMeals||0)+1;saveState(true);evaluateMissions();}return true;};
  const seller=cityCoast.citizens.find(n=>n.commerceShop===shop.id);if(seller)seller.servingUntil=performance.now()+2800;
  if(!beginCharacterActivity(kind,{target,pose,shop,commit}))beginCharacterActivity(kind,{target:{x:player.x,z:player.z},pose:{x:player.x,y:player.y,z:player.z,yaw:player.facing},shop,commit});
 }
 function addResident(id,name,stops,color){const p=stops[0],npc=cityCommercialNPC(id,name,p.x,p.z,color);npc.cityLifeManaged=true;npc.routine={index:0,remaining:0,stops};npc.lifeAction=p.action;worldResidents.actors.push(npc);return npc;}
 function ensureWorldResidents(){
  if(worldResidents.ready||!cityCoast.ready)return;
  for(const npc of cityCoast.citizens){npc.cityLifeManaged=true;if(npc.commerceRoute)npc.routine={index:0,remaining:0,stops:npc.commerceRoute.map((p,i)=>({...p,action:i===npc.commerceRoute.length-1?'talk':'walk',duration:i===npc.commerceRoute.length-1?4:0}))};worldResidents.actors.push(npc);}
  for(const[i,x]of[-346,-258].entries()){
   const n=cityCommercialNPC('coast-vendor-'+i,i?'Cecília':'Marcos',x,490.9,[0x3c8b7b,0xaf5744][i],null,'shop-coast-'+i);n.stationaryHeading=Math.PI;n.cityLifeManaged=true;worldResidents.actors.push(n);
   addResident('coast-diner-'+i,['Patrícia','Eduardo'][i],[{x:x-5.35,z:495.5,action:'eat',duration:18,seat:.48,yaw:-Math.PI/2},{x:x-5.35,z:489,action:'walk'},{x:x-10,z:486.5,action:'talk',duration:7},{x:x-7,z:492,action:'walk'}],0xa2764f+i*0x111111);
  }
  for(let i=0;i<6;i++){const x=-397+i*31,z=502+(i%2)*4;addResident('beach-visitor-'+i,['Lara','André','Renata','Felipe','Sofia','Rafael'][i],[{x,z,action:i%2?'stretch':'talk',duration:9+i},{x:x+7,z:z+3,action:'walk'},{x:x+8,z:509,action:'look',duration:10},{x:x-2,z:z+1,action:'walk'}],[0x649ca2,0xc58b55,0x9b7399,0x538469][i%4]);}
  for(let i=0;i<3;i++){const x=-400+i*42;addResident('beach-rest-'+i,['Helena','Caio','Denise'][i],[{x:x+1.25,z:502.4,action:'sit',duration:28,seat:.20,yaw:Math.PI},{x:x+4,z:499,action:'stretch',duration:10}],[0xb27f67,0x708e9a,0x9a829c][i]);}
  for(let i=0;i<2;i++){const x=-375+i*32;addResident('beach-swimmer-'+i,['Julia','Vinícius'][i],[{x,z:522,action:'swim',duration:9,yaw:Math.PI/2},{x:x+10,z:525,action:'swim',duration:9,yaw:-Math.PI/2}],[0x7a90ad,0xc17c69][i]);}
  for(const[i,x,z]of[[0,11,179],[1,27,176],[2,10,-154],[3,37,-154]])addResident('travel-resident-'+i,['Luís','Fernanda','Joana','Henrique'][i],[{x,z,action:'look',duration:9},{x:x+4,z,action:'walk'},{x:x+4,z:z+2,action:'talk',duration:9}],[0x567b99,0xa5685b,0x6d927a,0xa58d51][i]);worldResidents.ready=true;
 }
 function poseResident(npc,action,time,seat){
  const l=npc.limbs,w=Math.sin(time*(action==='run'?12:7.5)+npc.phase),walk=action==='walk'||action==='run',swim=action==='swim',sitting=seat!==undefined;npc.lifeAction=action;npc.group.rotation.x=swim?-1.22:0;npc.group.position.y=swim?-.06:sitting?Number(seat)-.82*npc.group.scale.y:Number.isFinite(npc.rioFloorY)?npc.rioFloorY:groundHeightAt(npc.group.position.x,npc.group.position.z);
  if(l){l.leftLeg.rotation.x=swim?w*.35:sitting?-1.25:walk?-w*.4:0;l.rightLeg.rotation.x=swim?-w*.35:sitting?-1.25:walk?w*.4:0;l.leftArm.rotation.x=swim?-1.5+w*.7:walk?w*.5:action==='stretch'?-2.1+Math.sin(time*2)*.25:action==='eat'?-.45:0;l.rightArm.rotation.x=swim?-1.5-w*.7:walk?-w*.5:action==='eat'?-1.2-Math.sin(time*3)*.35:action==='talk'?-.7-Math.sin(time*4)*.22:action==='serve'?-1:action==='stretch'?-2.1-Math.sin(time*2)*.25:0;}
  if(npc.body)npc.body.position.y=1.28+(walk?Math.abs(w)*.023:Math.sin(time*2)*.006);
  if(!npc.mealProp&&action==='eat'){npc.mealProp=new THREE.Mesh(new THREE.SphereGeometry(.11,8,6),renderMat(0xd3a268));npc.mealProp.scale.y=.50;npc.mealProp.position.set(0,-.66,.07);l.rightArm.add(npc.mealProp);}if(npc.mealProp)npc.mealProp.visible=action==='eat';
 }
 function updateWorldResidents(){
  ensureWorldResidents();
  if(!worldResidents.ready||paused)return;
  const now=performance.now(),dt=Math.min(.10,Math.max(0,(now-(worldResidents.lastAt||now))/1000));
  const time=now/1000,focus=otGamesFocus(),authority=typeof sharedWorldIsAuthority!=='function'||sharedWorldIsAuthority();
  worldResidents.lastAt=now;worldResidents.ticks++;
  for(const n of worldResidents.actors){
   if(n.following||n.passengerMode||n.pendingRide||n.coopRaceMode)continue;
   const position=n.group.position,distant=distance2D(focus,position)>125;
   if(distant&&(n.rioCityLocal||now<Number(n.nextBackgroundLifeAt||0)))continue;
   const actorDt=distant?Math.min(1,Math.max(0,(now-Number(n.lastLifeAt||now))/1000)):dt;
   if(distant)n.nextBackgroundLifeAt=now+1000;
   n.lastLifeAt=now;
   const routine=n.routine;
   if(!routine){
    if(n.stationaryHeading!==undefined)n.group.rotation.y=n.stationaryHeading;
    if(!distant)poseResident(n,now<(n.servingUntil||0)?'serve':'work',time);
    continue;
   }
   const stop=routine.stops[routine.index],dx=stop.x-position.x,dz=stop.z-position.z,distance=Math.hypot(dx,dz);
   const canAdvance=authority||n.rioCityLocal;
   let action=stop.action||'look',seat;
   if(distance>.22){
    if(action==='swim'&&canAdvance){
     const step=Math.min(distance,actorDt*.75);
     position.x+=dx/distance*step;position.z+=dz/distance*step;
     n.group.rotation.y=lerpAngle(n.group.rotation.y,Math.atan2(dx,dz),Math.min(1,actorDt*6));
    }else if(action!=='swim'){
     const moved=canAdvance?v705NpcWalk(n,actorDt,stop,action==='run'?3.05:1.15,true):0;
     action=moved?(action==='run'?'run':'walk'):'look';
     if(canAdvance)routine.blockedSeconds=moved?0:(routine.blockedSeconds||0)+actorDt;
     if(routine.blockedSeconds>12&&routine.stops.length>1){
      // Resume the next authored stop when furniture or a closure prevents arrival.
      routine.index=(routine.index+1)%routine.stops.length;
      routine.blockedSeconds=0;routine.skipped=(routine.skipped||0)+1;
     }
    }
    routine.remaining=0;
   }else{
    seat=stop.seat;
    if(stop.yaw!==undefined)n.group.rotation.y=lerpAngle(n.group.rotation.y,stop.yaw,Math.min(1,actorDt*6));
    if(!routine.remaining)routine.remaining=Number(stop.duration)||.15;
    routine.remaining-=actorDt;
    if(routine.remaining<=0){routine.index=(routine.index+1)%routine.stops.length;routine.remaining=0;routine.blockedSeconds=0;}
   }
   if(distant){n.lifeAction=action;position.y=action==='swim'?-.06:groundHeightAt(position.x,position.z);}
   else poseResident(n,action,time,seat);
  }
 }
 const residentsPreviousExpansion=updateWorldExpansion;updateWorldExpansion=function(){residentsPreviousExpansion();updateWorldResidents();};
 window.OT_WORLD_RESIDENTS={diagnostics:()=>({ready:worldResidents.ready,total:world.npcs.length,navigation:{
  plans:pedestrianNavigation.plans,detours:pedestrianNavigation.detours,waits:pedestrianNavigation.waits},
  actors:worldResidents.actors.map(n=>({id:n.id,name:n.name,x:n.group.position.x,y:n.group.position.y,z:n.group.position.z,
   action:n.lifeAction||'work',visible:n.group.visible,stop:n.routine?.index??null,skipped:n.routine?.skipped||0}))})};
