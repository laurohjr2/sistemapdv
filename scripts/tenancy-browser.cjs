const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
process.loadEnvFile(path.resolve(__dirname,'../.pdv-local/development.env'));
(async()=>{
 const base=process.env.PDV_WEB_URL||'http://127.0.0.1:5188',company=process.env.PDV_COMPANY||'demo';
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1100},locale:'pt-BR',reducedMotion:'reduce'});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(base+'/login');
 const badBranding=page.waitForResponse(r=>r.url().includes('/settings/branding?company=empresa-inexistente-ui'));
 await page.getByLabel('Código da empresa',{exact:true}).fill('empresa-inexistente-ui');await page.getByLabel('Usuário',{exact:true}).focus();assert.equal((await badBranding).status(),401);assert.equal(await page.getByLabel('Código da empresa',{exact:true}).inputValue(),'empresa-inexistente-ui');
 await page.getByLabel('Código da empresa',{exact:true}).fill(company);await page.getByLabel('Usuário',{exact:true}).fill('admin.dev');await page.getByLabel('Senha',{exact:true}).fill(process.env.DEV_ADMIN_PASSWORD);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(base+'/');
 await page.goto(base+'/settings');await page.getByLabel('Nome da empresa *',{exact:true}).waitFor();assert.equal(await page.getByTestId('support-client-id').count(),0);assert.equal(await page.getByLabel('Nome da empresa *',{exact:true}).isEnabled(),true);
 await page.screenshot({path:path.resolve(__dirname,'../docs/multiempresa-20261026/configuracoes-cliente.png'),fullPage:true,animations:'disabled'});
 await page.goto(base+'/support');await page.getByLabel('Usuário do suporte',{exact:true}).fill('support.dev');await page.getByLabel('Senha do suporte',{exact:true}).fill(process.env.DEV_SUPPORT_PASSWORD);await page.getByRole('button',{name:'Entrar no suporte',exact:true}).click();
 const card=page.locator('[data-slot="card"]').filter({has:page.getByRole('heading',{name:'Estabelecimento de demonstração',exact:true})});await card.getByRole('button',{name:'Acessar configurações',exact:true}).click();await page.waitForURL(base+'/settings');
 const id=page.getByTestId('support-client-id');await id.waitFor();const clientId=await id.innerText();assert.match(clientId,/^[a-f0-9-]{36}$/);assert.equal(await page.getByLabel('Nome da empresa *',{exact:true}).isDisabled(),true);
 await page.reload();await page.getByTestId('support-client-id').waitFor();assert.equal(await page.getByTestId('support-client-id').innerText(),clientId);
 await page.screenshot({path:path.resolve(__dirname,'../docs/multiempresa-20261026/configuracoes-suporte.png'),fullPage:true,animations:'disabled'});
 const supportSession=await page.evaluate(()=>localStorage.getItem('token'));await page.getByRole('button',{name:'Sair do suporte',exact:true}).click();await page.waitForURL(base+'/support');
 assert.equal((await page.request.get(base+'/api/settings',{headers:{Authorization:`Bearer ${supportSession}`}})).status(),401);
 assert.deepEqual(errors,[]);console.log('Navegador aprovado: empresa no login, ID oculto do cliente, suporte autenticado, ID visível somente no suporte, consulta sem edição, persistência e revogação ao sair.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exit(1)});
