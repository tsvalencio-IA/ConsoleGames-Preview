import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const gm=fs.readFileSync('games/otthi/src/modules/39-gm-admin-panel.js','utf8'),db=fs.readFileSync('games/otthi/assets/js/multiplayer-rtdb.js','utf8');
test('GM exposes real item codes and bulk max uses each item cap',()=>{
 const a={dataset:{gmItem:'wood'},max:'1000000',value:'0'},b={dataset:{gmItem:'tool-axe'},max:'1',value:'0'},coin={value:'0'};
 const form={querySelectorAll:()=>[a,b],querySelector:q=>q.includes('bulk-amount')?{value:'123'}:q==='[data-gm-coins]'?coin:{checked:true}};
 const context=vm.createContext({GM_MAX_ADD:1000000,gmPositiveInt:n=>Number(n),Math});vm.runInContext(gm.slice(gm.indexOf('  function gmFillItems('),gm.indexOf('  function gmFormatDate(')),context);
 context.gmFillItems(form,'max');assert.equal(a.value,1000000);assert.equal(b.value,1);assert.equal(coin.value,1000000);
 context.gmFillItems(form,'fill');assert.equal(a.value,123);assert.equal(b.value,1);context.gmFillItems(form,'clear');assert.equal(a.value,0);
 for(const key of ['seeds','wheat','carrots','clay','worldShopItems','RIO_CONSTRUCTION_CATALOG','RIO_WARDROBE_CATALOG','rioFurnitureCatalog','OTTHI_PLAYER_VEHICLE_CATALOG'])assert(gm.includes(key));
});
test('GM atomic batch splits 85 items for two players and keeps coins once per user',async()=>{
 let write,counter=0;const f={ref:(_db,p)=>p,push:()=>({key:'grant-'+(++counter)}),serverTimestamp:()=>123,update:async(_p,u)=>{write=u;}};
 const ctx=vm.createContext({GM_MAX_ADD:1000000,GM_MAX_ITEMS:40,ROOT:'world',db:{},isCurrentUserGM:async()=>({ok:true,allowed:true}),ensureServices:async()=>f,accountStatus:()=>({uid:'admin',username:'GM'}),validPublicUid:()=>true,sanitizePublicName:s=>s,Date,Map,Math,JSON,Object});
 vm.runInContext(db.slice(db.indexOf('async function gmCreateGrantBatch('),db.indexOf('async function gmTargetGuard(')),ctx);
 const items=Object.fromEntries(Array.from({length:85},(_,i)=>['item'+i,1000000]));const result=await ctx.gmCreateGrantBatch([{uid:'player1',name:'One'},{uid:'player2',name:'Two'}],{coins:1000000,items});assert.equal(result.ok,true);assert.equal(result.grantIds.length,6);
 for(const uid of ['player1','player2']){const records=Object.entries(write).filter(([p])=>p.startsWith('gmGrants/'+uid+'/')).map(([,v])=>v);assert.equal(records.length,3);assert.equal(records.reduce((n,r)=>n+r.coins,0),1000000);assert.equal(records.reduce((n,r)=>n+Object.keys(r.items).length,0),85);assert(records.every(r=>r.totalUnits<=41000000));for(const r of records)assert.equal(write['gmAudit/'+r.grantId],r);}
});
