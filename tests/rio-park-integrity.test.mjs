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
