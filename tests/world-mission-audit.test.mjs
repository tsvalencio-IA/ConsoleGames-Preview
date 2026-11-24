import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('games/otthi/src/modules/66-civil-missions.js','utf8');
const audit=new Function(source.slice(source.indexOf(' function civilAuditCatalog('),source.indexOf(' function civilMissionAudit('))+'return civilAuditCatalog;')();
test('detects impossible individual and team quota, missing targets without altering definitions',()=>{const d={x:{title:'Entrega',steps:[{title:'Entregue',action:'Entregar',quota:{easy:1,hard:2},sharedSubjects:true,targets:['a','b']}]}};const before=JSON.stringify(d);const s=audit(d,{easy:{},hard:{}},id=>id==='a'?{x:0,z:0}:null,false)[0].steps[0];assert(s.issues.includes('Cota individual inviável: hard'));assert(s.issues.includes('Cota da dupla inviável: easy'));assert(s.issues.includes('Alvo ausente ou sem coordenadas'));assert.equal(JSON.stringify(d),before);});
test('GPS skips missing target and preserves next available one',()=>{const f=new Function('civilSubject',source.slice(source.indexOf('function civilAvailableTarget('),source.indexOf(' // The photo follows'))+'return civilAvailableTarget;')(id=>id==='b'?{id,x:2,z:3}:null);assert.equal(f({uid:'qa',r:{id:'x'},book:{progress:()=>({step:{targets:['a','b']},count:0,quota:1,record:{phase:0,tokens:{}}})}}).id,'b');});
