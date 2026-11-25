/** Discoverable destinations and real, persistent sea craft in the native world. */
// @otthi-module-body
  const worldDestinations={ready:false,marina:null,flakes:null,lastAt:0,airSigns:new Map()};
  const MARINA_DOCK=Object.freeze({minX:-224,maxX:-216,minZ:506,maxZ:549,exitX:-220,touchDistance:5.8});
  const SEA_CRAFT=Object.freeze([
    {id:'sea-azul',label:'Lancha Azul · esportiva',x:-227,z:528,heading:-Math.PI/2,color:0x237db6,maxSpeed:22},
    {id:'sea-familia',label:'Lancha Família · passeio',x:-227,z:542,heading:-Math.PI/2,color:0x348c7c,maxSpeed:17},
    {id:'sea-coral',label:'Lancha Coral · esportiva',x:-213,z:535,heading:Math.PI/2,color:0xbf6549,maxSpeed:20}
  ]);
  function seaCraftHullGeometry(stations,openCockpit=true){
    const positions=[],indices=[];
    for(const[z,w,keel,top]of stations)for(const[x,y]of[[0,keel],[-w*.79,keel+.19],[-w,top],[w,top],[w*.79,keel+.19]])positions.push(x,y,z);
    for(let i=0;i<stations.length-1;i++)for(let j=0;j<5;j++){if(openCockpit&&j===2&&i<3)continue;const a=i*5+j,b=i*5+(j+1)%5,c=(i+1)*5+j,d=(i+1)*5+(j+1)%5;indices.push(a,d,b,a,c,d);}
    for(const e of[0,stations.length-1])for(let j=1;j<4;j++){if(e===0)indices.push(e*5,e*5+j,e*5+j+1);else indices.push(e*5,e*5+j+1,e*5+j);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  }
  function createSeaCraftModel(spec){
    const root=new THREE.Group();root.name='SPEEDBOAT_'+spec.id;
    const white=campaignMaterial(0xe4e6dc,.22),accent=campaignMaterial(spec.color,.32),dark=campaignMaterial(0x203b49,.22),seat=campaignMaterial(0xd7cfb8,.02),metal=campaignMaterial(0xa8bdc0,.7);
    // Continuous V hull, pointed bow and raised gunwales. +Z is forward.
    const stations=[[-2.5,.74,.12,.48],[-2.1,1.08,-.02,.54],[-.9,1.12,-.18,.57],[.6,1.02,-.18,.62],[1.65,.65,-.02,.75],[2.4,.04,.32,.85]];
    const hull=new THREE.Mesh(seaCraftHullGeometry(stations),white);hull.castShadow=true;root.add(hull);
    const rimPoints=side=>stations.map(([z,w,k,y])=>new THREE.Vector3(side*w,y+.025,z));
    for(const side of[-1,1]){root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPoints(side)),32,.052,7,false),accent));const stripe=stations.map(([z,w,k,y])=>new THREE.Vector3(side*(w+.008),y-.18,z));root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripe),32,.038,6,false),accent));}
    campaignBox(root,dark,0,.16,-.15,1.76,.12,3.5);
    for(const z of[.72,-.65])for(const side of[-1,1]){campaignBox(root,seat,side*.4,.36,z,.66,.14,.61);campaignBox(root,seat,side*.4,.64,z-.25,.66,.45,.13);}
    campaignBox(root,white,0,.46,1.55,1.25,.15,1.1);
    const glass=new THREE.Mesh(new THREE.PlaneGeometry(1.62,.50),new THREE.MeshStandardMaterial({color:0x5a8795,transparent:true,opacity:.58,roughness:.13,metalness:.3,side:THREE.DoubleSide}));glass.position.set(0,.94,1.02);glass.rotation.x=-.30;root.add(glass);
    for(const side of[-1,1]){campaignCylinder(root,metal,side*.8,.89,1.02,.018,.58);campaignBox(root,dark,side*.40,.68,.87,.58,.20,.31);}
    const steering=new THREE.Mesh(new THREE.TorusGeometry(.13,.018,7,20),metal);steering.position.set(.4,.79,.67);steering.rotation.x=-.4;root.add(steering);
    campaignBox(root,accent,0,.35,-2.55,.54,.75,.46);campaignBox(root,dark,0,-.19,-2.55,.14,.48,.17);
    const propeller=new THREE.Mesh(new THREE.BoxGeometry(.50,.08,.05),metal);propeller.position.set(0,-.38,-2.63);propeller.name='sea-propeller';root.add(propeller);
    root.userData.seaPropeller=propeller;root.userData.seats=[{x:.4,y:.28,z:.72},{x:-.4,y:.28,z:.72},{x:.4,y:.28,z:-.65},{x:-.4,y:.28,z:-.65}];
    return root;
  }
  function createMarina(){
    const root=new THREE.Group();root.name='COSTA_VERDE_MARINA';worldGroup.add(root);worldDestinations.marina=root;
    const wood=campaignMaterial(0xa58c68,.02),steel=campaignMaterial(0x537077,.45),white=campaignMaterial(0xe5e7d9);
    campaignBox(root,wood,-220,.38,524,8,.20,50);
    for(let z=501;z<=548;z+=.7)campaignBox(root,steel,-220,.49,z,8,.012,.025);
    for(const x of[-223.5,-216.5])for(const z of[502,515,529,545])campaignCylinder(root,steel,x,.1,z,.15,1.4);
    for(const x of[-223.8,-216.2])for(const z of[501,511,548]){campaignCylinder(root,white,x,1.05,z,.055,1.1);const lamp=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),new THREE.MeshBasicMaterial({color:0xf5e6b1}));lamp.position.set(x,1.62,z);root.add(lamp);}
    citySign(root,'GUARUJÁ · MARINA',-220,3,501,8,-1,'#1c525d',.75);
    mergeTrafficStatic(root);
    for(const spec of SEA_CRAFT){
      const group=createSeaCraftModel(spec),saved=state.boats.parked?.[spec.id],bounds=v704WorldBounds();
      const valid=saved&&[saved.x,saved.z,saved.heading].every(Number.isFinite)&&saved.x>bounds.minX+4&&saved.x<bounds.maxX-4&&saved.z<bounds.maxZ-4&&waterAt(saved.x,saved.z)?.ocean;
      const pose=valid?saved:spec,boat={...spec,heading:pose.heading,seaGoing:true,boardRadius:6.2,dock:MARINA_DOCK,group};
      group.position.set(pose.x,.1,pose.z);group.rotation.y=pose.heading;worldGroup.add(group);world.boats.set(spec.id,boat);
      registerInteractable({id:'board-'+spec.id,type:'boat',icon:'🚤',label:'Pilotar '+spec.label,radius:boat.boardRadius,priority:240,getPos:()=>({x:group.position.x,z:group.position.z}),available:()=>!player.boating&&!player.vehicle&&!otGames.active,action:()=>enterBoat(boat)});
    }
    if(rioCompactWorld())rioBuildCoastalCraft(root);
    world.navCache?.clear?.();
  }
  function seaNavigationBlocked(x,z,heading){
    if(rioMap.coastalDock&&world.boat?.seaGoing)return !rioMarineCanNavigate(world.boat,x,z,heading);
    const mine={x,z,w:1.08,l:2.68,s:Math.sin(heading),c:Math.cos(heading)},pier={x:-220,z:524,w:4,l:25,s:0,c:1};
    if(trafficBodiesOverlap(mine,pier,.06))return true;
    for(const b of world.boats?.values()||[]){if(b===world.boat||!b.seaGoing)continue;const host=[...remotePresence.values()].find(p=>p.boating&&p.boatId===b.id&&p.boatRole!=='passenger'),pose=host?{x:host.x,z:host.z,heading:host.r}:b.group.position,angle=host?Number(host.r||0):b.heading;
      if(trafficBodiesOverlap(mine,{x:pose.x,z:pose.z,w:1.08,l:2.68,s:Math.sin(angle),c:Math.cos(angle)},.08))return true;
    }return false;
  }
  function styleGhostBoat(ghost,target){
    const group=ghost?.userData.boatVisual;if(!group)return;
    const key=target.boatId||'lake-boat';if(group.userData.craftKey===key)return;
    const spec=SEA_CRAFT.find(b=>b.id===(key==='rio-lancha-familia'?'sea-familia':key));
    const model=spec?createSeaCraftModel(spec):key==='rio-prancha'?rioMakeBoard(0x35b4ad):(key==='rio-navio-passeio'||key==='rio-santos-escuna')?rioMakeTourShip():key==='rio-jet-ski'?rioMakeJetSki():null;
    group.userData.lakeParts??=group.children.slice();if(group.userData.seaModel){otGamesDisposeGroup(group.userData.seaModel);group.userData.seaModel=null;}
    for(const part of group.userData.lakeParts)part.visible=!model;
    if(model){group.add(model);group.userData.seaModel=model;}
    group.position.y=model?-.08:-.68;group.userData.craftKey=key;
  }
  const marinaGroundHeight=groundHeightAt;
  groundHeightAt=function(x,z){if(!inRioMap()&&x>=MARINA_DOCK.minX&&x<=MARINA_DOCK.maxX&&z>=499&&z<=549)return .48;const original=marinaGroundHeight(x,z),portHeight=!inRioMap()?regionalPortSurface(x,z):null;return portHeight===null?original:Math.max(original,portHeight);};
  const originalFamilyBoatSeat=familyBoatSeatOffset;
  familyBoatSeatOffset=function(i=-1){return world.boat?.seaGoing?world.boat.group.userData.seats[Math.max(0,Math.min(3,i+1))]:originalFamilyBoatSeat(i);};
  // Keep the original snow scenery and give every existing chalet its own
  // property, furnishing state and physical interior. Load the room on entry.
  const snowCabinRecords=new Map();
  function snowCabinSites(){
    return [[-52,184,'Pinheiros'],[46,184,'Araucárias'],[85,181,'Mirante']].map(([x,z,name],i)=>{
      const id='regional-campos-chale-'+(i+1);
      return {id,key:id,propertyId:id,name:'Chalé '+name+' · Campos do Jordão',
        kind:'residence',style:'snow-cabin',x,z,w:7,d:5,yaw:0,price:780+i*160,
        street:'Campos do Jordão · Serra',entry:[x,z+3.7]};
    });
  }
  // New lots are separate from the three historic chalet save identifiers.
  function regionalHomeSites(){
    const rows=[
      ['regional-campos-serra-1','Chalé Alto dos Pinheiros',-12,280,8,6,Math.PI/2,1280,'snow-cabin',[7,280]],
      ['regional-campos-serra-2','Chalé Vista da Cordilheira',72,330,8,6,-Math.PI/2,1520,'snow-cabin',[57,330]],
      ['regional-campos-serra-3','Chalé Refúgio das Araucárias',-147,393,8,6,Math.PI/2,1680,'snow-cabin',[-131,393]],
      ['regional-guaruja-casa-1','Casa Brisa do Mar',-343,458,10,8,0,1250,'beach-house',[-343,468]],
      ['regional-guaruja-casa-2','Casa dos Coqueiros',-324,458,10,8,0,1420,'beach-house',[-324,468]],
      ['regional-guaruja-casa-3','Casa Praia Azul',-280,458,10,8,0,1570,'beach-house',[-280,468]],
      ['regional-guaruja-casa-4','Casa Vista da Orla',-260,458,10,8,0,1760,'beach-house',[-260,468]],
      ['regional-guaruja-casa-5','Casa Marina',-240,458,10,8,0,1920,'beach-house',[-240,468]]
    ];
    return rows.map(([id,name,x,z,w,d,yaw,price,style,road])=>({id,key:id,propertyId:id,name,x,z,w,d,yaw,price,style,kind:'residence',
      street:style==='snow-cabin'?'Campos do Jordão · estrada da serra':'Guarujá · Avenida da Orla',
      entry:[x+Math.sin(yaw)*(d/2+1.35),z+Math.cos(yaw)*(d/2+1.35)],road}));
  }
  function regionalNatureReserve(x,z,margin=0){
    // Reserve just the new property footprints and access paths, not whole mountains.
    if(typeof rioCompactWorld==='function'&&!rioCompactWorld())return false;
    if(v704DistanceToSegment({x,z},{x:125,z:295},{x:105,z:270}).distance<margin+3.2)return true;
    return regionalHomeSites().some(s=>{
      const rotated=Math.abs(Math.sin(s.yaw))>.5,w=rotated?s.d:s.w,d=rotated?s.w:s.d;
      if(Math.abs(x-s.x)<=w/2+margin+1.4&&Math.abs(z-s.z)<=d/2+margin+1.4)return true;
      return v704DistanceToSegment({x,z},{x:s.entry[0],z:s.entry[1]},{x:s.road[0],z:s.road[1]}).distance<margin+1.5;
    });
  }
  function registerSnowCabin(site,facade,wall){
    const entrance={x:site.entry[0],z:site.entry[1]};
    const record={site,facade,wall,room:null,inside:false};
    snowCabinRecords.set(site.id,record);
    const available=()=>facade.visible&&!record.inside&&!rioMap.indoorRoom&&rioPlayerAt(entrance,3.3);
    function ensureRoom(){
      if(record.room)return record.room;
      const room=rioMountPlace(site,worldGroup);
      record.room=room;room.legacyResidence=true;room.legacyRecord=record;
      room.root.visible=false;
      for(const c of room.colliders)c.disabled=true;
      room.action('chalet-exit',site.style==='beach-house'?'Sair da casa':'Sair do chalé',0,site.d*.31,leave,{inside:true,icon:'🚪',radius:1.4,priority:260});
      return room;
    }
    function move(p){
      player.x=p.x;player.z=p.z;player.y=groundHeightAt(p.x,p.z);
      player.vx=player.vy=player.vz=0;player.grounded=true;
      playerGroup.position.set(player.x,player.y,player.z);
      rememberSafePlayerPosition(true);saveState(true);updateContext(true);
    }
    function enter(){
      if(record.inside||rioMap.indoorRoom||player.vehicle||player.boating)return false;
      const room=ensureRoom();
      record.inside=true;facade.visible=false;wall.disabled=true;
      room.root.visible=true;room.selectedUnitId=site.propertyId;
      for(const c of room.colliders)c.disabled=false;
      if(room.roof)room.roof.visible=false;
      if(room.gate)room.gate.disabled=true;
      if(room.door)room.door.visible=false;
      room.refreshDecor?.();
      rioMap.indoors=true;rioMap.indoorRoom=room;
      rioMapSave().activeSnowCabin=site.id;
      cameraMode='interior';cameraYaw=site.yaw;cameraPitch=.24;cameraZoom=2.6;
      player.facing=site.yaw;move(room.point(0,site.d*.22));return true;
    }
    function leave(){
      if(!record.inside)return false;
      record.inside=false;record.room.root.visible=false;facade.visible=true;wall.disabled=false;
      for(const c of record.room.colliders)c.disabled=true;
      rioMap.indoors=false;rioMap.indoorRoom=null;
      delete rioMapSave().activeSnowCabin;
      cameraMode='openworld';move({x:entrance.x+Math.sin(site.yaw||0)*.65,z:entrance.z+Math.cos(site.yaw||0)*.65});return true;
    }
    record.enter=enter;record.leave=leave;
    registerInteractable({id:site.id+'-door',type:'door',icon:'🏠',
      label:'Visitar ou comprar · '+site.name,...entrance,radius:3.2,priority:258,
      available:()=>available()&&!player.swimming&&!characterActivities.session,
      action:()=>rioPropertyDoor({id:site.propertyId,name:site.name,price:site.price,available,
        enter,decorate:()=>{if(enter())record.room.manageFurniture?.();}})});
    return record;
  }
  function createSnowDestination(){
    const root=new THREE.Group();root.name='SNOW_VISITOR_AREA';worldGroup.add(root);
    const wood=campaignMaterial(0x876749),snow=campaignMaterial(0xecf3f0),stone=campaignMaterial(0x778c8f),glass=campaignMaterial(0x547d90,.3);
    for(const site of snowCabinSites()){
      const {x,z}=site,facade=new THREE.Group();facade.name='SNOW_CABIN_'+site.key;root.add(facade);
      campaignBox(facade,wood,x,1.55,z,7,3.1,5);
      const wall={x,z,w:7,d:5,height:3.8,snowCabin:true};world.colliders.push(wall);
      const roof=new THREE.Mesh(new THREE.ConeGeometry(5,2.3,4),snow);roof.rotation.y=Math.PI/4;roof.position.set(x,4.15,z);facade.add(roof);
      for(const side of[-1,1]){
        campaignBox(facade,glass,x+side*2,1.75,z-2.53,1.3,.95,.07);
        campaignBox(facade,glass,x+side*2,1.75,z+2.53,1.3,.95,.07);
        campaignBox(facade,stone,x+side*.85,.10,z+2.9,.14,.20,.76);
      }
      campaignBox(facade,stone,x+1.6,4.1,z+1,.6,2.1,.6);
      campaignBox(facade,wood,x,1.12,z+2.53,1.45,2.2,.14);
      campaignBox(facade,snow,x,.10,z+3.05,2.2,.2,1.2);
      mergeTrafficStatic(facade);
      facade.position.y=groundHeightAt(x,z);
      if(typeof rioCompactWorld==='function'&&rioCompactWorld())registerSnowCabin(site,facade,wall);
    }
    citySign(root,'CAMPOS DO JORDÃO · NEVE',20,3,183,8,-1,'#315968',.8);
    const snowman=new THREE.Group();snowman.position.set(16,.06,181);root.add(snowman);for(const[y,r]of[[.55,.55],[1.28,.40],[1.85,.29]]){const ball=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),snow);ball.position.y=y;snowman.add(ball);}campaignBox(snowman,wood,0,2.14,0,.45,.15,.43);
    worldDestinations.snowRoot=root;
    const positions=new Float32Array(180*3);for(let i=0;i<180;i++){positions[i*3]=(Math.sin(i*93.17)*.5+.5)*36-18;positions[i*3+1]=(i*.173%1)*14;positions[i*3+2]=(Math.cos(i*67.21)*.5+.5)*36-18;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'#ffffffff');g.addColorStop(.35,'#ffffffe0');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,32,32);
    const flakes=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xffffff,size:.15,map:new THREE.CanvasTexture(canvas),transparent:true,opacity:.82,depthWrite:false}));flakes.name='LOCAL_SNOWFALL';flakes.frustumCulled=false;worldGroup.add(flakes);worldDestinations.flakes=flakes;
    registerInteractable({id:'snow-lookout',type:'viewpoint',icon:'❄️',label:'Mirante da Neve',x:20,z:180,radius:3,priority:120,action:()=>toast('Trecho de neve da OTTOVIAS. A pista continua liberada para viajar.','good',2600)});
  }
  const regionalExpansion={homes:[],rejected:[],port:null,tour:[],restaurant:null};
  function regionalWalk(root,a,b,width=1.8){
    const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.1)return;
    const n=Math.max(1,Math.ceil(len/.8)),rx=dz/len*width/2,rz=-dx/len*width/2,p=[];
    for(let i=0;i<=n;i++){const t=i/n,x=a.x+dx*t,z=a.z+dz*t;for(const sign of[-1,1]){const xx=x+rx*sign,zz=z+rz*sign;p.push(xx,groundHeightAt(xx,zz)+.075,zz);}}
    const indices=[];for(let i=0;i<n;i++){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(indices);geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,campaignMaterial(0xbab4a5));mesh.material.side=THREE.DoubleSide;mesh.receiveShadow=true;root.add(mesh);
  }
  function regionalBuildHome(site,index){
    const rotated=Math.abs(Math.sin(site.yaw))>.5,w=rotated?site.d:site.w,d=rotated?site.w:site.d;
    const clear=[[-1,-1],[-1,1],[1,-1],[1,1],[0,0]].every(([a,b])=>{
      const x=site.x+a*w/2,z=site.z+b*d/2;return !v704ReservedAt(x,z,.5)&&!waterAt(x,z);
    });
    const occupied=world.colliders.some(c=>!c.disabled&&Math.abs(c.x-site.x)<(c.w+w)/2+.35&&Math.abs(c.z-site.z)<(c.d+d)/2+.35);
    if(!clear||occupied){regionalExpansion.rejected.push({id:site.id,clear,occupied});return;}
    const mountain=site.style==='snow-cabin',facade=new THREE.Group(),path=new THREE.Group(),y=groundHeightAt(site.x,site.z);
    facade.name='REGIONAL_HOME_'+site.id;facade.position.set(site.x,y,site.z);facade.rotation.y=site.yaw;worldGroup.add(facade);worldGroup.add(path);
    const wallMat=campaignMaterial(mountain?0xa07854:[0xf1dfc2,0xd2e2df,0xe9ccaa,0xc5d8e5,0xf4e7d1][index%5]);
    const roofMat=campaignMaterial(mountain?0xe6eeef:[0x975c48,0x566b73,0xb87953,0x667c84,0x935b49][index%5]);
    const trim=campaignMaterial(mountain?0x624931:0xede7da),glass=campaignMaterial(0x63929c,.2),stone=campaignMaterial(0x948b7c);
    campaignBox(facade,stone,0,.10,0,site.w+.25,.20,site.d+.25);
    campaignBox(facade,wallMat,0,1.74,0,site.w,3.1,site.d);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.max(site.w,site.d)*.73,2.2,4),roofMat);roof.rotation.y=Math.PI/4;roof.position.y=4.45;roof.scale.z=site.d/site.w;facade.add(roof);
    for(const side of[-1,1]){
      campaignBox(facade,trim,side*site.w*.28,1.85,site.d/2+.04,1.75,1.3,.12);
      campaignBox(facade,glass,side*site.w*.28,1.85,site.d/2+.12,1.52,1.05,.06);
      campaignBox(facade,glass,side*site.w*.28,1.85,-site.d/2-.05,1.45,1.05,.07);
    }
    campaignBox(facade,trim,0,1.15,site.d/2+.08,1.75,2.3,.13);
    campaignBox(facade,stone,0,.13,site.d/2+.8,2.2,.26,1.55);
    if(mountain){campaignBox(facade,stone,site.w*.27,4.1,-.6,.65,2.4,.65);}
    else{
      campaignBox(facade,roofMat,0,2.85,site.d/2+1.15,site.w*.62,.18,2.3);
      for(const side of[-1,1])campaignBox(facade,trim,side*site.w*.28,1.4,site.d/2+1.95,.15,2.8,.15);
    }
    const wall={x:site.x,z:site.z,w,d,height:3.8,regionalHome:site.id};world.colliders.push(wall);
    regionalWalk(path,{x:site.entry[0],z:site.entry[1]},{x:site.road[0],z:site.road[1]});
    const rec=registerSnowCabin(site,facade,wall);regionalExpansion.homes.push({site,facade,path,rec});
  }
  function regionalCargoShip(color,loadingSlot=false){
    const root=new THREE.Group();root.name='SANTOS_CONTAINER_SHIP';
    const hull=campaignMaterial(0x23485c,.35),deck=campaignMaterial(0x878f8a),white=campaignMaterial(0xe1e4dc),glass=campaignMaterial(0x557c8d,.25);
    const sections=[[-15.5,3.6,.2,1.4],[-13,4.5,-.85,1.55],[-5,4.7,-1,1.55],[6,4.7,-.9,1.65],[12,3.4,-.4,1.7],[15.6,.15,.5,1.9]];
    root.add(new THREE.Mesh(seaCraftHullGeometry(sections,false),hull));
    campaignBox(root,deck,0,1.48,0,8.5,.20,27);
    const colors=[color,0x9b5141,0xc4a14b,0x4b827a];
    for(let row=0;row<4;row++)for(let col=0;col<3;col++)for(let layer=0;layer<2;layer++){
      // Leave the central bay open for the real quay crane delivery.
      if(loadingSlot&&row===1&&col===1)continue;
      campaignBox(root,campaignMaterial(colors[(row+col+layer)%4]),(col-1)*2.1,2.05+layer*1.04,-6+row*4.3,1.97,1,4.0);
    }
    campaignBox(root,white,0,3.65,-11.1,6.0,4.25,4.6);
    campaignBox(root,glass,0,5.1,-8.75,5.8,.65,.10);
    campaignBox(root,hull,0,6.55,-12.2,1.8,2.1,1.5);
    campaignBox(root,white,0,5.8,-11.1,6.4,.18,5);
    return root;
  }
  function regionalPortSurface(x,z){
    return regionalExpansion.port&&x>=-104&&x<=-96&&z>=499&&z<=549?.48:null;
  }
  function regionalPortVisit(index,point){
    if(player.vehicle||player.boating||otGames.active||Math.hypot(player.x-point.x,player.z-point.z)>3.5)return false;
    state.worldExploration||={};const visit=state.worldExploration.santosVisit||={seen:[],rewarded:false};
    if(!visit.seen.includes(index))visit.seen.push(index);
    if(visit.seen.length===3&&!visit.rewarded){visit.rewarded=true;addCoins(90);addXP(40);awardMedal('Visitante do Porto de Santos');}
    saveState(true);toast('Roteiro do porto: '+visit.seen.length+'/3 pontos visitados.','good',2400);return true;
  }
  function regionalBuildPort(){
    if(!rioMap.coastalDock)return;
    const root=new THREE.Group();root.name='SANTOS_PORT_TERMINALS';worldGroup.add(root);
    const concrete=campaignMaterial(0xa9aca5),steel=campaignMaterial(0x4f7180,.4),yellow=campaignMaterial(0xd7ab3c),blue=campaignMaterial(0x4e6979),white=campaignMaterial(0xe4e4dc);
    campaignBox(root,concrete,-120,.10,494,80,.20,30);
    campaignBox(root,concrete,-100,.38,524,8,.20,50);
    for(const x of[-103.8,-96.2])for(const z of[503,515,530,545]){
      campaignCylinder(root,steel,x,.25,z,.14,1.7);campaignCylinder(root,yellow,x,.63,z,.14,.35);
    }
    for(const x of[-150,-136,-122]){
      campaignBox(root,blue,x,2.6,487,11,5.2,9);
      campaignBox(root,white,x,5.3,487,11.5,.28,9.5);
      campaignBox(root,steel,x,1.8,491.55,6,3.6,.10);
      world.colliders.push({x,z:487,w:11,d:9,height:5.4,portWarehouse:true});
    }
    for(let i=0;i<4;i++)for(let j=0;j<2;j++){
      const x=-111+i*5.3,z=488+j*4.2;
      const m=campaignMaterial([0x9e5447,0x507a89,0xb89b4c,0x54816c][(i+j)%4]);
      campaignBox(root,m,x,.97,z,4.6,1.85,2.6);
      if((i+j)%2===0)campaignBox(root,m,x,2.82,z,4.6,1.85,2.6);
      world.colliders.push({x,z,w:4.6,d:2.6,height:4,portContainer:true});
    }
    // Actual quay crane: cargo travels from land to the deck of an alongside ship.
    for(const x of[-141,-133]){
      campaignBox(root,steel,x,4.2,502,.55,8.4,.65);
      campaignBox(root,steel,x,8.4,512,.60,.55,24);
      campaignBox(root,steel,x,4.2,506,.55,8.4,.65);
      world.colliders.push({x,z:502,w:.7,d:.8,height:8.4,portCrane:true});
    }
    campaignBox(root,yellow,-137,8.6,512,8.6,.65,.8);
    const hook=new THREE.Group();root.add(hook);hook.position.set(-137,8,501);
    campaignBox(hook,steel,0,.18,0,1.4,.35,1.0);
    const cargo=new THREE.Group();root.add(cargo);
    campaignBox(cargo,campaignMaterial(0xb76b40),0,.5,0,4.0,1,1.8);cargo.position.set(-137,.22,501);
    const ships=[{id:'santos-berthed',group:regionalCargoShip(0x497a88,true),x:-135.3,z:523,heading:Math.PI/2,halfWidth:4.8,halfLength:16},
      {id:'santos-moving',group:regionalCargoShip(0xa76c49),x:-20,z:620,heading:0,halfWidth:4.8,halfLength:16,phase:0}];
    for(const s of ships){s.group.position.set(s.x,.05,s.z);s.group.rotation.y=s.heading;worldGroup.add(s.group);}
    const d={x:-100,z:500,yaw:0,width:8},entry={x:-100,z:502};
    const escuna=rioMakeBerth({id:'rio-santos-escuna',label:'Escuna · passeio pelo canal de Santos',kind:'ship',region:'santos',halfWidth:1.57,halfLength:4.42,maxSpeed:9.3,acceleration:5.4,reverseSpeed:2.1,driver:{y:1.16,z:.94},group:rioMakeTourShip()},1,32,d);
    const port={root,entry,craft:[escuna],ships,cargo,hook,job:null,trucks:[],title:'Terminal turístico · Porto de Santos'};
    regionalExpansion.port=port;
    Object.assign(rioMap.coastalDock,{portCraft:port.craft,portTraffic:ships,portObstacles:[{x:-100,z:524,w:4,l:25,s:0,c:1}]});
    citySign(root,'PORTO DE SANTOS · TERMINAIS',-77,3.4,490,12,1,'#31566c',.55);
    citySign(root,'TERMINAL TURÍSTICO · ESCUNAS',-100,3.1,500,9,-1,'#285d65',.50);
    citySign(root,'PÁTIO DE CONTÊINERES',-112,3.5,481,10,1,'#35566a',.45);
    regionalWalk(root,{x:-65,z:497},{x:-100,z:502},2.5);
    root.remove(cargo,hook);mergeTrafficStatic(root);root.add(cargo,hook);
    registerInteractable({id:'santos-port-tour',type:'activity',icon:'⚓',label:'Embarcar na escuna de Santos',...entry,radius:3.4,priority:255,
      available:()=>!player.vehicle&&!player.boating&&!player.swimming&&!characterActivities.session,action:()=>openRioDock(port)});
    const points=[{id:'santos-port-gate',name:'Porto de Santos · acesso',x:-65,z:496},
      {id:'santos-port-cargo',name:'Porto de Santos · pátio e guindaste',x:-137,z:495},
      {id:'santos-port-view',name:'Porto de Santos · vista do canal',x:-100,z:509}];
    regionalExpansion.tour=points;
    for(const [i,p]of points.entries())registerInteractable({id:p.id,type:'viewpoint',icon:'⚓',label:p.name,x:p.x,z:p.z,radius:3.2,priority:230,
      available:()=>!player.vehicle&&!player.boating&&!otGames.active,action:()=>regionalPortVisit(i,p)});
    registerInteractable({id:'santos-port-crane',type:'activity',icon:'🏗️',label:'Operar o guindaste · carregar navio',x:-137,z:498,radius:2.2,priority:251,
      available:()=>!port.job&&!player.vehicle&&!player.boating&&!otGames.active,action:()=>{
        if(Math.hypot(player.x+137,player.z-498)>2.2)return;
        port.cargo.position.set(-137,.22,501);port.job={started:performance.now()};toast('Carregamento iniciado. Permaneça no posto de controle.','good',2400);
      }});
    for(const [i,x]of[-150,-118,-76].entries())addResident('santos-port-worker-'+i,['Operador Miguel','Conferente Ana','Guia Paulo'][i],
      [{x,z:497,action:'talk',duration:8},{x:x+3,z:497,action:'walk'},{x,z:497,action:'look',duration:8}],0x7e9d7c+i*0x121006);
  }
  function regionalUpdateExpansion(focus,now,dt){
    for(const h of regionalExpansion.homes){const near=Math.hypot(focus.x-h.site.x,focus.z-h.site.z)<(qualityTier()==='low'?145:210);h.facade.visible=near&&!h.rec.inside;h.path.visible=near;}
    const port=regionalExpansion.port;if(!port)return;
    // These trucks use the existing traffic controller and the same paved
    // graph as the regional bus. Keep the original 44-model collection intact.
    if(!port.trucks.length&&OTTOVIAS_RUNTIME.initialized){
      const route=buildTrafficRoute([{x:-65,z:497},{x:-65,z:475},{x:-115,z:475},{x:-170,z:475},{x:-220,z:475}],true);
      if(route.length>3&&route.every(p=>pointOnRoad(p.x,p.z,.03))){
        for(const [i,color]of[0x42778e,0xb67b43].entries()){
          const actor=createOttoviasTrafficVehicle('santos-cargo-truck-'+i,route,Math.floor(i*route.length/2),color,5.7,'truck');
          if(actor){actor.portCargo=true;port.trucks.push(actor);}
        }
        world.trafficSnapshot=null;
      }
    }
    const near=Math.hypot(focus.x+100,focus.z-500)<290;
    port.root.visible=near;port.craft[0].group.visible=near||(player.boating&&world.boat===port.craft[0]);
    for(const s of port.ships)s.group.visible=Math.hypot(focus.x-s.x,focus.z-s.z)<310;
    if(near){
      const s=port.ships[1],phase=s.phase+dt*.025,x=-100+80*Math.cos(phase),z=620+25*Math.sin(phase),heading=Math.atan2(-80*Math.sin(phase),25*Math.cos(phase));
      if(rioMarineCanNavigate(s,x,z,heading)){s.phase=phase;s.x=x;s.z=z;s.heading=heading;s.group.position.set(x,.05,z);s.group.rotation.y=heading;}
    }
    if(port.job){
      const valid=!player.vehicle&&!player.boating&&Math.hypot(player.x+137,player.z-498)<4.5;
      if(!valid){port.job=null;port.cargo.position.set(-137,.22,501);port.hook.position.set(-137,8,501);return;}
      const f=clamp((now-port.job.started)/8500,0,1);
      const lift=f<.25?f/.25:f>.75?(1-f)/.25:1,z=501+22*clamp((f-.25)/.5,0,1);
      port.cargo.position.set(-137,.22+6.5*lift+1.4*clamp((f-.75)/.25,0,1),z);port.hook.position.set(-137,port.cargo.position.y+1.3,z);
      if(f>=1){port.job=null;state.worldExploration||={};if(!state.worldExploration.santosCargoDone){state.worldExploration.santosCargoDone=true;addCoins(60);addXP(25);saveState(true);}toast('Contêiner colocado no navio.','good',2000);}
    }
  }
  function createRegionalExpansion(){
    if(typeof rioCompactWorld!=='function'||!rioCompactWorld())return;
    regionalHomeSites().forEach(regionalBuildHome);
    const site={id:'regional-campos-restaurante',key:'regional-campos-restaurante',name:'Café da Serra · Campos do Jordão',kind:'dining',style:'mountain',x:66,z:202,w:12,d:9,yaw:0,entry:[66,207.85],street:'Alameda dos Chalés'};
    if(!world.colliders.some(c=>!c.disabled&&Math.abs(c.x-site.x)<(c.w+site.w)/2+.4&&Math.abs(c.z-site.z)<(c.d+site.d)/2+.4)){
      regionalExpansion.restaurant=rioMountPlace(site,worldGroup);const path=new THREE.Group();worldGroup.add(path);regionalWalk(path,{x:66,z:207.85},{x:66,z:210.5});
    }
    regionalBuildPort();world.navCache?.clear?.();
  }
  function regionalExpansionDiagnostics(){
    return {homes:regionalExpansion.homes.map(h=>({id:h.site.id,x:h.site.x,z:h.site.z,y:h.facade.position.y,ground:groundHeightAt(h.site.x,h.site.z),entry:{x:h.site.entry[0],z:h.site.entry[1]},inside:h.rec.inside,exit:h.rec.room?.point(0,h.site.d*.31)})),
      rejected:regionalExpansion.rejected,restaurant:regionalExpansion.restaurant?.site.id||null,port:regionalExpansion.port?{entry:regionalExpansion.port.entry,craft:regionalExpansion.port.craft.map(b=>b.id),ships:regionalExpansion.port.ships.map(s=>({id:s.id,x:s.x,z:s.z,heading:s.heading})),tour:regionalExpansion.tour,trucks:regionalExpansion.port.trucks.map(t=>({id:t.id,x:t.group.position.x,z:t.group.position.z,route:t.route.length})),cargo:regionalExpansion.port.cargo.position.toArray(),job:!!regionalExpansion.port.job}:null};
  }
  function worldExploreLocations(){return[
    {id:'marina-costa',name:'Guarujá · marina e embarcações',label:'Guarujá · marina e embarcações',icon:'🚤',group:'Guarujá · praia e barcos',x:-220,z:502,navX:-220,navZ:502,description:'Caminhe pelo píer e escolha uma embarcação. Volte à vaga de embarque para desembarcar.',actions:['Seguir até a marina','Embarcar pelo botão AÇÃO','Pilotar, retornar e estacionar']},
    {id:'snow-lookout',name:'Campos do Jordão · mirante e chalés',label:'Campos do Jordão · mirante e chalés',icon:'❄️',group:'Natureza',x:20,z:180,navX:20,navZ:180,description:'Trecho de neve da OTTOVIAS, com acesso pela Ligação Norte. Neve no solo, pinheiros, chalés e precipitação local.',actions:['Seguir o GPS pela Ligação Norte','Chegar ao mirante']},
    ...(typeof rioCompactWorld==='function'&&rioCompactWorld()?snowCabinSites().map(site=>({id:site.id,name:site.name,icon:'🏡',group:'Campos do Jordão',x:site.entry[0],z:site.entry[1],navX:site.entry[0],navZ:site.entry[1],description:'Chalé visitável e comprável, com móveis e decoração próprios.'})):[]),
    ...regionalExpansion.homes.map(({site})=>({id:site.id,name:site.name,icon:'🏡',group:site.style==='snow-cabin'?'Campos do Jordão · montanha':'Guarujá · casas da orla',x:site.entry[0],z:site.entry[1],navX:site.entry[0],navZ:site.entry[1],description:'Imóvel visitável, comprável e decorável.'})),
    ...(regionalExpansion.restaurant?[{id:regionalExpansion.restaurant.site.id,name:regionalExpansion.restaurant.site.name,icon:'☕',group:'Campos do Jordão',x:66,z:207.85,navX:66,navZ:207.85}]:[]),
    ...regionalExpansion.tour.map(p=>({...p,icon:'⚓',group:'Santos · porto',navX:p.x,navZ:p.z,description:'Visita física ao terminal portuário.'})),
    ...(regionalExpansion.port?[{id:'santos-port-tour',name:'Porto de Santos · escuna',icon:'🛳️',group:'Santos · porto',x:-100,z:502,navX:-100,navZ:502}]:[]),
    ...Array.from(world.boats?.values()||[]).filter(b=>b.seaGoing||b.rioBerth).map(b=>{
      const step=b.rioBerth?.step,position=b.group.position;
      return {id:'marina-'+b.id,name:b.label,label:b.label,icon:b.kind==='board'?'🏄':b.kind==='ship'?'🛳️':'🚤',
        group:b.region==='santos'?'Santos · porto':'Guarujá · praia e barcos',x:position.x,z:position.z,navX:step?.x??-220,navZ:step?.z??clamp(position.z,513,548),
        description:step?'Embarque e desembarque na vaga do píer.':'O ponto de embarque fica no píer da marina.',actions:['Caminhar pelo píer','Toque em AÇÃO para embarcar']};
    })
  ];}
  function worldExploreDirectoryHtml(){
    const destinations=[
      ['airport-terminal','✈️','Aeroporto OT · terminal e helipontos','Aviões de passeio e carga; helicópteros de passeio, resgate e OTTOVIAS.'],
      ['mountain-balloon','🎈','Balão nas montanhas','Embarque na cesta, suba, explore a serra e pouse para sair.'],
      ['campaign-plane','✈️','Avião · embarcar e pilotar','Base Aérea. Aproxime-se da aeronave e toque em AÇÃO.'],
      ['campaign-helicopter','🚁','Helicóptero · embarcar e pilotar','Pouse, pare e use SAIR DA AERONAVE. Ela fica estacionada.'],
      ['marina-costa','🚤','Guarujá · marina e lanchas','Três lanchas no píer da praia. Pilotagem livre no mar.'],
      ['coast-view','🏖️','Guarujá · praia','Orla, ondas, quiosques e acesso à marina.'],
      ['snow-lookout','❄️','Campos do Jordão · neve e chalés','Siga a OTTOVIAS pela Ligação Norte.'],
      ...(regionalExpansion.port?[['santos-port-gate','⚓','Porto de Santos','Terminais, contêineres, guindaste e passeio de escuna.']]:[]),
      ...regionalExpansion.homes.map(({site})=>[site.id,'🏡',site.name,'Visite, compre e decore o imóvel.'])
    ];
    return '<h3>Explore o mundo</h3><div class="choice-grid world-explore-directory">'+destinations.map(([id,icon,title,description])=>'<button class="choice" data-explore-nav="'+id+'"><b>'+icon+' '+title+'</b><span>'+description+'</span><small>TRAÇAR ROTA NO GPS</small></button>').join('')+'<button class="choice" data-explore-civil><b>🤝 Missões do nosso mundo</b><span>Praias, vizinhança, neve, polícia, bombeiros e passeios.</span><small>INDIVIDUAL OU COOPERATIVO</small></button></div>';
  }
  function worldExploreBindDirectory(root){
    root.querySelectorAll('[data-explore-nav]').forEach(button=>button.onclick=()=>{const id=button.dataset.exploreNav;if(!currentMapLocations().some(x=>x.id===id)){toast('O destino está carregando. Tente novamente em instantes.','warn',2200);return;}setWaypoint(id);const loc=currentMapLocations().find(x=>x.id===id);worldCampaign.route={...loc,label:loc.name};worldCampaign.time=1;closeModal();toast('GPS: '+loc.name+'. Siga a rota até o local.','good',3000);});
    root.querySelector('[data-explore-civil]')?.addEventListener('click',()=>{closeModal();openCivilMissions();});
  }
  function updateWorldDestinations(){
    if(!worldDestinations.ready){if(!cityCoast.ready||!world.boats)return;createMarina();createSnowDestination();createRegionalExpansion();worldDestinations.ready=true;}
    const focus=otGamesFocus(),now=performance.now(),dt=Math.min(.15,(now-worldDestinations.lastAt)/1000);worldDestinations.lastAt=now;
    regionalUpdateExpansion(focus,now,Math.max(0,dt));
    if(typeof rioCompactWorld==='function'&&rioCompactWorld()&&rioMapSave().activeSnowCabin&&!rioMap.indoorRoom){
      const cabin=snowCabinRecords.get(rioMapSave().activeSnowCabin);
      if(cabin&&!cabin.inside&&Math.hypot(player.x-cabin.site.x,player.z-cabin.site.z)<4)cabin.enter();
      else if(cabin&&!cabin.inside&&Math.hypot(player.x-cabin.site.x,player.z-cabin.site.z)>8)delete rioMapSave().activeSnowCabin;
    }
    const snow=focus.z>147&&focus.z<480&&focus.x>-220&&focus.x<200;worldDestinations.flakes.visible=snow;
    if(snow){const a=worldDestinations.flakes.geometry.attributes.position;worldDestinations.flakes.position.set(focus.x,Math.max(0,groundHeightAt(focus.x,focus.z)),focus.z);for(let i=0;i<a.count;i++){let y=a.getY(i)-dt*(.7+i%5*.11);if(y<0)y+=14;a.setY(i,y);}a.needsUpdate=true;}
    for(const boat of world.boats.values())if(boat.seaGoing){const remote=[...remotePresence.values()].some(p=>p.boating&&p.boatId===boat.id&&p.boatRole!=='passenger'),local=player.boating&&state.boats.activeBoatId===boat.id;boat.group.visible=!remote&&Math.hypot(focus.x-boat.group.position.x,focus.z-boat.group.position.z)<260;if(!local&&!remote){boat.group.position.y=.10+Math.sin(now*.0014+boat.group.position.x)*.025;boat.group.rotation.z=Math.sin(now*.0012+boat.group.position.z)*.008;}else if(local){boat.group.rotation.z=player.boat.steerVisual*clamp(Math.abs(player.boat.speed)/22,0,1)*.11;boat.group.userData.seaPropeller.rotation.z+=dt*player.boat.speed*8;}}
    const button=document.getElementById('worldCampaignBtn');if(button&&button.textContent!=='MUNDO / GPS'){button.textContent='MUNDO / GPS';button.setAttribute('aria-label','Abrir destinos, aviões, helicópteros, balões, lanchas, praia e neve');}
    if(now-Number(worldDestinations.signAt||0)>1000){worldDestinations.signAt=now;for(const p of window.OTTHI_CAMPAIGN.parked()){let sign=worldDestinations.airSigns.get(p.id);if(!sign){const root=new THREE.Group();root.name='BOARDING_SIGN_'+p.id;worldGroup.add(root);citySign(root,(p.mode==='balloon'?'BALÃO':p.label)+' · EMBARQUE',0,3.1,0,6,-1,'#245060',.65);worldDestinations.airSigns.set(p.id,root);sign=root;}sign.position.set(p.x,groundHeightAt(p.x,p.z),p.z+5.7);sign.visible=(typeof airAvailable!=='function'||airAvailable(p.id))&&!otGames.active&&Math.hypot(focus.x-p.x,focus.z-p.z)<100;}}
  }
  const previousDestinationExpansion=updateWorldExpansion;updateWorldExpansion=function(){previousDestinationExpansion();updateWorldDestinations();};
  const previousDestinationLocations=expansionMapLocations;expansionMapLocations=function(){return[...previousDestinationLocations(),...worldExploreLocations()];};
  window.OTTHI_DESTINATIONS={open:campaignOpen,diagnostics:()=>({ready:worldDestinations.ready,locations:worldExploreLocations(),aircraft:window.OTTHI_CAMPAIGN.parked(),marina:{...MARINA_DOCK},regional:regionalExpansionDiagnostics(),cabins:[...snowCabinRecords.values()].filter(c=>c.site.id.startsWith('regional-campos-chale-')).map(c=>({id:c.site.id,inside:c.inside,visible:!!c.room?.root.visible,entry:{x:c.site.entry[0],z:c.site.entry[1]},exit:c.room?.point(0,c.site.d*.31)})),snow:{groundVisible:OTTOVIAS_RUNTIME.biomeGroups.find(b=>b.id==='snow')?.group.children.some(m=>m.userData.ottoviasBiome&&m.position.y>.025)||false,falling:!!worldDestinations.flakes?.visible},boats:[...world.boats?.values()||[]].map(b=>({id:b.id,label:b.label||'Barco de pesca',seaGoing:!!b.seaGoing,x:b.group.position.x,z:b.group.position.z,heading:b.heading,maxSpeed:b.maxSpeed||8.8,visible:b.group.visible})),activeBoat:player.boating?state.boats.activeBoatId:null})};
