import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../games/otthi/src/modules/27-npc-enemies-combat-camera-action.js', import.meta.url), 'utf8');
const walking = source.slice(source.indexOf('  function v705NpcSeed'), source.indexOf('  function updateNPCs'));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function fixture(blocked = () => false, frameDuration = .1) {
  let time = 100;
  const worldGroup = {}, npcs = [], traffic = [], world = {npcs, vehicles: []};
  const context = vm.createContext({world, worldGroup, player: {x: -50, y: 0, z: -50},
    performance: {now: () => time}, distance2D: distance, v704RoadAt: () => false,
    positionBlockedForPlayer: blocked, nearbyTrafficActors: () => traffic,
    trafficBody: ({group}) => ({...group.position, w: 1, l: 1.5, c: 1, s: 0}),
    lerpAngle: (from, to, t) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * t,
  });
  vm.runInContext(walking, context);
  const spawn = (id, x, z) => {
    const npc = {id, group: {parent: worldGroup, position: {x, y: 0, z}, rotation: {y: 0}}};
    npcs.push(npc);
    return npc;
  };
  const tick = () => { time += frameDuration * 1000; };
  return {spawn, tick, traffic, context, step: (npc, target) => context.v705NpcWalk(npc, frameDuration, target, 1.4, true)};
}

test('pedestrian walks around an intervening wall without crossing or changing destination', () => {
  const wall = (x, z, radius) => x > 2 - radius && x < 3 + radius && Math.abs(z) < 1.2 + radius;
  const f = fixture(wall), npc = f.spawn('resident-test', 0, 0), goal = {x: 8, z: 0};
  let farthest = 0;
  for (let tick = 0; tick < 190; tick++) {
    f.tick();
    const before = {...npc.group.position};
    f.step(npc, goal);
    const position = npc.group.position;
    farthest = Math.max(farthest, Math.abs(position.z));
    assert(!wall(position.x, position.z, .30));
    assert(distance(position, before) <= .18);
  }
  assert(farthest >= 1.5);
  assert(distance(npc.group.position, goal) < .11);
  assert(npc.pedestrianNav.replans > 0);
});

test('pedestrian keeps its heading while blocked and resumes when a closure clears', () => {
  let closed = true;
  const f = fixture((x, z) => closed && x > 1.4 && x < 2.5), npc = f.spawn('resident-crossing', 0, 0);
  const target = {x: 6, z: 0};
  for (let tick = 0; tick < 55; tick++) { f.tick(); f.step(npc, target); }
  const heading = npc.group.rotation.y;
  assert(npc.group.position.x < 1.4);
  for (let tick = 0; tick < 30; tick++) { f.tick(); f.step(npc, target); }
  assert.equal(npc.group.rotation.y, heading);
  assert(npc.pedestrianNav.replans < 10, 'replanning must be throttled');
  closed = false;
  for (let tick = 0; tick < 80; tick++) { f.tick(); f.step(npc, target); }
  assert(distance(npc.group.position, target) < .08);
});

test('pedestrian leaves clearance around a waiting person and a vehicle approaching a crossing', () => {
  const f = fixture(), npc = f.spawn('resident-walking', 0, 0), other = f.spawn('resident-waiting', 2, 0);
  const vehicle = {group: {position: {x: 4, y: 0, z: -2.6}, rotation: {y: 0}}, speed: 7};
  f.traffic.push(vehicle);
  for (let tick = 0; tick < 170; tick++) {
    if (tick === 60) vehicle.group.position.z = 15;
    f.tick(); f.step(npc, {x: 9, z: 0});
    assert(distance(other.group.position, npc.group.position) >= .74);
    if (tick < 60) assert(!(Math.abs(npc.group.position.x - 4) < 1.42 && Math.abs(npc.group.position.z) < .4));
  }
  assert(distance(npc.group.position, {x: 9, z: 0}) < .08);
});

test('two oncoming pedestrians share a narrow walkway and keep their destinations', () => {
  for (const {axis, width, frameDuration} of [
    {axis:'x', width:2.2, frameDuration:.1}, {axis:'z', width:1.65, frameDuration:1/60}
  ]) {
    const across = axis === 'x' ? 'z' : 'x';
    const blocked = (x, z, radius) => Math.abs(({x, z})[across]) + radius > width / 2;
    const f = fixture(blocked, frameDuration);
    const left = {[axis]: -4, [across]: 0}, right = {[axis]: 4, [across]: 0};
    const first = f.spawn('rio-a', left.x, left.z), second = f.spawn('rio-b', right.x, right.z);
    let maxStep = 0;
    for (let tick = 0; tick < 16 / frameDuration; tick++) {
      f.tick();
      for (const [npc, target] of [[first, right], [second, left]]) {
        const before = {...npc.group.position};
        f.step(npc, target);
        const point = npc.group.position;
        maxStep = Math.max(maxStep, distance(point, before));
        assert(!blocked(point.x, point.z, .31));
        assert(distance(first.group.position, second.group.position) >= .748);
      }
      if (distance(first.group.position, right) < .11 && distance(second.group.position, left) < .11) break;
    }
    assert(distance(first.group.position, right) < .11);
    assert(distance(second.group.position, left) < .11);
    assert(maxStep <= 1.8 * frameDuration);
    assert(first.pedestrianNav.replans + second.pedestrianNav.replans <= 2);
  }
});


test('step-aside and evacuation remain active instead of being overridden by proximity chat',()=>{
  const f=fixture(), npc=f.spawn('rio-city-walker',0,0), ctx=f.context;
  ctx.player.x=.8;ctx.player.z=0;
  const b=ctx.v705NpcBrain(npc);
  b.state='step-aside';b.target={x:0,z:2};b.stepAsideUntil=2400;
  for(let i=0;i<7;i++){f.tick();ctx.v705NpcThink(npc);assert.equal(b.state,'step-aside');f.step(npc,b.target);}
  assert(npc.group.position.z>.5);
  b.state='evade';b.target={x:0,z:3};b.fearUntil=2500;
  f.tick();ctx.v705NpcThink(npc);assert.equal(b.state,'evade');
});

test('a social peer target is not a moving vehicle occupant or an unrelated interior',()=>{
 const f=fixture(), ctx=f.context, npc=f.spawn('rio-city-friend',0,0);
 const brain=ctx.v705NpcBrain(npc);brain.traits.social=1;
 const driver=f.spawn('driver',.4,0);driver.mobility={};
 const hidden=f.spawn('hidden',.7,0);hidden.group.visible=false;
 const clerk=f.spawn('clerk',1,0);clerk.stationary=true;
 const indoor=f.spawn('inside',1.2,0);indoor.group.parent={};
 const friend=f.spawn('friend',2,0);
 assert.equal(ctx.v705NpcSocialPeer(npc),friend);
});
