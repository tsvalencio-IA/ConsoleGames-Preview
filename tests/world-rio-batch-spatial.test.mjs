import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('games/otthi/src/modules/79-rio-preto-districts.js','utf8');
const split=new Function(s.slice(s.indexOf('  function rioSpatialBatchItems('),s.indexOf('  function rioCreateBatch('))+'return rioSpatialBatchItems;')();
const item=(x,z,i)=>({matrix:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,x,0,z,1]},tint:i});
test('small local batches stay together',()=>{const a=Array.from({length:20},(_,i)=>item(i*10,0,i));assert.deepEqual(split(a),[a]);const b=Array.from({length:200},(_,i)=>item(i%10,Math.floor(i/10),i));assert.deepEqual(split(b),[b]);});
test('large spread batches retain every original transform and color exactly once',()=>{const a=Array.from({length:500},(_,i)=>item(i%50*8,Math.floor(i/50)*8,i));const chunks=split(a);assert(chunks.length>1);assert.equal(chunks.flat().length,a.length);assert.equal(new Set(chunks.flat()).size,a.length);assert(a.every(x=>chunks.flat().includes(x)));for(const c of chunks){assert.equal(new Set(c.map(x=>Math.floor(x.matrix.elements[12]/48)+':'+Math.floor(x.matrix.elements[14]/48))).size,1);}});
