import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=readFileSync('games/otthi/src/modules/13a-sports-kart-v705.js','utf8');

function match(type,overrides={}){
  const tally={coins:0,xp:0,closed:0,hud:''};
  const pos=(x=0,y=0,z=0)=>({x,y,z});
  const court={
    type,foot:type==='footvolley',label:type==='volley'?'Vôlei':'Futevôlei',
    cx:0,cz:0,w:12,d:18,netH:2.25,mode:'solo',state:'rally',timer:60,
    serving:0,pointLock:0,score:[10,8],touches:[1,0],lastSide:0,vx:0,vy:-.25,vz:0,
    ball:{position:pos(0,.26,5),rotation:{}},
    team:[{group:{position:pos(-3,0,-5)}}],opponents:[{group:{position:pos(3,0,7)}}],
    ...overrides
  };
  court.ball.rotation={x:0,z:0};
  const ctx=vm.createContext({window:{},court,player:{x:-4,z:-5},remotePresence:new Map(),
    addCoins:value=>{tally.coins+=value;},addXP:value=>{tally.xp+=value;},
    toast:()=>{},clamp:(n,min,max)=>Math.max(min,Math.min(max,n)),
    lerp:(a,b,k)=>a+(b-a)*k,setTimeout:()=>assert.fail('the court loop must own the match result')
  });
  vm.runInContext(source+`
    SPORTS_V705.active=court;
    SPORTS_V705.courts.set(court.type,court);
    v705AnimateAthlete=()=>{};
  `,ctx);
  ctx.v705Hud=(_,text)=>{tally.hud=text;};
  ctx.stopSportV704=()=>{tally.closed++;vm.runInContext('SPORTS_V705.active=null',ctx);};
  return {ctx,court,tally};
}

for(const type of ['volley','footvolley']){
  test(`an actual ${type} rally awards its last point and prize exactly once`,()=>{
    const {ctx,court,tally}=match(type);
    ctx.updateCourtV704(court,.05); // A live ball lands on the opponent's side.
    assert.equal(court.state,'finished');
    assert.deepEqual(court.score,[11,8]);
    for(let i=0;i<17;i++){
      ctx.updateCourtV704(court,.1);
      assert.equal(ctx.courtHitV704(),false);
      assert.equal(ctx.v705CourtTouch('kick'),false);
    }
    assert.deepEqual(court.score,[11,8]);
    assert.deepEqual(tally,{coins:24,xp:52,closed:1,hud:'Fim • 11 × 8'});
  });

  test(`the ${type} clock can expire while waiting for a serve`,()=>{
    const {ctx,court,tally}=match(type,{state:'serve',timer:.03});
    ctx.updateCourtV704(court,.05);
    assert.equal(court.state,'finished');
    ctx.updateCourtV704(court,1.5);
    assert.equal(tally.closed,1);
    assert.equal(tally.coins,0);
    assert.deepEqual(court.score,[10,8]);
  });
}

test('an online court guest receives the result and leaves without granting a second prize',()=>{
  const {ctx,court,tally}=match('footvolley',{mode:'online'});
  ctx.multiplayerV2SportOnline=()=>true;
  ctx.multiplayerV2SportIsHost=()=>false;
  ctx.multiplayerV2SportState=()=>({type:'footvolley',state:'finished',score:[11,8]});
  ctx.updateCourtV704(court,.01);
  assert.equal(court.state,'finished');
  assert.deepEqual(Array.from(court.score),[11,8]);
  ctx.remotePresence.set('guest',{x:0,z:5});
  assert.equal(ctx.v705ApplyRemoteSportInputV2('footvolley','guest',{action:'kick'}),false);
  ctx.updateCourtV704(court,1.5);
  assert.equal(tally.closed,1);
  assert.equal(tally.xp,0);
  assert.equal(tally.coins,0);
});
