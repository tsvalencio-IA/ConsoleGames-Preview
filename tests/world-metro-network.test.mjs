import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('games/otthi/src/modules/15-transit-bus-metro.js','utf8');
const find=new Function(s.slice(s.indexOf('  function metroFindStationPoint('),s.indexOf('  const metroCoverage='))+'return metroFindStationPoint;')();
test('station placement moves off roads and never chooses an invalid fallback',()=>{const clear=p=>Math.abs(p.x)>7&&Math.abs(p.z)>2;const p=find({x:0,z:0},clear);assert(p&&clear(p));assert.equal(find({x:0,z:0},()=>false),null);assert.equal(find({x:NaN,z:0},()=>true),null);});
test('metro travel uses physical station list, expansions, and refuses invalid arrival',()=>{assert(s.includes('world.metroStations.filter(s=>s.id!==station.id)'));assert(s.includes('expansionMapLocations()'));assert(s.includes('v704RoadAt(p.x,p.z,3.1,false)'));assert(s.includes('Desembarque indisponível'));});
