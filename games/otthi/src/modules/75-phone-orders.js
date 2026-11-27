/** Purchases share the physical shop catalog and arrive as real world orders.
 * Pending orders and receipts live with the existing player vehicle save. */
// @otthi-module-body
 function phoneOrders(){const v=state.vehicles;if(!Array.isArray(v.phoneOrders))v.phoneOrders=[];return v.phoneOrders;}
 function phoneOrderItem(order){return order.kind==='fuel'?{name:'Socorro de combustível',fuel:true,amount:order.litres}:worldShopItems().find(i=>(i.tool||i.key)===order.itemKey)||null;}
 function phoneItemUnavailable(item){return !!(item.tool&&state.tools.owned.includes(item.tool)||item.unique&&(state.inventory[item.key]||0)>0||phoneOrders().some(o=>o.kind==='parcel'&&o.itemKey===(item.tool||item.key)&&['queued','en-route','ready'].includes(o.status)&&(item.tool||item.unique)));}
 function phonePickupPoint(vehicle,origin,avoid=[]){
  const road=groundServiceRoadProjection(origin);if(!road)return null;const {a,b}=road,d=Math.hypot(b.x-a.x,b.z-a.z)||1,fx=(b.x-a.x)/d,fz=(b.z-a.z)/d,yaw=Math.atan2(fx,fz);
  for(const along of[0,6,-6,12,-12,20,-20,30,-30])for(const side of[1.35,-1.35,0]){const p={x:road.point.x+fx*along-fz*side,z:road.point.z+fz*along+fx*side,yaw};if(!avoid.some(previous=>distance2D(previous,p)<2)&&v704RoadAt(p.x,p.z,.1,false)&&phoneVehiclePoseClear(vehicle,p.x,p.z,yaw,true))return p;}return null;
 }
 function phoneOrderOnMap(order){return inRioMap()?order.map==='rio-preto':!order.map||typeof rioCompactWorld==='function'&&rioCompactWorld()&&order.map==='rio-preto';}
 function phoneNewOrder(kind,label,price){return{id:'order-'+crypto.randomUUID(),kind,label,price,status:'queued',at:Date.now(),owner:sharedWorldOwnId(),...(inRioMap()?{map:'rio-preto'}:{})};}
 function phoneFuelSupported(){return typeof rioFuelCapacity==='function'&&(inRioMap()||typeof rioCompactWorld==='function'&&rioCompactWorld());}
 function phoneFuelVehicle(order,restore=false){
  if(!phoneFuelSupported()||!state.vehicles.owned.includes(order.fuelVehicleId)||vehicleStoredOnMap(order.fuelVehicleId))return null;
  let v=vehicleById(order.fuelVehicleId);
  if(!v&&restore){
   const pose=inRioMap()?rioMapSave().roadVehicles?.[order.fuelVehicleId]:state.vehicles.parked?.[order.fuelVehicleId];
   if(pose&&Number.isFinite(pose.x)&&Number.isFinite(pose.z))v=ensureCatalogVehicle(order.fuelVehicleId,1,pose);
  }
  return v?.group.visible&&rioFuelCapacity(v)?v:null;
 }
 function phoneFuelDestination(courier,order,avoid=[]){
  const v=phoneFuelVehicle(order,true);if(!v||v.occupied||v.phoneDelivery)return null;
  const p=phonePickupPoint(courier,v.group.position,avoid);
  return p&&distance2D(p,v.group.position)<=28?p:null;
 }
 function phoneFuelOrders(){return phoneOrders().filter(o=>o.kind==='fuel'&&phoneOrderOnMap(o)&&o.owner===sharedWorldOwnId()&&['queued','en-route','ready'].includes(o.status));}
 function phoneCanBuyFuel(vehicle){
  return !!vehicle&&!vehicle.occupied&&!vehicle.phoneDelivery&&phoneDispatchAllowed()&&!worldPhone.job&&!worldPhone.pending&&
   !worldPhone.purchasePending&&!worldPhone.returning.length&&!phoneFuelOrders().length&&distance2D(player,vehicle.group.position)<=18;
 }
 function phoneBuyFuel(vehicleId,requested){
  const probe={fuelVehicleId:vehicleId},vehicle=phoneFuelVehicle(probe),owner=sharedWorldOwnId();
  if(!phoneCanBuyFuel(vehicle))return false;
  const q=rioFuelQuote(rioFuelCapacity(vehicle),rioFuelLevel(vehicle),Number(state.profile.coins),Number(requested));if(q.litres<=0)return false;
  openModal('Socorro de combustível',`<p>${q.litres.toFixed(1)} L para ${escapeHtml(vehicle.label)} · ${q.price} moedas.</p><p>Aproxime-se da van quando chegar. Desembarque e mantenha o carro parado.</p><div class="modal-actions"><button class="btn primary" data-yes>CHAMAR SOCORRO</button><button class="btn" data-no>VOLTAR</button></div>`,root=>{
   root.querySelector('[data-no]').onclick=openPhoneFuel;
   const confirm=root.querySelector('[data-yes]');
   confirm.onclick=()=>{
    if(!confirm.isConnected)return;
    if(owner!==sharedWorldOwnId()||phoneFuelVehicle(probe)!==vehicle||!phoneCanBuyFuel(vehicle))return;
    const available=rioFuelQuote(rioFuelCapacity(vehicle),rioFuelLevel(vehicle),Number(state.profile.coins),q.litres);
    if(available.litres!==q.litres||available.price!==q.price){openPhoneFuel();toast('Confira o saldo e o espaço no tanque antes de chamar o socorro.','warn',3000);return;}
    const order=phoneNewOrder('fuel',`${q.litres.toFixed(1)} L · ${vehicle.label}`,q.price);
    Object.assign(order,{fuelVehicleId:vehicleId,litres:q.litres,fuelUnitPrice:RIO_FUEL_PRICE});
    phoneOrders().push(order);
    if(!phoneStartParcel(order,q.price)){
     phoneOrders().pop();
     toast('Não há trajeto ou parada segura para o socorro. Nada foi cobrado.','warn',3500);return;
    }
    closeModal();toast('Socorro a caminho. O combustível entra no tanque durante o atendimento junto ao carro.','good',3800);
   };
  });
  return true;
 }
 function phoneRefundFuel(order){
  if(order.kind!=='fuel'||order.owner!==sharedWorldOwnId()||!['queued','en-route','ready'].includes(order.status))return false;
  order.status='cancelled';order.fuelService='cancelled';order.refundedAt=Date.now();
  if(order.paidAt&&Number.isFinite(order.price)&&order.price>0)addCoins(order.price);
  saveState(true);return true;
 }
 function phoneCancelFuelOrder(id){
  const order=phoneFuelOrders().find(o=>o.id===id);if(!order)return false;
  if(!phoneRefundFuel(order))return false;
  const job=worldPhone.job;
  if(job?.orderId===id){
   if(!phoneFuelSendDriverBack(job,job.fuelTransfer,true))phoneReturnCourier(job);
  }
  toast('Socorro cancelado e moedas devolvidas.','good',2500);return true;
 }
 function openPhoneFuel(){
  if(!phoneFuelSupported())return;
  const vehicles=(world.vehicles||[]).filter(v=>phoneFuelVehicle({fuelVehicleId:v.id})===v&&distance2D(player,v.group.position)<=18),orders=phoneFuelOrders(),busy=!!worldPhone.job||worldPhone.pending||worldPhone.purchasePending||worldPhone.returning.length>0||orders.length>0;
  openModal('⛽ Socorro de combustível',`<section class="world-phone"><p>A equipe parte do posto e leva combustível até o seu carro. Desembarque e mantenha-o parado. A cobrança ocorre uma vez ao aceitar uma rota; cancelar antes de abastecer devolve as moedas.</p><p>Saldo: <b>${state.profile.coins} moedas</b> · ${RIO_FUEL_PRICE} moedas/L.</p>${orders.map(o=>`<p role="status">${escapeHtml(o.label)} · ${o.status==='ready'?'Equipe chegou — aproxime-se da van':'Equipe a caminho'}</p><button class="btn" data-phone-fuel-cancel="${escapeHtml(o.id)}">CANCELAR SOCORRO E DEVOLVER MOEDAS</button>`).join('')}${!phoneDispatchAllowed()?'<p>Saia do veículo e fique em uma área externa para chamar o socorro.</p>':''}${vehicles.map(v=>`<div class="world-phone-vehicle"><label>${escapeHtml(v.label)} · ${rioFuelLevel(v).toFixed(1)} / ${rioFuelCapacity(v)} L<input data-phone-fuel-litres="${escapeHtml(v.id)}" type="number" min="0.1" max="${Math.min(20,rioFuelCapacity(v)-rioFuelLevel(v))}" step="0.1" value="${Math.min(5,rioFuelCapacity(v)-rioFuelLevel(v))}" inputmode="decimal"></label><button class="btn primary" data-phone-fuel-buy="${escapeHtml(v.id)}" ${busy||!phoneDispatchAllowed()||v.occupied||rioFuelCapacity(v)-rioFuelLevel(v)<.1?'disabled':''}>SOLICITAR COMBUSTÍVEL</button></div>`).join('')||'<p>Aproxime-se de um veículo próprio fora da garagem. Bicicletas, aeronaves e embarcações não usam este serviço.</p>'}<button class="btn" data-phone-fuel-back>VOLTAR AO CELULAR</button></section>`,root=>{
   root.querySelector('[data-phone-fuel-back]').onclick=openWorldPhone;
   root.querySelectorAll('[data-phone-fuel-buy]').forEach(b=>b.onclick=()=>phoneBuyFuel(b.dataset.phoneFuelBuy,Number([...root.querySelectorAll('[data-phone-fuel-litres]')].find(i=>i.dataset.phoneFuelLitres===b.dataset.phoneFuelBuy)?.value)));
   root.querySelectorAll('[data-phone-fuel-cancel]').forEach(b=>b.onclick=()=>{phoneCancelFuelOrder(b.dataset.phoneFuelCancel);openPhoneFuel();});
  });
 }
 function phoneFuelFootBlocked(x,z,courier,boarding=false){
  const traffic=nearbyTrafficActors(x,z,5).filter(actor=>actor.ref!==courier);
  return positionBlockedForPlayer(x,z,.25,{trafficCandidates:traffic,ignoreActor:boarding?courier:undefined});
 }
 function phoneFuelFootClear(courier,a,b,boarding=false){
  const length=distance2D(a,b),steps=Math.max(1,Math.ceil(length/.24)),ground=groundHeightAt(a.x,a.z);
  for(let i=1;i<=steps;i++){const t=i/steps,x=lerp(a.x,b.x,t),z=lerp(a.z,b.z,t);if(phoneFuelFootBlocked(x,z,courier,boarding)||Math.abs(groundHeightAt(x,z)-ground)>.5)return false;}return true;
 }
 function phoneFuelServicePoints(courier,vehicle,longitudinal,spacings){
  const {position:p,rotation}=vehicle.group,yaw=rotation.y,data=vehicle.group.userData.brazilRoot?.userData;
  const width=Number(data?.halfWidth)||.9,fx=Math.sin(yaw),fz=Math.cos(yaw),found=[];
  for(const offset of longitudinal)for(const spacing of spacings)for(const side of[1,-1]){
   const x=p.x+fx*offset+fz*(width+spacing)*side,z=p.z+fz*offset-fx*(width+spacing)*side;
   if(!phoneFuelFootBlocked(x,z,courier))found.push({x,z,y:groundHeightAt(x,z),capX:p.x+fx*offset+fz*width*side,capZ:p.z+fz*offset-fx*width*side});
  }
  return found;
 }
 function phoneFuelFootRoute(courier,from,goals,yaw=0){
  return phoneDetourSteps({x:from.x,z:from.z,yaw},goals,(a,b)=>phoneFuelFootClear(courier,a,b),{step:.75,maxNodes:700,radius:36});
 }
 function phoneFuelVanExits(courier,seat){
  return phoneFuelServicePoints(courier,courier,[.65,0,-.65],[.55,1])
   .filter(exit=>phoneFuelFootClear(courier,exit,seat,true));
 }
 function phoneFuelRetryReturn(t){
  t.phase='return-search';t.elapsed=2;t.returnSearch=null;
 }
 function phoneFuelDisposeTransfer(job){
  const t=job?.fuelTransfer;if(!t)return;
  for(const root of[t.kit,t.visual]){root?.parent?.remove(root);if(root)disposeDetachedVisual(root);}job.fuelTransfer=null;
 }
 function phoneFuelStartTransfer(job,order){
  if(job.fuelTransfer||!phoneDispatchAllowed()||order.status!=='ready'||order.owner!==sharedWorldOwnId())return false;
  const v=phoneFuelVehicle(order);if(!v||v.occupied||distance2D(player,v.group.position)>30||distance2D(job.vehicle.group.position,v.group.position)>28){toast('Deixe o carro parado perto da equipe e desembarque antes de abastecer.','warn',3000);return false;}
  const initial=rioFuelLevel(v),litres=Math.floor(Math.min(order.litres,rioFuelCapacity(v)-initial)*10+1e-6)/10;if(litres<=0){toast('O tanque não tem espaço. Cancele o pedido para receber as moedas de volta.','warn',3200);return false;}
  const seat=job.driver.group.getWorldPosition(new THREE.Vector3());
  const exits=phoneFuelVanExits(job.vehicle,seat),goals=phoneFuelServicePoints(job.vehicle,v,[-.7,0,.7],[.42,.65]);
  if(!exits.length||!goals.length){toast('Não há acesso seguro a pé para a equipe. Libere a lateral do carro.','warn',2800);return false;}
  const exit=exits.sort((a,b)=>distance2D(a,v.group.position)-distance2D(b,v.group.position))[0];
  job.fuelTransfer={phase:'planning',vehicleId:v.id,initial,litres,pose:{x:v.group.position.x,z:v.group.position.z,yaw:v.group.rotation.y},seat,exit,goals,elapsed:0,progress:0,walked:[exit],search:phoneFuelFootRoute(job.vehicle,exit,goals,job.route.yaw)};
  order.fuelService='preparing';saveState(true);closeModal();toast('A equipe está preparando o acesso e o galão. O tanque ainda não foi abastecido.','info',3000);return true;
 }
 function phoneFuelMakeKit(job,t){
  t.kit=new THREE.Group();t.kit.name='OT_ROADSIDE_FUEL_CAN';job.driver.group.add(t.kit);t.kit.position.set(.48,.9,.1);
  const red=campaignMaterial(0xd84727,.08),black=campaignMaterial(0x242a2c,.18);
  campaignBox(t.kit,red,0,0,0,.32,.42,.19);campaignBox(t.kit,black,0,.27,0,.22,.06,.08);campaignBox(t.kit,black,.12,.22,0,.12,.08,.08);
  t.visual=new THREE.Group();t.visual.name='OT_ROADSIDE_FUEL_TRANSFER';worldGroup.add(t.visual);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
  t.stream=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xe4c44d,transparent:true,opacity:.8}));t.stream.visible=false;t.visual.add(t.stream);
 }
 function phoneReturnCourier(job){
  phoneFuelDisposeTransfer(job);if(job.vehicle.group.userData.phoneParcel)job.vehicle.group.userData.phoneParcel.visible=false;
  job.ready=false;job.kind='return';job.target=job.origin;job.route=new PhoneDriveRoute(phoneGroundRoute(job.vehicle,{x:job.route.x,z:job.route.z,yaw:job.route.yaw},job.origin),job.route.yaw);worldPhone.returning.push(job);worldPhone.job=null;
 }
 function phoneFuelFinish(job,order,t,v){
  if(worldPhone.job!==job||job.fuelTransfer!==t||!job.ready||t.phase!=='pour'||t.progress<1||order.status!=='ready'||!order.paidAt||order.owner!==sharedWorldOwnId()||v.id!==order.fuelVehicleId||Math.abs(rioFuelLevel(v)-t.initial)>.001)return false;
  const after=Math.min(rioFuelCapacity(v),t.initial+t.litres),unitPrice=order.fuelUnitPrice||RIO_FUEL_PRICE,amount=Math.min(order.price,Math.ceil(unitPrice*t.litres-1e-9)),refund=order.price-amount;
  order.status='delivered';order.receivedAt=Date.now();order.deliveredLitres=t.litres;order.fuelBefore=t.initial;order.fuelAfter=after;order.fuelService='completed';order.chargedPrice=amount;order.refundedPrice=refund;
  rioRoadVehicleSave(v.id).fuel=order.fuelAfter;
  if(refund>0)addCoins(refund);
  addXP(5);saveState(true);updateHUD();toast(t.litres.toFixed(1)+' L abastecidos. O tanque e o recibo foram salvos.','good',3500);return true;
 }
 function phoneFuelSendDriverBack(job,t,release=false){
  if(!t)return false;
  t.release=release||t.release;t.unwinding=true;
  if(t.phase==='planning'){phoneFuelDisposeTransfer(job);return false;}
  if(['exit','back','return-search','embark'].includes(t.phase))return true;
  const driver=job.driver;
  t.stream.visible=false;t.kit.rotation.z=0;
  driver.rightArm.rotation.x=0;
  t.phase='back';t.points=t.walked.slice().reverse();t.index=0;t.elapsed=0;t.blockedFor=0;
  return true;
 }
 function phoneFuelInterrupt(job,order,t,why){
  order.fuelService='interrupted';phoneFuelSendDriverBack(job,t);
  saveState(true);toast(why+' Nenhum litro foi creditado. Tente novamente ou cancele para receber as moedas.','warn',4500);
 }
 function phoneFuelUpdateTransfer(job,dt){
  const t=job.fuelTransfer,order=phoneOrders().find(o=>o.id===job.orderId);if(!t||!order||order.owner!==sharedWorldOwnId()||job.owner!==order.owner)return;
  const v=phoneFuelVehicle(order),yaw=(v?.group.rotation.y??0)-t.pose.yaw;
  if(!t.unwinding&&(!v||v.occupied||distance2D(v.group.position,t.pose)>.35||Math.abs(Math.atan2(Math.sin(yaw),Math.cos(yaw)))>.12||Math.abs(rioFuelLevel(v)-t.initial)>.001||distance2D(player,t.pose)>32)){
   phoneFuelInterrupt(job,order,t,'Mantenha o carro parado e permaneça perto da equipe.');return;
  }
  const driver=job.driver,p=driver.group.position;t.elapsed+=dt;
  if(t.phase==='planning'){
   const result=t.search.next();if(!result.done)return;
   if(!result.value||!phoneFuelFootClear(job.vehicle,t.seat,t.exit,true)){phoneFuelInterrupt(job,order,t,'Libere a passagem até a lateral do carro.');return;}
   t.points=result.value.points;t.goal=t.goals[result.value.goalIndex];t.index=1;
   worldGroup.attach(driver.group);driver.group.scale.setScalar(.65);driver.leftLeg.rotation.x=driver.rightLeg.rotation.x=0;driver.leftArm.rotation.x=driver.rightArm.rotation.x=0;
   t.phase='exit';t.elapsed=0;phoneFuelMakeKit(job,t);return;
  }
  if(t.phase==='exit'){
   const f=clamp(t.elapsed/.85,0,1);p.set(lerp(t.seat.x,t.exit.x,f),lerp(t.seat.y,t.exit.y,f),lerp(t.seat.z,t.exit.z,f));
   if(f>=1){t.phase=t.unwinding?'embark':'walk';t.elapsed=0;}return;
  }
  if(t.phase==='return-search'){
   if(!t.returnSearch){
    if(t.elapsed<2)return;
    const exits=phoneFuelVanExits(job.vehicle,t.seat);
    t.elapsed=0;if(!exits.length)return;
    t.returnSearch={exits,steps:phoneFuelFootRoute(job.vehicle,p,exits,driver.group.rotation.y)};
   }
   const search=t.returnSearch,result=search.steps.next();if(!result.done)return;
   t.returnSearch=null;t.elapsed=0;
   if(result.value){t.exit=search.exits[result.value.goalIndex];t.points=result.value.points;t.index=1;t.phase='back';t.blockedFor=0;}
   return;
  }
  if(t.phase==='walk'||t.phase==='back'){
   const point=t.points[t.index];if(!point){
    if(t.phase==='back'&&!phoneFuelFootClear(job.vehicle,p,t.seat,true)){phoneFuelRetryReturn(t);return;}
    t.phase=t.phase==='back'?'embark':'pour';t.elapsed=0;driver.leftLeg.rotation.x=driver.rightLeg.rotation.x=0;return;
   }
   const d=distance2D(p,point),step=Math.min(d,dt*1.7),next=d>.001?{x:p.x+(point.x-p.x)/d*step,z:p.z+(point.z-p.z)/d*step}:{x:p.x,z:p.z};
   if(!phoneFuelFootClear(job.vehicle,p,next)){
    t.blockedFor=(t.blockedFor||0)+dt;
    if(t.blockedFor>=2){
     if(t.phase==='walk')phoneFuelInterrupt(job,order,t,'A passagem a pé ficou bloqueada.');
     else phoneFuelRetryReturn(t);
    }
    return;
   }
   t.blockedFor=0;
   if(d>.001)driver.group.rotation.y=Math.atan2(point.x-p.x,point.z-p.z);
   p.set(next.x,groundHeightAt(next.x,next.z),next.z);const swing=Math.sin(t.elapsed*9)*.4;driver.leftLeg.rotation.x=swing;driver.rightLeg.rotation.x=-swing;
   if(step>=d-.001){if(t.phase==='walk')t.walked.push({x:p.x,z:p.z});t.index++;}return;
  }
  if(t.phase==='pour'){
   t.progress=clamp(t.elapsed/Math.max(4,t.litres*.7),0,1);driver.group.rotation.y=Math.atan2(v.group.position.x-p.x,v.group.position.z-p.z);driver.rightArm.rotation.x=-.8;t.kit.rotation.z=-.65;t.stream.visible=true;
   const from=t.kit.getWorldPosition(new THREE.Vector3()),a=t.stream.geometry.attributes.position.array;
   a.set([from.x,from.y+.2,from.z,t.goal.capX,groundHeightAt(v.group.position.x,v.group.position.z)+.8,t.goal.capZ]);t.stream.geometry.attributes.position.needsUpdate=true;t.stream.geometry.computeBoundingSphere();
   if(t.progress>=1){
    if(phoneFuelFinish(job,order,t,v))phoneFuelSendDriverBack(job,t,true);
    else phoneFuelInterrupt(job,order,t,'A equipe não conseguiu concluir o abastecimento.');
   }
   return;
  }
  if(t.phase==='embark'){
   const f=clamp(t.elapsed/.85,0,1),next={x:lerp(t.exit.x,t.seat.x,f),z:lerp(t.exit.z,t.seat.z,f)};
   if(!phoneFuelFootClear(job.vehicle,p,next,true)){
    if(t.elapsed<=dt)phoneFuelRetryReturn(t);else t.elapsed-=dt;
    return;
   }
   p.set(next.x,lerp(groundHeightAt(t.exit.x,t.exit.z),t.seat.y,f),next.z);
   if(f>=1){phoneDriverInVehicle(driver,job.vehicle);if(t.release)phoneReturnCourier(job);else phoneFuelDisposeTransfer(job);}
  }
 }
 function phoneCourierVehicle(){
  const pose=inRioMap()?RIO_GARAGE_BAY:null;
  const v=vehicleById('phone-parcel-courier')||createToyCar(pose?.x??-30,pose?.z??-20,{id:'phone-parcel-courier',label:inRioMap()?'Entrega do comércio local':'Entrega do Mercadinho',brazilModel:'kombi',bodyType:'utility',primary:0xe3b344,secondary:0x28596a,parkedPose:pose,garageStored:true});v.phoneCourier=true;return v;
 }
 function phoneReleaseCourier(job){
  phoneFuelDisposeTransfer(job);
  phoneRemoveDriver(job.driver);const v=job.vehicle;v.occupied=false;v.phoneDelivery=false;v.garageStored=true;v.group.visible=false;v.currentSpeed=0;if(!inRioMap())delete state.vehicles.parked[v.id];world.trafficSnapshot=null;
 }
 function phoneStartParcel(order,payment=0){
  if(worldPhone.job||worldPhone.pending||worldPhone.returning.length||!phoneDispatchAllowed()||!phoneOrderOnMap(order)||order.owner!==sharedWorldOwnId())return false;
  const fuel=order.kind==='fuel';
  if(fuel&&(!Number.isFinite(order.litres)||order.litres<=0||!Number.isFinite(order.price)||order.price<=0||
   (payment>0?(payment!==order.price||order.paidAt||state.profile.coins<payment):!order.paidAt)))return false;
  const vehicle=phoneCourierVehicle();vehicle.garageStored=true;vehicle.group.visible=false;
  const shop=MAP_LOCATIONS.find(l=>l.id==='shop')||{x:-30,z:-20},origin={x:Number(shop.navX??shop.x),z:Number(shop.navZ??shop.z)};
  let from=order.pose&&[order.pose.x,order.pose.z,order.pose.yaw].every(Number.isFinite)?{...order.pose}:null;
  if(from&&!phoneVehiclePoseClear(vehicle,from.x,from.z,from.yaw,true))return false;
  const target=order.status==='ready'&&order.target?order.target:fuel?phoneFuelDestination(vehicle,order):phoneGroundDestination(vehicle);if(!target)return false;
  const sources=fuel?rioFunctionalSites().filter(s=>s.kind==='fuel').sort((a,b)=>distance2D(a,target)-distance2D(b,target)):inRioMap()?rioFunctionalSites().filter(s=>s.kind==='market'||s.kind==='mall').sort((a,b)=>distance2D(a,target)-distance2D(b,target)):[origin];
  let points=[];
  for(const source of from?[from]:sources){
   const start=from||phonePickupPoint(vehicle,source);if(!start)continue;
   const route=order.status==='ready'?[start,{...start}]:phoneGroundRoute(vehicle,start,target);
   if(route.length>=2){from=start;points=route;break;}
  }
  if(!points.length)return false;
  const driver=phoneMakeDriver();vehicle.occupied=true;vehicle.phoneDelivery=true;vehicle.garageStored=false;vehicle.group.position.set(from.x,groundHeightAt(from.x,from.z),from.z);vehicle.group.rotation.y=from.yaw;vehicle.group.visible=true;phoneDriverInVehicle(driver,vehicle);
  const job={id:vehicle.id,kind:'parcel',orderId:order.id,vehicle,driver,target,origin:order.origin||from,route:new PhoneDriveRoute(points,from.yaw),owner:sharedWorldOwnId(),saveAt:0,waiting:false,caller:fuel?null:{x:player.x,z:player.z}};
  worldPhone.job=job;order.origin=job.origin;order.target=target;if(order.status!=='ready')order.status='en-route';phoneSaveParcelPose(job);
  if(payment>0){if(fuel)order.paidAt=Date.now();addCoins(-payment);}
  if(inRioMap()||fuel)phoneWaypoint(target,fuel?'Receber socorro de combustível':'Receber encomenda');
  saveState(true);world.trafficSnapshot=null;
  if(order.status==='ready')phoneParcelArrived(job);return true;
 }
 function phoneSaveParcelPose(job){const order=phoneOrders().find(o=>o.id===job.orderId);if(order){order.pose={x:job.vehicle.group.position.x,z:job.vehicle.group.position.z,yaw:job.vehicle.group.rotation.y};order.target={...job.target};}}
 function phoneParcelArrived(job){
  if(job.ready)return;const order=phoneOrders().find(o=>o.id===job.orderId);if(!order)return;
  const fuel=order.kind==='fuel';job.ready=true;job.fuelOrder=fuel;order.status='ready';
  // Only a completed receipt survives a restart. A partial animation always
  // starts again from the arrived van without debiting or adding any fuel.
  if(fuel)order.fuelService='waiting';
  phoneSaveParcelPose(job);
  const v=job.vehicle;let parcel=v.group.userData.phoneParcel;if(!parcel){parcel=campaignBox(v.group,campaignMaterial(0xae793f,.05),0,.5,-2.5,.8,.8,.8);v.group.userData.phoneParcel=parcel;}parcel.material?.color?.setHex(fuel?0xd84727:0xae793f);parcel.visible=true;
  const id='phone-parcel-pickup';
  if(!world.interactables.some(i=>i.id===id))registerInteractable({
   id,type:'shop',icon:'📦',
   getLabel:()=>worldPhone.job?.fuelOrder?'Equipe de combustível':'Receber minha encomenda',
   getActionLabel:()=>worldPhone.job?.fuelOrder?'Abastecer':'Receber encomenda',
   getPos:()=>worldPhone.job?.vehicle.group.position||{x:0,z:0},radius:6,priority:820,
   available:()=>!!worldPhone.job?.ready&&worldPhone.job.kind==='parcel'&&!worldPhone.job.fuelTransfer,
   action:phoneReceiveParcel
  });
  world.interactables.find(i=>i.id===id).icon=fuel?'⛽':'📦';
  saveState(true);toast(order.kind==='fuel'?'O socorro chegou. Aproxime-se da van e use ABASTECER VEÍCULO.':'Sua encomenda chegou. Aproxime-se da van e use RECEBER ENCOMENDA.','good',4000);
 }
 function phoneReceiveParcel(){
  const job=worldPhone.job;if(!job?.ready||job.kind!=='parcel'||Math.hypot(player.x-job.vehicle.group.position.x,player.z-job.vehicle.group.position.z)>6)return false;
  const order=phoneOrders().find(o=>o.id===job.orderId),item=order&&phoneOrderItem(order);if(!item||order.status!=='ready'||order.owner!==sharedWorldOwnId())return false;
  if(item.fuel)return phoneFuelStartTransfer(job,order);
  // Receipt and item grant are saved in one synchronous transaction. Repeating
  // the pickup, reopening a menu, or reloading cannot grant the order twice.
  order.status='delivered';order.receivedAt=Date.now();
  if(item.tool){state.tools.owned=[...new Set([...state.tools.owned,item.tool])];state.tools.equipped=item.tool;refreshEquippedToolVisual();}else state.inventory[item.key]=(state.inventory[item.key]||0)+item.amount;
  addXP(5);saveState(true);updateHUD();if(job.vehicle.group.userData.phoneParcel)job.vehicle.group.userData.phoneParcel.visible=false;
  phoneReturnCourier(job);toast(item.name+' recebido!','good',2600);return true;
 }
 function phoneCancelParcel(job){
  const order=phoneOrders().find(o=>o.id===job.orderId);if(order?.owner&&order.owner!==sharedWorldOwnId())return false;
  if(order?.kind==='fuel')return phoneCancelFuelOrder(order.id);
  if(order&&['queued','en-route','ready'].includes(order.status)){order.status='cancelled';order.refundedAt=Date.now();addCoins(order.price);saveState(true);}phoneReleaseCourier(job);worldPhone.job=null;toast(order?.status==='delivered'?'Atendimento concluído; equipe liberada.':'Compra cancelada e moedas devolvidas.','good',2800);
 }
 async function phoneBuyParcel(key){
  const item=worldShopItems().find(i=>(i.tool||i.key)===key);if(!item||worldPhone.pending||worldPhone.purchasePending||worldPhone.job||!phoneDispatchAllowed()||phoneItemUnavailable(item)||state.profile.coins<item.price)return false;
  const owner=sharedWorldOwnId();worldPhone.purchasePending=true;
  try{
   if(!await confirmModal('Comprar com entrega',`${item.icon} ${item.name} · ${item.price} moedas. ${inRioMap()?'O comércio local envia a sua encomenda.':'O entregador vem do Mercadinho; você recebe a encomenda no mundo.'}`,'COMPRAR','VOLTAR'))return false;
   if(owner!==sharedWorldOwnId()||worldPhone.job||!phoneDispatchAllowed()||phoneItemUnavailable(item)||state.profile.coins<item.price)return false;
   const order=phoneNewOrder('parcel',item.name,item.price);order.itemKey=key;const orders=phoneOrders();orders.push(order);
   if(inRioMap()){
    if(!phoneStartParcel(order,item.price)){
     orders.pop();toast('Não há saída ou vaga segura para a entrega. A compra não foi cobrada.','warn',3200);return false;
    }
   }else{addCoins(-item.price);saveState(true);phoneStartParcel(order);}
   closeModal();toast('Compra confirmada. Acompanhe a encomenda no celular e no mapa.','good',3300);return order.id;
  }finally{worldPhone.purchasePending=false;}
 }
 async function phoneBuyVehicle(catalogId){
  const base=garageOldCatalogEntry(catalogId);if(!base||worldPhone.purchasePending||worldPhone.pending||worldPhone.job||!phoneDispatchAllowed())return false;const owner=sharedWorldOwnId();worldPhone.purchasePending=true;
  try{
   const units=garageOwnedEntries().filter(e=>e.catalogId===catalogId);if(units.length>=10||state.profile.coins<base.price)return false;
   if(!await confirmModal('Comprar veículo com entrega',`${base.label} · ${base.price} moedas. O motorista traz esta nova unidade ${inRioMap()?'do ponto de retirada':'da concessionária'} até uma vaga perto de você.`,'COMPRAR','VOLTAR'))return false;
   if(!await requestBrazilModel(base.model||brazilModelKey(base.id,base.category)))return false;
   if(owner!==sharedWorldOwnId()||worldPhone.job||!phoneDispatchAllowed()||state.profile.coins<base.price||garageOwnedEntries().filter(e=>e.catalogId===catalogId).length>=10)return false;
   const unit=garageUnitId(catalogId),id=garageNewInstanceId(catalogId,unit.unit),g=ensurePlayerGarageState(),order=phoneNewOrder('vehicle',base.label,base.price);order.vehicleId=id;order.status='en-route';
   state.vehicles.instances||={};state.vehicles.instances[id]={catalogId,unit:unit.unit,purchasedAt:Date.now()};state.vehicles.owned.push(id);g.stored[id]=true;g.purchasedAt[id]=Date.now();
   const vehicle=ensureCatalogVehicle(id,1,inRioMap()?RIO_GARAGE_BAY:null),dealer=OTTHI_DEALERS.find(d=>d.category===neighborhoodVehicleCategory(base));
   const origin=inRioMap()?RIO_GARAGE_BAY:dealer&&{x:dealer.entryX,z:dealer.entryZ},from=vehicle&&origin&&phonePickupPoint(vehicle,origin);
   phoneOrders().push(order);const ok=from&&await phoneDispatchGround(id,{from,payment:base.price,orderId:order.id});
   if(!ok){state.vehicles.owned=state.vehicles.owned.filter(v=>v!==id);delete state.vehicles.instances[id];delete g.stored[id];delete g.purchasedAt[id];state.vehicles.phoneOrders=phoneOrders().filter(o=>o.id!==order.id);if(vehicle){if(inRioMap())rioRemoveRoadVehicle(vehicle);else setGarageVehicleStored(vehicle,true);}saveState(true);toast('Não há saída ou vaga segura para esta entrega. A compra não foi cobrada.','info',3300);return false;}
   addXP(30);saveState(true);return id;
  }finally{worldPhone.purchasePending=false;}
 }
 function openPhoneShop(tab='items'){
  const busy=!!worldPhone.job||worldPhone.pending||worldPhone.purchasePending,allowed=phoneDispatchAllowed(),orders=phoneOrders(),pending=orders.filter(o=>phoneOrderOnMap(o)&&['queued','en-route','ready'].includes(o.status));
  const items=worldShopItems();openModal('📱 Compras com entrega',`<section class="world-phone"><p>Saldo: <b>${state.profile.coins} moedas</b>. Suas compras chegam com um entregador. Receba a encomenda para colocar os itens no inventário.</p><nav class="world-phone-actions"><button class="btn" data-phone-shop-tab="items">MERCADINHO</button><button class="btn" data-phone-shop-tab="vehicles">VEÍCULOS</button><button class="btn" data-phone-back>VOLTAR AO CELULAR</button></nav>${pending.map(o=>`<p class="world-phone-status">${escapeHtml(o.label)} · ${o.status==='ready'?'Chegou — receber no mundo':o.status==='queued'?'Aguardando entregador':'Em entrega'}</p>`).join('')}${busy?'<p>Aguarde a entrega atual antes de fazer outra compra.</p>':''}${!allowed?'<p>Desembarque e fique ao ar livre para solicitar uma entrega.</p>':''}<div class="world-phone-list">${tab==='vehicles'?OTTHI_PLAYER_VEHICLE_CATALOG.map(e=>`<button class="btn" data-phone-buy-vehicle="${escapeHtml(e.id)}" ${busy||!allowed||state.profile.coins<e.price||garageOwnedEntries().filter(u=>u.catalogId===e.id).length>=10?'disabled':''}><span>${e.icon} ${escapeHtml(e.label)}</span><small>${e.price} moedas · comprar nova unidade e receber</small></button>`).join(''):items.map(item=>`<button class="btn" data-phone-buy-item="${escapeHtml(item.tool||item.key)}" ${busy||!allowed||state.profile.coins<item.price||phoneItemUnavailable(item)?'disabled':''}><span>${item.icon} ${item.name}</span><small>${phoneItemUnavailable(item)?'Já possui / já encomendado':`${item.price} moedas · ${item.tool?'ferramenta':item.amount+' unidades'}`}</small></button>`).join('')}</div></section>`,root=>{
   root.querySelector('[data-phone-back]').onclick=openWorldPhone;root.querySelectorAll('[data-phone-shop-tab]').forEach(b=>b.onclick=()=>openPhoneShop(b.dataset.phoneShopTab));root.querySelectorAll('[data-phone-buy-item]').forEach(b=>b.onclick=()=>phoneBuyParcel(b.dataset.phoneBuyItem));root.querySelectorAll('[data-phone-buy-vehicle]').forEach(b=>b.onclick=()=>phoneBuyVehicle(b.dataset.phoneBuyVehicle));
  });
 }
 function updatePhoneOrders(dt){
  if(worldPhone.job?.fuelTransfer)phoneFuelUpdateTransfer(worldPhone.job,dt);
  for(const job of [...worldPhone.returning]){if(job.owner!==sharedWorldOwnId()){phoneReleaseCourier(job);worldPhone.returning=worldPhone.returning.filter(j=>j!==job);continue;}phoneAdvanceJob(job,dt);if(job.route.arrived){phoneReleaseCourier(job);worldPhone.returning=worldPhone.returning.filter(j=>j!==job);}}
  if(worldPhone.job||worldPhone.pending||worldPhone.returning.length||!phoneDispatchAllowed())return;
  const order=phoneOrders().find(o=>phoneOrderOnMap(o)&&['parcel','fuel'].includes(o.kind)&&['queued','en-route','ready'].includes(o.status)&&o.owner===sharedWorldOwnId());if(order){const now=performance.now();if(now-Number(worldPhone.restoreAt||0)<3000)return;worldPhone.restoreAt=now;phoneStartParcel(order);}
 }
 const phoneFuelUiBefore=phoneUpdateTrackingUI;
 phoneUpdateTrackingUI=function(){
  phoneFuelUiBefore();const root=els.modalBody;if(!root?.querySelector('.world-phone'))return;
  if(phoneFuelSupported()&&root.querySelector('[data-phone-shop]')&&!root.querySelector('[data-phone-fuel-open]')){const b=document.createElement('button');b.type='button';b.className='btn';b.dataset.phoneFuelOpen='';b.textContent='SOCORRO DE COMBUSTÍVEL';b.onclick=openPhoneFuel;root.querySelector('.world-phone-actions').prepend(b);}
  const job=worldPhone.job,order=job&&phoneOrders().find(o=>o.id===job.orderId);if(order?.kind!=='fuel')return;
  let button=root.querySelector('[data-phone-parcel-receive]');const status=root.querySelector('[data-phone-status]'),t=job.fuelTransfer,tracking=phoneDeliveryTracking();
  if(button){
   if(!button.hasAttribute('data-roadside-receive')){const next=button.cloneNode(true);next.dataset.roadsideReceive='';next.onclick=phoneReceiveParcel;button.replaceWith(next);button=next;}
   button.disabled=!!t||!job.ready||distance2D(player,job.vehicle.group.position)>6;button.textContent=t?'EQUIPE EM ATENDIMENTO':job.ready?'ABASTECER VEÍCULO':'AGUARDE O SOCORRO';
  }
  if(status)status.textContent=t?t.unwinding?'Equipe retornando à van':t.phase==='pour'?'Abastecendo · '+Math.round(t.progress*100)+'%':'Equipe preparando o galão e caminhando até o carro':job.ready?'Socorro chegou · aproxime-se da van para abastecer':`Socorro a caminho · ${Math.round(tracking?.distance||0)} m${tracking?.waiting?' · aguardando passagem':''}`;
 };
 if(typeof window!=='undefined')window.OT_WORLD_PHONE_FUEL={open:openPhoneFuel,diagnostics:()=>({orders:phoneOrders().filter(o=>o.kind==='fuel').map(o=>({...o})),service:worldPhone.job?.fuelTransfer?{phase:worldPhone.job.fuelTransfer.phase,progress:worldPhone.job.fuelTransfer.progress,vehicleId:worldPhone.job.fuelTransfer.vehicleId,litres:worldPhone.job.fuelTransfer.litres}:null})};
