/** Walkable lots. Doors, furnishings, service actions and their collision shapes share coordinates. */
// @otthi-module-body
  const rioPlaceStyles={
    market:{wall:0xe0c69a,trim:0x944638,roof:0xb05743,floor:0xcebca1,height:5.6,sign:'MERCADO MUNICIPAL'},
    dining:{wall:0xc18e62,trim:0x733f31,roof:0x8f5440,floor:0xc59772,height:3.8},
    bakery:{wall:0xcab391,trim:0x986039,roof:0x6e6457,floor:0xc6b8a2,height:3.7},
    church:{wall:0xe5d6ba,trim:0x9d8065,roof:0x83504b,floor:0xb5a08b,height:7.9,sign:'CATEDRAL SÃO JOSÉ'},
    civic:{wall:0xc3bdab,trim:0x54717b,roof:0x81847d,floor:0xb9b8ac,height:5.7,sign:'PAÇO MUNICIPAL'},
    theater:{wall:0xa4573d,trim:0x653e34,roof:0x795348,floor:0xa89380,height:6.5,sign:'SWIFT · PAULO MOURA'},
    exhibition:{wall:0xc0b9aa,trim:0x486267,roof:0x657e82,floor:0xa9ab9f,height:5.7},
    mall:{wall:0xd1c2a6,trim:0x498084,roof:0x777b73,floor:0xbebbae,height:5.4},
    reception:{wall:0xd4d9d2,trim:0x668887,roof:0x7e9190,floor:0xc5cec5,height:4.1},
    station:{wall:0xb0babe,trim:0x435c69,roof:0x627985,floor:0xafb8ba,height:5},
    airport:{wall:0xd1d8dd,trim:0x365e76,roof:0x6e8088,floor:0xa7adb3,height:5.7,sign:'AEROPORTO PROF. ERIBELTO MANOEL REINO'},
    construction:{wall:0xd7d1bb,trim:0x596f65,roof:0x636f69,floor:0xb0aaa0,height:4.8},
    residence:{wall:0xddc5a5,trim:0x6e6054,roof:0x995540,floor:0xc6ad8e,height:3.2},
  };
  const rioDiningStock=[
    {id:'meal',name:'Prato da casa',price:24,hunger:42},
    {id:'pizza',name:'Pizza da casa',price:32,hunger:48},
    {id:'portion',name:'Porção para compartilhar',price:22,hunger:34},
    {id:'juice',name:'Suco gelado',price:10,hunger:10},
    {id:'parcel',name:'Lanche para levar',price:18,food:2}
  ];
  const rioSiteLabels={
    market:'Percorrer as bancas e comprar alimentos',dining:'Pedir no balcão e consumir à mesa',
    bakery:'Comprar pães ou consumir à mesa com atendimento',church:'Visitar a nave, as obras e os altares',
    civic:'Solicitar e retirar um protocolo do jogo',theater:'Retirar ingresso e acender o palco na cabine',
    exhibition:'Retirar ingresso e visitar a exposição',mall:'Percorrer as lojas de roupas e calçados',
    reception:'Retirar uma senha e usar a recepção',station:'Consultar o painel e alcançar a plataforma',
    fuel:'Entrar no pátio e abastecer o carro na bomba',stadium:'Jogar futebol 4 × 4',
    practice:'Entrar no gramado e treinar chutes',square:'Descansar em um banco da praça',
    garden:'Percorrer o caminho e cuidar dos vasos',trail:'Largar para os seis checkpoints da Represa',
    statue:'Aproximar-se da escultura e observar a orla',airport:'Terminal, pátio, pista 07/25 e aviação',
    construction:'Escolher materiais ou ferramentas no balcão e receber a compra no imóvel',
    residence:'Visitar, comprar e usar os cômodos', 'oil-shop':'Entrar com o carro para revisar o motor'
  };
  const rioPaint={
    window:0x426979,glass:0x7dafa9,metal:0x3f5055,white:0xf1e6cf,wood:0x8b5840,
    seat:0x9e6346,stone:0xb3a99a,paving:0xa6a99c,green:0x527b55,brick:0xa85d43
  };

  function rioSiteLayout(site,root){
    const batch=rioCreateBatch(root);batch.root=root;
    const baseY=groundHeightAt(site.x,site.z);
    // Biome sheets and terrain decals lie above the original paper-thin floor.
    // Build an actual foundation, with every furnishing using the same datum.
    const floorY=rioPlaceStyles[site.kind]?baseY+.24:baseY;
    const draw=rioLocal(batch,{...site,floorBaseY:floorY});
    const {point}=draw,colliders=[],actions=[],lights=[];
    const forSite=(x,z,r=0)=>rioSiteContains(site,x,z,r);
    function collider(x,z,w,d,height){
      const ring=[point(x-w/2,z-d/2),point(x+w/2,z-d/2),point(x+w/2,z+d/2),point(x-w/2,z+d/2)].map(p=>[p.x,p.z]);
      const [x0,z0,x1,z1]=rioCoordinateBounds(ring);
      const c={x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0,height,rioRings:[ring]};
      world.colliders.push(c);colliders.push(c);
    }
    function object(x,y,z,w,h,d,color){
      draw.box(x,y,z,w,h,d,color);collider(x,z,w,d,h);
    }
    function action(suffix,label,x,z,handler,options={}){
      const target={id:site.id+'-'+suffix,type:'activity',label,icon:'●',...point(x,z),radius:1.75,priority:248,
        ...options,
        available:()=>root.visible&&(!options.vehicleOnly?!player.vehicle:player.vehicle)&&!player.boating&&!SPORTS_V705.active&&!activeRace&&!characterActivities.session&&
          (!options.inside||forSite(player.x,player.z,-.44))&&(options.available?.()??true),
        action:handler};
      registerInteractable(target);actions.push(target.id);
    }
    function bench(x,z){
      draw.bench(x,z);collider(x,z,2.2,.58,1.03);
    }
    return {...draw,site,bench,batch,root,colliders,actions,lights,object,action,collider,forSite,baseY,floorY};
  }

  function rioSiteContains(site,x,z,pad=0){
    const dx=x-site.x,dz=z-site.z,s=Math.sin(site.yaw),c=Math.cos(site.yaw);
    return Math.abs(c*dx-s*dz)<site.w/2+pad&&Math.abs(s*dx+c*dz)<site.d/2+pad;
  }
  function rioPlayerAt(point,radius=1.85){
    return running&&!player.vehicle&&!player.boating&&!paused&&player.grounded&&Math.hypot(player.x-point.x,player.z-point.z)<=radius;
  }
  function rioCountVisit(site){
    const visits=rioMapSave().visits??={};
    if(!visits[site.id]){visits[site.id]=true;addXP(12);}
    saveState(true);
  }

  function rioBuildShell(site,room){
    const base=rioPlaceStyles[site.kind],p=site.style==='damha'?{...base,wall:0xe3e2d9,trim:0x586364,roof:0x4c585a}:site.style==='snow-cabin'?{...base,wall:0xa57e59,trim:0x6a4b37,roof:0xecf3f0,floor:0xbd9872}:site.style==='mountain-luxury'?{...base,wall:0xe7ded0,trim:0x66594a,roof:0x526270,floor:0xd4cbbb,height:4.1}:base;
    const {w,d}=site,{box,object}=room;
    const h=p.height,edge=.27,entry=site.kind==='market'?4.8:Math.min(3.1,w*.4);
    const front=d/2-edge,length=(w-entry)/2,center=(w+entry)/4;
    // Real floor is a solid slab, not a depth-disabled overlay.
    const floorDepth=Math.max(.26,room.floorY-room.baseY+.08);
    const floor=new THREE.Mesh(new THREE.BoxGeometry(w,floorDepth,d),renderMat(p.floor,{roughness:.9,metalness:0}));
    floor.name='RIO_FINISHED_FLOOR_'+site.key;floor.position.set(site.x,room.floorY-floorDepth/2,site.z);
    floor.rotation.y=site.yaw;floor.receiveShadow=true;room.root.add(floor);room.floorMesh=floor;
    // Separate architectural surfaces allow a true camera cutaway. Colliders
    // are never disabled by rendering, and all furniture remains visible.
    room.wallGroups={};room.wallDraw={};const wallBatches=[];
    for(const key of ['front','back','left','right']){
      const group=new THREE.Group();group.name='RIO_WALL_'+key+'_'+site.key;room.root.add(group);
      const batch=rioCreateBatch(group);batch.root=group;wallBatches.push(batch);
      room.wallGroups[key]=group;room.wallDraw[key]=rioLocal(batch,{...site,floorBaseY:room.floorY});
    }
    room.commitWalls=()=>wallBatches.forEach(batch=>batch.commit());
    const wallObject=(key,x,y,z,ww,hh,dd,color)=>{
      room.wallDraw[key].box(x,y,z,ww,hh,dd,color);room.collider(x,z,ww,dd,hh);
    };
    wallObject('back',0,h/2,-front,w,h,.39,p.wall);
    const f=room.wallDraw.front;
    for(const side of [-1,1]){
      wallObject(side<0?'left':'right',side*(w/2-edge),h/2,0,.39,h,d,p.wall);
      wallObject('front',side*center,h/2,front,length,h,.42,p.wall);
      f.box(side*(entry/2+.13),1.48,front+.23,.19,2.96,.23,p.trim);
      for(let offset=entry/2+.82;offset<w/2-.70;offset+=2.38){
        const paneW=Math.min(1.68,2*(w/2-offset-.31));
        f.box(side*offset,2.02,front+.222,paneW,1.28,.10,rioPaint.window);
        f.box(side*offset,2.02,front+.29,.09,1.27,.05,rioPaint.white);
        f.box(side*offset,1.35,front+.30,paneW+.16,.12,.16,p.trim);
      }
    }
    f.box(0,(h+2.95)/2,front,entry+.14,h-2.95,.43,p.wall);
    f.box(0,2.91,front+.33,entry+.43,.18,.34,p.trim);
    // Two broad entrance steps bridge the 24 cm foundation and terrain.
    box(0,-.12,d/2+.58,entry+.88,.12,1.16,rioPaint.paving);
    box(0,-.21,d/2+1.08,entry+.96,.06,.66,rioPaint.paving);
    const fixedSign=(site.key==='mercado_municipal'||site.key==='catedral_sao_jose'||site.key==='prefeitura_andalo'||site.key==='complexo_swift'||site.kind==='airport')?p.sign:null;
    f.sign(fixedSign||site.name,0,h-.69,d/2+.005,Math.min(w-.72,17),.56,
      site.kind==='market'?'#87352e':site.kind==='dining'?'#62422f':'#294b56');
    const roof=new THREE.Group();roof.name='RIO_ROOF_'+site.key;room.root.add(roof);
    const cap=rioCreateBatch(roof),top=rioLocal(cap,{...site,floorBaseY:room.floorY});
    if(['market','church','theater','dining','bakery'].includes(site.kind)||site.kind==='residence'&&site.style!=='damha'){
      top.box(0,h+.06,0,w+.12,.17,d+.12,p.trim);
      top.part('hip',0,h+.66,0,w+.25,1.24,d+.20,p.roof);
    }else top.box(0,h+.16,0,w+.15,.34,d+.15,p.roof);
    if(site.kind==='market'){
      for(const side of [-1,1]){
        f.part('post',side*(w/2-1.04),h*.54,front-.56,1.85,h*1.11,1.85,p.wall);
        for(const y of [2.04,2.46,2.88,3.30])f.box(side*(w/2-1.04),y,front+.18,1.41,.16,.18,rioPaint.window);
      }
      f.box(0,3.09,front+.76,Math.min(7.9,w-.4),.23,1.66,p.trim);
    }
    if(site.kind==='church'){
      for(const side of [-1,1]){
        top.box(side*w*.34,h+1.75,d*.37,2.5,4.35,2.55,p.wall);
        top.part('hip',side*w*.34,h+4.05,d*.37,2.78,1.35,2.8,p.roof);
      }
      top.box(0,h+2.13,-d*.38,.17,1.75,.17,0xaf9360);
      top.box(0,h+2.37,-d*.38,1.2,.16,.17,0xaf9360);
    }
    if(site.key==='canecao_represa'){
      for(const x of [-w*.41,-w*.20,w*.20,w*.41])wallObject('front',x,1.49,front+.55,.32,2.98,.32,rioPaint.brick);
      f.box(0,2.99,front+.62,w-.16,.22,1.24,p.trim);
    }
    cap.commit();
    room.roof=roof;
  }

  // Architectural finish is batched into the existing room, with a small,
  // bounded number of instances. No extra lights, texture requests or invisible
  // colliders on the public aisles. Colors distinguish the building's purpose.
  function rioFinishInterior(site,room){
    const {w,d,kind}=site, b=room.box, edgeX=w/2-.51,edgeZ=d/2-.51;
    const theme={
      residence:site.style==='damha'||site.style==='rios-ditalia'?[0x6d8b8a,0xe8dfd0]:site.style==='snow-cabin'?[0x896748,0xd4bf97]:site.style==='mountain-luxury'?[0x526d75,0xe8dfcf]:[0x9d7659,0xe6d6bb],
      mall:[0x467579,0xe4ddd0],market:[0xa46a43,0xe8dbbb],dining:[0x9c6249,0xe8c6a4],
      bakery:[0xaa7950,0xf0dfbe],construction:[0x516b61,0xd2c7a8],church:[0x9a7954,0xe1cfac],
      station:[0x4d6b7b,0xd7dfe0],airport:[0x486c80,0xd4e0e4],reception:[0x61847c,0xe1e9e3],
      civic:[0x617680,0xe4dfd1],theater:[0x794a43,0xc2a898],exhibition:[0x637b72,0xe4ded0]
    }[kind];
    if(!theme)return;
    const [accent,pale]=theme;
    for(const side of[-1,1]){
      const wall=room.wallDraw?.[side<0?'left':'right']?.box||b;
      wall(side*edgeX,.16,0,.055,.18,d-1.04,accent);
      wall(side*edgeX,2.20,0,.055,.09,d-1.04,pale);
      // Framed wall panels, not free-floating furniture or false doors.
      const panels=Math.max(1,Math.min(5,Math.floor((d-1.8)/3.4)));
      for(let i=0;i<panels;i++){
        const z=-d*.38+(i+.5)*(d*.76/panels);
        const span=Math.min(1.4,d*.40/panels);
        wall(side*(edgeX-.01),2.46,z,.06,.40,span,accent);
        wall(side*(edgeX-.05),2.46,z,.06,.27,span*.81,pale);
      }
    }
    const back=room.wallDraw?.back?.box||b;
    back(0,.16,-edgeZ,w-1.04,.18,.055,accent);
    back(0,2.20,-edgeZ,w-1.04,.09,.055,pale);
    // Fine grout joints / floorboards make the surface visibly intentional.
    const tile=kind==='residence'?1.1:1.8;
    const joints=Math.min(12,Math.floor((w-1.2)/tile));
    for(let i=1;i<joints;i++)b(-w*.5+.6+i*(w-1.2)/joints,.009,0,.025,.012,d-1.2,kind==='residence'?0x9a8d7c:0xa7a49b);
    if(kind!=='residence')for(let i=1,rows=Math.min(10,Math.floor((d-1.2)/tile));i<rows;i++)b(0,.009,-d*.5+.6+i*(d-1.2)/rows,w-1.2,.012,.025,0xa7a49b);
    if(kind!=='residence'){
      // A clear central route in commercial/public buildings; only floor
      // markings, so walking and vehicle physics remain unchanged.
      const aisle=Math.min(2.7,w*.22);
      b(0,.063,d*.17,aisle,.012,d*.52,pale);
      for(const side of[-1,1])b(side*(aisle/2-.035),.075,d*.17,.07,.012,d*.51,accent);
    }
    room.interiorTheme=kind==='residence'?'home-'+(site.style||'classic'):kind;
  }

  function rioBuildConstructionStore(site,room){
    const {w,d}=site,hardware=site.shop==='tools';
    const shelfX=Math.min(w*.34,w/2-1.02),length=Math.min(5.2,d*.43);
    for(const side of[-1,1]){
      const x=side*shelfX;
      // Stock stands occupy the side bays; the middle aisle stays clear.
      room.object(x,.84,-d*.06,.82,1.68,length,0x6f7971);
      for(const y of[.44,.97,1.53])room.box(x,y,-d*.06,.98,.07,length,0xc1b7a1);
      for(let i=0;i<5;i++){
        const z=-d*.06-length*.4+i*length*.2;
        if(hardware){
          room.box(x-side*.46,.68,z,.29,.36,.45,[0x4e7488,0xb08a46,0x6d8278][i%3]);
          room.box(x-side*.46,1.20,z,.29,.35,.43,[0x7f5947,0x678c8f,0xd0bc94][i%3]);
          room.box(x-side*.46,1.72,z,.28,.25,.44,0x4d6063);
        }else{
          room.box(x-side*.45,.66,z,.35,.33,.54,i%2?0xc7b18a:0xb08761);
          room.box(x-side*.45,1.18,z,.35,.30,.50,i%2?0xb36951:0xd5c5a6);
          room.part('post',x-side*.45,1.75,z,.30,.36,.30,i%2?0x6d9993:0xe2ce9c);
        }
      }
      room.sign(hardware?(side<0?'FERRAMENTAS':'FERRAGENS'):(side<0?'PISOS E CIMENTO':'TINTAS E ACABAMENTOS'),x,2.60,-d*.06,Math.min(3.3,w*.22),.36,'#455e53');
    }
    const z=-d*.16-1.02;
    rioCounter(room,0,z,Math.min(4.2,w*.44),0x586c62);
    rioServiceClerk(site,room,'construction','Consultor de materiais',0,z-.84,0x597c6d);
    room.sign(hardware?'PEDIDOS · FERRAMENTAS':'PEDIDOS · ENTREGA NO IMÓVEL',0,2.45,z-.38,Math.min(5.1,w*.48),.43,'#455e53');
    room.interiorStock=hardware?'tools':'materials';
  }

  function rioTable(room,x,z,{seatOffset=.9,side=1,cloth=0xe7d3b7}={}){
    const {box,object}=room;
    object(x,.79,z,1.18,.12,1.06,rioPaint.wood);
    box(x,.871,z,1.03,.021,.95,cloth);
    for(const dx of [-.47,.47])for(const dz of[-.36,.36])box(x+dx,.37,z+dz,.085,.74,.085,rioPaint.wood);
    return rioDiningChair(room,x,z,side,seatOffset);
  }
  function rioDiningChair(room,x,z,side,seatOffset=.9){
    const {box,point}=room,sx=x+side*seatOffset;
    box(sx,.465,z,.52,.09,.53,rioPaint.seat);
    box(sx+side*.22,.735,z,.075,.51,.52,rioPaint.wood);
    for(const dz of[-.20,.20])box(sx,.22,z+dz,.37,.44,.077,rioPaint.wood);
    // The place to stand is alongside the chair. Sitting starts on the furniture itself.
    room.collider(sx,z,.54,.56,.96);
    const table=point(x,z),chair=point(sx,z),approach=point(sx,z+1.02);
    return {table,chair,approach,yaw:Math.atan2(table.x-chair.x,table.z-chair.z),seatTop:(room.floorY||0)+.51};
  }

  function rioCounter(room,x,z,width=3.05,accent=rioPaint.wood){
    room.object(x,.49,z,width,.98,.65,accent);
    room.box(x,1.014,z,width+.12,.068,.76,rioPaint.white);
    room.box(x+width*.24,1.18,z-.08,.47,.26,.32,rioPaint.window);
    return room.point(x,z+1.02);
  }

  function rioPurchaseItems(item){
    if(!Number.isSafeInteger(item.price)||item.price<1||Number(state.profile.coins)<item.price){
      toast('Moedas insuficientes.','warn',1800);return false;
    }
    addCoins(-item.price);
    for(const key of ['food','water'])if(item[key])state.inventory[key]=Math.min(999,Math.max(0,Number(state.inventory[key]||0))+item[key]);
    if(item.hunger)state.needs.hunger=clamp(Number(state.needs.hunger||0)+item.hunger,0,100);
    return true;
  }
  function rioOpenDining(site,room,counter){
    if(!rioPlayerAt(counter))return;
    const clerk=room.npcs?.find(n=>n.shopSlot==='dining');if(clerk)clerk.servingUntil=performance.now()+2500;
    const stock=site.kind==='bakery'?[{id:'bread-coffee',name:'Pão na chapa e café',price:12,hunger:22},
      {id:'juice',name:'Suco de laranja',price:10,hunger:10},{id:'bread-pack',name:'Pães para levar',price:16,food:3}]:site.key==='canecao_represa'?rioDiningStock:
      [{id:'burger',name:'Hambúrguer',price:14,hunger:38},{id:'juice',name:'Bebida sem álcool',price:10,hunger:10},{id:'parcel',name:'Lanche para levar',price:18,food:2}];
    const order=rioMap.order;
    if(order?.site===site.id){
      openModal('Seu pedido · '+site.name,'<p>'+escapeHtml(order.item.name)+' · mesa 1. Você paga somente ao consumir.</p>'+
        '<div class="modal-actions"><button class="btn primary" data-rio-resume-meal>Ir à mesa</button><button class="btn" data-rio-cancel-meal>Cancelar pedido</button></div>',root=>{
          root.querySelector('[data-rio-resume-meal]').onclick=closeModal;
          root.querySelector('[data-rio-cancel-meal]').onclick=()=>{if(rioMap.order===order)rioClearDiningOrder(room);closeModal();};
        });
      return;
    }
    if(order){const previous=rioMap.sites.get(order.site);if(previous)rioClearDiningOrder(previous);else rioMap.order=null;}
    openModal(site.name,'<p>Faça o pedido no balcão. Para consumir aqui, vá até a mesa indicada.</p><div class="choice-grid">'+
      stock.map(item=>'<button class="choice" data-rio-food="'+item.id+'"><b>'+item.name+'</b><span>'+item.price+' moedas</span></button>').join('')+
      '</div>',root=>{
      let ordered=false;
      for(const button of root.querySelectorAll('[data-rio-food]'))button.onclick=()=>{
        if(ordered||button.disabled||Math.hypot(player.x-counter.x,player.z-counter.z)>1.85||!room.root.visible)return;
        const item=stock.find(record=>record.id===button.dataset.rioFood);
        if(!item)return;
        if(Number(state.profile.coins)<item.price){toast('Moedas insuficientes.','warn',1800);return;}
        ordered=true;button.disabled=true;
        closeModal();
        if(item.food){
          if(rioPurchaseItems(item)){rioCountVisit(site);toast('Lanche entregue no balcão.','good',2100);}
        }else{
          const seat=room.seats[0];
          rioMap.order={site:site.id,item,seat};
          if(room.server){
            room.server.index=0;room.server.serving=true;room.server.tray.visible=true;
            toast('A garçonete vai levar seu pedido à mesa 1.','good',2600);
          }else{
            room.servedDish.visible=true;
            toast('Pedido pronto na mesa 1. Use Ação junto à cadeira.','good',2900);
          }
        }
      };
    });
  }

  function rioClearDiningOrder(room){
    if(rioMap.order?.site===room.site.id)rioMap.order=null;
    if(room.servedDish)room.servedDish.visible=false;
    if(room.server){
      const server=room.server;
      server.tray.visible=false;server.serving=false;server.index=0;server.direction=1;
      const start=server.points[0];
      server.npc.group.position.x=start.x;server.npc.group.position.z=start.z;
      poseResident(server.npc,'work',performance.now()/1000);
    }
  }
  function rioEatAtTable(site,room,seat){
    const order=rioMap.order;
    if(order?.site!==site.id||order.seat!==seat||!room.root.visible||!room.servedDish.visible||!rioPlayerAt(seat.approach))return false;
    if(!rioSiteContains(site,seat.chair.x,seat.chair.z,-.35)||Math.hypot(seat.table.x-seat.chair.x,seat.table.z-seat.chair.z)>1.12)return false;
    const kind=order.item.id==='juice'?'drink':'meal';
    return beginCharacterActivity(kind,{
      target:{...seat.approach},pose:{...seat.chair,y:seat.seatTop,yaw:seat.yaw,sitting:true},
      commit:()=>{
        if(order!==rioMap.order||!room.root.visible||!rioPlayerAt(seat.approach,.26))return false;
        if(!rioPurchaseItems(order.item))return false;
        rioMap.order=null;room.servedDish.visible=false;
        setFlag('ateMeal');state.stats.restaurantMeals=(state.stats.restaurantMeals||0)+1;
        rioCountVisit(site);return true;
      }
    });
  }
  function rioBuildDining(site,room){
    const {w,d}=site, x=Math.min(4.2,w*.25),z=-Math.min(2.0,d*.13);
    room.seats=[rioTable(room,-x,z,{side:1,cloth:0xcf8251}),rioTable(room,x,z,{side:-1,cloth:0xf2e2ca})];
    for(const side of[-1,1]){
      room.box(side*x,.075,z,1.64,.018,1.46,site.kind==='bakery'?0xd3b185:0xb37f60);
      room.box(side*x,.91,z-.25,.20,.075,.21,0xdacbb5);
      room.part('post',side*x,1.04,z-.25,.105,.22,.105,0x70935e);
    }
    const marked=room.seats[0], dish=new THREE.Mesh(new THREE.CylinderGeometry(.23,.22,.065,16),renderMat(0xffeaba));
    dish.position.set(marked.table.x,room.floorY+.917,marked.table.z);dish.visible=false;dish.name='RIO_ORDER_ON_TABLE';
    room.root.add(dish);room.servedDish=dish;
    const counterZ=-d/2+1.85;
    const counter=rioCounter(room,0,counterZ,Math.min(4.6,w*.53));
    room.sign('PEDIDOS',0,2.31,counterZ-.37,Math.min(3.4,w*.6),.32);
    room.box(0,2.90,counterZ-.47,Math.min(4.7,w*.54),.16,.53,0x79523e);
    const displayZ=counterZ-.36;
    for(let i=-2;i<=2;i++){
      if(site.kind==='bakery')room.part('canopy',i*.39,1.18,displayZ,.30,.23,.30,0xcba262);
      else room.box(i*.39,1.20,displayZ,.23,.33,.22,i%2?0xb56c4c:0xe8d7ac);
    }
    if(site.kind==='bakery')rioBuildBakeryService(site,room,counterZ,x,z);
    else rioServiceClerk(site,room,'dining','Atendente do restaurante',0,counterZ-.86,0x99735e);
    room.action('counter','Fazer pedido no balcão',0,counterZ+1.02,()=>rioOpenDining(site,room,counter),{inside:true,icon:'🍽️'});
    const p=marked.approach,dx=p.x-site.x,dz=p.z-site.z,c=Math.cos(site.yaw),s=Math.sin(site.yaw);
    room.action('table','Mesa 1 · sentar e consumir',c*dx-s*dz,s*dx+c*dz,
      ()=>rioEatAtTable(site,room,marked),{inside:true,icon:'🍽️',available:()=>rioMap.order?.site===site.id&&room.servedDish.visible});
    room.sign('1',-x,1.05,z+.04,.18,.21,'#6b3f31');
    // Keep the original player table, approach, order and payment untouched.
    if(site.key==='canecao_represa'&&w>=15&&d>=8)rioCanecaoGuests(site,room,x,z);
    else if(w>=8&&d>=6.5){
      const guest=room.seats[1];
      rioPublicGuest(site,room,'dining-guest','Cliente',x-.9,z,{seat:.51,action:'eat',yaw:guest.yaw,color:0x98775f});
      room.box(x,.928,z,.36,.05,.35,0xf1e2c6);
      room.box(x,.974,z,.24,.06,.23,site.kind==='bakery'?0xc39159:0xc57b48);
      room.box(x+.33,1.0,z-.22,.10,.18,.10,0xd4ac70);
    }
  }

  function rioCanecaoGuests(site,room,x,z){
    const back=Math.min(1.55,site.d*.19),colors=[0x6285a0,0xb97e65,0x66846e,0x9e7295];
    const seats=[room.seats[1],rioDiningChair(room,x,z,1)];
    // Two additional tables outside the central entry aisle; keep the first free.
    seats.push(rioTable(room,x,back,{side:-1,cloth:0xcf8251}),rioDiningChair(room,x,back,1));
    rioTable(room,-x,back,{side:1,cloth:0xf2e2ca});rioDiningChair(room,-x,back,-1);
    rioDiningChair(room,-x,z,-1);
    for(const row of [{x,z},{x,z:back}]){
      room.box(row.x,.928,row.z,.57,.055,.56,0xf5e9d1);
      room.box(row.x,.971,row.z,.44,.044,.43,0xd29b51);
      for(const dx of[-.12,.12])for(const dz of[-.12,.12])room.box(row.x+dx,1.005,row.z+dz,.08,.018,.08,0xa84b38);
      for(const side of[-1,1])room.box(row.x+side*.33,.997,row.z-.29,.12,.20,.12,0xbd813f);
    }
    room.diningGuests=seats.map((seat,index)=>{
      const npc=createNPC('rio-diner-'+site.key+'-'+index,'Cliente',seat.chair.x,seat.chair.z,colors[index],0);
      npc.stationary=true;npc.cityLifeManaged=true;npc.rioFloorY=room.floorY;
      npc.group.rotation.y=seat.yaw;room.root.add(npc.group);
      (room.npcs??=[]).push(npc);
      world.interactables=world.interactables.filter(action=>action.id!=='npc-'+npc.id);
      poseResident(npc,'talk',0,seat.seatTop);
      return {npc,seat,index};
    });
  }
  // The established interior service scheduler already runs near visible rooms.
  const rioDiningServiceBefore=rioUpdatePlaceService;
  rioUpdatePlaceService=function(site,room,dt){
    rioDiningServiceBefore(site,room,dt);
    if(!room.root.visible)return;
    const time=performance.now()/1000;
    for(const {npc,seat,index} of room.diningGuests||[]){
      const phase=(time+index*3)%12,action=phase<5?'talk':phase<9?'eat':'sit';
      poseResident(npc,action,time,seat.seatTop);
      if(phase>=9&&npc.limbs)npc.limbs.rightArm.rotation.x=-1.35-Math.sin(time*2)*.18;
    }
    for(const {npc,seat,action,index} of room.publicGuests||[]){
      const gesture=action==='talk'&&((time+index*2)%8)>4?'sit':action;
      poseResident(npc,gesture,time,seat);
    }
    if(room.stageActor&&room.serviceComplete){
      const npc=room.stageActor;poseResident(npc,'talk',time);
      if(npc.limbs){npc.limbs.leftArm.rotation.x=-.9-Math.sin(time*3)*.32;npc.limbs.rightArm.rotation.x=-.8+Math.sin(time*3)*.32;}
    }
    if(room.cinema?.session&&typeof rioUpdateCinema==='function')rioUpdateCinema(room,time);
  };

  // Occupied furniture and role-specific idle routines share the existing NPC
  // renderer. These residents stay inside the room, outside walking aisles.
  function rioPublicGuest(site,room,id,name,x,z,{seat=null,action='talk',yaw=site.yaw,color=0x6d8792}={}){
    const p=room.point(x,z),npc=createNPC('rio-public-'+site.key+'-'+id,name,p.x,p.z,color,0);
    npc.stationary=true;npc.cityLifeManaged=true;npc.rioFloorY=room.floorY;
    npc.group.rotation.y=yaw;room.root.add(npc.group);(room.npcs??=[]).push(npc);
    world.interactables=world.interactables.filter(item=>item.id!=='npc-'+npc.id);
    const guests=room.publicGuests??=[];
    guests.push({npc,seat:seat===null?undefined:room.floorY+seat,action,index:guests.length});
    poseResident(npc,action,0,seat===null?undefined:room.floorY+seat);
    return npc;
  }
  function rioBasketTotals(basket,items){
    const entries=[];
    for(const item of items){
      const quantity=Math.max(0,Math.min(12,Math.floor(Number(basket[item.id])||0)));
      if(quantity&&Number.isSafeInteger(item.price)&&item.price>0)entries.push({item,quantity});
    }
    return {entries,count:entries.reduce((n,e)=>n+e.quantity,0),total:entries.reduce((n,e)=>n+e.item.price*e.quantity,0)};
  }

  function rioServiceClerk(site,room,role,name,x,z,color){
    const p=room.point(x,z),clerk=createNPC('rio-service-'+site.key+'-'+role,name,p.x,p.z,color,0);
    clerk.stationary=true;clerk.cityLifeManaged=true;clerk.shopSlot=role;
    clerk.group.rotation.y=site.yaw;clerk.rioFloorY=room.floorY;clerk.group.position.y=room.floorY;room.root.add(clerk.group);
    room.npcs??=[];room.npcs.push(clerk);
    world.interactables=world.interactables.filter(a=>a.id!=='npc-'+clerk.id);
    return clerk;
  }
  function rioBuildMarket(site,room){
    const {w,d}=site,{box,object,sign}=room, counterZ=-d/2+2.45;
    const items=site.kind==='bakery'?CITY_SHOP_STOCK.cafe:CITY_SHOP_STOCK.market;
    const stallX=Math.min(4.6,w*.26);
    const stallD=Math.min(d*.3,5.2),stallW=Math.min(1.38,w*.12);
    if(site.kind!=='bakery')for(const side of [-1,1]){
      object(side*stallX,.45,0,stallW,.90,stallD,0xa37154);
      box(side*stallX,.936,0,stallW+.08,.072,stallD,0xbe8e62);
      for(let row=0;row<5;row++)for(let col=-1;col<=1;col++){
        room.part('canopy',side*stallX+col*.23,1.06,-stallD*.37+row*stallD*.18,.22,.21,.22,
          [0xc17435,0x9b5236,0x6d8755][(row+col+4)%3]);
      }
    }
    const counter=rioCounter(room,0,counterZ,Math.min(4.7,w*.54));
    const clerk=rioServiceClerk(site,room,'checkout','Caixa',0,counterZ-.88,0x527e70);
    sign(site.kind==='bakery'?'PÃES':site.kind==='mall'?'MERCADO · CAIXA':'CAIXA',0,2.63,counterZ-.35,3.15,.46);
    if(w>=10&&d>=8){
      for(const side of[-1,1]){
        const sx=side*stallX;
        box(sx,1.62,0,stallW+.13,.08,stallD,0xb59873);
        box(sx,1.71,0,stallW+.18,.09,stallD,0x6d8870);
        for(let i=0;i<5;i++){
          const pz=-stallD*.39+i*stallD*.19;
          box(sx,1.44,pz,stallW*.62,.27,.29,[0xd7ba80,0x8b9e76,0xb97358][i%3]);
        }
        for(const end of[-1,1])box(sx,.46,end*stallD*.47,stallW+.08,.75,.10,0x9c7453);
      }
    }
    if(site.kind!=='bakery'){
      room.basket??={};
      // Physical shelf access: select goods here, then take the basket to the
      // original cashier. The existing direct-purchase flow remains available.
      const positions=items.map((item,i)=>({item,side:i%2?-1:1,z:(Math.floor(i/2)-.5)*stallD*.55}));
      for(const {item,side,z} of positions){
        const x=side*(stallX-stallW/2-.85),point=room.point(x,z);
        room.action('shelf-'+item.id,'Prateleira · '+item.name,x,z,()=>{
          if(!rioPlayerAt(point))return false;
          const basket=room.basket,summary=rioBasketTotals(basket,items);
          if(summary.count>=12){toast('Cesta cheia. Passe no caixa.','info',2000);return false;}
          basket[item.id]=(Number(basket[item.id])||0)+1;
          toast(item.name+' na cesta. Total: '+rioBasketTotals(basket,items).total+' moedas.','good',2200);
          return true;
        },{inside:true,icon:'🛒',radius:1.45});
      }
      if(w>=12&&d>=10){
        rioPublicGuest(site,room,'market-1','Cliente',-stallX+stallW/2+.70,stallD*.38,{yaw:site.yaw-Math.PI/2,action:'work',color:0x9d785e});
        rioPublicGuest(site,room,'market-2','Cliente',stallX-stallW/2-.70,stallD*.38,{yaw:site.yaw+Math.PI/2,action:'talk',color:0x568a82});
      }
    }
    room.action('counter',site.kind==='bakery'?'Comprar pães no balcão':'Comprar no caixa',0,counterZ+1.02,()=>{
      if(!rioPlayerAt(counter))return;
      clerk.servingUntil=performance.now()+2500;
      const summary=rioBasketTotals(room.basket||{},items);
      const basketHTML=summary.count?'<h3>Sua cesta · '+summary.count+' produto(s)</h3><p>'+summary.entries.map(e=>escapeHtml(e.item.name)+' × '+e.quantity).join(' · ')+'</p><p>Total: <b>'+summary.total+' moedas</b></p><div class="modal-actions"><button class="btn primary" data-rio-basket-pay>Pagar cesta</button><button class="btn" data-rio-basket-clear>Esvaziar cesta</button></div>':'<p>Escolha produtos nas prateleiras ou compre diretamente no caixa.</p>';
      openModal(site.name,basketHTML+'<p>Produtos disponíveis no balcão.</p><div class="choice-grid">'+items.map(item=>
        '<button class="choice" data-rio-checkout="'+item.id+'"><b>'+item.name+'</b><span>'+item.price+' moedas</span></button>').join('')+'</div>',root=>{
        let sold=false;
        const basketPay=root.querySelector('[data-rio-basket-pay]'),basketClear=root.querySelector('[data-rio-basket-clear]');
        if(basketPay)basketPay.onclick=()=>{
          if(sold||!room.root.visible||Math.hypot(player.x-counter.x,player.z-counter.z)>1.85)return;
          const fresh=rioBasketTotals(room.basket||{},items);
          if(!fresh.count||fresh.total>Number(state.profile.coins)){toast('Moedas insuficientes.','warn',1800);return;}
          sold=true;
          for(const {item,quantity} of fresh.entries)for(let i=0;i<quantity;i++)rioPurchaseItems(item);
          room.basket={};rioCountVisit(site);closeModal();toast('Compra da cesta concluída.','good',2200);
        };
        if(basketClear)basketClear.onclick=()=>{if(sold)return;room.basket={};closeModal();};
        for(const button of root.querySelectorAll('[data-rio-checkout]'))button.onclick=()=>{
          if(sold||Math.hypot(player.x-counter.x,player.z-counter.z)>1.85||!room.root.visible)return;
          const item=items.find(record=>record.id===button.dataset.rioCheckout);
          if(!item||!rioPurchaseItems(item))return;
          sold=true;closeModal();rioCountVisit(site);toast('Compra entregue no balcão.','good',2000);
        };
      });
    },{inside:true,icon:'🛒'});
  }

  function rioDeskModel(site,room){
    const {d,w,kind}=site;
    const configs={
      civic:['ATENDIMENTO','Retirar senha','Receber o protocolo do jogo','Protocolo entregue no balcão.'],
      theater:['BILHETERIA','Retirar ingresso','Acender o palco na cabine','Luzes do palco acesas.'],
      exhibition:['RECEPÇÃO','Retirar ingresso','Ver a peça exposta','Visita registrada na exposição.'],
      reception:['RECEPÇÃO','Retirar senha','Apresentar a senha no guichê','Senha registrada no atendimento do jogo.'],
      station:['PARTIDAS','Consultar partidas','Chegar à plataforma','Você chegou à plataforma.']
    };
    const [sign,title,next,success]=configs[kind], z=-d*.19,x=Math.min(w*.26,4.2),stationX=Math.min(w*.25,3.8),stationZ=-d/2+1.2;
    const counter=rioCounter(room,-x,z,Math.min(w*.33,3.3));
    room.sign(sign,-x,2.23,z-.28,Math.min(w*.4,3.6),.46);
    rioServiceClerk(site,room,'reception','Recepcionista',-x,z-.80,0x607f91);
    const badge=rioCounter(room,stationX,stationZ,Math.min(2.3,w*.25),0x738889);
    const light=new THREE.Mesh(new THREE.SphereGeometry(.15,8,6),new THREE.MeshBasicMaterial({color:0xf8bb5b}));
    light.position.set(badge.x,room.floorY+1.12,badge.z-1.02);light.visible=false;room.root.add(light);room.lights.push(light);
    const seatsZ=Math.min(d*.28,3.6);
    if(kind!=='theater'){
      room.bench(x,seatsZ);
      room.action('waiting-seat','Sentar enquanto aguarda atendimento',x,seatsZ+.81,
        ()=>rioSitOnBench(site,room,x,seatsZ),{inside:true,icon:'🪑'});
    }
    if(kind==='theater'){
      room.box(0,.16,-d*.40,Math.min(9.5,w*.43),.31,Math.min(3,d*.15),0x735041);
      const stageW=Math.min(9.5,w*.43);
      room.box(0,3.15,-d*.46,stageW+.50,.23,.24,0x7a483c);
      for(const side of[-1,1])for(let i=0;i<4;i++)room.box(side*(stageW*.47-i*.14),1.66,-d*.46,.18,2.84,.21,i%2?0x9a5050:0x793c42);
      room.box(0,.325,-d*.40,stageW-.22,.035,Math.min(2.65,d*.14),0xb79b75);
      for(let i=0;i<5;i++){
        const p=room.point((i-2)*Math.min(w*.105,1.45),-d*.42);
        const strip=new THREE.Mesh(new THREE.BoxGeometry(.47,.27,.31),new THREE.MeshBasicMaterial({color:0xffcf82}));
        strip.position.set(p.x,room.floorY+2.69,p.z);strip.visible=false;room.root.add(strip);room.lights.push(strip);
      }
      for(let i=0;i<3;i++)for(const side of [-1,1])room.bench(side*x,.29+i*1.17);
      room.stageActor=rioPublicGuest(site,room,'stage','Artista',0,-d*.40,{action:'talk',color:0xa76c56});
      room.stageActor.rioFloorY=room.floorY+.32;
      for(let i=0;i<3;i++)rioPublicGuest(site,room,'audience-'+i,'Espectador',-x,.29+i*1.17,{seat:.535,yaw:site.yaw+Math.PI,action:'sit'});
      const approach=room.point(x,.29+1.17+.81),seat=room.point(x,.29+1.17);
      room.action('watch-show','Sentar e assistir à apresentação',x,.29+1.17+.81,()=>{
        if(!room.serviceComplete||!rioPlayerAt(approach))return false;
        return beginCharacterActivity('tv',{target:approach,pose:{...seat,y:room.floorY+.535,yaw:site.yaw+Math.PI,sitting:true},commit:()=>{
          if(!room.root.visible||!rioPlayerAt(approach,.26))return false;
          state.needs.fun=clamp(Number(state.needs.fun||0)+18,0,100);rioCountVisit(site);return true;
        }});
      },{inside:true,available:()=>!!room.serviceComplete,icon:'🎭'});
    }else if(kind==='exhibition'){
      room.object(0,.5,-d*.29,1.25,1,1.25,rioPaint.stone);
      room.part('canopy',0,1.55,-d*.29,.82,.9,.74,0xab7344);
    }else if(kind==='reception'&&w>=9&&d>=8){
      const examX=-w*.35,examZ=d*.19;
      room.object(examX,.35,examZ,.97,.67,1.92,0x8ca7a2);
      room.box(examX,.73,examZ,.87,.10,1.81,0xd9e3d9);
      room.box(examX,.82,examZ-.63,.76,.14,.44,0xf0eee1);
      room.box(examX-.51,1.14,examZ,.075,.91,1.70,0x9fb4ad);
      room.box(examX,1.84,examZ-.98,1.52,.13,.08,0x8ca79e);
      room.sign('SALA DE REPOUSO',examX,2.22,examZ-.97,Math.min(2.9,w*.30),.32,'#57796d');
      rioServiceClerk(site,room,'nursing','Profissional de enfermagem',examX+.85,examZ-.72,0xe5e8de);
      if(w>=12&&d>=10)rioPublicGuest(site,room,'waiting','Paciente',x,seatsZ,{seat:.535,action:'sit'});
      const approach=room.point(examX+.91,examZ),bed=room.point(examX,examZ);
      room.action('recovery','Descansar após o atendimento',examX+.91,examZ,()=>{
        if(!room.serviceComplete)return false;
        return beginCharacterActivity('rio-rest',{target:approach,pose:{...bed,y:room.floorY+.86,yaw:site.yaw,lying:true},commit:()=>{
          if(!room.root.visible||!rioPlayerAt(approach,.26))return false;
          state.needs.energy=clamp(Number(state.needs.energy||0)+8,0,100);
          saveState(true);updateHUD();return true;
        }});
      },{inside:true,available:()=>!!room.serviceComplete,icon:'🛏️'});
    }else if(kind==='station'){
      room.sign('PLATAFORMA',stationX,2,stationZ-.35,Math.min(w*.5,6),.5);
      for(let i=-3;i<=3;i++)room.box(i*.5,.035,stationZ+2.2,.36,.036,.15,0xceb35a);
    }
    room.action('desk',title,-x,z+1.02,()=>{
      if(!rioPlayerAt(counter))return;
      room.ticket=true;light.visible=true;
      toast(next+'.','info',2700);
    },{inside:true,icon:'📋'});
    room.action('service',next,stationX,stationZ+1.02,()=>{
      if(!room.ticket||!rioPlayerAt(badge))return;
      const complete=()=>{
        if(!room.ticket||!room.root.visible||!rioPlayerAt(badge,.30))return false;
        room.ticket=false;room.serviceComplete=true;room.lights.forEach(item=>{item.visible=true;});
        rioCountVisit(site);toast(success,'good',2600);return true;
      };
      if(kind==='reception'){
        CHARACTER_ACTIVITIES['rio-consult']=['Atendimento simulado',4];
        const doctor=room.npcs?.find(n=>n.shopSlot==='nursing');
        if(doctor)doctor.servingUntil=performance.now()+4500;
        return beginCharacterActivity('rio-consult',{target:badge,pose:{...badge,y:room.floorY,yaw:site.yaw+Math.PI},commit:complete});
      }
      // Preserve the established interaction radius for civic, station and
      // exhibition desks; their own objects still provide the visible action.
      room.ticket=false;room.serviceComplete=true;room.lights.forEach(item=>{item.visible=true;});
      rioCountVisit(site);toast(success,'good',2600);
    },{inside:true,available:()=>room.ticket});
  }

  function rioSitOnBench(site,room,x,z){
    const approach=room.point(x,z+.81),seat=room.point(x,z);
    if(!rioPlayerAt(approach))return;
    beginCharacterActivity('rio-rest',{target:approach,pose:{...seat,y:(room.floorY||0)+.535,yaw:site.yaw,sitting:true},
      commit:()=>{if(!room.root.visible||!rioPlayerAt(approach,.26))return false;state.needs.energy=clamp(state.needs.energy+4,0,100);rioCountVisit(site);return true;}});
  }
  function rioBuildChurch(site,room){
    const {w,d}=site;
    const lateral=Math.min(w*.24,4.7), pewZ=Math.min(d*.20,2.8);
    for(let i=0;i<4;i++)for(const side of [-1,1])room.bench(side*lateral,pewZ-i*1.35);
    for(let i=0;i<3;i++)rioPublicGuest(site,room,'pew-'+i,'Visitante',-lateral,pewZ-i*1.35,{seat:.535,action:'sit',yaw:site.yaw+Math.PI,color:[0x8b736c,0x63878a,0x9a9570][i]});
    const altarZ=-d/2+1.34;
    room.object(0,.53,altarZ,Math.min(3.55,w*.54),1.06,.78,rioPaint.stone);
    room.box(0,3.72,altarZ-.66,.16,2.11,.16,0xa47d61);
    room.box(0,4.13,altarZ-.66,1.33,.16,.16,0xa47d61);
    for(const side of [-1,1])for(let j=0;j<4;j++)room.box(side*(w/2-.49),3.14+j*.21,-d*.22,.115,.19,1.24,
      [0x5b8d9d,0xc59d62,0x926d89,0x799693][j]);
    room.action('pew','Sentar no banco da Catedral',lateral,pewZ+.81,()=>rioSitOnBench(site,room,lateral,pewZ),{inside:true});
    room.action('nave','Observar a nave e os vitrais',0,altarZ+1.47,()=>{rioCountVisit(site);toast('Visita à Catedral registrada.','good',2100);},{inside:true});
    for(const side of [-1,1]){
      const x=side*Math.min(w*.28,7.5),artZ=altarZ-.48;
      room.box(x,2.13,artZ,1.17,1.56,.11,0x8c6046);
      room.box(x,2.13,artZ+.065,.99,1.36,.04,side===1?0xa69759:0x568895);
      room.box(x,2.31,artZ+.10,.48,.51,.036,0xe5c5a5);
      room.object(x,.49,altarZ+.25,1.28,.98,.61,0x9e836b);
      const kneelerZ=altarZ+1.33;
      room.object(x,.19,kneelerZ,1.17,.38,.45,0xa95c54);
      room.action('altar-'+side,'Rezar no altar lateral',x,kneelerZ+.75,()=>{
        const approach=room.point(x,kneelerZ+.75),kneeler=room.point(x,kneelerZ);
        beginCharacterActivity('rio-rest',{target:approach,pose:{...kneeler,y:room.floorY+.40,yaw:site.yaw+Math.PI,sitting:true},commit:()=>{rioCountVisit(site);return true;}});
      },{inside:true,icon:'🕯️'});
    }
  }

  function rioBuildFuel(site,room){
    const {w,d}=site,{box,object,sign}=room;
    box(0,.024,0,w,.048,d,0x727777);
    const road=rioMap.compact?compactRioLayout.highways.find(road=>road.id==='rio-compact-murchid'):
      rioRoadAt(site.road[0],site.road[1],0,r=>!r.pedestrian);
    const driveway=Math.min(23,Math.hypot(site.x-site.road[0],site.z-site.road[1])-d/2-(road?.width||6)/2);
    const lane=5.15;
    if(driveway>0)box(lane,.026,d/2+driveway/2,3.5,.049,driveway,0x777d79);
    for(const side of [-1,1])box(lane+side*1.48,.053,.75,.08,.015,5.8,0xebe0c5);
    for(const side of [-1,1]){
      object(side*(w/2-1.1),2.15,-2.25,.31,4.3,.32,rioPaint.white);
      object(side*(w/2-1.1),2.15,1.55,.31,4.3,.32,rioPaint.white);
    }
    box(0,4.41,-.35,w, .38,d*.61,0x318375);
    box(0,4.64,-.35,w,.14,d*.61,0xbcb59a);
    sign('POSTO CHIESA BRASÍLIA',0,4.44,d*.31-.32,Math.min(w-.5,17),.42,'#196953');
    box(0,.09,-.40,10.45,.18,.99,0xb7b0a0);
    for(const x of [-2.45,2.45]){
      object(x,.85,-.42,.71,1.7,.62,0xe2e4dc);
      box(x,1.16,-.08,.48,.38,.06,0x395667);
      box(x-.37,.65,-.49,.06,.91,.13,0x2d383a);
      box(x,.49,1.09,.16,.98,.16,0xf1cf7a);
    }
    room.sign('PARE JUNTO À BOMBA',0,2.52,-.76,8.4,.38);
    const p=room.point(lane,-.42);
    room.action('pump','Pare ao lado da bomba',lane,-.42,()=>rioOpenFuel(site,room,p),
      {vehicleOnly:true,icon:'⛽',actionLabel:'Abastecer',radius:2.35});
  }

  // Approximate the actual seated three-metre monument, not a small
  // four-legged generic animal. All pieces remain in shared instance batches.
  function rioDonaCapiParts(){
    const body=0xb77543,chest=0xc78a56,head=0xb87c51,muzzle=0x9f6646,dark=0x59413a;
    const parts=[
      ['plinth',0,.08,0,3,.16,3,0xa39d8c],
      ['sculpture',0,1.02,-.48,1.65,1.71,1.78,body],
      ['sculpture',0,1.56,.23,1.22,1.83,1.13,chest],
      ['sculpture',0,2.28,.49,1.19,1.06,1.38,head],
      ['sculpture',0,2.11,1.03,1.07,.69,.75,muzzle],
      ['sculpture',0,2.31,1.30,.76,.39,.35,0x51413c],
      ['sculpture',0,1.90,.99,.83,.32,.62,0xc28459]
    ];
    for(const side of [-1,1]){
      parts.push(
        ['sculpture',side*.63,.68,-.53,.69,1.03,1.10,body],
        ['sculpture',side*.41,.77,.50,.42,1.20,.43,chest],
        ['sculpture',side*.41,.33,.66,.38,.36,.64,dark],
        ['sculpture',side*.62,.30,-.24,.47,.29,.64,dark],
        ['sculpture',side*.46,2.81,.15,.37,.37,.28,0x865b45,0,side*-.24],
        ['sculpture',side*.47,2.82,.28,.23,.24,.11,dark,0,side*-.24],
        ['sculpture',side*.51,2.45,.79,.26,.29,.23,0x262120],
        ['sculpture',side*.55,2.51,.87,.072,.08,.07,0xf7eee2],
        ['sculpture',side*.19,2.30,1.44,.13,.10,.07,0x302724],
        ['sculpture',side*.38,2.00,1.24,.31,.055,.085,0x674635,0,side*.18]
      );
      for(const toe of [-1,0,1])parts.push(['sculpture',side*.41+toe*.104,.23,.91,.105,.13,.23,0x493b35]);
    }
    return parts;
  }
  const rioLandmarkPhoto={pending:null,busy:false};
  function requestRioLandmarkPhoto(){
    if(!running||!els.modal.hidden||rioLandmarkPhoto.pending||rioLandmarkPhoto.busy)return false;
    const request={until:performance.now()+8000};
    rioLandmarkPhoto.pending=request;
    toast('Fotografando a imagem da câmera atual…','info',1500);
    setTimeout(()=>{if(rioLandmarkPhoto.pending===request){rioLandmarkPhoto.pending=null;toast('Não foi possível fotografar. Tente novamente.','warn',2200);}},8500);
    return true;
  }
  function rioCaptureLandmarkFrame(canvas){
    const request=rioLandmarkPhoto.pending;if(!request)return;
    rioLandmarkPhoto.pending=null;
    if(!running||performance.now()>request.until)return;
    rioLandmarkPhoto.busy=true;
    const finish=()=>{rioLandmarkPhoto.busy=false;};
    try{
      canvas.toBlob(blob=>{
        if(!blob){finish();toast('Fotografia indisponível neste aparelho.','warn',2200);return;}
        const reader=new FileReader();
        reader.onerror=()=>{finish();toast('Não foi possível preparar a fotografia.','warn',2200);};
        reader.onload=()=>{
          finish();if(!running||!els.modal.hidden)return;
          const data=String(reader.result||'');
          if(!data.startsWith('data:image/jpeg;base64,')){toast('Fotografia indisponível.','warn',2200);return;}
          openModal('Minha foto na Dona Capi','<img data-rio-photo-preview alt="Fotografia do jogo" style="display:block;width:100%;height:auto;max-height:55vh;object-fit:contain;border-radius:12px"><div class="modal-actions"><button class="btn primary" data-rio-photo-save>BAIXAR FOTO</button><button class="btn" data-rio-photo-close>VOLTAR AO JOGO</button></div>',root=>{
            root.querySelector('[data-rio-photo-preview]').src=data;
            root.querySelector('[data-rio-photo-save]').onclick=()=>{const a=document.createElement('a');a.href=data;a.download='OTThi-Dona-Capi-'+Date.now()+'.jpg';document.body.append(a);a.click();a.remove();};
            root.querySelector('[data-rio-photo-close]').onclick=closeModal;
          });
        };
        reader.readAsDataURL(blob);
      },'image/jpeg',.9);
    }catch(error){finish();toast('Fotografia indisponível: '+String(error.message||error).slice(0,120),'warn',2400);}
  }
  function rioBuildOpenSite(site,room){
    const {kind,w,d}=site;
    if(kind==='statue'){
      for(const part of rioDonaCapiParts())room.part(...part);
      room.collider(0,0,2.8,2.8,3.0);
      room.action('observe','Observar Dona Capi',0,d/2+1.1,()=>{rioCountVisit(site);toast('Escultura Dona Capi · Parque da Represa','good',2400);},{icon:'🌿'});
      room.action('photo','Fotografar Dona Capi · enquadre com a câmera',1.85,d/2+1.1,requestRioLandmarkPhoto,{icon:'📷',actionLabel:'Fotografar',radius:1.4,priority:249});
      return;
    }
    if(kind==='practice'){
      rioBuildPractice(site,room);
      return;
    }
    if(kind==='trail'){
      for(const x of [-1.48,1.48])room.box(x,1.44,0,.20,2.88,.25,0x52756c);
      room.box(0,2.91,0,3.24,.30,.29,0x52756c);
      room.sign('CAMINHO DA REPRESA',0,2.92,.16,3.12,.33, '#345f56');
      room.action('run','Corrida a pé · seis pontos',0,1.48,openRioGeoRun,{icon:'🏃',radius:3});
      return;
    }
    room.box(0,.028,0,w,.055,d,rioPaint.paving);
    room.bench(0,-.62);
    const planter=kind==='garden'?1.85:Math.min(3.2,w*.35);
    for(const side of [-1,1]){
      room.object(side*planter,.28,-.84,.62,.56,.62,rioPaint.stone);
      room.part('canopy',side*planter,.86,-.84,.57,.62,.59,rioPaint.green);
    }
    room.action('bench',kind==='garden'?'Descansar no jardim':'Sentar na praça',0,.19,()=>rioSitOnBench(site,room,0,-.62),{icon:'🌿'});
    if(kind==='garden')room.action('care','Regar o vaso',planter,.07,()=>{
      if(!rioPlayerAt(room.point(planter,.07)))return;
      room.sign('JARDIM CUIDADO',0,1.21,-1.2,2.4,.36);
      rioCountVisit(site);toast('Vaso regado.','good',1900);
    },{available:()=>!rioMapSave().visits?.[site.id]});
  }

  function rioMountPlace(site,parent){
    if(site.kind==='stadium'){
      createSportsComplexV704(site);
      return null;
    }
    const root=new THREE.Group();root.name='RIO_PLACE_'+site.key;parent.add(root);
    const room=rioSiteLayout(site,root);
    if(rioPlaceStyles[site.kind]){
      rioBuildShell(site,room);
      const [x,z]=site.entry,inside=room.point(0,site.d*.30);
      const id=site.id+'-entrance';
      registerInteractable({id,type:'activity',icon:'🚪',label:'Entrar · '+site.name,x,z,radius:3.2,priority:238,
        available:()=>root.visible&&!player.vehicle&&!player.boating&&!player.swimming&&!characterActivities.session&&
          !room.forSite(player.x,player.z,-.45),
        action:()=>site.kind==='residence'?rioResidenceDoor(site,room,inside):rioEnterPlace(inside)});
      room.actions.push(id);
      if(site.kind==='construction')rioBuildConstructionStore(site,room);
      else if(site.kind==='market')rioBuildMarket(site,room);
      else if(site.kind==='mall')rioBuildShopping(site,room);
      else if(site.kind==='dining'||site.kind==='bakery')rioBuildDining(site,room);
      else if(site.kind==='church')rioBuildChurch(site,room);
      else if(site.kind==='residence')rioBuildResidence(site,room);
      else if(site.kind==='airport')rioBuildAirportTerminal(site,room);
      else rioDeskModel(site,room);
      rioFinishInterior(site,room);
      room.commitWalls();
    }else if(site.kind==='fuel')rioBuildFuel(site,room);
    else if(site.kind==='oil-shop')rioBuildOilShop(site,room);
    else rioBuildOpenSite(site,room);
    room.batch.commit();rioMap.sites.set(site.id,room);
    return room;
  }
