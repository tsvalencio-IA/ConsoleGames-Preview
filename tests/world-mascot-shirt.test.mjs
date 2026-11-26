import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('games/otthi/family-mascots.js','utf8');
test('official shirt reads THIAGUINHO from the rear, preserving outward winding',()=>{
 const points=[],ctx=vm.createContext({color:()=>[1,1,1],normalize:a=>a});
 vm.runInContext(source.slice(source.indexOf('    function shirtLettering(g)'),source.indexOf('    function human(id)')),ctx);
 ctx.shirtLettering({vertex:(p,n)=>points.push({p,n})});
 const cell=.0074,centers=[];
 for(let i=0;i<points.length;i+=6){const q=points.slice(i,i+6),a=q[0].p,b=q[1].p,c=q[2].p;assert((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0,'rear triangles face outward');const xs=q.map(v=>v.p[0]),ys=q.map(v=>v.p[1]);centers.push({col:Math.round(-(Math.min(...xs)+Math.max(...xs))/2/cell+29.5),row:6-Math.round(((Math.min(...ys)+Math.max(...ys))/2-1.81)/cell)});}
 const glyph=i=>Array.from({length:7},(_,row)=>Array.from({length:5},(_,col)=>centers.some(p=>p.row===row&&p.col===i*6+col)?'1':'0').join(''));
 assert.deepEqual(glyph(0),['11111','00100','00100','00100','00100','00100','00100']);
 assert.deepEqual(glyph(4),['01110','10001','10000','10111','10001','10001','01110']);
 assert.deepEqual(glyph(9),['01110','10001','10001','10001','10001','10001','01110']);
});
