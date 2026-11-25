import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function fixture(){const module={exports:{}};vm.runInNewContext(fs.readFileSync('games/otthi/assets/vendor/three-r128.min.js','utf8'),{module,exports:module.exports});const T=module.exports,c=vm.createContext({THREE:T});vm.runInContext(fs.readFileSync('games/otthi/src/modules/72-static-instance-culling.js','utf8'),c);return{T,c};}
test('static instance chunks retain all transforms and bound every transformed corner, including mirrored and very large boxes',()=>{
 const{T,c}=fixture(),material=new T.MeshStandardMaterial(),items=[];let seed=177;const random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 for(let i=0;i<700;i++)items.push(new T.Matrix4().compose(new T.Vector3((random()-.5)*800,random()*20,(random()-.5)*800),new T.Quaternion().setFromEuler(new T.Euler(random(),random()*6.28,random())),new T.Vector3((i%3?-1:1)*(1+random()*60),1+random()*10,1+random()*20)));
 const meshes=c.createBoundedWorldBoxInstances(material,items),key=m=>Array.from(new Float32Array(m.elements)).join(','),expected=items.map(key).sort(),actual=[];assert(meshes.length>10);
 for(const mesh of meshes){assert.equal(mesh.material,material);assert.equal(mesh.frustumCulled,true);assert.equal(mesh.userData.otthiBoundedInstances,true);for(let i=0;i<mesh.count;i++){const matrix=new T.Matrix4();mesh.getMatrixAt(i,matrix);actual.push(key(matrix));for(const x of[-.5,.5])for(const y of[-.5,.5])for(const z of[-.5,.5]){const p=new T.Vector3(x,y,z).applyMatrix4(matrix);assert(p.distanceTo(mesh.geometry.boundingSphere.center)<=mesh.geometry.boundingSphere.radius+.0001);}}}
 assert.deepEqual(actual.sort(),expected);assert.equal(new Set(meshes.map(m=>m.geometry)).size,meshes.length,'aggregate bounds belong only to their own geometry');
 const glass=new T.MeshStandardMaterial({transparent:true,opacity:.5}),transparent=c.createBoundedWorldBoxInstances(glass,items);assert.equal(transparent.length,1,'preserve existing transparent instance ordering');assert.equal(transparent[0].count,700);
});
test('frustum policy enables mathematically bounded instances and still protects unbounded distributed instances',()=>{
 const{T,c}=fixture(),bounded=c.createBoundedWorldBoxInstances(new T.MeshStandardMaterial(),[new T.Matrix4().makeTranslation(8,1,5)])[0],unbounded=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),2),root=new T.Group();root.add(bounded,unbounded);c.worldGroup=root;c.world={criticalSurfaces:[]};c.perf={};const source=fs.readFileSync('games/otthi/src/modules/09-responsive-ar-quality-diagnostics.js','utf8');vm.runInContext(source.slice(source.indexOf('  function freezeWorldFrustumCulling(){'),source.indexOf('  function updateVisualLOD(){')),c);c.freezeWorldFrustumCulling();assert.equal(bounded.frustumCulled,true);assert.equal(unbounded.frustumCulled,false);
});

test('regional forest tiles retain every tree transform, original geometry and correct bounds',()=>{
 const {T,c}=fixture(),src=fs.readFileSync('games/otthi/src/modules/63-cordillera-forest.js','utf8');
 vm.runInContext(src.slice(src.indexOf(' function cordilleraForestBatches('),src.indexOf(' function createCordilleraForest(')),c);
 const materials=[0,1,2].map(()=>new T.MeshStandardMaterial()),trees=Array.from({length:400},(_,i)=>({x:i%20*23-500,z:Math.floor(i/20)*31-300,y:i%13,scale:.8+i%7*.12,yaw:i*.31,snow:i%3===0}));
 const meshes=c.cordilleraForestBatches(trees,materials);
 for(const [j,height]of [1,3.5,4.05].entries()){
  const expected=trees.filter(p=>j!==2||p.snow).map(p=>new T.Matrix4().compose(new T.Vector3(p.x,p.y+height*p.scale,p.z),new T.Quaternion().setFromEuler(new T.Euler(0,p.yaw,0)),new T.Vector3(p.scale,p.scale,p.scale)));
  const key=m=>Array.from(new Float32Array(m.elements)).join(','),actual=[];
  for(const m of meshes.filter(m=>m.material===materials[j])){
   assert.equal(m.frustumCulled,true);assert.equal(m.userData.otthiBoundedInstances,true);
   const b=m.geometry.boundingBox;
   for(let i=0;i<m.count;i++){const matrix=new T.Matrix4();m.getMatrixAt(i,matrix);actual.push(key(matrix));for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])assert(new T.Vector3(x,y,z).applyMatrix4(matrix).distanceTo(m.geometry.boundingSphere.center)<=m.geometry.boundingSphere.radius+.0001);}
  }
  assert.deepEqual(actual.sort(),expected.map(key).sort());
 }
 const camera=new T.PerspectiveCamera(55,1,.1,200);camera.position.set(0,8,0);camera.lookAt(0,8,100);camera.updateMatrixWorld(true);const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const submitted=meshes.filter(m=>frustum.intersectsObject(m)).reduce((n,m)=>n+m.count,0);
 assert(submitted<trees.length,'offscreen forest must not submit every instance: '+submitted);
});
