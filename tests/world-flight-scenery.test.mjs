import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function readFunctionModule(file, start, end) {
  const source = readFileSync(new URL('../games/otthi/src/modules/' + file, import.meta.url), 'utf8');
  assert(source.includes(start) && source.includes(end));
  return source.slice(source.indexOf(start), source.indexOf(end));
}

const flightHelpers = readFunctionModule(
  '09-responsive-ar-quality-diagnostics.js',
  '  function worldFlightHorizon(',
  '  function updateCriticalSurfaceDistanceVisibility(',
);

test('civil flight widens scenery by height above terrain while sharing each floor lookup', () => {
  const otGames = {active: true, mode: 'plane', armed: false, onGround: false, body: {x: 400, y: 121, z: 320}};
  let queries = 0;
  const ctx = vm.createContext({otGames, v704WorldSize: () => ({w: 1700, d: 1800}), groundHeightAt(x, z) {
    queries++;
    return x === 400 && z === 320 ? 120 : 0;
  }});
  vm.runInContext(flightHelpers, ctx);

  assert.equal(ctx.worldFlightSceneryRange(142), 145.5, 'a flight just above a high summit keeps the nearby range');
  assert.equal(ctx.worldFlightSceneryRange(420), 423.5);
  assert.equal(queries, 1);
  otGames.body.y = 320;
  assert.equal(ctx.worldFlightSceneryRange(142), 842);
  assert.equal(ctx.worldFlightSceneryRange(920, 1320), 1320);
  assert.equal(queries, 1, 'climbing does not change the terrain sample at a fixed x/z');
  otGames.body.x = 401;
  assert.equal(ctx.worldFlightSceneryRange(142), 920);
  assert.equal(queries, 2);

  for (const overrides of [{onGround: true}, {armed: true}, {mode: 'ground'}, {active: false}]) {
    Object.assign(otGames, {active: true, mode: 'plane', armed: false, onGround: false}, overrides);
    assert.equal(ctx.worldFlightSceneryRange(142), 142);
  }
  assert.equal(queries, 2);
});

test('the terrain tick preserves the flight horizon and precipitation fog', () => {
  const otGames = {active: true, mode: 'balloon', body: {x: 0, y: 320, z: 0}};
  const camera = {far: 1200, updateProjectionMatrix() {}};
  const scene = {fog: {near: 210, far: 650}};
  const rioClimate = {kind: 'clear'};
  const chunk = {x: 1100, z: 0, mesh: {visible: false}};
  const ctx = vm.createContext({
    otGames, camera, scene, rioClimate,
    cordillera: {ready: true, chunks: [chunk], balloons: []},
    state: {}, createCordillera() {}, ensureRegionalRoadTraffic() {}, airNow: () => 0,
    otGamesFocus: () => otGames.body, sharedWorldIsAuthority: () => false,
    v704WorldSize: () => ({w: 1700, d: 1800}), groundHeightAt: () => 0,
  });
  vm.runInContext(flightHelpers + readFunctionModule(
    '63-cordillera-forest.js',
    ' function updateCordillera(',
    ' const cordilleraOldExpand=',
  ), ctx);

  ctx.syncWorldFlightHorizon();
  ctx.updateCordillera();
  assert.equal(scene.fog.far, camera.far);
  assert.equal(chunk.mesh.visible, true);
  rioClimate.kind = 'rain';
  Object.assign(scene.fog, {near: 92, far: 315});
  ctx.updateCordillera();
  ctx.syncWorldFlightHorizon();
  assert.deepEqual(scene.fog, {near: 92, far: 315});
  otGames.active = false;
  ctx.updateCordillera();
  ctx.syncWorldFlightHorizon();
  assert.deepEqual(scene.fog, {near: 92, far: 315});
  assert.equal(chunk.mesh.visible, false);
  assert.equal(camera.far, 1200);
});

test('distant visible circuit facilities leave karts on their existing near-only budget', () => {
  const kart = {group: {visible: true}};
  const circuit = {cx: 510, cz: 0, root: {visible: false}, karts: [kart]};
  const city = {position: {x: 700, z: 0}, visible: false};
  const otGames = {active: true, mode: 'helicopter', body: {x: 0, y: 220, z: 0}};
  let time = 300;
  const ctx = vm.createContext({
    otGames, otGamesFocus: () => otGames.body, expansionEnsure() {},
    worldExpansion: {ready: true, groups: [city], lastLod: 0}, SPORTS_V705: {circuits: [circuit]},
    performance: {now: () => time}, groundHeightAt: () => 0,
  });
  vm.runInContext(flightHelpers + readFunctionModule(
    '46-world-cities-and-racers.js',
    '  function updateWorldExpansion(',
    '  window.OTTHI_EXPANSION=',
  ), ctx);

  ctx.updateWorldExpansion();
  assert.equal(city.visible, true);
  assert.equal(circuit.root.visible, true);
  assert.equal(kart.group.visible, false);
  otGames.active = false;
  time += 300;
  ctx.updateWorldExpansion();
  assert.equal(city.visible, false);
  assert.equal(circuit.root.visible, false);
});
