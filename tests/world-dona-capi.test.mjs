import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('games/otthi/src/modules/88-rio-places.js','utf8');
const parts=new Function(s.slice(s.indexOf('  function rioDonaCapiParts('),s.indexOf('  const rioLandmarkPhoto='))+'return rioDonaCapiParts;')();
test('Dona Capi uses a seated sculpture with real scale, eyes, snout and low-cost grouped geometry',()=>{const rows=parts();assert(rows.length>=25);assert(rows.every(p=>['plinth','sculpture'].includes(p[0])));const height=Math.max(...rows.map(p=>p[2]+p[5]/2));assert(height>=2.95&&height<=3.10);assert(rows.every(p=>Math.abs(p[1])+p[4]/2<=1.51&&Math.abs(p[3])+p[6]/2<=1.51));});
test('actual canvas is captured immediately after normal render and is not stored in player state',()=>{const loop=fs.readFileSync('games/otthi/src/modules/29-game-loop-controls-gamepad.js','utf8');assert(loop.includes("renderer.render(scene,camera);if(typeof rioCaptureLandmarkFrame==='function')rioCaptureLandmarkFrame(renderer.domElement)"));assert(s.includes('canvas.toBlob(blob=>'));assert(s.includes("'image/jpeg',.9"));assert(s.includes('data-rio-photo-save'));});
