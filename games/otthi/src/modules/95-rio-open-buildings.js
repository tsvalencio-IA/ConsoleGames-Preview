/** Accounts, furniture and services for the walkable city buildings. */
// @otthi-module-body
  function rioEnterPlace(target,onArrival){
    return beginCharacterActivity('rio-entry',{target,walkSpeed:2.8,onArrival:()=>{onArrival?.();updateContext(true);}});
  }

  function rioPropertyTitle(id){
    const properties=rioMapSave().properties??={};
    const existing=state.houses[id];
    const imported=id==='home'||(existing?.owned&&(!existing.ownerUid||existing.ownerUid===window.OTTHOS_RTDB?.uid));
    if(imported&&!properties[id])properties[id]={owned:true,locked:!!existing?.locked,adopted:true};
    return properties[id]||null;
  }

  function rioPropertyDoor({id,name,price,available,enter,decorate}){
    if(!available())return false;
    const property=rioPropertyTitle(id);
    const purchase=property?.owned?'':'<button class="btn good" data-rio-property-buy>Comprar por '+price+' moedas</button>';
    const lock=property?.owned?'<button class="btn" data-rio-property-lock>'+(property.locked?'Destrancar':'Trancar')+'</button>':'';
    const decoration=property?.owned&&decorate?'<button class="btn" data-rio-property-decor>Decorar minha casa</button>':'';
    openModal(name,'<p>'+(property?.owned?'Sua residência.':'Visite a casa ou compre com moedas do jogo.')+
      '</p><div class="modal-actions"><button class="btn primary" data-rio-property-enter>'+(property?.owned?'Entrar e morar':'Visitar')+'</button>'+purchase+lock+decoration+'</div>',root=>{
      root.querySelector('[data-rio-property-enter]').onclick=()=>{if(available()){closeModal();enter();}};
      root.querySelector('[data-rio-property-buy]')?.addEventListener('click',event=>{
        if(event.currentTarget.disabled||!available()||rioPropertyTitle(id)?.owned)return;
        if(state.profile.coins<price){toast('Moedas insuficientes.','warn',1900);return;}
        event.currentTarget.disabled=true;
        rioMapSave().properties[id]={owned:true,locked:false,paid:price,at:Date.now()};
        addCoins(-price);setFlag('boughtHouse');awardMedal('Nova Propriedade');saveState(true);
        rioPropertyDoor({id,name,price,available,enter,decorate});
      });
      root.querySelector('[data-rio-property-decor]')?.addEventListener('click',()=>{
        if(!available()||!rioPropertyTitle(id)?.owned||typeof decorate!=='function')return;
        closeModal();decorate();
      });
      root.querySelector('[data-rio-property-lock]')?.addEventListener('click',()=>{
        const title=rioPropertyTitle(id);if(!title?.owned||!available())return;
        title.locked=!title.locked;if(title.locked)setFlag('lockedHouse');saveState(true);
        rioPropertyDoor({id,name,price,available,enter,decorate});
      });
    });
    return true;
  }

  function rioResidenceDoor(site,room,target){
    const point={x:site.entry[0],z:site.entry[1]},available=()=>room.root.visible&&rioPlayerAt(point,3.3);
    const enterUnit=(onArrival)=>{
      room.gate.disabled=true;room.door.visible=false;
      room.refreshDecor?.();
      if(!rioEnterPlace(target,()=>{if(site.propertyId==='home')setFlag('enteredHome');if(site.style==='rios-ditalia'){(rioMapSave().selectedApartmentBySite??={})[site.id]=room.selectedUnitId;saveState(true);}onArrival?.();})){
        room.gate.disabled=false;room.door.visible=true;
      }
    };
    if(site.style!=='rios-ditalia'){
      room.selectedUnitId=site.propertyId;
      return rioPropertyDoor({id:site.propertyId,name:site.name,price:site.price,available,
        decorate:()=>enterUnit(()=>room.manageFurniture?.()),enter:enterUnit});
    }
    // Unit 101 reuses the original property ID to preserve ownership saves.
    const unitId=number=>number==='101'?site.propertyId:site.propertyId+'-unit-'+number;
    const units=[];
    // The exterior already renders five levels with four window bays each.
    for(let floor=1;floor<=5;floor++)for(let door=1;door<=4;door++){
      const number=String(floor)+'0'+String(door);
      units.push({number,id:unitId(number),floor});
    }
    openModal('Apartamentos · '+site.name,
      '<p>Escolha a unidade para visitar, comprar ou decorar. Cada apartamento tem seus próprios móveis e progresso.</p>'+
      '<div class="choice-grid">'+units.map(u=>{
        const owned=rioPropertyTitle(u.id)?.owned;
        return '<button class="choice" data-rio-apartment="'+u.number+'"><b>Apartamento '+u.number+
          '</b><span>'+ (owned?'Sua propriedade':Math.round(site.price*(.80+u.floor*.10))+' moedas')+
          ' · '+u.floor+'º andar</span></button>';
      }).join('')+'</div>',root=>{
      for(const button of root.querySelectorAll('[data-rio-apartment]'))button.onclick=()=>{
        const unit=units.find(u=>u.number===button.dataset.rioApartment);
        if(!unit||!available())return;
        room.selectedUnitId=unit.id;room.refreshDecor?.();
        rioPropertyDoor({id:unit.id,name:site.name+' · Apartamento '+unit.number,
          price:Math.round(site.price*(.80+unit.floor*.10)),available,
          decorate:()=>enterUnit(()=>room.manageFurniture?.()),enter:enterUnit});
      };
    });
    return true;
  }

  function rioFurnitureCatalog(site){
    const {w,d}=site;
    return [
      {id:'tapete',name:'Tapete decorativo',price:35,type:'rug',color:0x73928c,x:-w*.06,z:-.68,w:1.56,d:1.24},
      {id:'luminaria',name:'Luminária de piso',price:65,type:'lamp',color:0xd9bb8e,x:w*.36,z:-d*.27,w:.35,d:.35},
      {id:'quadro',name:'Quadro moderno',price:48,type:'picture',color:0xb17c64,x:w*.25,z:-d*.38,w:1.45,d:.16},
      {id:'aparador',name:'Aparador de madeira',price:75,type:'cabinet',color:0x865b45,x:-w*.35,z:-d*.1,w:1.18,d:.40},
      {id:'estante',name:'Estante de livros',price:110,type:'bookshelf',color:0xbda27c,x:-w*.43,z:-d*.26,w:.52,d:1.35},
      {id:'planta',name:'Vaso decorativo',price:25,type:'plant',color:0x658c5f,x:w*.37,z:-d*.36,w:.44,d:.44},
      {id:'sofa-modular',name:'Sofá modular',price:180,type:'sofa',color:0x758d8c,x:-w*.1,z:-d*.1,w:2.3,d:1.04},
      {id:'poltrona',name:'Poltrona estofada',price:85,type:'armchair',color:0xb67b65,x:w*.2,z:-d*.15,w:.94,d:.91},
      {id:'mesa-jantar',name:'Mesa de jantar',price:155,type:'table',color:0x9d7952,x:-w*.08,z:d*.04,w:1.75,d:1.16},
      {id:'cadeira-madeira',name:'Cadeira para sala',price:45,type:'chair',color:0x9b7152,x:w*.12,z:d*.05,w:.58,d:.59},
      {id:'cama-casal',name:'Cama de casal',price:210,type:'bed',color:0x8d7a6c,x:-w*.12,z:-d*.22,w:2.1,d:2.03},
      {id:'guarda-roupa',name:'Guarda-roupa de casal',price:190,type:'wardrobe',color:0xac9477,x:-w*.34,z:-d*.24,w:1.7,d:.66},
      {id:'mesa-escritorio',name:'Mesa de escritório',price:110,type:'desk',color:0x97745b,x:w*.17,z:-d*.22,w:1.45,d:.68},
      {id:'computador',name:'Computador',price:220,type:'computer',color:0x3e5867,x:w*.22,z:-d*.30,w:.68,d:.40},
      {id:'tv-premium',name:'Televisão grande',price:260,type:'tv',color:0x324b5a,x:w*.21,z:-d*.39,w:1.7,d:.15},
      {id:'geladeira',name:'Geladeira inox',price:155,type:'fridge',color:0xc2cbd0,x:-w*.34,z:d*.12,w:.75,d:.72},
      {id:'bancada',name:'Bancada de cozinha',price:135,type:'counter',color:0xc4b3a0,x:-w*.28,z:d*.23,w:1.68,d:.66},
      {id:'churrasqueira',name:'Churrasqueira compacta',price:145,type:'grill',color:0x6b7276,x:w*.32,z:d*.31,w:1.06,d:.76},
      {id:'espreguicadeira',name:'Espreguiçadeira da piscina',price:90,type:'lounger',color:0xe2cfa5,x:w*.16,z:d*.24,w:.64,d:1.42},
      {id:'vaso-flores',name:'Flores para decoração',price:30,type:'flowers',color:0xd88b90,x:w*.32,z:-d*.22,w:.35,d:.35}
    ];
  }

  function rioBuildResidence(site,room){
    const selected=rioMapSave().selectedApartmentBySite?.[site.id];
    if(site.style==='rios-ditalia'&&(selected===site.propertyId||(typeof selected==='string'&&selected.startsWith(site.propertyId+'-unit-')&&/^[1-5]0[1-4]$/.test(selected.slice(-3)))))room.selectedUnitId=selected;
    const rioResidencePropertyId=()=>room.selectedUnitId||site.propertyId;
    const {w,d,yaw}=site,condominium=site.style==='rios-ditalia',modern=site.style==='damha'||condominium,back=-d/2+1.04,front=d/2-.12;
    const compactHome=d<7.2,linen=modern?0x709490:site.style==='snow-cabin'?0xb17c53:0xb8946f;
    const cabinet=modern?0xc8c9c1:site.style==='snow-cabin'?0x8b6447:0xa17e5e;
    const kitchenX=compactHome?-w*.17:-w*.32,kitchenZ=compactHome?Math.min(1.35,d*.27):d*.27;
    const wardrobeX=compactHome?-w*.43:-w*.37,wardrobeZ=compactHome?1.02:.8;
    const bathZ=Math.min(1.85,d/2-.88);
    room.collider(0,front,Math.min(3.1,w*.4)-.13,.18,2.5);
    room.gate=room.colliders.at(-1);
    const doorPoint=room.point(0,front);
    room.door=new THREE.Mesh(new THREE.BoxGeometry(Math.min(3.1,w*.4)-.15,2.5,.17),renderMat(modern?0x4a5a5a:0x8d593c));
    room.door.position.set(doorPoint.x,room.floorY+1.25,doorPoint.z);room.door.rotation.y=yaw;room.root.add(room.door);
    const bx=-w*.29;
    room.object(bx,.30,back+.24,1.48,.56,2.03,0x8a6b50);
    room.box(bx,.62,back+.13,1.37,.12,1.90,modern?0x7b979c:0xd3b88e);
    room.box(bx,.73,back-.45,1.20,.14,.48,0xf4e2c8);
    room.box(bx,.91,back-.69,1.53,.76,.14,cabinet);
    room.box(bx,.755,back+.41,1.38,.09,1.11,linen);
    for(const side of[-1,1])room.box(bx+side*.32,.82,back-.40,.52,.14,.36,0xf4e2c8);
    room.object(wardrobeX,.92,wardrobeZ,.49,1.84,1.26,cabinet);
    for(const side of[-1,1]){
      room.box(wardrobeX+.256,1.03,wardrobeZ+side*.31,.035,1.66,.60,modern?0xdfe0d5:0xb09272);
      room.box(wardrobeX+.292,1.05,wardrobeZ+side*.085,.055,.27,.055,0x65716f);
    }
    const sx=w*.29;
    room.bench(sx,back-.15);
    room.box(sx,1.32,-.42,1.15,.62,.12,0x29424d);
    room.object(sx,.49,-.45,1.60,.98,.48,0x706459);
    room.box(sx,1.32,-.35,1.04,.52,.065,0x63818b);
    room.box(sx,.16,-.18,1.35,.055,.10,0x8a8070);
    for(const side of[-1,1]){
      room.box(sx+side*.50,.55,back-.08,.91,.15,.47,linen);
      room.box(sx+side*.91,.68,back-.08,.17,.44,.57,linen);
    }
    const rugWidth=Math.min(2.65,w*.27),rugDepth=Math.min(2.10,d*.30);
    room.box(0,.059,.05,rugWidth,.022,rugDepth,modern?0x708c8e:0xa87659);
    for(const side of[-1,1])room.box(side*(rugWidth/2-.09),.076,.05,.09,.012,rugDepth-.10,0xdfcfb4);
    if(w>=10&&d>=8){
      // Low open partition distinguishes the bedroom without obstructing
      // the central entry, the wardrobe or the existing bed approach.
      room.object(0,.69,-d*.35,.15,1.38,d*.18,cabinet);
      room.box(0,1.44,-d*.35,.22,.12,d*.19,0xe7ddc8);
      room.box(0,1.51,-d*.35,.17,.04,d*.15,0xb9a18a);
    }
    const wallZ=-d/2+.48,wallBox=room.wallDraw?.back?.box||room.box;
    for(const side of[-1,1]){
      const wx=side*w*.28;
      wallBox(wx,2.15,wallZ,Math.min(1.6,w*.20),.89,.075,cabinet);
      wallBox(wx,2.15,wallZ+.05,Math.min(1.44,w*.18),.73,.06,0x8aa6ad);
      wallBox(wx,2.15,wallZ+.09,.055,.73,.06,0xe8dfca);
      wallBox(wx,2.15,wallZ+.09,Math.min(1.44,w*.18),.055,.06,0xe8dfca);
    }
    if(modern){
      room.box(w*.31,.045,d/2+.71,w*.34,.074,1.53,0xb2afa4);
      room.box(w*.34,2.71,d/2+.52,w*.36,.21,1.06,0x657374);
    }else for(const x of [-w*.38,w*.38]){
      room.box(x,.23,d/2+.65,.91,.45,.72,0x99674d);
      room.part('canopy',x,.61,d/2+.65,.63,.58,.58,0x617e50);
    }


    if(modern){
      // Outdoor leisure: independent from the apartment's furnished interior.
      // The original pool erroneously lived in room.root and appeared beside
      // the indoor bed. A condominium has one common pool for its residents,
      // while a private house retains its own exterior pool.
      const exterior=new THREE.Group();
      exterior.name='RIO_OUTDOOR_POOL_'+site.key;
      (room.root.parent||worldGroup).add(exterior);
      const batch=rioCreateBatch(exterior);
      batch.root=exterior;
      const outdoor=rioLocal(batch,site);
      const compactPool=typeof rioCompactWorld==='function'&&rioCompactWorld()?rioCompactPoolPlan(site):null;
      const px=compactPool?.x??w*.245,pz=compactPool?.z??d*.405;
      const pw=Math.min(3.8,w*.23),pd=Math.min(2.8,d*.19);
      if(compactPool){
        outdoor.box(px,.045,pz,pw+1.30,.075,pd+1.50,0xbec5aa);
        // Both sides of the house remain passable; pool is behind the shell.
        for(const side of[-1,1])outdoor.box(px+side*(pw/2+.47),.09,pz,.54,.13,pd+1.05,0xd6cbb3);
      }
      outdoor.box(px,.065,pz,pw+.40,.13,pd+.40,0xe1d9ca);
      outdoor.box(px,.075,pz,pw,.04,pd,0x2787b3);
      outdoor.box(px,.13,pz-pd*.47,pw,.045,.11,0xa8dee1);
      for(const side of[-1,1]){
        outdoor.box(px+side*(pw/2+.16),.33,pz-pd*.30,.07,.63,.07,0xc6cbc8);
      }
      // Shared amenities: trees, pool furniture and boundary fence remain
      // outside the apartments and require no expensive reflections.
      if(condominium){
        for(const side of[-1,1]){
          outdoor.box(px+side*(pw/2+.68),.07,pz,.56,.12,1.38,0xe4d0a9);
          outdoor.box(px+side*(pw/2+.68),.37,pz-pd*.28,.56,.52,.28,0xf1e2bc);
        }
        outdoor.box(px,.48,pz+pd/2+.32,pw+.95,.12,.10,0xe2d9c9);
      }
      batch.commit();
      room.poolExterior=exterior;
      const approach=compactPool?outdoor.point(px,pz+pd/2+.80):outdoor.point(px-pw*.45,pz-pd*.46);
      const water=outdoor.point(px,pz);
      // A pool shares the address of its house, but not the interior.
      // The former indoor-flag check made the exterior pool impossible to use.
      room.isOutdoorLeisurePoint=(x,z)=>(!compactPool||!room.forSite(x,z,-.05))&&Math.hypot(x-water.x,z-water.z)<Math.max(pw,pd)*.62+1.55;
      room.poolPlan={...water,w:pw,d:pd,approach};
      registerInteractable({
        id:site.id+'-outdoor-pool',type:'activity',icon:'🏊',
        label:condominium?'Usar piscina da área comum do condomínio':'Nadar na piscina da casa',
        x:approach.x,z:approach.z,radius:2.7,priority:252,
        available:()=>exterior.visible&&room.isOutdoorLeisurePoint(player.x,player.z)&&!player.vehicle&&!player.boating&&
          !player.swimming&&!characterActivities.session,
        action:()=>beginCharacterActivity('rio-pool',{
          target:approach,pose:{...water,y:.37,yaw:site.yaw,lying:true},walkSpeed:1.8,
          commit:()=>{
            state.needs.fun=clamp(Number(state.needs.fun||0)+27,0,100);
            state.needs.hygiene=clamp(Number(state.needs.hygiene||0)+6,0,100);
            rioCountVisit(site);saveState(true);updateHUD();return true;
          }
        })
      });
    }

    if(condominium){
      // Apartment towers share the existing batched building renderer.
      // Only the furnished ground-floor unit is physically navigable at this stage.
      const colors=[0xd6cabe,0xcdc6b9,0xd8d6cb,0xc4d0cc,0xcac6bd,0xd8cfc5];
      const order=['rios_candelaro','rios_fiora','rios_salso','rios_fortore','rios_liri','rios_tanaro'];
      const tint=colors[Math.max(0,order.indexOf(site.key))];
      const towerRoot=new THREE.Group();towerRoot.name='RIO_CONDO_TOWER_'+site.key;room.roof.add(towerRoot);
      const towerBatch=rioCreateBatch(towerRoot),tower=rioLocal(towerBatch,{...site,floorBaseY:room.floorY});
      tower.box(0,10.5,-d*.1,w*.70,14.5,d*.64,tint);
      for(let floor=0;floor<5;floor++){
        const y=5.15+floor*2.65;
        tower.box(0,y-.95,d*.224,w*.72,.18,1.1,0xa8aba9);
        for(const dx of[-w*.24,-w*.08,w*.08,w*.24]){
          tower.box(dx,y,d*.224+.055,w*.105,1.1,.09,0x52727a);
          tower.box(dx,y-.64,d*.224+.09,w*.114,.12,.18,0x526467);
        }
        for(const side of[-1,1])tower.box(side*w*.354,y,-d*.15,.08,1.12,d*.27,0x66878a);
      }
      tower.box(0,17.92,-d*.1,w*.75,.25,d*.71,0x66767c);
      tower.box(0,3.35,d*.34,w*.41,.19,2.3,0x6f8284);
      towerBatch.commit();
      const point=room.point(0,d*.18);
      const porteiro=createNPC('porteiro-'+site.key,'Porteiro',point.x,point.z,0x456779,0);
      porteiro.stationary=true;porteiro.cityLifeManaged=true;porteiro.rioFloorY=room.floorY;porteiro.group.position.y=room.floorY;room.root.add(porteiro.group);
      world.interactables=world.interactables.filter(action=>action.id!=='npc-'+porteiro.id);
      room.npcs=[porteiro];
      const openCondoConcierge=()=>{
        const id=rioResidencePropertyId(),owned=rioPropertyTitle(id);
        const service=owned?.condoService;
        const ready=service?.status==='scheduled'&&Date.now()>=service.readyAt;
        const status=service?.status==='scheduled'?(ready?'Serviço pronto para receber':'Equipe em deslocamento'):
          service?.status==='completed'?'Último serviço concluído':'Nenhuma solicitação aberta';
        openModal('Portaria · '+site.name,
          '<p>Atendimento do condomínio · apartamento '+(id.includes('-unit-')?id.split('-unit-').at(-1):'101')+'.</p>'+
          '<p><b>'+status+'</b>. '+(owned?.owned?'Seu imóvel está cadastrado. Limpeza: '+Math.round(Number(owned.cleanliness??85))+'%.':'Para solicitar serviços, adquira a unidade primeiro.')+'</p>'+
          '<div class="choice-grid">'+
          '<button class="choice" data-concierge-wardrobe><b>Guarda-roupa</b><span>Trocar roupas</span></button>'+
          '<button class="choice" data-concierge-deliveries><b>Encomendas</b><span>Consultar e retirar materiais recebidos</span></button>'+
          (owned?.owned?'<button class="choice" data-concierge-maintenance>'+
            '<b>'+(ready?'Receber serviço':service?.status==='scheduled'?'Serviço agendado':'Solicitar limpeza')+'</b>'+
            '<span>'+(service?.status==='scheduled'?'Pedido registrado':'45 moedas · equipe do condomínio')+'</span></button>':'')+
          '</div>',root=>{
            root.querySelector('[data-concierge-wardrobe]').onclick=openRioWardrobe;
            root.querySelector('[data-concierge-deliveries]').onclick=()=>rioConstructionDeliveryReport();
            const button=root.querySelector('[data-concierge-maintenance]');
            if(button)button.onclick=()=>{
              const current=rioPropertyTitle(id),pending=current?.condoService;
              if(!current?.owned){toast('Só o proprietário pode solicitar serviços.','warn',1900);return;}
              if(pending?.status==='scheduled'){
                if(Date.now()<pending.readyAt){
                  toast('O atendimento está em deslocamento para seu apartamento.','info',2200);
                  return;
                }
                current.cleanliness=100;
                pending.status='completed';pending.completedAt=Date.now();
                saveState(true);toast('Limpeza concluída! Seu apartamento foi atendido.','good',2400);
                openCondoConcierge();return;
              }
              if(Number(state.profile.coins)<45){toast('Saldo insuficiente para solicitar limpeza.','warn',1900);return;}
              button.disabled=true;addCoins(-45);
              const serial=Number(current.condoService?.serial||0)+1;
              current.condoService={serial,type:'cleaning',cost:45,status:'scheduled',
                requestedAt:Date.now(),readyAt:Date.now()+45000};
              saveState(true);
              toast('Limpeza agendada no seu apartamento. Atendimento registrado na portaria.','good',2500);
              openCondoConcierge();
            };
          });
      };
      room.action('portaria','Conversar com o porteiro',0,d*.18,openCondoConcierge,
        {inside:true,icon:'🏢',radius:2.1});
    }
    room.action('rest','Descansar na sala',sx,back+.65,()=>rioSitOnBench(site,room,sx,back-.15),{inside:true,icon:'🛋️'});
    const bedApproach=room.point(bx,back+1.78),bed=room.point(bx,back+.24);
    room.action('bed','Dormir na cama',bx,back+1.78,()=>beginCharacterActivity('bed',{
      target:bedApproach,pose:{...bed,y:room.floorY+.72,yaw,lying:true},commit:()=>{
        state.needs.energy=100;setFlag('slept');rioCountVisit(site);return true;
      }
    }),{inside:true,icon:'🛏️'});
    room.action('wardrobe','Usar o guarda-roupa',wardrobeX+.92,wardrobeZ,openRioWardrobe,{inside:true,icon:'👕'});

    // Native inventory/needs/save; each action works on the existing profile.
    // A usable kitchen: cabinet fronts, stone worktop, sink, tap and stove.
    const kitchenW=compactHome?1.18:1.72;
    room.object(kitchenX,.44,kitchenZ,kitchenW,.88,.68,cabinet);
    room.box(kitchenX,.92,kitchenZ,kitchenW+.10,.08,.78,0xd5cbb6);
    room.box(kitchenX-kitchenW*.25,.975,kitchenZ,.46,.025,.47,0x7e9194);
    room.box(kitchenX-kitchenW*.25,1.09,kitchenZ-.19,.07,.23,.07,0xaab7b5);
    room.box(kitchenX-kitchenW*.25,1.20,kitchenZ-.12,.07,.05,.20,0xaab7b5);
    room.box(kitchenX+kitchenW*.24,.973,kitchenZ,.53,.025,.47,0x303d43);
    for(const dx of[-.12,.12])for(const dz of[-.11,.11])room.part('post',kitchenX+kitchenW*.24+dx,1.00,kitchenZ+dz,.16,.035,.16,0x677171);
    for(const side of[-1,1]){
      room.box(kitchenX+side*kitchenW*.25,.46,kitchenZ+.35,kitchenW*.46,.75,.035,modern?0xe1ddd2:0xb39470);
      room.box(kitchenX+side*kitchenW*.25,.70,kitchenZ+.39,.18,.045,.055,0x626e70);
    }
    const cookX=compactHome?kitchenX:kitchenX+kitchenW*.12;
    const cookZ=kitchenZ-1.02;
    room.action('kitchen',condominium?'Cozinhar no apartamento':'Cozinhar na residência',cookX,cookZ,()=>{
      if(Number(state.inventory.food||0)<1){toast('Compre alimentos no Mercadão para cozinhar.','info',2300);return false;}
      const approach=room.point(cookX,cookZ),stove=room.point(kitchenX,kitchenZ);
      return beginCharacterActivity('cook',{target:approach,pose:{...approach,y:room.floorY,yaw:Math.atan2(stove.x-approach.x,stove.z-approach.z)},commit:()=>{
        if(!room.root.visible||!rioPlayerAt(approach,.26)||Number(state.inventory.food||0)<1)return false;
        state.inventory.food--;state.needs.hunger=clamp(Number(state.needs.hunger||0)+30,0,100);
        if(condominium){const home=rioPropertyTitle(rioResidencePropertyId());if(home?.owned)home.cleanliness=clamp(Number(home.cleanliness??85)-7,0,100);}
        setFlag('ateMeal');state.stats.cooked=(state.stats.cooked||0)+1;trackDaily('cook',1);
        rioCountVisit(site);saveState(true);updateHUD();toast('Refeição preparada. Fome recuperada.','good',2000);return true;
      }});
    },{inside:true,icon:'🍳'});
    // A separate sanitary zone, with an open shower entry and real fixtures.
    const bathX=w*.39;
    room.box(bathX,.069,bathZ,.78,.04,1.28,0x8daaa7);
    room.box(bathX+.31,1.06,bathZ,.055,2.05,1.25,0xb7cfcc);
    room.box(bathX,1.06,bathZ-.58,.67,2.05,.055,0xc4d4cf);
    room.box(bathX+.27,1.76,bathZ-.29,.075,.37,.075,0x7f9394);
    room.box(bathX+.14,1.94,bathZ-.29,.32,.075,.22,0xb5c2c0);
    if(!compactHome){
      room.box(bathX-.10,.47,bathZ+1.10,.50,.78,.46,0xdeddd4);
      room.part('post',bathX-.10,.89,bathZ+1.10,.51,.16,.46,0xe9e8df);
    }
    room.action('bathroom','Tomar banho',w*.20,bathZ,()=>{
      const approach=room.point(w*.20,bathZ),shower=room.point(bathX,bathZ);
      return beginCharacterActivity('shower',{target:approach,pose:{...shower,y:room.floorY+.09,yaw},commit:()=>{
        if(!room.root.visible||!rioPlayerAt(approach,.26))return false;
        state.needs.hygiene=clamp(Number(state.needs.hygiene||0)+42,0,100);
        rioCountVisit(site);saveState(true);updateHUD();toast('Banho concluído. Higiene recuperada.','good',2000);return true;
      }});
    },{inside:true,icon:'🚿'});
    room.action('tv','Assistir televisão',sx,back+.75,()=>{
      const approach=room.point(sx,back+.75),seat=room.point(sx,back-.15);
      return beginCharacterActivity('tv',{target:approach,pose:{...seat,y:room.floorY+.535,yaw,sitting:true},commit:()=>{
        if(!room.root.visible||!rioPlayerAt(approach,.26))return false;
        state.needs.fun=clamp(Number(state.needs.fun||0)+18,0,100);
        rioCountVisit(site);saveState(true);updateHUD();toast('Você descansou assistindo à TV.','good',2000);return true;
      }});
    },{inside:true,icon:'📺'});


    // OT Home Life: ownership, owned item library, positions, rotation and storage
    // are part of the existing unit or residence property record.
    // Keep the original six IDs and saved furniture arrays compatible.
    const furnishings=rioFurnitureCatalog(site);
    const byId=new Map(furnishings.map(item=>[item.id,item])),decorMeshes=new Map();
    const addDecorModel=item=>{
      const group=new THREE.Group();
      group.name='CASA_MOVEIS_'+site.key+'_'+item.id;
      const part=(ww,hh,dd,color,xx=0,yy=0,zz=0)=>{
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(ww,hh,dd),renderMat(color,{roughness:.78}));
        mesh.position.set(xx,yy,zz);mesh.castShadow=false;group.add(mesh);return mesh;
      };
      const W=item.w,D=item.d,C=item.color;
      if(item.type==='rug')part(W,.04,D,C,0,.08,0);
      else if(item.type==='lamp'){
        part(.13,1.55,.13,0x7e8580,0,.83,0);part(.62,.36,.62,C,0,1.64,0);part(.48,.08,.48,0x6f746d,0,.07,0);
      }else if(item.type==='picture'){
        part(W,.92,.06,0xb49a75,0,1.88,0);part(W-.17,.75,.075,C,0,1.88,.035);
      }else if(item.type==='cabinet'||item.type==='counter'){
        part(W,item.type==='counter'?.89:1.12,D,C,0,item.type==='counter'?.47:.59,0);
        part(W+.07,.08,D+.07,0xd4cbb8,0,item.type==='counter'?.95:1.16,0);
        for(const x of[-W*.22,W*.22])part(.085,.09,.05,0x404b50,x,.62,D/2+.03);
      }else if(item.type==='bookshelf'||item.type==='wardrobe'){
        part(W,2.18,D,C,0,1.10,0);
        for(const y of [.5,1.06,1.62])part(W-.14,.055,D+.08,0xe8cba1,0,y,0);
        if(item.type==='bookshelf')for(let i=0;i<12;i++){
          const x=-W*.39+(i%4)*W*.26,y=.69+Math.floor(i/4)*.57;
          part(.10,.25+.06*(i%3),.12,[0x587c86,0xb16e54,0x6a855d][i%3],x,y,D/2+.06);
        }
      }else if(['sofa','armchair','chair'].includes(item.type)){
        const seatY=item.type==='chair'?.48:.43;
        part(W,.30,D,C,0,seatY,0);part(W,.73,.22,C,0,seatY+.48,-D*.40);
        for(const side of[-1,1])if(item.type!=='chair')part(.18,.45,D,C,side*(W/2-.09),seatY+.18,0);
        for(const x of[-W*.32,W*.32])part(.09,.35,.10,0x554c43,x,.2,-D*.25);
      }else if(['table','desk'].includes(item.type)){
        part(W,.12,D,C,0,.83,0);
        for(const x of[-W*.4,W*.4])for(const z of[-D*.35,D*.35])part(.10,.79,.10,0x705a4a,x,.42,z);
      }else if(item.type==='bed'||item.type==='lounger'){
        const baseY=item.type==='bed'?.45:.30;
        part(W,.35,D,C,0,baseY,0);
        part(W-.14,.16,D-.14,item.type==='bed'?0xe8dfcf:0xc5d9ce,0,baseY+.25,0);
        part(W,.74,.18,0x8c6954,0,baseY+.25,-D/2+.08);
        if(item.type==='bed')for(const x of[-W*.23,W*.23])part(W*.4,.16,D*.18,0xffffff,x,baseY+.43,-D*.28);
      }else if(item.type==='tv'||item.type==='computer'){
        part(W,item.type==='computer'?.64:.95,.08,0x26363c,0,item.type==='computer'?1.19:1.75,0);
        part(W-.13,item.type==='computer'?.50:.80,.03,C,0,item.type==='computer'?1.19:1.75,.045);
        part(.11,.55,.09,0x56656a,0,item.type==='computer'?.72:1.22,0);
      }else if(item.type==='fridge'){
        part(W,1.92,D,C,0,.99,0);part(W,.06,.06,0x778b93,0,1.39,D/2+.025);
        part(.07,.32,.10,0x566773,-W*.34,1.22,D/2+.08);
      }else if(item.type==='grill'){
        part(W,.70,D,0x777a75,0,.56,0);part(W,.13,D,0x252c2b,0,.95,0);
        for(const x of[-W*.33,W*.33])part(.13,.68,.13,0x4e5555,x,.32,0);
      }else if(item.type==='plant'||item.type==='flowers'){
        part(.38,.49,.38,0xa78764,0,.25,0);
        part(.52,.59,.52,C,0,.76,0);
        if(item.type==='flowers')for(const x of[-.17,0,.17])part(.13,.16,.13,0xe5b0aa,x,1.05,.07);
      }else part(W,1,D,C,0,.55,0);
      room.root.add(group);decorMeshes.set(item.id,group);
      return group;
    };
    const layoutFor=(item,owner)=>{
      const p=owner?.decorLayout?.[item.id]||{};
      const limX=Math.max(.25,w/2-item.w/2-.53),limZ=Math.max(.25,d/2-item.d/2-1.10);
      return {
        x:clamp(Number.isFinite(p.x)?p.x:item.x,-limX,limX),
        z:clamp(Number.isFinite(p.z)?p.z:item.z,-limZ,limZ),
        rotation:Number.isInteger(p.rotation)?((p.rotation%4)+4)%4:0,
        stored:!!p.stored
      };
    };
    const updateDecor=()=>{
      const owner=rioPropertyTitle(rioResidencePropertyId());
      const owned=new Set(owner?.furniture||[]);
      for(const item of furnishings){
        const existing=decorMeshes.get(item.id);
        if(!owned.has(item.id)){if(existing)existing.visible=false;continue;}
        const pos=layoutFor(item,owner),group=existing||addDecorModel(item),point=room.point(pos.x,pos.z);
        group.visible=!pos.stored;group.position.set(point.x,room.floorY,point.z);
        group.rotation.y=yaw+pos.rotation*Math.PI/2;
      }
    };
    updateDecor();
    room.refreshDecor=()=>{endDecor();updateDecor();renovationFinish('walls');renovationFinish('floor');};
    const openDecorCatalog=()=>{
      const owner=rioPropertyTitle(rioResidencePropertyId());
      if(!owner?.owned){toast('Primeiro compre esta residência.','info',2300);return;}
      const owned=new Set(owner.furniture||[]),propertyId=rioResidencePropertyId();
      openModal('Minha casa · móveis e decoração',
        '<p>Compre móveis com moedas do jogo, escolha a posição, gire e guarde peças. Suas escolhas ficam salvas nesta residência.</p>'+
        '<p><b>'+owned.size+' de '+furnishings.length+' itens adquiridos</b></p><div class="choice-grid">'+
        furnishings.map(item=>'<button class="choice" data-rio-decor-item="'+item.id+'"><b>'+item.name+'</b><span>'+
          (owned.has(item.id)?'Editar posição e rotação':rioPropertyFurniturePending(propertyId,item.id)?'Aguardando entrega':item.price+' moedas')+'</span></button>').join('')+'</div>',root=>{
        for(const button of root.querySelectorAll('[data-rio-decor-item]'))button.onclick=()=>{
          const item=byId.get(button.dataset.rioDecorItem);
          if(!item)return;
          const current=rioPropertyTitle(rioResidencePropertyId());
          if(!current?.owned)return;
          if(!(current.furniture||[]).includes(item.id)){
            if(rioPropertyFurniturePending(rioResidencePropertyId(),item.id)){toast('Este móvel já está a caminho deste imóvel.','info',2300);return;}
            if(Number(state.profile.coins)<item.price){toast('Moedas insuficientes.','warn',1800);return;}
            button.disabled=true;(current.furniture??=[]).push(item.id);
            addCoins(-item.price);saveState(true);updateDecor();
          }
          openDecorEditor(item);
        };
      });
    };

    // Real-time furniture preview lives over the scene, never in a full-screen modal.
    let activeDecor=null,decorOverlay=null,decorSelection=null,decorPointerCleanup=null;
    const endDecor=()=>{
      decorPointerCleanup?.();decorPointerCleanup=null;
      activeDecor=null;
      if(decorOverlay){decorOverlay.remove();decorOverlay=null;}
      if(decorSelection){decorSelection.parent?.remove(decorSelection);decorSelection.geometry.dispose();decorSelection.material.dispose();decorSelection=null;}
      delete window.__OTTHI_DECOR_PREVIEW;
      document.body.classList.remove('rio-decor-active');
    };
    const openDecorEditor=item=>{
      const owner=rioPropertyTitle(rioResidencePropertyId());
      if(!owner?.owned||!(owner.furniture||[]).includes(item.id))return;
      endDecor();
      if(!els.modal.hidden)closeModal();
      const original=layoutFor(item,owner);
      activeDecor={item,original,position:{...original},propertyId:rioResidencePropertyId()};
      const bound=pos=>{
        const wx=Math.max(.25,w/2-item.w/2-.53),wz=Math.max(.25,d/2-item.d/2-1.10);
        return {x:clamp(pos.x,-wx,wx),z:clamp(pos.z,-wz,wz),rotation:((pos.rotation%4)+4)%4,stored:!!pos.stored};
      };
      decorSelection=new THREE.Mesh(new THREE.RingGeometry(.71,1.01,32),
        new THREE.MeshBasicMaterial({color:0xffdc62,side:THREE.DoubleSide,transparent:true,opacity:.94,depthTest:false}));
      decorSelection.rotation.x=-Math.PI/2;decorSelection.renderOrder=999;room.root.add(decorSelection);
      const overlapsAnotherPurchasedItem=()=>{
        if(!activeDecor||activeDecor.position.stored)return false;
        const current=rioPropertyTitle(activeDecor.propertyId);
        const decorative=new Set(['rug','picture','plant','flowers','lamp']);
        if(decorative.has(item.type))return false;
        const a=activeDecor.position,aW=a.rotation%2?item.d:item.w,
          aD=a.rotation%2?item.w:item.d;
        return furnishings.some(other=>{
          if(other.id===item.id||decorative.has(other.type)||!(current?.furniture||[]).includes(other.id))return false;
          const b=layoutFor(other,current);if(b.stored)return false;
          const bW=b.rotation%2?other.d:other.w,bD=b.rotation%2?other.w:other.d;
          return Math.abs(a.x-b.x)<(aW+bW)/2+.12&&Math.abs(a.z-b.z)<(aD+bD)/2+.12;
        });
      };
      const refresh=()=>{
        if(!activeDecor)return;
        if(activeDecor.propertyId!==rioResidencePropertyId()){endDecor();updateDecor();return;}
        activeDecor.position=bound(activeDecor.position);
        const p=activeDecor.position,worldPoint=room.point(p.x,p.z);
        const object=decorMeshes.get(item.id)||addDecorModel(item);
        object.visible=!p.stored;object.position.set(worldPoint.x,room.floorY,worldPoint.z);
        object.rotation.y=yaw+p.rotation*Math.PI/2;
        decorSelection.position.set(worldPoint.x,room.floorY+.12,worldPoint.z);
        decorSelection.visible=!p.stored;
        window.__OTTHI_DECOR_PREVIEW={siteId:site.id,propertyId:rioResidencePropertyId(),
          x:worldPoint.x,z:worldPoint.z,yaw,centerX:site.x,centerZ:site.z,roomWidth:w,roomDepth:d,floorY:room.floorY};
        const status=decorOverlay.querySelector('[data-rio-editor-status]');
        const occupied=overlapsAnotherPurchasedItem();
        decorSelection.material.color.setHex(occupied?0xff6767:0xffdc62);
        if(status)status.textContent='Posição '+p.x.toFixed(1)+' / '+p.z.toFixed(1)+
          ' · '+p.rotation*90+'°'+(p.stored?' · Guardado':occupied?' · Espaço ocupado':' · Livre');
      };
      if(!document.getElementById('rio-decor-live-css')){
        const style=document.createElement('style');style.id='rio-decor-live-css';
        style.textContent=[
          '#rio-decor-live{position:fixed;z-index:1250;top:max(8px,env(safe-area-inset-top,0px));right:max(8px,env(safe-area-inset-right,0px));width:min(267px,39vw);max-height:calc(100dvh - 20px);box-sizing:border-box;overflow:auto;border-radius:13px;border:1px solid #a2c4bd;background:rgba(5,25,32,.88);color:#fff;padding:10px;box-shadow:0 7px 25px rgba(0,0,0,.35);font:600 12px system-ui,sans-serif;touch-action:pan-y;pointer-events:auto}',
          '#rio-decor-live strong{display:block;overflow-wrap:anywhere;font-size:13px;margin-bottom:4px}',
          '#rio-decor-live p{font-size:11px;font-weight:400;margin:4px 0;color:#d3e9eb}',
          '#rio-decor-live .rio-editor-buttons{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}',
          '#rio-decor-live button{font:700 12px system-ui,sans-serif;min-height:38px;padding:4px;border:1px solid #73949c;border-radius:8px;color:#fff;background:#245062;cursor:pointer}',
          '#rio-decor-live button[data-rio-live=save]{background:#237451}',
          '#rio-decor-live button[data-rio-live=cancel]{background:#873e40}',
          '#rio-decor-live [data-rio-editor-status]{color:#c3ebed;font-size:11px;padding:5px 0}',
          '@media(max-width:650px){#rio-decor-live{width:min(202px,49vw);padding:6px;top:max(4px,env(safe-area-inset-top,0px));right:max(4px,env(safe-area-inset-right,0px))}#rio-decor-live strong{font-size:11px}#rio-decor-live p{display:none}#rio-decor-live button{font-size:11px;min-height:34px;padding:2px}}',
          '@media(orientation:landscape) and (max-height:480px){#rio-decor-live{width:min(265px,32vw);max-height:calc(100dvh - 8px);top:4px}#rio-decor-live .rio-editor-buttons{grid-template-columns:repeat(4,minmax(0,1fr))}#rio-decor-live button{min-height:31px}}'
        ].join('');
        document.head.appendChild(style);
      }
      decorOverlay=document.createElement('section');decorOverlay.id='rio-decor-live';
      decorOverlay.setAttribute('role','region');
      decorOverlay.setAttribute('aria-label','Decoração em tempo real com a casa visível');
      const title=document.createElement('strong');title.textContent='Decorar · '+item.name;
      const help=document.createElement('p');help.textContent='Arraste o móvel direto no piso ou use as setas. Gire e veja o resultado ao vivo.';
      const status=document.createElement('div');status.dataset.rioEditorStatus='';status.className='rio-editor-status';
      const controls=document.createElement('div');controls.className='rio-editor-buttons';
      for(const [id,label] of [['up','↑'],['rotate','↻ 90°'],['store','Guardar'],
        ['left','←'],['down','↓'],['right','→'],['save','✓ Salvar'],
        ['cancel','✕ Cancelar'],['catalog','Móveis']]){
        const button=document.createElement('button');button.type='button';button.dataset.rioLive=id;
        button.textContent=label;controls.appendChild(button);
      }
      decorOverlay.append(title,help,status,controls);document.body.appendChild(decorOverlay);
      document.body.classList.add('rio-decor-active');
      for(const type of ['pointerdown','pointerup','click','touchstart','touchend'])
        decorOverlay.addEventListener(type,e=>e.stopPropagation());
      controls.addEventListener('click',e=>{
        const type=e.target.closest('button')?.dataset.rioLive;
        if(!type||!activeDecor)return;
        if(type==='save'){
          if(overlapsAnotherPurchasedItem()){
            toast('Espaço ocupado por outro móvel. Mova até o marcador ficar amarelo.','warn',2600);return;
          }
          const current=rioPropertyTitle(rioResidencePropertyId());
          if(!current?.owned||activeDecor.propertyId!==rioResidencePropertyId()||
            (current.furniture||[]).indexOf(item.id)<0){endDecor();updateDecor();return;}
          (current.decorLayout??={})[item.id]={...activeDecor.position};
          endDecor();updateDecor();saveState(true);
          toast(item.name+' posicionado e salvo.','good',2100);return;
        }
        if(type==='cancel'){endDecor();updateDecor();return;}
        if(type==='catalog'){endDecor();updateDecor();openDecorCatalog();return;}
        const p=activeDecor.position;
        if(type==='left')p.x-=.55;
        if(type==='right')p.x+=.55;
        if(type==='up')p.z-=.55;
        if(type==='down')p.z+=.55;
        if(type==='rotate')p.rotation=(p.rotation+1)%4;
        if(type==='store')p.stored=!p.stored;
        refresh();
      });
      // Drag directly on the visible 3D floor. The pointer is captured only
      // while the editor exists; original walking/camera controls are restored
      // immediately on save, cancel or switching apartments.
      const canvas=renderer?.domElement;
      if(canvas){
        const ray=new THREE.Raycaster(),floor=new THREE.Plane(new THREE.Vector3(0,1,0),-.10);
        const impact=new THREE.Vector3();let movingPointer=null;
        const positionFromPointer=event=>{
          if(!activeDecor||!room.root.visible)return;
          const bounds=canvas.getBoundingClientRect();
          if(!bounds.width||!bounds.height)return;
          const nx=((event.clientX-bounds.left)/bounds.width)*2-1;
          const ny=1-((event.clientY-bounds.top)/bounds.height)*2;
          ray.setFromCamera(new THREE.Vector2(nx,ny),camera);
          if(!ray.ray.intersectPlane(floor,impact))return;
          const dx=impact.x-site.x,dz=impact.z-site.z;
          const cs=Math.cos(yaw),sn=Math.sin(yaw);
          activeDecor.position.x=cs*dx-sn*dz;
          activeDecor.position.z=sn*dx+cs*dz;
          activeDecor.position.stored=false;refresh();
        };
        const pointerDown=event=>{
          if(!activeDecor||event.target!==canvas)return;
          if(event.pointerType==='mouse'&&event.button!==0)return;
          movingPointer=event.pointerId;
          event.preventDefault();event.stopImmediatePropagation();
          canvas.setPointerCapture?.(event.pointerId);
          positionFromPointer(event);
        };
        const pointerMove=event=>{
          if(!activeDecor||movingPointer!==event.pointerId)return;
          event.preventDefault();event.stopImmediatePropagation();
          positionFromPointer(event);
        };
        const pointerUp=event=>{
          if(movingPointer!==event.pointerId)return;
          event.preventDefault();event.stopImmediatePropagation();
          movingPointer=null;
          if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);
        };
        const onKey=event=>{
          if(!activeDecor||event.target?.matches?.('input,textarea,select'))return;
          const commands={'ArrowLeft':'left','ArrowRight':'right',
            'ArrowUp':'up','ArrowDown':'down','q':'rotate','Q':'rotate'};
          if(event.key==='Escape'){
            event.preventDefault();endDecor();updateDecor();return;
          }
          const command=commands[event.key];if(!command)return;
          event.preventDefault();event.stopImmediatePropagation();
          const p=activeDecor.position;
          if(command==='left')p.x-=.40;
          if(command==='right')p.x+=.40;
          if(command==='up')p.z-=.40;
          if(command==='down')p.z+=.40;
          if(command==='rotate')p.rotation=(p.rotation+1)%4;
          refresh();
        };
        canvas.addEventListener('pointerdown',pointerDown,true);
        canvas.addEventListener('pointermove',pointerMove,true);
        canvas.addEventListener('pointerup',pointerUp,true);
        canvas.addEventListener('pointercancel',pointerUp,true);
        window.addEventListener('keydown',onKey,true);
        decorPointerCleanup=()=>{
          canvas.removeEventListener('pointerdown',pointerDown,true);
          canvas.removeEventListener('pointermove',pointerMove,true);
          canvas.removeEventListener('pointerup',pointerUp,true);
          canvas.removeEventListener('pointercancel',pointerUp,true);
          window.removeEventListener('keydown',onKey,true);
          movingPointer=null;
        };
      }
      refresh();
    };

    // Real use for construction purchases: one delivered paint can renovates the
    // wall finish; one box of flooring renovates the interior floor.
    // Upgrades are per-property, have no extra draw calls until purchased,
    // and are preserved in the same save as ownership and furniture.
    const renovationColors=Object.freeze({
      walls:[0xe9ddc9,0xb9d0ce,0xd9c8b4,0xd8d0df],
      floor:[0xc7a884,0xa0a7a5,0x8f795d,0xd7cfba]
    });
    const renovateMeshes={};
    const renovationFinish=(kind)=>{
      const owner=rioPropertyTitle(rioResidencePropertyId());
      const finish=owner?.renovation?.[kind];
      if(!Number.isInteger(finish)){if(renovateMeshes[kind])renovateMeshes[kind].visible=false;return;}
      const palette=renovationColors[kind];
      const value=palette[((finish%palette.length)+palette.length)%palette.length];
      if(!renovateMeshes[kind]){
        const group=new THREE.Group(),makePanel=(xx,yy,zz,ww,hh,dd)=>{
          const mesh=new THREE.Mesh(new THREE.BoxGeometry(ww,hh,dd),
            new THREE.MeshStandardMaterial({color:value,roughness:.83,metalness:0}));
          mesh.position.set(xx,yy,zz);group.add(mesh);
        };
        if(kind==='floor')makePanel(0,.091,0,w-.69,.024,d-.68);
        else{
          makePanel(0,1.45,-d/2+.36,w-.82,2.76,.045);
          for(const x of[-w/2+.35,w/2-.35])makePanel(x,1.45,0,.045,2.76,d-.82);
        }
        group.position.set(site.x,room.floorY,site.z);group.rotation.y=yaw;
        group.name='CASA_REFORMA_'+site.key+'_'+kind;
        room.root.add(group);renovateMeshes[kind]=group;
      }
      renovateMeshes[kind].visible=true;
      for(const mesh of renovateMeshes[kind].children)mesh.material.color.setHex(value);
    };
    renovationFinish('walls');renovationFinish('floor');
    const openRenovation=()=>{
      const owner=rioPropertyTitle(rioResidencePropertyId());
      if(!owner?.owned){toast('Só o proprietário pode reformar esta casa.','warn',2200);return;}
      const propertyId=rioResidencePropertyId();
      const inventory=rioConstructionAtAddress(propertyId);
      openModal('Reformar imóvel · '+site.name,
        '<p>Os novos materiais precisam ser recebidos neste endereço. Estoque antigo sem endereço continua disponível.</p>'+
        '<p>Estoque: <b>'+Number(inventory.paint||0)+' lata(s) de tinta</b> · <b>'+
        Number(inventory.tile||0)+' caixa(s) de piso</b></p>'+
        '<div class="choice-grid">'+
        renovationColors.walls.map((color,index)=>'<button class="choice" data-rio-home-wall="'+index+'"><b>Cor das paredes '+(index+1)+'</b><span>1 tinta</span></button>').join('')+
        renovationColors.floor.map((color,index)=>'<button class="choice" data-rio-home-floor="'+index+'"><b>Piso '+(index+1)+'</b><span>1 caixa de piso</span></button>').join('')+
        '</div>',root=>{
          const apply=(kind,index)=>{
            const current=rioPropertyTitle(propertyId),item=kind==='walls'?'paint':'tile';
            if(propertyId!==rioResidencePropertyId()||!Number.isInteger(index)||index<0||index>=renovationColors[kind].length||!current?.owned||!rioConsumeConstructionStock(propertyId,item)){toast('Receba primeiro o material de construção neste imóvel.','warn',2400);return;}
            (current.renovation??={})[kind]=index;
            renovationFinish(kind);saveState(true);
            toast('Reforma aplicada e salva nesta propriedade.','good',2000);
            openRenovation();
          };
          for(const button of root.querySelectorAll('[data-rio-home-wall]'))button.onclick=()=>{
            apply('walls',Number(button.dataset.rioHomeWall));};
          for(const button of root.querySelectorAll('[data-rio-home-floor]'))button.onclick=()=>{
            apply('floor',Number(button.dataset.rioHomeFloor));};
        });
    };
    room.manageRenovation=openRenovation;
    room.action('renovate','Reformar paredes e piso com materiais entregues',w*.04,d*.22,openRenovation,{inside:true,icon:'🧱'});
    room.manageFurniture=openDecorCatalog;
    room.action('decor','Comprar, posicionar e decorar a casa',0,.8,openDecorCatalog,{inside:true,icon:'🪑'});

    // Usable purchased furniture. Actions track moved items, so changing their
    // coordinates never leaves a phantom interaction at the old location.
    const furnitureAction={sofa:'sofa',armchair:'sofa',chair:'sofa',lounger:'sofa',
      bed:'bed',tv:'tv',computer:'tv',table:'eat',fridge:'eat',grill:'cook',
      desk:'sofa',bookshelf:'sofa'};
    for(const item of furnishings){
      const activity=furnitureAction[item.type];
      if(!activity)continue;
      const currentPlacement=()=>layoutFor(item,rioPropertyTitle(rioResidencePropertyId()));
      const position=()=>{const p=currentPlacement();return room.point(p.x,p.z);};
      registerInteractable({
        id:site.id+'-furniture-use-'+item.id,type:'activity',
        label:'Usar · '+item.name,icon:activity==='bed'?'🛏️':activity==='cook'?'🍳':
          activity==='eat'?'🍽️':activity==='tv'?'📺':'🛋️',
        radius:2.05,priority:246,getPos:position,
        available:()=>room.root.visible&&!player.vehicle&&!player.boating&&
          !player.swimming&&!characterActivities.session&&
          room.forSite(player.x,player.z,-.38)&&
          !!rioPropertyTitle(rioResidencePropertyId())?.furniture?.includes(item.id)&&
          !currentPlacement().stored,
        action:()=>{
          if((activity==='cook'||activity==='eat')&&Number(state.inventory.food||0)<1){
            toast('Você precisa comprar alimentos antes.','info',2000);return;
          }
          const p=currentPlacement(),center=room.point(p.x,p.z);
          const target=room.point(p.x,p.z+Math.min(item.d/2+.45,1.18));
          const sitting=['sofa','tv','eat'].includes(activity);
          beginCharacterActivity(activity,{target,pose:{...center,y:activity==='bed'?.74:.55,
            yaw:yaw+p.rotation*Math.PI/2,sitting,lying:activity==='bed'},
            commit:()=>{
              if((activity==='cook'||activity==='eat')&&Number(state.inventory.food||0)<1)return false;
              if(activity==='bed')state.needs.energy=100;
              if(activity==='sofa'){
                state.needs.energy=clamp(Number(state.needs.energy||0)+12,0,100);
                state.needs.fun=clamp(Number(state.needs.fun||0)+14,0,100);
              }
              if(activity==='tv')state.needs.fun=clamp(Number(state.needs.fun||0)+28,0,100);
              if(activity==='eat'||activity==='cook'){
                state.inventory.food--;
                state.needs.hunger=clamp(Number(state.needs.hunger||0)+(activity==='cook'?55:34),0,100);
              }
              rioCountVisit(site);saveState(true);updateHUD();return true;
            }});
        }
      });
    }
    room.action('home-entry','Ver propriedade',0,d*.24,()=>{
      const title=rioPropertyTitle(rioResidencePropertyId());
      toast(title?.owned?'Esta casa é sua.':'Residência disponível para compra na porta.','info',2100);
    },{inside:true,icon:'🔑'});
  }

  function rioBuildBakeryService(site,room,counterZ,x,z){
    const side=-site.w*.39;
    const points=[room.point(side,counterZ-.85),room.point(side,counterZ+1.04),room.point(side,z-.95),room.point(-x-.58,z-.95)];
    const npc=createNPC(site.key==='panificacao-zappas-centro'?'rio-bakery-server':'rio-bakery-server-'+site.key,'Garçonete',points[0].x,points[0].z,0xe6d6c6,0);
    npc.stationary=true;npc.cityLifeManaged=true;npc.group.name='RIO_BAKERY_SERVER';npc.rioFloorY=room.floorY;npc.group.position.y=room.floorY;room.root.add(npc.group);
    world.interactables=world.interactables.filter(action=>action.id!=='npc-'+npc.id);
    room.npcs=[npc];
    const tray=new THREE.Group();tray.position.set(0,1.16,.62);npc.group.add(tray);
    campaignBox(tray,campaignMaterial(0xac7950),0,0,0,.65,.06,.43);
    campaignCylinder(tray,campaignMaterial(0xf6e9c9),.04,.09,.01,.16,.056);
    campaignCylinder(tray,campaignMaterial(0xe9d9a8),-.19,.119,0,.08,.13);
    tray.visible=false;
    room.server={npc,points,tray,index:0,direction:1,serving:false};
  }

  function rioUpdatePlaceService(site,room,dt){
    if(room.door&&!room.door.visible&&!room.forSite(player.x,player.z,2.8)&&!characterActivities.session){
      room.door.visible=true;room.gate.disabled=false;
    }
    const server=room.server;
    const now=performance.now();
    for(const clerk of room.npcs||[]){
      if(!clerk.shopSlot)continue;
      const p=clerk.group.position,customer=rioMap.indoorRoom===room&&!player.vehicle&&distance2D(player,p)<3.5;
      const heading=customer?Math.atan2(player.x-p.x,player.z-p.z):site.yaw;
      clerk.group.rotation.y=lerpAngle(clerk.group.rotation.y,heading,Math.min(1,dt*5));
      poseResident(clerk,now<(clerk.servingUntil||0)?'serve':'work',now/1000);
    }
    if(!server?.serving)return;
    const {npc,points,tray}=server,target=points[server.index],p=npc.group.position,distance=distance2D(p,target);
    if(distance>.08){
      const step=Math.min(distance,dt*1.45),dx=target.x-p.x,dz=target.z-p.z;
      p.x+=dx/distance*step;p.z+=dz/distance*step;npc.group.rotation.y=Math.atan2(dx,dz);
      poseResident(npc,'walk',performance.now()/1000);return;
    }
    if(server.direction===1&&server.index===points.length-1){
      tray.visible=false;server.direction=-1;
      if(rioMap.order?.site===site.id){room.servedDish.visible=true;toast('Pedido servido na mesa 1.','good',2500);}
    }else if(server.direction===-1&&server.index===0){server.serving=false;server.direction=1;return;}
    server.index+=server.direction;
  }

  function rioWardrobeShop(site,room,counter,slot){
    if(!rioPlayerAt(counter))return false;
    const clerk=room.npcs?.find(npc=>npc.shopSlot===slot);
    if(clerk)clerk.servingUntil=performance.now()+2500;
    const choices=Object.entries(RIO_WARDROBE_CATALOG).filter(([kind])=>slot==='top'?kind!=='shoes':kind==='shoes').flatMap(([kind,items])=>items.map(item=>[...item,kind])).filter(([id])=>RIO_WARDROBE_STORE[id]);
    openModal(slot==='shoes'?'Loja de calçados':'Loja de roupas','<div class="choice-grid">'+choices.map(([id,label,color,category])=>
      '<button class="choice" data-rio-clothing-buy="'+id+'" '+(rioWardrobeHasItem(id)?'disabled':'')+'><b>'+RIO_WARDROBE_LABELS[category]+' · '+label+'</b><span>'+
      (rioWardrobeHasItem(id)?'No guarda-roupa':RIO_WARDROBE_STORE[id]+' moedas')+'</span></button>').join('')+
      '</div><div class="modal-actions"><button class="btn" data-rio-clothing-try>Provar em Thiago ou Thamis</button><button class="btn" data-rio-custom-avatar>Criar meu personagem</button></div>',root=>{
        for(const button of root.querySelectorAll('[data-rio-clothing-buy]'))button.onclick=()=>{
          const id=button.dataset.rioClothingBuy,price=RIO_WARDROBE_STORE[id];
          if(!price||button.disabled||rioWardrobeHasItem(id)||!room.root.visible||!rioPlayerAt(counter))return;
          if(state.profile.coins<price){toast('Moedas insuficientes.','warn',2100);return;}
          button.disabled=true;(rioMapSave().wardrobePurchases??={})[id]=true;
          addCoins(-price);rioCountVisit(site);rioWardrobeShop(site,room,counter,slot);
        };
        root.querySelector('[data-rio-clothing-try]').onclick=()=>openRioWardrobe();
        root.querySelector('[data-rio-custom-avatar]').onclick=openAvatarStudio;
      });
    return true;
  }

  function rioBuildFurnitureShowroom(site,room){
    const {w,d}=site;
    if(w<20||d<13)return;
    const x=-w*.36,z=-d*.35,sampleX=-w*.37,sampleZ=-d*.12;
    const counter=rioCounter(room,x,z,Math.min(2.8,w*.15),0x746957);
    const clerk=rioServiceClerk(site,room,'furniture','Consultor de móveis',x,z-.84,0x807769);
    room.sign('MÓVEIS E DECORAÇÃO',x,2.53,z-.40,Math.min(4.4,w*.20),.42,'#605a4a');
    // A model home display: seating, solid legs, cushions and a real table.
    // The fixtures are physically placed at the edge, outside the main aisle.
    room.box(sampleX,.026,sampleZ,Math.min(3.2,w*.15),.025,2.16,0xc2a78a);
    room.object(sampleX,.39,sampleZ-.37,2.05,.78,.77,0x789b94);
    room.box(sampleX,.85,sampleZ-.68,2.05,.50,.20,0x557b76);
    for(const side of[-1,1]){
      room.box(sampleX+side*.89,.68,sampleZ-.37,.20,.50,.77,0x557b76);
      room.box(sampleX+side*.39,.86,sampleZ-.40,.71,.16,.52,side<0?0xd6c1a2:0xb4c4b5);
    }
    room.box(sampleX,.43,sampleZ+.70,.98,.12,.47,0xa27b56);
    for(const dx of[-.39,.39])for(const dz of[-.16,.16])room.box(sampleX+dx,.22,sampleZ+.70+dz,.075,.40,.075,0x685143);
    room.part('post',sampleX-1.13,.72,sampleZ-.46,.12,1.39,.12,0x6a7f72);
    room.part('post',sampleX-1.13,1.45,sampleZ-.46,.45,.32,.45,0xd8c198);
    room.action('furniture-counter','Comprar móveis para minha propriedade',x,z+1.02,()=>{
      if(!rioPlayerAt(counter))return false;
      clerk.servingUntil=performance.now()+2500;
      return rioOpenFurnitureStore(site);
    },{inside:true,icon:'🛋️'});
  }

  function rioBuildFoodCourt(site,room){
    // The existing market remains a grocery store. The new food court has
    // a real dining counter and table, uses the same order/coins/needs
    // lifecycle as the restaurants, and never charges until consumption.
    const {w,d}=site;
    if(w<20||d<13)return;
    const x=w*.36,z=-d*.35,tableX=w*.37,tableZ=-d*.12;
    const counter=rioCounter(room,x,z,Math.min(2.8,w*.15),0x9b7256);
    rioServiceClerk(site,room,'dining','Atendente da praça de alimentação',x,z-.83,0x9d795a);
    room.sign('PRAÇA DE ALIMENTAÇÃO',x,2.53,z-.40,Math.min(4.4,w*.20),.42,'#76533d');
    room.box(x,.07,z+1.5,Math.min(4.1,w*.19),.022,1.22,0xd5b78d);
    room.seats=[rioTable(room,tableX,tableZ,{side:1,cloth:0xc7aa80})];
    const seat=room.seats[0],dish=new THREE.Mesh(new THREE.CylinderGeometry(.23,.22,.065,16),renderMat(0xffeaba));
    dish.position.set(seat.table.x,room.floorY+.917,seat.table.z);
    dish.visible=false;dish.name='RIO_ORDER_ON_TABLE';room.root.add(dish);room.servedDish=dish;
    room.action('food-court-counter','Pedir lanche na praça de alimentação',x,z+1.02,
      ()=>rioOpenDining(site,room,counter),{inside:true,icon:'🍔'});
    const guestSeat=rioDiningChair(room,tableX,tableZ,-1);
    const guestX=tableX-.9;
    rioPublicGuest(site,room,'foodcourt-guest','Cliente da praça de alimentação',guestX,tableZ,
      {seat:.51,yaw:guestSeat.yaw,action:'eat',color:0x8c687c});
    room.box(tableX,.926,tableZ-.30,.29,.06,.24,0xe5cba3);
    room.box(tableX-.30,.97,tableZ-.27,.12,.17,.12,0xc7a569);
    room.action('food-court-table','Sentar e consumir na praça de alimentação',tableX+.9,tableZ+1.02,
      ()=>rioEatAtTable(site,room,seat),{inside:true,icon:'🍽️',available:()=>rioMap.order?.site===site.id&&dish.visible});
  }

  // Scaled cinema attraction with an original in-game short film. It uses
  // the existing seat/animation/save system and never opens an external site.
  function rioCinemaFrame(cinema,elapsed=null){
    const {canvas,ctx,texture}=cinema,w=canvas.width,h=canvas.height;
    ctx.fillStyle='#172e43';ctx.fillRect(0,0,w,h);
    if(elapsed===null){
      ctx.fillStyle='#fff0d0';ctx.font='bold 28px sans-serif';ctx.textAlign='center';
      ctx.fillText('CINEMA OTTHI',w/2,58);ctx.font='18px sans-serif';ctx.fillText('Aventura na cidade',w/2,92);ctx.textAlign='left';
    }else{
      const t=Math.max(0,elapsed);
      ctx.fillStyle='#6eaec2';ctx.fillRect(0,0,w,h*.68);
      ctx.fillStyle='#f7da8b';ctx.beginPath();ctx.arc(w*.8-t*6,33,18,0,Math.PI*2);ctx.fill();
      for(let i=0;i<7;i++){const x=((i*88-t*26)%(w+88)+w+88)%(w+88)-88;ctx.fillStyle=i%2?'#668a6d':'#587962';ctx.fillRect(x,65+(i%3)*10,64,44);}
      ctx.fillStyle='#706b66';ctx.fillRect(0,107,w,h-107);
      ctx.fillStyle='#f0dc9b';for(let i=-1;i<8;i++){const x=((i*68-t*78)%(w+68)+w+68)%(w+68)-68;ctx.fillRect(x,135,36,4);}
      const carX=65+Math.sin(t*.9)*48,carY=108-Math.abs(Math.sin(t*4))*2;
      ctx.fillStyle='#b94e48';ctx.fillRect(carX,carY,75,21);ctx.fillRect(carX+15,carY-14,44,15);
      ctx.fillStyle='#c4e5e5';ctx.fillRect(carX+21,carY-11,31,11);
      ctx.fillStyle='#26333b';for(const dx of[15,60]){ctx.beginPath();ctx.arc(carX+dx,carY+21,8,0,Math.PI*2);ctx.fill();}
      if(t>=7){ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,w,h);ctx.fillStyle='#fff';ctx.font='bold 25px sans-serif';ctx.textAlign='center';ctx.fillText('FIM',w/2,h/2);ctx.textAlign='left';}
    }
    texture.needsUpdate=true;
  }
  function rioUpdateCinema(room,time){
    const cinema=room.cinema;
    if(!cinema?.session)return;
    if(characterActivities.session!==cinema.session){cinema.session=null;rioCinemaFrame(cinema);return;}
    if(cinema.session.phase!=='perform'||time-(cinema.lastFrame||0)<.10)return;
    cinema.lastFrame=time;rioCinemaFrame(cinema,cinema.session.elapsed);
  }
  function rioBuildShoppingCinema(site,room){
    if(site.w<24||site.d<16)return;
    // Use the front-side alcove, not the central entrance or store counters.
    const x=-site.w*.43,z=site.d*.36,screenZ=site.d*.45;
    room.bench(x,z);
    room.sign('CINEMA',x,2.76,screenZ,2.1,.34,'#463b56');
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=160;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;
    const screen=new THREE.Mesh(new THREE.PlaneGeometry(2.05,1.03),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
    const point=room.point(x,screenZ);screen.position.set(point.x,room.floorY+1.72,point.z);screen.rotation.y=site.yaw+Math.PI;
    room.root.add(screen);
    const cinema=room.cinema={canvas,ctx,texture,screen,session:null,lastFrame:0};rioCinemaFrame(cinema);
    const approach=room.point(x,z+.81),seat=room.point(x,z),price=15;
    room.action('cinema','Cinema · sessão de 15 moedas',x,z+.81,()=>{
      if(!rioPlayerAt(approach)||Number(state.profile.coins)<price){toast('Aproxime-se do cinema com 15 moedas.','info',2100);return false;}
      CHARACTER_ACTIVITIES['rio-cinema']=['Assistindo ao filme',8];
      let paid=false;
      const started=beginCharacterActivity('rio-cinema',{target:approach,pose:{...seat,y:room.floorY+.535,yaw:site.yaw,sitting:true},
        commit:()=>{
          if(paid||!cinema.session||characterActivities.session!==cinema.session||cinema.session.phase!=='perform'||cinema.session.elapsed+1e-6<8||!room.root.visible||!rioPlayerAt(approach,.30)||Number(state.profile.coins)<price)return false;
          paid=true;addCoins(-price);state.needs.fun=clamp(Number(state.needs.fun||0)+22,0,100);
          const visits=rioMapSave().cinemaVisits??={};visits[site.id]=(Number(visits[site.id])||0)+1;
          rioCountVisit(site);updateHUD();return true;
        }});
      if(started)cinema.session=characterActivities.session;
      return started;
    },{inside:true,icon:'🎬',radius:1.4});
  }
  function rioBuildShopping(site,room){
    const x=site.w*.28,z=site.d*.15,w=Math.min(5.5,site.w*.24);
    for(const [index,title,slot] of [[-1,'MODA', 'top'],[1,'CALÇADOS','shoes']]){
      const counter=rioCounter(room,index*x,z,w,index<0?0x76516a:0x4d677f);
      // The store is staffed by a real in-world NPC, not an illustration or
      // a shopping-only modal. Preserve the same native store economy.
      const clerkPoint=room.point(index*x,z-.54);
      const clerk=createNPC('rio-mall-staff-'+site.key+'-'+slot,
        slot==='top'?'Atendente de moda':'Atendente de calçados',
        clerkPoint.x,clerkPoint.z,slot==='top'?0x90648c:0x486f80,0);
      clerk.stationary=true;clerk.cityLifeManaged=true;
      clerk.shopSlot=slot;
      clerk.group.rotation.y=site.yaw;clerk.rioFloorY=room.floorY;clerk.group.position.y=room.floorY;
      room.root.add(clerk.group);
      room.npcs??=[];room.npcs.push(clerk);
      world.interactables=world.interactables.filter(action=>action.id!=='npc-'+clerk.id);
      room.sign(title,index*x,2.52,z-.38,w,.45,index<0?'#69445d':'#395569');
      // Distinct store frontage with a clear, walkable entrance; retain the original counter coordinates.
      const edge=Math.min(w*.52,site.w*.10),frontZ=z+1.85,accent=index<0?0x76516a:0x4d677f;
      for(const side of [-1,1]){
        room.box(index*x+side*edge,1.40,frontZ,.12,2.8,.16,accent);
        room.box(index*x+side*edge*.85,.82,frontZ,.34,1.64,.11,0x92b6bc);
      }
      room.box(index*x,2.81,frontZ,edge*2+.12,.17,.17,accent);
      room.box(index*x,.036,frontZ+.05,edge*1.5,.018,.72,index<0?0xb996a0:0x91a9b3);
      // Lighting rails, display cases and the visual boundary distinguish
      // a retail store from the public circulation space.
      room.box(index*x,2.71,z-2.3,w*.93,.075,.15,0xe7dccc);
      for(let n=-1;n<=1;n++){
        room.object(index*x+n*1.49,.68,z-2.3,1.27,1.35,.66,0xb2a496);
        room.box(index*x+n*1.49,.35,z-1.94,1.16,.12,.06,accent);
        room.box(index*x+n*1.49,1.36,z-2.3,1.34,.075,.73,0xe0d5c1);
        if(slot==='top'){
          room.box(index*x+n*1.49,1.63,z-2.3,.56,.60,.19,[0x557b78,0xb1879c,0x94724e][n+1]);
        }else for(const dx of [-.17,.17])room.box(index*x+n*1.49+dx,1.42,z-2.3,.25,.16,.43,0x394e67);
      }
      room.action('store-'+slot,slot==='top'?'Entrar na loja de roupas':'Entrar na sapataria',index*x,z+1.02,
        ()=>rioWardrobeShop(site,room,counter,slot),{inside:true,icon:slot==='top'?'👕':'👟'});
    }
    rioBuildMarket(site,room);
    rioBuildFoodCourt(site,room);
    rioBuildFurnitureShowroom(site,room);
    rioBuildShoppingCinema(site,room);
  }

  const RIO_PREVENTIVE_SERVICES=Object.freeze([
    {id:'oil',label:'Trocar óleo e filtro',price:12,duration:4200},
    {id:'engine',label:'Revisão do motor',price:12,duration:4600},
    {id:'tires',label:'Trocar conjunto de pneus',price:48,duration:6200},
    {id:'alignment',label:'Alinhamento e balanceamento',price:20,duration:4800},
    {id:'inspection',label:'Inspecionar motor, freios e suspensão',price:8,duration:2800}
  ]);
  function rioMaintenanceRecord(vehicle){
    const record=rioRoadVehicleSave(vehicle.id);
    const m=record.maintenance??={oil:100,tires:100,alignment:100,metres:0,history:[]};
    for(const key of ['oil','tires','alignment'])m[key]=clamp(Number.isFinite(m[key])?m[key]:100,0,100);
    m.metres=Number.isFinite(m.metres)?Math.max(0,m.metres):0;
    if(!Array.isArray(m.history))m.history=[];
    return m;
  }
  function rioMaintenanceWear(m,metres){
    if(!Number.isFinite(metres)||metres<=0||metres>40)return;
    m.metres+=metres;
    m.oil=Math.max(0,m.oil-metres*.005);
    m.tires=Math.max(0,m.tires-metres*.003);
    m.alignment=Math.max(0,m.alignment-metres*.0015);
  }
  function rioCompletePreventive(vehicle,service){
    if(Number(state.profile.coins)<service.price)return false;
    const m=rioMaintenanceRecord(vehicle),parts=workshopComponentRecord(vehicle);
    if(!parts)return false;
    if(service.id==='oil'){
      m.oil=100;
      // An oil change is preventive; it must not magically repair a broken engine.
    }else if(service.id==='engine'){
      if(parts.parts.engine>=100)return false;
      parts.parts.engine=Math.min(100,parts.parts.engine+18);
      const durability=Math.max(vehicleDurabilityV704(vehicle),workshopPartsOverall(parts.parts));
      setVehicleDurabilityV704(vehicle,durability,'revisao-motor');parts.lastDurability=durability;
    }else if(service.id==='tires')m.tires=100;
    else if(service.id==='alignment')m.alignment=100;
    else if(service.id!=='inspection')return false;
    addCoins(-service.price);
    m.history.push({service:service.id,price:service.price,metres:Math.round(m.metres),at:Date.now()});
    m.history=m.history.slice(-40);
    saveState(true);updateHUD();return true;
  }
  function rioBuildOilShop(site,room){
    const {w,d}=site,bay=room.point(0,-.55);
    room.box(0,.035,0,w,.07,d,0x636c6e);
    for(const side of [-1,1]){
      room.object(side*(w/2-.2),2.1,0,.35,4.2,d,0xc9c6b1);
      room.box(side*1.43,.08,.56,.1,.06,5.35,0xecc64d);
      room.object(side*w*.32,.54,-d*.29,1.5,1.08,.73,0x4e6773);
    }
    room.object(0,2.07,-d/2+.16,w,4.14,.32,0xa8b1a9);
    room.box(0,4.29,0,w+.18,.28,d,0x3d554f);
    room.sign('CACHOEIRA · SUPER TROCA DE ÓLEO',0,3.91,d/2+.1,w-.42,.45,'#315c4c');
    // Keep the service bay clear and put supplies and attendant to its side.
    for(let i=0;i<3;i++){
      room.part('post',w*.32,1.17+i*.24,-d*.29,.58,.20,.58,0x292e32,0,Math.PI/2);
      room.box(-w*.32-.35+i*.35,1.18,-d*.29,.22,.23,.21,0xcfaa55);
    }
    const mechanic=rioServiceClerk(site,room,'preventive','Mecânico',w*.32,0,0x58787b);
    room.action('oil','Manutenção · óleo, pneus e revisão',0,-.55,()=>{
      const vehicle=currentVehicleRef();
      const valid=()=>player.vehicle&&!player.car.passengerOf&&rioOwnedRoadVehicle(vehicle)&&currentVehicleRef()===vehicle&&Math.abs(player.car.speed)<.4&&distance2D(player,bay)<2.3&&room.root.visible;
      if(!valid()){toast('Pare seu carro dentro da baia demarcada.','info',2100);return false;}
      const m=rioMaintenanceRecord(vehicle),record=workshopComponentRecord(vehicle);
      openModal(site.name,'<p>Óleo '+Math.round(m.oil)+'% · Pneus '+Math.round(m.tires)+'% · Alinhamento '+Math.round(m.alignment)+'%</p>'+
        '<p>Motor '+Math.round(record.parts.engine)+'% · Freios '+Math.round(record.parts.brakes)+'% · Suspensão '+Math.round(record.parts.suspension)+'%</p>'+
        '<div class="choice-grid">'+RIO_PREVENTIVE_SERVICES.map(service=>'<button class="choice" data-rio-preventive="'+service.id+'"><b>'+service.label+'</b><span>'+service.price+' moedas</span></button>').join('')+'</div>'+
        '<p data-rio-service-status>Escolha um serviço. O pagamento é feito ao concluir.</p><progress data-rio-service-progress value="0" max="1" style="width:100%"></progress>'+
        '<button class="btn" data-rio-service-cancel>Cancelar / sair</button>',root=>{
          let busy=false,cancelled=false;
          const choices=[...root.querySelectorAll('[data-rio-preventive]')],status=root.querySelector('[data-rio-service-status]'),progress=root.querySelector('[data-rio-service-progress]');
          root.querySelector('[data-rio-service-cancel]').onclick=()=>{cancelled=true;closeModal();};
          for(const button of choices)button.onclick=()=>{
            const service=RIO_PREVENTIVE_SERVICES.find(x=>x.id===button.dataset.rioPreventive);
            if(!service||busy||cancelled||!valid())return;
            if(service.id==='engine'&&workshopComponentRecord(vehicle).parts.engine>=100){toast('O motor está revisado.','info',1800);return;}
            if(Number(state.profile.coins)<service.price){toast('Moedas insuficientes.','warn',2100);return;}
            busy=true;choices.forEach(x=>x.disabled=true);mechanic.servingUntil=performance.now()+service.duration;
            const start=performance.now();
            const tick=now=>{
              if(cancelled||!button.isConnected||els.modal.hidden)return;
              if(!valid()||Number(state.profile.coins)<service.price){busy=false;choices.forEach(x=>x.disabled=false);status.textContent='Serviço interrompido, sem cobrança.';return;}
              const ratio=clamp((now-start)/service.duration,0,1);progress.value=ratio;status.textContent=service.label+' · '+Math.floor(ratio*100)+'%';
              if(ratio<1){requestAnimationFrame(tick);return;}
              if(!rioCompletePreventive(vehicle,service)){busy=false;choices.forEach(x=>x.disabled=false);status.textContent='Serviço não realizado; nada cobrado.';return;}cancelled=true;
              rioCountVisit(site);closeModal();toast(service.label+' · concluído e salvo.','good',2400);
            };
            requestAnimationFrame(tick);
          };
        });
    },{vehicleOnly:true,icon:'🛠️',radius:2.3});
  }
