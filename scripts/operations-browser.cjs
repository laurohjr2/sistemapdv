const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
process.loadEnvFile(path.resolve(__dirname,'../.pdv-local/development.env'));
(async()=>{
 const base=process.env.PDV_WEB_URL||'http://127.0.0.1:5183';const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'pt-BR',reducedMotion:'reduce'});page.setDefaultTimeout(15000);page.on('dialog',dialog=>dialog.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(base+'/login');await page.getByLabel('Código da empresa',{exact:true}).fill(process.env.PDV_COMPANY||'demo');await page.getByLabel('Usuário',{exact:true}).fill('admin.dev');await page.getByLabel('Senha',{exact:true}).fill(process.env.DEV_ADMIN_PASSWORD);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(base+'/');
 const headers={Authorization:`Bearer ${await page.evaluate(()=>localStorage.getItem('token'))}`};
 const name=`Produto fluxo ${Date.now()}`;
 await page.goto(base+'/stock');await page.getByRole('button',{name:'Cadastrar Produto',exact:true}).click();
 let dialog=page.getByRole('dialog');await page.getByLabel('Nome do Produto *',{exact:true}).fill(name);
 await dialog.getByRole('combobox').first().click();await page.getByRole('option',{name:'Outros',exact:true}).click();
 await page.getByLabel('Preço de Venda *',{exact:true}).fill('10');
 const createResponse=page.waitForResponse(r=>r.url().endsWith('/api/products')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Cadastrar',exact:true}).click();const created=await createResponse;assert.equal(created.status(),201);const product=(await created.json()).product;
 await page.getByRole('button',{name:'Adicionar Estoque',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('combobox').click();await page.getByRole('option',{name:new RegExp(name)}).click();await page.getByLabel('Quantidade *',{exact:true}).fill('5');
 const stockResponse=page.waitForResponse(r=>r.url().endsWith('/api/stock/add')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Adicionar',exact:true}).click();assert.equal((await stockResponse).status(),201);
 await page.goto(base+'/products');const productRow=page.getByRole('row').filter({hasText:name});await productRow.waitFor();assert.ok((await productRow.innerText()).includes('5.000'));
 if(!(await(await page.request.get(base+'/api/cash-register/status',{headers})).json()).is_open)await page.request.post(base+'/api/cash-register/open',{headers,data:{opening_amount:0}});
 const comanda=(await(await page.request.post(base+'/api/comandas',{headers,data:{type:'balcao',customerName:'Teste cozinha navegador'}})).json()).comanda;
 const response=await page.request.post(base+`/api/comandas/${comanda.id}/items`,{headers,data:{productId:product.id,quantity:1}});assert.equal(response.status(),201);const item=(await response.json()).item;
 await page.goto(base+'/kitchen');
 for(const [button,status] of [['Iniciar','preparando'],['Finalizar','pronto'],['Entregar','entregue']]){
  const card=page.locator('[data-slot="card"]').filter({has:page.getByRole('heading',{name,exact:true})}).last();
  const update=page.waitForResponse(r=>r.url().endsWith(`/queue/items/${item.id}/status`)&&r.request().method()==='PUT');await card.getByRole('button',{name:button,exact:true}).click();assert.equal((await update).status(),200);
 }
 await page.goto(base+'/reports');await page.waitForLoadState('networkidle');
 for(const format of ['PDF','CSV']){const download=page.waitForEvent('download');await page.getByRole('button',{name:format,exact:true}).click();const file=await download;assert.equal(await file.failure(),null);const buffer=fs.readFileSync(await file.path());assert.ok(buffer.length>0);if(format==='PDF')assert.equal(buffer.subarray(0,4).toString(),'%PDF');}
 await page.screenshot({path:path.resolve(__dirname,'../docs/validacao-20261026/relatorios-fluxo.png'),fullPage:true,animations:'disabled'});
 await page.goto(base+'/print');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Gerar PDF de teste',exact:true}).click();const file=await download;assert.equal(fs.readFileSync(await file.path()).subarray(0,4).toString(),'%PDF');
 assert.deepEqual(errors,[]);
 console.log('Navegador aprovado: cadastro no estoque, entrada, saldo em Produtos, preparo até entrega na cozinha e downloads PDF/CSV e teste de impressão em PDF.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1)});
