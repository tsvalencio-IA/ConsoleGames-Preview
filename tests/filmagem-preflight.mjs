import {chromium} from 'playwright';
const b=await chromium.launch({headless:true,args:['--no-sandbox']});try{const c=await b.newContext({viewport:{width:320,height:180}});const p=await c.newPage();await p.setContent('<body style="background:#159;color:white;font:24px sans-serif">Teste de gravação</body>');await p.waitForTimeout(1200);await c.close();}finally{await b.close();}
