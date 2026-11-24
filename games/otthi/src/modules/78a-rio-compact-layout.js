/** Rio Preto lots and connections adapted to the original World coordinates. */
// @otthi-module-body
  const RIO_WEST_BRIDGE_ENTRY=[-123.5,69],RIO_EAST_BRIDGE_ENTRY=[-85.8,69];
  const RIO_COMPACT_LAYOUT={
    highways:[
      {id:'rio-compact-godoy',name:'Rua Antônio de Godoy',width:10,shoulder:1,closed:false,
        points:[{x:-105,z:0},{x:-140,z:0},{x:-170,z:0}]},
      {id:'rio-compact-murchid',name:'Avenida Murchid Homsi',width:12,shoulder:1.2,closed:false,
        points:[{x:205,z:-104},{x:205,z:-10},{x:205,z:56},{x:205,z:117}]},
      {id:'rio-condominios-link',name:'Acesso Rios D’Italia',width:9,shoulder:1,closed:false,
        points:[{x:205,z:117},{x:205,z:128},{x:300,z:128},{x:300,z:230}]}
    ],
    nodes:{
      RIO_GODOY:{x:-140,z:0},RIO_GODOY_W:{x:-170,z:0},
      RIO_MURCHID_S:{x:205,z:-104},RIO_MURCHID_M:{x:205,z:56},RIO_MURCHID_N:{x:205,z:117},RIO_MURCHID_CONDOMINIOS:{x:300,z:230}
    },
    edges:[['HW','RIO_GODOY'],['RIO_GODOY','RIO_GODOY_W'],['RIO_GODOY_W','OV18'],['RIO_GODOY_W','OV19'],
      ['RIO_MURCHID_S','A_LINK'],['A_LINK','RIO_MURCHID_M'],['RIO_MURCHID_M','RIO_MURCHID_N'],['RIO_MURCHID_N','RIO_MURCHID_CONDOMINIOS']],
    avenueNames:{
      'avenida-central-ew':'Avenida Bady Bassitt',
      'avenida-central-ns':'Avenida Alberto Andaló',
      'acesso-norte':'Avenida da Represa',
      'via-floresta-norte':'Rua XV de Novembro',
      'via-escola-leste':'Rua General Glicério'
    },
    // Width and depth describe each playable interior. Facing points to the street or promenade.
    lots:[
      ['mercado_municipal',-137,18,34,19,'n','Rua Antônio de Godoy'],
      ['catedral_sao_jose',-136,-19,25,19,'s','Rua Antônio de Godoy'],
      ['prefeitura_andalo',100,55,27,16,'n','Avenida Alberto Andaló'],
      ['calcadao_centro',-43,15,10,6,'n','Avenida Bady Bassitt'],
      ['mcdonalds_andalo',18,-87,12,10,'w','Avenida Alberto Andaló'],
      ['complexo_swift',-128,52,12,14,'e','Orla da Represa'],
      ['dona_capi',-99,36,3,3,'s','Orla da Represa'],
      ['canecao_represa',-78,33,17,9,'s','Orla da Represa'],
      ['posto_brasilia',185,-40,24,17,'e','Avenida Murchid Homsi'],
      ['estadio_anisio_haddad',-208,-81,32,22,'s','Acesso à Coleção'],
      ['riopreto_shopping',225,24,28,16,'w','Avenida Murchid Homsi'],
      ['plaza_avenida',185,28,24,16,'e','Avenida Murchid Homsi'],
      ['centro_eventos',225,80,28,17,'w','Avenida Murchid Homsi'],
      ['austa_hospital',185,81,25,16,'e','Avenida Murchid Homsi'],
      ['cemiterio_sao_joao_batista',-130,86,12,9,'n','Orla da Represa'],
      ['parque-da-represa',-91.5,34,6,4,'s','Orla da Represa'],
      ['panificacao-zappas-centro',-87,17,11,10,'n','Avenida Bady Bassitt'],
      ['terminal-urbano',225,-61,25,14,'w','Avenida Murchid Homsi'],
      ['upa-jaguare',185,54,13,12,'e','Avenida Murchid Homsi'],
      ['cachoeira_troca_oleo',185,-68,13,9,'e','Avenida Murchid Homsi'],
      ['casa-jardim',225,0,11,9,'w','Avenida Murchid Homsi'],
      ['casa-cotegipe',225,51,11,9,'w','Avenida Murchid Homsi'],
      ['casa-vila-ercilia',185,4.5,11,10,'e','Avenida Murchid Homsi'],
      ['casa-damha',225,107,15,11,'w','Avenida Murchid Homsi'],
      ['casa-damha-varanda',185,107,15,12,'e','Avenida Murchid Homsi'],
      // The six condominium lots extend the existing street grid; no existing lot is replaced.
      ['rios_candelaro',280,147,22,20,'e','Rios D’Italia · Av. Murchid Homsi'],
      ['rios_fiora',320,147,22,20,'w','Rios D’Italia · Av. Murchid Homsi'],
      ['rios_salso',280,181,22,20,'e','Rios D’Italia · Av. Murchid Homsi'],
      ['rios_fortore',320,181,22,20,'w','Rios D’Italia · Av. Murchid Homsi'],
      ['rios_liri',280,204,22,20,'e','Rios D’Italia · Av. Murchid Homsi'],
      ['rios_tanaro',320,215,22,20,'w','Rios D’Italia · Av. Murchid Homsi']
    ],
    sections:[[-65,40],[-116.8,40],[-118.7,43],[-118.7,62],[-120.1,64],[-123.5,65.8],RIO_WEST_BRIDGE_ENTRY,[-123.5,72],[-118.7,76.5],[-115.7,78.2],[-90.4,78.2],
      [-87.6,76.8],[-87.1,72.7],[-87.1,70.4],RIO_EAST_BRIDGE_ENTRY,[-63,68.7],[-61.4,65],[-61.4,42],[-63,40],[-65,40]]
  };
  // One datum for visible bridge deck, ramps and walking/vehicle physics.
  const RIO_COMPACT_BRIDGE=Object.freeze({x:-104,z:69,deckLength:26.4,rampLength:4.5,width:4.8,top:.815});
  function rioCompactBridgeSurface(x,z){
    const b=RIO_COMPACT_BRIDGE,dx=Math.abs(x-b.x);
    if(Math.abs(z-b.z)>b.width/2||dx>b.deckLength/2+b.rampLength)return 0;
    return b.top*Math.max(0,Math.min(1,(b.deckLength/2+b.rampLength-dx)/b.rampLength));
  }
  const RIO_COMPACT_LAKES=Object.freeze([
    {id:'lake',name:'Lago 1 · Represa',x:-88,z:54,w:50,d:22},
    {id:'lakeNorth',name:'Lago 3 · Ponte Estaiada',x:-104,z:71.25,w:24,d:9.5},
    {id:'lakeEast',name:'Lago 2 · Parque da Represa',x:-77,z:73.5,w:16,d:6}
  ]);
  const RIO_COMPACT_UPPER_PATH=Object.freeze([[-90.4,78.2],[-67,78.2],[-63,76.5],[-61.4,74],[-61.4,65]]);
  const westJunction=RIO_COMPACT_LAYOUT.sections.indexOf(RIO_WEST_BRIDGE_ENTRY);
  const eastJunction=RIO_COMPACT_LAYOUT.sections.indexOf(RIO_EAST_BRIDGE_ENTRY);
  // Closed route with the historic race's save key and six ordered gates.
  // The compact city has a smaller scale than the original laboratory.
  const RIO_COMPACT_DAMHA_COURSE=Object.freeze([
    [-108,78.2],...RIO_COMPACT_UPPER_PATH,[-61.4,42],[-63,40],
    ...RIO_COMPACT_LAYOUT.sections.slice(0,westJunction+1),
    [-123.5,72],[-118.7,76.5],[-115.7,78.2],[-108,78.2]
  ]);
  // The shore and the bridge share the two on-land junctions. Both races
  // retain their original IDs, distance rules and independently saved records.
  const RIO_COMPACT_BRIDGE_LAP=[
    ...RIO_COMPACT_LAYOUT.sections.slice(0,westJunction+1),
    ...RIO_COMPACT_LAYOUT.sections.slice(eastJunction)
  ];
  function rioCompactCourseReservations(){
    const paths=[RIO_COMPACT_LAYOUT.sections,RIO_COMPACT_UPPER_PATH,[RIO_WEST_BRIDGE_ENTRY,RIO_EAST_BRIDGE_ENTRY]];
    return paths.flatMap((p,n)=>p.slice(1).map((b,i)=>{const a=p[i];return{id:'rio-compact-track-'+n+'-'+i,x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,w:Math.abs(a[0]-b[0])+3.1,d:Math.abs(a[1]-b[1])+3.1};}));
  }
  const RIO_COMPACT_PARK_STALLS=Object.freeze([
    {id:'rio-represa-coco',kind:'coconut',name:'Água de coco · Represa',seller:'Vendedor de coco',x:-123.2,z:61.5,yaw:Math.PI/2,color:0x588657},
    {id:'rio-represa-milho',kind:'corn',name:'Milho verde · Represa',seller:'Vendedor de milho',x:-65.2,z:73.4,yaw:Math.PI/2,color:0xc19a46}
  ]);
  // The snow resort keeps its cabins, cableway and civilian activities.
  // The legacy decorative urban towers are not part of this region.
  function rioCompactSnowBackdrop(p){return p.z>=147&&p.z<480&&p.x>-220&&p.x<200;}
  function rioCompactPoolPlan(site){
    const {w,d}=site,pw=Math.min(3.8,w*.23),pd=Math.min(2.8,d*.19);
    return {x:0,z:-d/2-pd/2-1.6,w:pw,d:pd};
  }
  function rioCompactPoolReservation(lot){
    const [key,x,z,w,d,facing]=lot;
    if(!key.startsWith('rios_')&&!key.startsWith('casa-damha'))return null;
    const yaw=rioCompactYaw[facing],p=rioCompactPoolPlan({w,d}),s=Math.sin(yaw),c=Math.cos(yaw),side=Math.abs(s)>.5;
    return {id:'rio-compact-pool-'+key,x:x+s*p.z,z:z+c*p.z,w:(side?p.d:p.w)+1.6,d:(side?p.w:p.d)+1.6,margin:.25};
  }
  const rioCompactYaw={s:0,n:Math.PI,w:-Math.PI/2,e:Math.PI/2};
  function rioCompactWorld(){return typeof rioMap!=='undefined'&&!!rioMap?.compact;}
  function rioCompactLotRect([key,x,z,w,d,facing]){
    return {id:'rio-compact-'+key,x,z,w:facing==='e'||facing==='w'?d:w,
      d:facing==='e'||facing==='w'?w:d,margin:.45};
  }

  // Stable identifiers match the original Rio Preto saves.
  const RIO_COMPACT_SITES=[
    ["mercado_municipal","regional-mercado_municipal","Mercado Municipal · Mercadão","market"],
    ["catedral_sao_jose","regional-catedral_sao_jose","Catedral Metropolitana São José","church"],
    ["prefeitura_andalo","regional-prefeitura_andalo","Prefeitura Municipal (Paço)","civic"],
    ["calcadao_centro","regional-calcadao_centro","Calçadão · Praça Dom José Marcondes","square"],
    ["mcdonalds_andalo","regional-mcdonalds_andalo","McDonald's — Av. Alberto Andaló","dining"],
    ["complexo_swift","regional-complexo_swift","Complexo Swift & Teatro Paulo Moura","theater"],
    ["dona_capi","regional-dona_capi","Escultura Dona Capi (Capivara)","statue"],
    ["canecao_represa","regional-canecao_represa","Canecão Represa","dining"],
    ["posto_brasilia","regional-posto_brasilia","Posto Chiesa Brasília","fuel"],
    ["estadio_teixeirao","regional-estadio_teixeirao","Teixeirão · Estádio Benedito Teixeira","stadium"],
    ["estadio_anisio_haddad","regional-estadio_anisio_haddad","Estádio Anísio Haddad (Rio Preto EC)","practice"],
    ["riopreto_shopping","regional-riopreto_shopping","Riopreto Shopping Center","mall"],
    ["plaza_avenida","regional-plaza_avenida","Plaza Avenida Shopping","mall"],
    ["centro_eventos","regional-centro_eventos","Centro Regional de Eventos","exhibition"],
    ["austa_hospital","regional-austa_hospital","Austa Hospital","reception"],
    ["cemiterio_sao_joao_batista","regional-cemiterio_sao_joao_batista","Cemitério São João Batista","garden"],
    ["parque-da-represa","regional-parque_da_represa","Parque da Represa Municipal","trail"],
    ["panificacao-zappas-centro","regional-panificacao_zappas_centro","Zappa’s · unidade do Centro","bakery"],
    ["terminal-urbano","regional-terminal_urbano","Terminal Urbano","station"],
    ["upa-jaguare","regional-upa_jaguare","UPA Jaguaré","reception"],
    ["aeroporto-sbsr","regional-aeroporto_sbsr","Aeroporto Prof. Eribelto Manoel Reino","airport"],
    ["cachoeira_troca_oleo","regional-cachoeira_troca_oleo","Cachoeira Super Troca de Óleo","oil-shop"],
    ["casa-jardim","regional-casa-jardim","Casa do Jardim · Teixeira de Freitas","residence","popular",0],
    ["casa-cotegipe","regional-casa-cotegipe","Casa de varanda · Barão de Cotegipe","residence","popular",380],
    ["casa-vila-ercilia","regional-casa-vila-ercilia","Casa térrea · Vila Ercília","residence","popular",450],
    ["casa-damha","regional-casa-damha","Casa contemporânea · Damha","residence","damha",1250],
    ["casa-damha-varanda","regional-casa-damha-varanda","Casa com varanda · Damha","residence","damha",1490],
    ["rios_candelaro","regional-rios-italia-candelaro","Rios D’Italia · Rio Candelaro","residence","rios-ditalia",1280],
    ["rios_fiora","regional-rios-italia-fiora","Rios D’Italia · Rio Fiora","residence","rios-ditalia",1340],
    ["rios_salso","regional-rios-italia-salso","Rios D’Italia · Rio Salso","residence","rios-ditalia",1300],
    ["rios_fortore","regional-rios-italia-fortore","Rios D’Italia · Rio Fortore","residence","rios-ditalia",1360],
    ["rios_liri","regional-rios-italia-liri","Rios D’Italia · Rio Liri","residence","rios-ditalia",1380],
    ["rios_tanaro","regional-rios-italia-tanaro","Rios D’Italia · Rio Tanaro","residence","rios-ditalia",1420]
  ];
