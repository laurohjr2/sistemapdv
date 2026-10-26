const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');
process.loadEnvFile(path.resolve(__dirname,'../.pdv-local/development.env'));
(async()=>{
 const base=process.env.PDV_WEB_URL||'http://127.0.0.1:5182';
 const output=path.resolve(__dirname,'..',process.env.PDV_AUDIT_DIR||'docs/validacao-20261026');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'pt-BR',reducedMotion:'reduce'});page.setDefaultTimeout(12000);
 const results=[];let errors=[],failedRequests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',response=>{if(response.url().includes('/api/') && response.status()>=400)failedRequests.push({path:new URL(response.url()).pathname,status:response.status()});});
 try{
 await page.goto(base+'/login');await page.getByLabel('Usuário',{exact:true}).fill('admin.dev');await page.getByLabel('Senha',{exact:true}).fill(process.env.DEV_ADMIN_PASSWORD);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(base+'/');
 for(const [route,name] of [['/','Dashboard'],['/sales','Vendas'],['/tables','Mesas'],['/stock','Estoque'],['/comandas','Comandas'],['/kitchen','Cozinha'],['/queue','Fila'],['/reports','Relatorios'],['/settings','Configuracoes'],['/users','Usuarios'],['/products','Produtos'],['/print','Impressao']]){
  errors=[];failedRequests=[];
  await page.goto(base+route);await page.waitForLoadState('networkidle');
  const directory=path.join(output,'telas');fs.mkdirSync(directory,{recursive:true});
  await page.screenshot({path:path.join(directory,name+'.png'),fullPage:true,animations:'disabled'});
  const body=await page.locator('body').innerText();
  results.push({route,name,rendered:body.length>100,headings:await page.getByRole('heading').allTextContents(),errors:[...errors],failedRequests:[...failedRequests],visibleMessages:body.split('\n').filter(line=>/erro|falha|inativo/i.test(line)).slice(0,8)});
 }
 await page.goto(base+'/users');await page.waitForLoadState('networkidle');
 await page.getByRole('button',{name:'Novo Usuário',exact:true}).click();
 await page.getByLabel('Nome de Usuário *',{exact:true}).fill(`browseraudit${Date.now()}`);
 await page.getByLabel('Senha *',{exact:true}).fill('SenhaFicticiaDeAuditoria123!');
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/users')&&r.request().method()==='POST');
 await page.getByRole('dialog').getByRole('button',{name:'Criar',exact:true}).click();
 const created=await responsePromise;
 results.push({name:'Usuarios: formulário de criação',passed:created.status()===201,status:created.status()});
 }finally{
 fs.writeFileSync(path.join(output,'browser-resultados.json'),JSON.stringify(results,null,2));
 await browser.close();
 }
 console.log(JSON.stringify(results.map(r=>({name:r.name,errors:r.errors,failedRequests:r.failedRequests,status:r.status})),null,2));
 process.exitCode=results.some(r=>r.errors?.length||r.failedRequests?.length||r.passed===false)?1:0;
})().catch(e=>{console.error(e.message);process.exit(1)});
