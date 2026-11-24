/** Adapt Rio Preto's playable places to the original World scene and save. */
// @otthi-module-body
  const compactRio={sites:[],nextUpdate:0,courses:new Map()};
  function rioSelectCompactCourse(id){const record=compactRio.courses.get(id);if(!record||activeRace)return false;for(const m of rioMap.courseMarkers||[])m.visible=false;rioMap.course=record.course;rioMap.courseMarkers=record.markers;return true;}
  const compactRioStreets=[
    ['bady','Avenida Bady Bassitt',-95,0],
    ['andalo','Avenida Alberto Andaló',0,-52],
    ['murchid','Avenida Murchid Homsi',205,28],
    ['godoy','Rua Antônio de Godoy',-137,0],
    ['sp310','SP-310 · Washington Luís',84,-147],
    ['br153','BR-153 · Transbrasiliana',158,-17]
  ];

  function compactRioSite(lot){
    const [key,x,z,w,d,facing,street]=lot;
    const [,id,name,kind,style,price]=RIO_COMPACT_SITES.find(record=>record[0]===key);
    const yaw=rioCompactYaw[facing],out={x:Math.sin(yaw),z:Math.cos(yaw)},threshold=d/2+1.35;
    const roadDistance=key==='posto_brasilia'?205-x:threshold+5;
    return {key,id,name,kind,style,price,street,x,z,w,d,yaw,
      // Never change legacy residential save keys; each new condominium gets its own property key.
      propertyId:kind==='residence'?id:undefined,
      entry:[x+out.x*threshold,z+out.z*threshold],
      road:[x+out.x*roadDistance,z+out.z*roadDistance]};
  }

  function compactRioWalk(root,a,b,width,material){
    const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    if(length<.1)return;
    const geometry=new THREE.PlaneGeometry(width,length+.09);
    geometry.rotateX(-Math.PI/2);
    const uv=geometry.getAttribute('uv');
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*width*.4,uv.getY(i)*length*.4);
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set((a.x+b.x)/2,.033,(a.z+b.z)/2);
    mesh.rotation.y=Math.atan2(dx,dz);
    root.add(mesh);
  }

  function compactRioPlacePaths(root,site){
    if(['fuel','oil-shop','practice'].includes(site.kind))return;
    const [x,z]=site.entry,outX=Math.sin(site.yaw),outZ=Math.cos(site.yaw);
    if(waterAt(x,z))return;
    for(let length=1;length<=25;length++){
      const p={x:x+outX*length,z:z+outZ*length};
      if(waterAt(p.x,p.z)||positionBlockedForPlayer(p.x,p.z,.66,{ignoreTraffic:true,ignoreParkedVehicles:true}))break;
      if(v704RoadAt(p.x,p.z,.22,true)){
        compactRioWalk(root,{x,z},p,2.2,materials.sidewalk);
        break;
      }
    }
  }

  function buildCompactRio(){
    if(!rioCompactWorld())return;
    const root=new THREE.Group();
    root.name='RIO_PRETO_CENTRO';
    worldGroup.add(root);
    rioMap.materials??=rioTerrainMaterials();
    Object.assign(CHARACTER_ACTIVITIES,{
      'rio-rest':['Descansando no banco',3.3],
      'rio-entry':['Entrando pela porta',0],
      'rio-boarding':['Caminhando até a embarcação',0],
      'rio-pool':['Nadando na piscina',4.0]
    });
    const lots=RIO_COMPACT_LAYOUT.lots.map(compactRioSite);
    const alias=(key,point)=>{
      const [,id,name,kind]=RIO_COMPACT_SITES.find(site=>site[0]===key);
      return {key,id,name,kind,x:point.x,z:point.z,entry:[point.x,point.z]};
    };
    compactRio.sites=[...lots,
      alias('estadio_teixeirao',worldLayoutPoint('footballEntrance')),
      alias('aeroporto-sbsr',{x:90,z:-175})
    ];
    for(const site of lots)rioMountPlace(site,root);
    for(const site of lots)compactRioPlacePaths(root,site);
    const hall=lots.find(site=>site.kind==='civic');
    registerInteractable({id:'castle-adventures',type:'adventure',icon:'🏅',label:'Desafios do Paço Municipal',
      x:hall.x-11,z:hall.entry[1],radius:3.5,priority:210,action:openAdventureHub});
    for(const [x,z,text,yaw] of [
      [-96,11,'AV. BADY BASSITT',0],[-145,7.1,'RUA ANTÔNIO DE GODOY',0],
      [11,-11,'AV. ALBERTO ANDALÓ',-Math.PI/2],[213,6,'AV. MURCHID HOMSI',-Math.PI/2],
      [-65,42,'PARQUE DA REPRESA',0],[152,-17,'BR-153 · TRANSBRASILIANA',Math.PI/2],
      [90,-154,'SP-310 · WASHINGTON LUÍS',0],
      [300,128,'RIOS D’ITALIA · CONDOMÍNIOS',0],
      [300,197,'RIO CANDELARO · FIORA · SALSO · FORTORE · LIRI · TANARO',0]
    ])createSignpost(x,z,text,yaw);
    createCastleChallengeTokens();
  }


  function buildRioPretoJulioZacarinBridge(){
    if(!rioCompactWorld())return;
    // Native lightweight bridge over Lago 3, never replaces existing OT bridges.
    const root=new THREE.Group();root.name='RIO_PRETO_PONTE_JULIO_ZACARIN';worldGroup.add(root);
    const steel=renderMat(0xd1d7d7,{roughness:.67,metalness:.22}),cable=renderMat(0xb6c1c4,{roughness:.48,metalness:.38});
    const b=RIO_COMPACT_BRIDGE,bx=b.x,bz=b.z,deckY=b.top-.165;
    stableBox(b.deckLength,.22,b.width,0x788890,bx,deckY,bz,root,2);
    stableBox(b.deckLength,.05,3.2,0x58626b,bx,deckY+.14,bz,root,3);
    // Ramps and deck share the height function used by resolveWaterWalking.
    // No generic platform threshold is allowed to drop the actor into water.
    for(const side of[-1,1]){
      const run=b.rampLength,rise=b.top,angle=Math.atan2(rise,run);
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(run,rise),.16,b.width),renderMat(0x788890,{roughness:.9}));
      mesh.position.set(bx+side*(b.deckLength/2+run/2),rise/2-.08,bz);
      mesh.rotation.z=-side*angle;mesh.receiveShadow=true;root.add(mesh);
      registerCollider(bx,bz+side*(b.width/2-.045),b.deckLength,.12,{height:1.4,rioBridge:'julio-zacarin-rail'});
    }
    for(const side of[-1,1]){
      stableBox(b.deckLength,.58,.12,steel,bx,deckY+.55,bz+side*2.35,root);
      for(let i=-6;i<=6;i++)stableBox(.085,.56,.10,steel,bx+i*2,deckY+.38,bz+side*2.35,root);
    }
    for(const z of[bz-b.width/2+.24,bz+b.width/2-.24]){
      stableBox(.64,13.4,.67,steel,bx,7.25,z,root);
      for(const dx of[-12,-9,-6,-3,3,6,9,12]){
        const start=new THREE.Vector3(bx,13.9,z),end=new THREE.Vector3(bx+dx,deckY+.82,z);
        const vec=end.clone().sub(start),length=vec.length();
        const line=new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,length,6),cable);
        line.position.copy(start).add(end).multiplyScalar(.5);
        line.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vec.normalize());
        line.castShadow=false;root.add(line);
      }
    }
    createSignpost(-126,64.6,'PONTE ESTAIADA JÚLIO ZACARIN · LAGO 3',Math.PI/2);
    registerInteractable({id:'rio-ponte-julio-zacarin',type:'activity',icon:'🌉',
      label:'Ponte Estaiada Júlio Zacarin · Lago 3',x:-126.5,z:65.8,radius:4.5,priority:200,
      action:()=>toast('Ponte Júlio Zacarin · Lago 3 da Represa Municipal de Rio Preto.','info',2600)});
  }

  function buildRioCompactParkStalls(){
    for(const spec of RIO_COMPACT_PARK_STALLS){
      const root=new THREE.Group();root.name='RIO_PARK_STALL_'+spec.kind;worldGroup.add(root);
      const site={...spec,w:2.1,d:1.3},batch=rioCreateBatch(root);batch.root=root;
      const draw=rioLocal(batch,site),{box,part,point,sign}=draw;
      box(0,.68,0,1.9,1.02,1.05,spec.color);
      box(0,1.23,0,2.02,.12,1.23,0xe5d5b0);
      for(const x of[-.83,.83])for(const z of[-.43,.43])part('post',x,1.72,z,.075,1.0,.075,0x79827b);
      box(0,2.23,0,2.18,.17,1.40,spec.color);
      for(let i=0;i<5;i++)box(-.82+i*.41,2.18,.72,.21,.12,.05,0xece3ca);
      for(const x of[-.69,.69])part('post',x,.27,0,.44,.13,.44,0x323d42,0,Math.PI/2);
      if(spec.kind==='coconut'){
        for(let i=0;i<5;i++)part('canopy',-.72+i*.35,1.40,-.12,.31,.29,.31,i%2?0x77974b:0x63854d);
        box(.52,1.39,.26,.34,.26,.28,0xe7e2cf);
      }else{
        box(0,1.43,-.14,1.48,.18,.65,0xb3b9b3);
        for(let i=0;i<5;i++)part('post',-.60+i*.30,1.61,-.14,.16,.39,.16,0xeac351,0,.50);
      }
      sign(spec.kind==='coconut'?'ÁGUA DE COCO':'MILHO VERDE',0,2.04,.74,1.92,.32,spec.kind==='coconut'?'#47734b':'#a47b36');
      batch.commit();
      draw.collider(0,0,1.95,1.1,1.35,spec.id);
      const counter=point(0,1.47),seller=point(0,-1.13);
      const shop={id:spec.id,label:spec.name,kind:spec.kind,x:spec.x,z:spec.z,navX:counter.x,navZ:counter.z,description:'Comércio de rua do Parque da Represa.'};
      cityCoast.shops.set(shop.id,shop);
      const npc=cityCommercialNPC('rio-park-vendor-'+spec.kind,spec.seller,seller.x,seller.z,spec.color,null,shop.id);
      npc.stationaryHeading=spec.yaw;npc.group.rotation.y=spec.yaw;root.add(npc.group);
      const native=world.interactables.find(a=>a.id==='npc-'+npc.id);
      if(native)native.available=()=>root.visible&&!player.vehicle&&!player.boating&&distance2D(player,counter)<3.4;
      registerInteractable({id:shop.id,type:'shop',icon:spec.kind==='coconut'?'🥥':'🌽',label:spec.name,...counter,radius:2.35,priority:276,
        available:()=>root.visible&&!player.vehicle&&!player.boating&&!player.swimming&&!activeRace,
        action:()=>openCityShop(shop.id)});
      cityCoast.roots.push({root,x:spec.x,z:spec.z,range:120});
    }
  }

  function buildRioCompactDamha(){
    // Place the existing Damha destination at the access to its two
    // playable properties, rather than reintroducing a duplicate city.
    const root=new THREE.Group();root.name='RIO_DAMHA_ACESSO';worldGroup.add(root);
    const x=205,z=97,batch=rioCreateBatch(root);batch.root=root;
    const stone=0xe0dacd,trim=0x5c7467;
    for(const side of[-1,1]){
      batch.part('box',x+side*7.75,2.15,z,.62,4.3,.72,stone);
      batch.part('box',x+side*7.75,4.22,z,.84,.20,.94,trim);
      registerCollider(x+side*7.75,z,.62,.72,{height:4.3,rioDamhaGate:true});
    }
    // No boom, collision slab or barrier across the live traffic lanes.
    batch.part('box',x,4.43,z,16.2,.36,.55,trim);batch.commit();
    citySign(root,'DAMHA · AV. NADIMA DAMHA',x,4.46,z+.30,12,1,'#48665a',.56);
    citySign(root,'DAMHA · AV. NADIMA DAMHA',x,4.46,z-.30,12,-1,'#48665a',.56);
    registerInteractable({id:'rio-damha-residencias',type:'viewpoint',icon:'🏡',label:'Acesso aos imóveis Damha',x:213.8,z:100.5,radius:3.2,priority:218,
      available:()=>!player.vehicle&&!player.boating,
      action:()=>openModal('Damha · Rio Preto','<p>Visite as duas residências e as respectivas áreas de lazer. A pista da Represa continua disponível no mapa.</p><div class="choice-grid">'+
      '<button class="choice" data-damha-route="regional-casa-damha">Casa contemporânea</button><button class="choice" data-damha-route="regional-casa-damha-varanda">Casa com varanda</button><button class="choice" data-damha-route="regional-portaria_damha">Corrida Represa e Damha</button></div>',modal=>{
        for(const button of modal.querySelectorAll('[data-damha-route]'))button.onclick=()=>{closeModal();setWaypoint(button.dataset.damhaRoute);};
      })});
  }

  function buildCompactRioWaterfront(){
    rioBuildWaterfront();
    buildRioPretoJulioZacarinBridge();
    const shore=RIO_COMPACT_LAYOUT.sections.map(([x,z])=>({x,z}));
    const walk=new THREE.Group();
    walk.name='RIO_PRETO_PASSEIO_DA_REPRESA';
    worldGroup.add(walk);
    // Continuous red running surface with two lanes and marked edges.
    // Use the existing six-checkpoint 300m route; no reset of race records.
    const batch=rioCreateBatch(walk);batch.root=walk;
    const paths=[shore,RIO_COMPACT_UPPER_PATH.map(([x,z])=>({x,z}))];
    for(const path of paths)for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),x=(a.x+b.x)/2,z=(a.z+b.z)/2;
      batch.part('box',x,.080,z,2.7,.10,len+.20,0xae5848,yaw);
      for(const side of[-1,0,1]){
        const offset=side*1.22;
        batch.part('box',x+Math.cos(yaw)*offset,.141,z-Math.sin(yaw)*offset,.065,.016,len+.12,0xf0e8d5,yaw);
      }
    }
    // Paint a continuous pair of lanes up the ramps and over Lago 3.
    // Vertices share each ramp break so the paint follows the visible deck.
    const bridge=RIO_COMPACT_BRIDGE,edge=bridge.deckLength/2,base=edge+bridge.rampLength;
    const stations=[RIO_WEST_BRIDGE_ENTRY[0],bridge.x-base,bridge.x-edge,bridge.x+edge,bridge.x+base,RIO_EAST_BRIDGE_ENTRY[0]];
    const colors=[0xae5848,0xf0e8d5],polygons=[[],[]];
    const bands=[[-1.1,1.1,0],[-1.06,-1.00,1],[-.027,.027,1],[1,1.06,1]];
    for(let i=1;i<stations.length;i++){
      const a=stations[i-1],b=stations[i];
      for(const [left,right,tint] of bands){
        const depth=tint ? .030 : .022;
        const ay=rioCompactBridgeSurface(a,bridge.z)+depth,by=rioCompactBridgeSurface(b,bridge.z)+depth;
        const near=bridge.z+left,far=bridge.z+right;
        polygons[tint].push(a,ay,near,a,ay,far,b,by,near,b,by,near,a,ay,far,b,by,far);
      }
    }
    for(const [i,vertices] of polygons.entries()){
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
      const lane=new THREE.Mesh(geometry,renderMat(colors[i],{roughness:.94}));
      lane.name=i?'RIO_PONTE_FAIXAS':'RIO_PONTE_PISTA';lane.receiveShadow=true;walk.add(lane);
    }
    batch.commit();
    const start=shore[0],gate=new THREE.Group();gate.name='RIO_REPRESA_LARGADA';walk.add(gate);
    for(const side of[-1,1])stableBox(.18,2.8,.18,0x526b60,start.x,1.4,start.z+side*1.65,gate);
    stableBox(.24,.24,3.55,0x526b60,start.x,2.87,start.z,gate);
    const sign=citySign(gate,'PISTA DE CORRIDA · REPRESA',start.x,2.88,start.z,3.4,1,'#3c6156',.38);sign.rotation.y=Math.PI/2;
    buildRioCompactParkStalls();
    buildRioCompactDamha();
    // Two passes around the shore provide six checkpoints at the same 50 m spacing.
    rioPrepareWaterfrontRun([...RIO_COMPACT_BRIDGE_LAP,...RIO_COMPACT_BRIDGE_LAP.slice(1)],
      'represa_rio_preto_compacta_300m');
    compactRio.courses.set(rioMap.course.id,{course:rioMap.course,markers:rioMap.courseMarkers});
    const route=RIO_COMPACT_DAMHA_COURSE.map(([x,z])=>({x,z})),startDamha=route[0];
    const length=route.slice(1).reduce((sum,p,i)=>sum+distance2D(route[i],p),0);
    const labels=['Orla superior','Lago 2','Orla do Canecão','Retorno Swift','Lago 3','Chegada · Damha'];
    const gates=[];
    let traversed=0;
    for(let i=1;i<route.length;i++){
      const a=route[i-1],b=route[i],span=distance2D(a,b);
      while(gates.length<6&&(gates.length+1)*length/6<=traversed+span+1e-6){
        const t=clamp(((gates.length+1)*length/6-traversed)/span,0,1);
        gates.push({x:lerp(a.x,b.x,t),z:lerp(a.z,b.z,t),label:labels[gates.length]});
      }
      traversed+=span;
    }
    const marks=new THREE.Group();marks.name='RIO_DAMHA_CHECKPOINTS';walk.add(marks);
    const markerGeo=new THREE.RingGeometry(1.22,1.75,22),markerMat=new THREE.MeshBasicMaterial({color:0xffd850,side:THREE.DoubleSide});
    const markers=gates.map(p=>{const mesh=new THREE.Mesh(markerGeo,markerMat);mesh.rotation.x=-Math.PI/2;mesh.position.set(p.x,groundHeightAt(p.x,p.z)+.18,p.z);mesh.visible=false;marks.add(mesh);return mesh;});
    const damha={id:'corrida_rua_represa_damha',name:'Corrida de Rua · Represa e Damha',startId:'regional-portaria_damha',start:startDamha,route,gates,distance:length};
    compactRio.courses.set(damha.id,{course:damha,markers});
    const portico=new THREE.Group();portico.name='RIO_DAMHA_LARGADA_SUPERIOR';walk.add(portico);
    for(const side of[-1,1])stableBox(.20,2.8,.20,0x536f61,startDamha.x,1.4,startDamha.z+side*1.72,portico);
    stableBox(.24,.26,3.68,0x536f61,startDamha.x,2.88,startDamha.z,portico);
    const board=citySign(portico,'DAMHA · LARGADA',startDamha.x,2.88,startDamha.z,3.4,1,'#3c6156',.38);board.rotation.y=Math.PI/2;
    registerInteractable({id:'regional-portaria_damha',type:'race',icon:'🏃',label:'Largar · Represa e Damha',...startDamha,radius:2.8,priority:279,
      available:()=>!player.vehicle&&!player.boating&&!activeRace&&!SPORTS_V705.active,
      action:()=>{if(!rioSelectCompactCourse(damha.id))return false;return openRioGeoRun();}});
    rioFottoBuild();
  }


  const rioFotto={stations:[],pending:null,busy:false,lastAt:-Infinity,db:null};
  const RIO_FOTTO_PRICE=15;
  function rioFottoOwner(){const id=String(state.account?.accountId||state.profile?.playerId||'');return id?'player:'+id:'';}
  function rioFottoDB(){
    if(!rioFotto.db)rioFotto.db=new Promise((resolve,reject)=>{
      const req=indexedDB.open('otthi-fotto-album-v1',1);
      req.onupgradeneeded=()=>{const store=req.result.createObjectStore('photos',{keyPath:'id'});store.createIndex('owner','owner');};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Álbum ocupado'));
    }).catch(e=>{rioFotto.db=null;throw e;});return rioFotto.db;
  }
  async function rioFottoRows(owner){
    const db=await rioFottoDB();return new Promise((resolve,reject)=>{const t=db.transaction('photos','readonly'),q=t.objectStore('photos').index('owner').getAll(owner);q.onsuccess=()=>resolve(q.result.sort((a,b)=>b.at-a.at));q.onerror=()=>reject(q.error);});
  }
  async function rioFottoPut(row){
    const db=await rioFottoDB();return new Promise((resolve,reject)=>{const t=db.transaction('photos','readwrite');t.objectStore('photos').put(row);t.oncomplete=()=>resolve(true);t.onerror=t.onabort=()=>reject(t.error||Error('Álbum não salvo'));});
  }
  function rioFottoReceipts(){state.cityServices.rioMap??={};return state.cityServices.rioMap.fottoReceipts??={};}
  function rioFottoDistanceToPass(a,b,p){
    const dx=b.x-a.x,dz=b.z-a.z,dd=dx*dx+dz*dz,t=dd?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/dd)):0;
    return Math.hypot(a.x+dx*t-p.x,a.z+dz*t-p.z);
  }
  function rioFottoBuild(){
    if(rioFotto.stations.length)return;
    for(const {course} of compactRio.courses.values())for(const [index,gate] of course.gates.entries()){
      if(index!==0&&index!==3)continue;if(rioFotto.stations.some(s=>distance2D(s.gate,gate)<12))continue;
      const prev=index?course.gates[index-1]:course.start,dx=gate.x-prev.x,dz=gate.z-prev.z,len=Math.hypot(dx,dz)||1;let pos=null;
      for(const offset of[3.8,-3.8,5,-5,6,-6]){
        const x=gate.x-dz/len*offset,z=gate.z+dx/len*offset;
        if(!waterAt(x,z)&&!positionBlockedForPlayer(x,z,.65,{ignoreTraffic:true,ignoreParkedVehicles:true})){pos={x,z};break;}
      }
      if(!pos)continue;
      const id='rio-fotto-'+rioFotto.stations.length,name=['Marina','Bruno','Helena','Rafael'][rioFotto.stations.length%4];
      const person=createNPC(id,'f_OTTO · '+name,pos.x,pos.z,0x213345,0);person.cityLifeManaged=true;person.group.position.y=groundHeightAt(pos.x,pos.z);person.group.rotation.y=Math.atan2(gate.x-pos.x,gate.z-pos.z);
      rioFotto.stations.push({id,gate:{x:gate.x,z:gate.z},pos,course:course.name,person,armed:true});
      const talk=world.interactables.find(a=>a.id==='npc-'+id);if(talk){talk.label='f_OTTO · Ver minhas fotos';talk.actionLabel='Fotos';talk.icon='📷';talk.action=openRioFottoGallery;}
    }
  }
  function rioFottoObserveRun(dt,before){
    if(!rioFotto.stations.length||!before||player.vehicle||player.boating||otGames.active||currentHouse||!running||paused||!els.modal.hidden)return;
    const moved=Math.hypot(player.x-before.x,player.z-before.z),speed=moved/Math.max(.001,dt),now=performance.now();
    for(const s of rioFotto.stations){
      if(Math.hypot(player.x-s.gate.x,player.z-s.gate.z)>9)s.armed=true;
      if(!s.armed||rioFotto.pending||rioFotto.busy||now-rioFotto.lastAt<12000||moved>2||speed<1.8||(!input.isSprinting&&!activeRace))continue;
      if(rioFottoDistanceToPass(before,player,s.gate)>2.4)continue;
      const owner=rioFottoOwner();if(!owner)continue;s.armed=false;rioFotto.lastAt=now;rioFotto.pending={owner,station:s,at:Date.now(),until:now+1800};break;
    }
  }
  function rioFottoCaptureFrame(){
    const job=rioFotto.pending;if(!job)return;rioFotto.pending=null;
    if(job.owner!==rioFottoOwner()||performance.now()>job.until||!running||paused||Math.hypot(player.x-job.station.gate.x,player.z-job.station.gate.z)>8)return;
    rioFotto.busy=true;let target=null;
    const oldTarget=renderer.getRenderTarget(),oldViewport=renderer.getViewport(new THREE.Vector4()),oldScissor=renderer.getScissor(new THREE.Vector4()),oldScissorTest=renderer.getScissorTest(),oldVisible=playerGroup.visible;
    try{
      const w=768,h=512,at=job.station.pos,cam=new THREE.PerspectiveCamera(48,w/h,.1,120);cam.position.set(at.x,groundHeightAt(at.x,at.z)+1.85,at.z);cam.lookAt(player.x,player.y+1.05,player.z);
      target=new THREE.WebGLRenderTarget(w,h,{depthBuffer:true,stencilBuffer:false});target.texture.encoding=renderer.outputEncoding;
      playerGroup.visible=true;renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.render(scene,cam);
      const pixels=new Uint8Array(w*h*4);renderer.readRenderTargetPixels(target,0,0,w,h,pixels);
      const cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d'),data=ctx.createImageData(w,h);
      for(let row=0;row<h;row++)data.data.set(pixels.subarray((h-1-row)*w*4,(h-row)*w*4),row*w*4);ctx.putImageData(data,0,0);
      cv.toBlob(async blob=>{try{
        if(!blob||job.owner!==rioFottoOwner())return;
        const id=job.owner+':'+(globalThis.crypto?.randomUUID?.()||String(job.at)+'-'+Math.random().toString(36).slice(2));
        await rioFottoPut({id,owner:job.owner,at:job.at,course:job.station.course,blob});
        if(job.owner===rioFottoOwner())toast('📷 f_OTTO registrou sua corrida! Veja no álbum do Menu.','good',2800);
      }catch(e){toast('f_OTTO: não foi possível salvar a foto.','warn',2400);}finally{rioFotto.busy=false;}},'image/jpeg',.91);
    }catch(e){rioFotto.busy=false;toast('f_OTTO: captura indisponível neste aparelho.','warn',2300);}
    finally{renderer.setRenderTarget(oldTarget);renderer.setViewport(oldViewport);renderer.setScissor(oldScissor);renderer.setScissorTest(oldScissorTest);playerGroup.visible=oldVisible;target?.dispose();}
  }
  function rioFottoDownload(row){
    if(row.owner!==rioFottoOwner()||!rioFottoReceipts()[row.id])return false;
    const a=document.createElement('a'),url=URL.createObjectURL(row.blob);a.href=url;a.download='f_OTTO-'+row.at+'.jpg';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);return true;
  }
  async function rioFottoPreview(row,img,paid){
    const url=URL.createObjectURL(row.blob);try{
      const source=new Image();source.src=url;await source.decode();if(!img.isConnected||row.owner!==rioFottoOwner())return;
      const cv=document.createElement('canvas');cv.width=384;cv.height=256;const ctx=cv.getContext('2d');ctx.drawImage(source,0,0,384,256);
      if(!paid){ctx.fillStyle='rgba(255,255,255,.72)';ctx.font='bold 27px sans-serif';ctx.textAlign='center';for(const y of[52,130,208])ctx.fillText('f_OTTO • PRÉVIA',192,y);}
      img.src=cv.toDataURL('image/jpeg',.8);
    }finally{URL.revokeObjectURL(url);}
  }
  async function openRioFottoGallery(){
    const owner=rioFottoOwner();if(!owner){toast('Defina seu personagem antes de usar o álbum.','warn',2200);return;}
    let rows;try{rows=await rioFottoRows(owner);}catch(e){toast('Álbum local indisponível neste navegador.','warn',2300);return;}if(owner!==rioFottoOwner())return;
    openModal('📷 f_OTTO · Álbum de corridas','<p>Fotos registradas na pista ao correr. Prévia gratuita; original JPEG por '+RIO_FOTTO_PRICE+' moedas virtuais. As imagens ficam neste aparelho.</p><div data-fotto-list class="choice-grid"></div><div class="modal-actions"><button class="btn" data-fotto-more>Mostrar mais</button></div>',root=>{
      const list=root.querySelector('[data-fotto-list]'),more=root.querySelector('[data-fotto-more]');let index=0;
      if(!rows.length)list.textContent='Nenhuma foto ainda. Corra pela pista da Represa e passe pelos fotógrafos.';
      function show(){
        for(const row of rows.slice(index,index+12)){
          const card=document.createElement('article');card.className='choice';const paid=!!rioFottoReceipts()[row.id];
          const img=document.createElement('img');img.alt='Prévia da corrida';img.loading='lazy';img.style.cssText='width:100%;height:auto;object-fit:contain;border-radius:8px';
          const caption=document.createElement('b');caption.textContent=row.course+' · '+new Date(row.at).toLocaleString('pt-BR');
          const action=document.createElement('button');action.type='button';action.className='btn primary';action.textContent=paid?'BAIXAR ORIGINAL':'COMPRAR · '+RIO_FOTTO_PRICE+' moedas';
          card.append(img,caption,action);list.append(card);rioFottoPreview(row,img,paid).catch(()=>{img.alt='Prévia indisponível';});
          action.onclick=async()=>{
            if(owner!==rioFottoOwner()||action.disabled)return;
            if(rioFottoReceipts()[row.id]){rioFottoDownload(row);return;}action.disabled=true;
            if(!await confirmModal('Comprar fotografia','Comprar o JPEG original por '+RIO_FOTTO_PRICE+' moedas virtuais?','Comprar','Cancelar')){openRioFottoGallery();return;}
            if(owner!==rioFottoOwner())return;const receipts=rioFottoReceipts();
            if(!receipts[row.id]){
              if(Number(state.profile.coins||0)<RIO_FOTTO_PRICE){toast('Saldo insuficiente.','warn',2200);openRioFottoGallery();return;}
              receipts[row.id]={at:Date.now(),price:RIO_FOTTO_PRICE};addCoins(-RIO_FOTTO_PRICE);saveState(true);updateHUD();
            }openRioFottoGallery();
          };
        }index+=12;more.hidden=index>=rows.length;
      }more.onclick=show;show();
    });
  }

  function updateCompactRio(dt,before){
    rioFottoObserveRun(dt,before);
    if(player.vehicle&&rioFuelCapacity(currentVehicleRef())){
      const vehicle=currentVehicleRef(),metres=distance2D(player,before),fuel=rioFuelLevel(vehicle);
      if(metres>0&&metres<=40&&!player.car.passengerOf){if(fuel>0)rioRoadVehicleSave(vehicle.id).fuel=Math.max(0,fuel-metres*.002);rioMaintenanceWear(rioMaintenanceRecord(vehicle),metres);}
    }
    if(player.boating)rioRecordBoatPose();
    updateRioWaterfront(dt);
    updateRioClimate(dt);
    if(performance.now()<compactRio.nextUpdate)return;
    compactRio.nextUpdate=performance.now()+80;
    rioMap.indoors=false;
    rioMap.indoorRoom=null;
    const focus=navigationFocus();
    for(const room of rioMap.sites.values()){
      const {site}=room;
      if(room.legacyResidence){
        // Historic homes retain the exact old exterior while the furnished
        // native room is visible only to the player who entered the door.
        const inside=!!room.legacyRecord?.inside;
        room.root.visible=inside;
        if(room.poolExterior)room.poolExterior.visible=distance2D(focus,site)<(qualityTier()==='low'?142:195);
        if(inside){
          if(room.roof)room.roof.visible=false;
          rioMap.indoors=true;rioMap.indoorRoom=room;
          if(room.server||room.npcs?.length)rioUpdatePlaceService(site,room,.08);
        }
        continue;
      }
      room.root.visible=distance2D(focus,site)<(qualityTier()==='low'?142:195);
      if(room.poolExterior)room.poolExterior.visible=room.root.visible;
      if(!room.root.visible)continue;
      if(room.roof){
        const inside=!currentHouse&&!player.vehicle&&room.forSite(player.x,player.z,-.22)&&!room.isOutdoorLeisurePoint?.(player.x,player.z);
        room.roof.visible=!inside;
        if(inside){rioMap.indoors=true;rioMap.indoorRoom=room;}
      }
      if(room.server||room.door||room.npcs?.length)rioUpdatePlaceService(site,room,.08);
      if(rioMap.order?.site===site.id&&distance2D(player,site)>Math.max(site.w,site.d)+8){
        rioClearDiningOrder(room);
      }
    }
  }

  function compactRioDestination(site){
    const [x,z]=site.entry;
    const icon={market:'🛒',church:'⛪',civic:'🏛️',trail:'🌳',dining:'🍽️',bakery:'🥐',mall:'🛍️',
      'oil-shop':'🔧',fuel:'⛽',residence:'🏠',airport:'✈️',theater:'🎭',stadium:'⚽',practice:'⚽'};
    return {id:site.id,name:site.name,icon:icon[site.kind]||'📍',group:'Rio Preto',x,z,navX:x,navZ:z,
      description:[site.street,site.style==='rios-ditalia'?'Condomínio Rios D’Italia · apartamento mobiliado':rioSiteLabels[site.kind]].filter(Boolean).join(' · ')};
  }

  const beforeCompactRioLocations=expansionMapLocations;
  expansionMapLocations=function(){
    const existing=beforeCompactRioLocations();
    if(!rioCompactWorld())return existing;
    const places=compactRio.sites.map(compactRioDestination);
    const streets=compactRioStreets.map(([id,name,x,z])=>({id:'rio-via-'+id,name,x,z,icon:'🛣️',group:'Ruas e rodovias'}));
    const dock=rioMap.waterfront?.entry,course=compactRio.courses.get('represa_rio_preto_compacta_300m')?.course||rioMap.course;
    places.push({id:'rio-ponte-julio-zacarin',name:'Ponte Estaiada Júlio Zacarin · Lago 3',group:'Represa de Rio Preto',icon:'🌉',x:-126.5,z:65.8,navX:-126.5,navZ:65.8,description:'Ponte estaiada, orla e passeio do Lago 3'});
    if(dock)places.push({id:'rio-represa-cais',name:'Mirante da Represa Municipal',group:'Represa de Rio Preto',icon:'🌳',...dock});
    if(course)places.push({id:'rio-orla-largada',name:'Pista de corrida a pé · Represa',group:'Represa de Rio Preto',icon:'🏃',...course.start});
    places.push({id:'regional-portaria_damha',name:'Portaria Damha · Corrida da Represa',group:'Represa de Rio Preto',icon:'🏃',x:-108,z:78.2,navX:-108,navZ:78.2,description:'Pórtico da pista superior, seis pontos e chegada'});
    places.push({id:'rio-damha-residencias',name:'Damha · Av. Nadima Damha',group:'Rio Preto',icon:'🏡',x:213.8,z:100.5,navX:213.8,navZ:100.5,description:'Acesso às residências e piscinas exteriores'});
    const hall=places.find(place=>place.id==='regional-prefeitura_andalo');
    if(hall)places.push({...hall,id:'castle'});
    return [...existing,...places,...streets];
  };

  function compactRioArrive(){
    const url=new URL(location.href);
    const entrance=url.searchParams.get('entrada'),destination=url.searchParams.get('destino');
    url.searchParams.delete('entrada');
    url.searchParams.delete('destino');
    url.searchParams.set('map','rio-preto');
    if(url.href!==location.href)history.replaceState(history.state,'',url);
    const site=compactRio.sites.find(place=>place.key===entrance);
    const target=entrance==='represa-cais'?rioMap.waterfront?.entry:entrance==='guaruja-marina'?rioMap.coastalDock?.entry:site?{
      x:site.entry[0]+2.2*Math.sin(site.yaw||0),z:site.entry[1]+2.2*Math.cos(site.yaw||0)
    }:null;
    if(target){
      const safe=safePointNear(target.x,target.z,{ignoreTraffic:true,allowWater:false,distances:[0,1,2,4,7]});
      rioMapSave().aboard=null;
      Object.assign(player,{x:safe.x,y:safe.y,z:safe.z,vx:0,vy:0,vz:0,grounded:true});
      cameraYaw=site?Math.atan2(Math.sin(site.yaw||0),Math.cos(site.yaw||0)):Math.PI/2;
      playerGroup.position.set(player.x,player.y,player.z);
      rememberSafePlayerPosition(true);
    }else if(!entrance)rioRestoreBoatRide();
    if(destination==='ottovias')setWaypoint('ottovias-entry');
  }

  function migrateCompactRioProgress(){
    const saved=rioMapSave();
    if(saved.compactMapVersion===1)return;
    // The two maps used different coordinates. Preserve the older positions for rollback.
    saved.previousMapPose={position:saved.position,waypoint:saved.waypoint,aboard:saved.aboard};
    for(const order of phoneOrders()){
      if(order.map!=='rio-preto')continue;
      if(order.kind==='vehicle'&&order.status==='en-route')order.status='interrupted';
      if(order.kind==='parcel'&&['en-route','ready'].includes(order.status)){
        order.status='queued';
        delete order.pose;
        delete order.origin;
        delete order.target;
      }
    }
    if(saved.phoneDelivery?.status==='en-route'&&!state.vehicles.phoneDelivery)
      state.vehicles.phoneDelivery={...saved.phoneDelivery,status:'interrupted'};
    saved.compactMapVersion=1;
  }
