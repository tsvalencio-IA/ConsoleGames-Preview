import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('games/otthi/src/modules/14a-ottovias-highway-v7054.js','utf8');
const f=new Function(s.slice(s.indexOf('  function ottoviasGateAngle('),s.indexOf('  function updateOttoviasHighway('))+'return ottoviasGateAngle;')();
test('physical toll bar extends along positive X and raises above hinge when opened',()=>{const length=3.5,hingeY=2;assert.equal(hingeY+length*Math.sin(f(false)),hingeY);assert(hingeY+length*Math.sin(f(true))>hingeY+3);assert(f(true)<Math.PI/2);assert(s.includes('target=ottoviasGateAngle(open)'));});
