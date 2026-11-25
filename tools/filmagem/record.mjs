import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
const test=process.argv[2];
if(!test||!/^tests\/[a-z0-9-]+\.mjs$/.test(test))throw Error('Roteiro inválido');
const name=basename(test,'.mjs'),out=resolve('filmagem',name);
mkdirSync(out,{recursive:true});
const marks=[],pages=[],browsers=[];
const launch=chromium.launch.bind(chromium);
chromium.launch=async(options={})=>{
 const browser=await launch({...options,headless:true,args:[...new Set([...(options.args||[]),'--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--enable-features=SyntheticPointerActions'])]});
 browsers.push(browser);
 const nc=browser.newContext.bind(browser),close=browser.close.bind(browser);
 let pageCount=0;
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
   pages.push(entry);
   const shot=page.screenshot.bind(page);
   page.screenshot=async(opt={})=>{
    marks.push({page:index,seconds:(Date.now()-start)/1000,frame:opt.path||'captura'});
    const result=await shot(opt);
    if(!String(opt.path||'').includes('failure'))await page.waitForTimeout(1300);
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
writeFileSync(helper,original.replace('cap:(fps=0)=>','cap:(fps=12)=>'));
let status='completed',error=null;
try{await import(pathToFileURL(resolve(test)).href);}
catch(e){status='failed';error=String(e.stack||e);console.error(error);process.exitCode=1;}
finally{
 for(const b of browsers)await b.close().catch(()=>{});
 for(const p of pages){
  try{await p.video.saveAs(resolve(out,p.file));const raw=await p.video.path();if(resolve(raw)!==resolve(out,p.file))await p.video.delete();}
  catch(e){console.error('Video não finalizado',e.message);p.error=e.message;process.exitCode=1;status='failed';}
 }
 writeFileSync(resolve(out,'capitulos.json'),JSON.stringify({test,status,error,pages:pages.map(({index,file,error})=>({index,file,error})),marks,limits:['Gravação de jogabilidade com perfil de teste isolado.','Alguns roteiros utilizam posicionamento e avanço de relógio de QA.','Sem áudio: a gravação do Playwright é visual.','Dança utiliza câmera/poses de teste quando indicado.']},null,2));
 writeFileSync(helper,original);
}
