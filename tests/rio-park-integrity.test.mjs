import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=p=>readFileSync('games/otthi/src/modules/'+p+'.js','utf8');
const c=vm.createContext({Math,regionalRouteVisible:()=>false,window:{}});
vm.runInContext(source('78a-rio-compact-layout'),c);
const run=x=>JSON.parse(vm.runInContext('JSON.stringify('+x+')',c));
test('bridge surface is continuous across both real ramps and remains above the swimming threshold throughout the lake',()=>{
 const b=run('RIO_COMPACT_BRIDGE'), samples=run('Array.from({length:451},(_,i)=>rioCompactBridgeSurface(-126.5+i*.1,69))');
 assert.equal(samples[0],0);assert.equal(samples.at(-1),0);
 for(let i=1;i<samples.length;i++)assert(Math.abs(samples[i]-samples[i-1])<.02);
 assert(run('Array.from({length:241},(_,i)=>rioCompactBridgeSurface(-116+i*.1,69)).every(y=>y>.24)'));
 assert.equal(run('rioCompactBridgeSurface(-104,72)'),0);
 assert.match(source('25-render-init-resize-position-collision'),/rioCompactBridgeSurface\(x,z\)/);
 assert.match(source('99-rio-compact-world'),/mesh\.rotation\.z=-side\*angle/);
});
test('each modern residence has a genuine exterior pool footprint, not a different scene group in the same room',()=>{
 const result=run('RIO_COMPACT_LAYOUT.lots.map(l=>({lot:rioCompactLotRect(l),pool:rioCompactPoolReservation(l)})).filter(x=>x.pool)');
 assert.equal(result.length,8);
 const overlap=(a,b)=>Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.z-b.z)<(a.d+b.d)/2;
 const lots=run('RIO_COMPACT_LAYOUT.lots.map(rioCompactLotRect)');
 for(const r of result){assert(!overlap(r.lot,r.pool),r.lot.id);for(const l of lots)assert(!overlap(l,r.pool),r.pool.id+' / '+l.id);}
 for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++)assert(!overlap(result[i].pool,result[j].pool));
});
test('park carts are distinct native purchases and not a replacement for original shops',()=>{
 const stocks=source('56-city-coast-life'),world=source('99-rio-compact-world');
 assert.match(stocks,/coconut-water/);assert.match(stocks,/green-corn/);assert.match(stocks,/function cityPurchase/);
 assert.match(world,/cityCoast\.shops\.set\(shop\.id,shop\)/);assert.match(world,/action:\(\)=>openCityShop\(shop\.id\)/);
 assert.match(world,/rioPrepareWaterfrontRun/);assert.match(world,/represa_rio_preto_compacta_300m/);
 assert.match(world,/regional-portaria_damha/);
});
test('snow keeps the old resort but excludes urban backdrop buildings in compact Rio',()=>{
 assert.equal(run('rioCompactSnowBackdrop({x:-74,z:188})'),true);
 assert.equal(run('rioCompactSnowBackdrop({x:58,z:-248})'),false);
 assert.match(source('14-world-district-decoration'),/rioCompactWorld\(\)&&rioCompactSnowBackdrop\(p\)/);
});

test('three distinct native lake basins, both race paths and vendor positions remain separated',()=>{
 const lakes=run('RIO_COMPACT_LAKES'),paths=run('[RIO_COMPACT_LAYOUT.sections,RIO_COMPACT_DAMHA_COURSE]'),vendors=run('RIO_COMPACT_PARK_STALLS');
 assert.equal(lakes.length,3);
 const inside=(x,z,r,m=0)=>Math.abs(x-r.x)<r.w/2+m&&Math.abs(z-r.z)<r.d/2+m;
 for(let i=0;i<lakes.length;i++)for(let j=i+1;j<lakes.length;j++){const a=lakes[i],b=lakes[j];assert(Math.abs(a.x-b.x)>=(a.w+b.w)/2||Math.abs(a.z-b.z)>=(a.d+b.d)/2);}
 for(const path of paths)for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(len/.25);
   for(let n=0;n<=steps;n++){const x=a[0]+(b[0]-a[0])*n/steps,z=a[1]+(b[1]-a[1])*n/steps;assert(!lakes.some(l=>inside(x,z,l,.45)),JSON.stringify({x,z}));}
 }
 for(const v of vendors)assert(!lakes.some(l=>inside(v.x,v.z,l,1)));
 assert.match(source('12-world-resources-nature'),/RIO_REPRESA_TRES_LAGOS/);
 assert.match(source('99-rio-compact-world'),/id:'corrida_rua_represa_damha'/);
});
test('audit every personal home and all active regional building parcels instead of one test identity',()=>{
 const ctx=vm.createContext({window:{},regionalRouteVisible:()=>false,Math});
 for(const name of ['78-rio-preto-layout','78a-rio-compact-layout','83-rio-v51-layout','80-rio-regional-circuits','05a-world-layout-v704'])vm.runInContext(source(name),ctx);
 const result=JSON.parse(vm.runInContext("JSON.stringify((()=>{const profiles=[];for(let i=0;i<OTTHI_PERSONAL_HOME_LOTS.length;i++){otthiHomeLotIndex=()=>i;profiles.push(v704StaticWorldAudit().problems);}const h=RIO_PRETO_LAYOUT.lots.map(l=>({id:l.id,x:l.x,z:l.z,w:Math.abs(Math.sin(l.yaw))>.5?l.d:l.w,d:Math.abs(Math.sin(l.yaw))>.5?l.w:l.d}));const r=RIO_V51.places.filter(p=>!p.nativeVenue&&RIO_RECOVERED_SECTORS.includes(p.sector));const lots=[...h,...r,...RIO_COMPACT_LAYOUT.lots.map(rioCompactLotRect),...WORLD_LAYOUT_V704.structures.filter(s=>['house','civil-home','city','garage','campaign','family-home','dealer'].includes(s.kind)).map(s=>worldLayoutStructure(s.id))];const overlaps=[];for(let i=0;i<lots.length;i++)for(let j=i+1;j<lots.length;j++)if(v704RectOverlap(lots[i],lots[j],-.15))overlaps.push([lots[i].id,lots[j].id]);return {profiles,overlaps,count:lots.length};})())",ctx));
 assert.equal(result.profiles.length,10);assert(result.profiles.every(p=>p.length===0),JSON.stringify(result.profiles));assert(result.count>=100);assert.deepEqual(result.overlaps,[]);
});
