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
test('a rotated sofa fits the room and dragging projects onto the actual finished floor',()=>{
 const code=homes.slice(homes.indexOf('  function rioFurnitureCatalog('),homes.indexOf('  // Shared furnishings'));
 const site={w:8,d:6};
 const saved={x:30,z:30,rotation:5,stored:true};
 const ctx=vm.createContext({site,saved,clamp:(n,min,max)=>Math.max(min,Math.min(n,max))});
 const layouts=JSON.parse(vm.runInContext(code+`
  const sofa=rioFurnitureCatalog(site).find(item=>item.id==='sofa-modular');
  JSON.stringify({sofa,legacy:rioFurnitureLayout(site,sofa,{...saved,rotation:0}),rotated:rioFurnitureLayout(site,sofa,saved)});
 `,ctx));
 const {sofa,legacy,rotated}=layouts;
 assert.equal(rotated.rotation,1);
 assert(rotated.stored);
 assert(rotated.x>legacy.x&&rotated.z<legacy.z);
 assert(Math.abs(rotated.x+sofa.d/2+1.10-site.w/2)<1e-9);
 assert(Math.abs(rotated.z+sofa.w/2+1.10-site.d/2)<1e-9);
 assert.deepEqual(saved,{x:30,z:30,rotation:5,stored:true});
 assert.match(homes,/new THREE\.Plane\(new THREE\.Vector3\(0,1,0\),-room\.floorY\)/);
});
test('the modular sofa seats the avatar above the cushion with a walkable approach at each rotation',()=>{
 const code=homes.slice(homes.indexOf('  function rioFurnitureCatalog('),homes.indexOf('  function rioHomeCareValue('));
 const site={w:8,d:6};
 const ctx=vm.createContext({site,clamp:(n,min,max)=>Math.max(min,Math.min(n,max))});
 vm.runInContext(code+"\nconst sofa=rioFurnitureCatalog(site).find(item=>item.id==='sofa-modular');",ctx);
 const directions=[[0,1],[1,0],[0,-1],[-1,0]];
 const near=(a,b)=>Math.abs(a-b)<1e-9;
 for(const [rotation,[x,z]] of directions.entries()){
  ctx.saved={x:100*x,z:100*z,rotation};
  const {p,plan}=vm.runInContext(`(()=>{
   const p=rioFurnitureLayout(site,sofa,saved);
   return {p,plan:rioFurnitureUsePlan(sofa,p,null,(x,z)=>({x,z}),.3,4)};
  })()`,ctx);
  assert(plan.pose.sitting&&near(plan.pose.y,4.71));
  assert(near(plan.pose.x,p.x+x*.33)&&near(plan.pose.z,p.z+z*.33));
  assert(near(plan.pose.yaw,.3+rotation*Math.PI/2));
  assert(Math.min(site.w/2-Math.abs(plan.target.x),site.d/2-Math.abs(plan.target.z))>=.57);
 }
});
test('streaming tracks movable furniture interactions alongside the mounted room',()=>{
 const code=homes.slice(homes.indexOf('    const furnitureAction='),homes.indexOf("    room.action('home-entry'"));
 const site={id:'regional-qa-residencia'},room={actions:[],point:(x,z)=>({x,z})};
 const actions=[];
 const ctx=vm.createContext({site,room,furnishings:[{id:'sofa-modular',type:'sofa',name:'Sofá'},{id:'quadro',type:'picture'}],
  registerInteractable:action=>actions.push(action),rioResidencePropertyId:()=>site.id,rioPropertyTitle:()=>({}),layoutFor:()=>({x:2,z:3})});
 vm.runInContext(code,ctx);
 assert.deepEqual(room.actions,[site.id+'-furniture-use-sofa-modular']);
 assert.deepEqual(actions.map(action=>action.id),room.actions);
 assert.deepEqual(actions[0].getPos(),{x:2,z:3});
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
