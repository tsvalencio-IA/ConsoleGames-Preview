import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const places=readFileSync('games/otthi/src/modules/88-rio-places.js','utf8');
const regions=readFileSync('games/otthi/src/modules/84-rio-v51-world.js','utf8');
const homes=readFileSync('games/otthi/src/modules/95-rio-open-buildings.js','utf8');
const journey=readFileSync('games/otthi/src/modules/76-player-journey.js','utf8');
test('construction stores have their own fixtures, stock, staff and keep the real delivery checkout',()=>{
 const code=places.slice(places.indexOf('  function rioFinishInterior('),places.indexOf('  function rioTable('));
 for(const shop of ['tools','materials']){
  const calls=[],room={};for(const method of ['box','object','part','sign'])room[method]=(...args)=>calls.push([method,...args]);
  const ctx=vm.createContext({Math,rioCounter:(...args)=>calls.push(['counter',...args.slice(1)]),rioServiceClerk:(...args)=>calls.push(['clerk',...args.slice(2)]),room,site:{w:16,d:12,kind:'construction',shop}});
  vm.runInContext(code+'\nrioBuildConstructionStore(site,room);rioFinishInterior(site,room);',ctx);
  assert.equal(room.interiorStock,shop);assert.equal(room.interiorTheme,'construction');
  assert(calls.filter(c=>c[0]==='box').length>20);
  assert(calls.some(c=>c[0]==='clerk'&&c[1]==='construction'));
  assert(calls.some(c=>c[0]==='sign'&&c[1].includes(shop==='tools'?'FERRAMENTAS':'CIMENTO')));
 }
 assert.match(regions,/if\(p\.shop==='tools'\|\|p\.shop==='materials'\)return 'construction'/);
 assert.match(regions,/rioOpenRegionalConstructionStore\(p\)/);
});
test('native mall adds a food court without removing wardrobe and market actions',()=>{
 assert.match(homes,/room\.action\('food-court-counter'/);
 assert.match(homes,/room\.action\('food-court-table'/);
 assert.match(homes,/rioBuildMarket\(site,room\);\s*rioBuildFoodCourt\(site,room\)/);
 assert.match(homes,/rioEatAtTable\(site,room,seat\)/);
 assert.match(places,/if\(!rioPurchaseItems\(order\.item\)\)return false/);
 assert.match(places,/if\(ordered\|\|button\.disabled/);
});
test('life goals count actual native save and preserve old civil mission progression',()=>{
 const save={properties:{home:{owned:true,adopted:true},other:{owned:true,paid:600,decorLayout:{sofa:{x:1}},renovation:{floor:0}}},visits:{'regional-mercado_municipal':true},wardrobePurchases:{polo:true},constructionOrders:[{status:'delivered'}],regionExperience:{visits:{ibira:{count:1}}}};
 const ctx=vm.createContext({rioCompactWorld:()=>true,rioMapSave:()=>save});
 vm.runInContext(journey.slice(journey.indexOf(' function rioLivingJourney(){'),journey.indexOf(' function rioLivingJourneyHtml(){')),ctx);
 const rows=JSON.parse(vm.runInContext('JSON.stringify(rioLivingJourney())',ctx));
 assert.equal(rows.length,7);assert(rows.every(row=>row.done));
 save.properties={home:{owned:true,adopted:true}};assert.equal(vm.runInContext("rioLivingJourney().find(x=>x.id==='home').done",ctx),false);
 assert.match(journey,/PLAYER_JOURNEY_ROUTE/);
});
