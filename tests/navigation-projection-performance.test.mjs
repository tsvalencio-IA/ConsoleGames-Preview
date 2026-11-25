import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('games/otthi/src/modules/07-navigation-traffic-routes.js','utf8'),body=source.slice(source.indexOf('  function nearestRoadProjection('),source.indexOf('  function pointOnRoad('));
// The former exhaustive selection is the behavioural reference, including ties.
function exhaustive(pos,nodes,edges,project,clear){let best=null;for(const[aId,bId]of edges){const p=project(pos,nodes[aId],nodes[bId]),distance=Math.hypot(pos.x-p.x,pos.z-p.z),visible=clear(pos,p),score=distance+(visible?0:120);if(!best||score<best.score)best={aId,bId,point:p,distance,clear:visible,score};}return best;}
const project=(p,a,b)=>{const x=b.x-a.x,z=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/(x*x+z*z||1)));return{x:a.x+x*t,z:a.z+z*t,t};};
test('road projection preserves the exhaustive choice for occlusion, penalties and equal-distance roads',()=>{
 const nodes={},edges=[];for(let i=0;i<150;i++){nodes['a'+i]={x:i%15*17-110,z:Math.floor(i/15)*23-105};nodes['b'+i]={x:nodes['a'+i].x+13,z:nodes['a'+i].z+9};edges.push(['a'+i,'b'+i]);}edges.push(edges[0]);
 const clear=(p,q)=>!(q.x>p.x+4&&q.z<p.z+20),c=vm.createContext({NAV_BASE_NODES:nodes,NAV_BASE_EDGES:edges,projectPointToSegment:project,segmentClear:clear,Math});vm.runInContext(body,c);
 let seed=177;for(let i=0;i<400;i++){seed=Math.imul(seed,1664525)+1013904223|0;const x=(seed>>>0)%480-240;seed=Math.imul(seed,1664525)+1013904223|0;const p={x,z:(seed>>>0)%480-240};assert.deepEqual(JSON.parse(JSON.stringify(c.nearestRoadProjection(p))),exhaustive(p,nodes,edges,project,clear));}
});
test('an unobstructed nearest road needs one line-of-sight query, rather than every road',()=>{
 const nodes={},edges=[];for(let i=0;i<500;i++){nodes['a'+i]={x:i*4,z:0};nodes['b'+i]={x:i*4,z:20};edges.push(['a'+i,'b'+i]);}let calls=0;const c=vm.createContext({NAV_BASE_NODES:nodes,NAV_BASE_EDGES:edges,projectPointToSegment:project,segmentClear:()=>{calls++;return true;},Math});vm.runInContext(body,c);assert.equal(c.nearestRoadProjection({x:.1,z:5}).aId,'a0');assert.equal(calls,1);
});

test('traffic polyline pruning retains exact nearest segments, ties and closed paths',()=>{
 const code=source.slice(source.indexOf('  function projectPointToPolyline('),source.indexOf('  function snapTrafficToRoad('));let calls=0;const c=vm.createContext({Math,projectPointToSegment:(...a)=>{calls++;return project(...a);}});vm.runInContext(code,c);
 const points=Array.from({length:1200},(_,i)=>({x:i*.8,z:Math.sin(i*.08)*8}));
 function original(p,points,closed){let best=null;for(let i=0;i<(closed?points.length:points.length-1);i++){const a=points[i],b=points[(i+1)%points.length],point=project(p,a,b),distance=Math.hypot(p.x-point.x,p.z-point.z);if(!best||distance<best.distance)best={point,distance,index:i,nextIndex:(i+1)%points.length};}return best;}
 for(const closed of [true,false])for(let i=0;i<80;i++){const p={x:i*13-30,z:Math.sin(i*2)*20};assert.deepEqual(JSON.parse(JSON.stringify(c.projectPointToPolyline(p,points,closed))),original(p,points,closed));}
 const near={x:1,z:0};calls=0;c.projectPointToPolyline(near,points,false);assert(calls<20,'near-start route should not project every distant segment: '+calls);
 const tie=[{x:0,z:0},{x:3,z:0},{x:0,z:0}];assert.equal(c.projectPointToPolyline({x:1,z:2},tie,false).index,0);
});
