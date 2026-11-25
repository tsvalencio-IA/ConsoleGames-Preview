import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,copyFileSync,statSync,existsSync,readdirSync} from 'node:fs';
import {resolve,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
const test=process.argv[2];
if(!test||!/^tests\/[a-z0-9-]+\.mjs$/.test(test))throw Error('Roteiro inválido');
const name=basename(test,'.mjs'),out=resolve('filmagem',name);
mkdirSync(out,{recursive:true});
const marks=[],pages=[],browsers=[];let pageCount=0;
const launch=chromium.launch.bind(chromium);
chromium.launch=async(options={})=>{
 const browser=await launch({...options,headless:true,args:[...new Set([...(options.args||[]),'--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--enable-features=SyntheticPointerActions'])]});
 browsers.push(browser);
 const nc=browser.newContext.bind(browser),close=browser.close.bind(browser);
 browser.newContext=async(opts={})=>{
  const viewport=opts.viewport||{width:844,height:390};
  const ctx=await nc({...opts,recordVideo:{dir:out,size:viewport}});
  // Test scenarios use localhost and disposable browser state only.
  // External requests not explicitly intercepted by their fixtures are refused.
  await ctx.route(/^https?:\/\//,route=>{
   const host=new URL(route.request().url()).hostname;
   return ['127.0.0.1','localhost','[::1]'].includes(host)?route.continue():route.abort('blockedbyclient');
  });
  ctx.on('page',page=>{
   const index=++pageCount,start=Date.now(),video=page.video();
   const entry={index,page,video,start,file:'cena-'+String(index).padStart(2,'0')+'.webm'};
   // Obtain the local recording path while the Playwright connection is alive.
   entry.rawPath=video.path().catch(e=>{entry.pathError=e.message;return null;});
   pages.push(entry);
   const shot=page.screenshot.bind(page);
   page.screenshot=async(opt={})=>{
    marks.push({page:index,seconds:(Date.now()-start)/1000,frame:opt.path||'captura'});
    const result=await shot(opt);
    // Do not change the timing of existing regression scenarios.
    return result;
   };
  });
  return ctx;
 };
 browser.close=async(...args)=>{
  for(const ctx of browser.contexts())await ctx.close().catch(()=>{});
  await close(...args);
 };
 return browser;
};
// Keep the original test fixtures, but let the real game renderer draw
// during sequences that the regression tests normally run without rendering.
// The change is confined to this disposable checkout, never published.
const helper='tests/helpers/world-city-inspection.mjs';
const original=readFileSync(helper,'utf8');
const fps=test.includes('park-integrity')?0:4;
writeFileSync(helper,original.replace('cap:(fps=0)=>','cap:(fps='+fps+')=>'));
let status='completed',error=null;
try{await import(pathToFileURL(resolve(test)).href);}
catch(e){status='failed';error=String(e.stack||e);console.error(error);process.exitCode=1;}
finally{
 for(const b of browsers)await b.close().catch(()=>{});
 for(const p of pages){
  try{const raw=await p.rawPath;if(!raw||!existsSync(raw)||statSync(raw).size===0)throw Error(p.pathError||'Arquivo de vídeo original ausente');const target=resolve(out,p.file);if(resolve(raw)!==target)copyFileSync(raw,target);console.log('VIDEO SAVED',p.file,statSync(target).size);}
  catch(e){console.error('Video não finalizado',e.message);p.error=e.message;process.exitCode=1;status='failed';}
 }
 if(!pages.length){status='failed';process.exitCode=1;error||='Nenhuma página gravada';}
 writeFileSync(resolve(out,'capitulos.json'),JSON.stringify({test,status,error,pages:pages.map(({index,file,error})=>({index,file,error})),marks,limits:['Gravação de jogabilidade com perfil de teste isolado.','Alguns roteiros utilizam posicionamento e avanço de relógio de QA.','Sem áudio: a gravação do Playwright é visual.','Dança utiliza câmera/poses de teste quando indicado.']},null,2));
 writeFileSync(helper,original);
}
