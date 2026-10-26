const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
process.loadEnvFile(path.resolve(__dirname,'../.pdv-local/development.env'));
(async()=>{
 const base=process.env.PDV_WEB_URL||'http://127.0.0.1:5178';
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1200},reducedMotion:'reduce'});page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let original,headers;
 try{
  await page.goto(base+'/login');
  await page.getByLabel('Código da empresa',{exact:true}).fill(process.env.PDV_COMPANY||'demo');await page.getByLabel('Usuário',{exact:true}).fill('admin.dev');await page.getByLabel('Senha',{exact:true}).fill(process.env.DEV_ADMIN_PASSWORD);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(base+'/');
  headers={Authorization:`Bearer ${await page.evaluate(()=>localStorage.getItem('token'))}`};
  original=await (await page.request.get(base+'/api/settings',{headers})).json();
  await page.getByRole('link',{name:'Configurações',exact:true}).click();
  await page.getByLabel('Nome da empresa *',{exact:true}).fill('Bistrô da Praça');
  await page.getByLabel('Razão social',{exact:true}).fill('Empresa Demonstração Ltda');
  await page.getByLabel('CNPJ',{exact:true}).fill('11.222.333/0001-81');
  await page.getByLabel('Telefone',{exact:true}).fill('(11) 3333-4444');
  await page.getByLabel('E-mail',{exact:true}).fill('contato@example.com');
  await page.getByLabel('Endereço e número',{exact:true}).fill('Rua de Demonstração, 100');
  await page.getByLabel('Cidade',{exact:true}).fill('São Paulo');
  await page.getByLabel('UF',{exact:true}).fill('SP');
  await page.getByLabel('CEP',{exact:true}).fill('01001-000');
  await page.getByLabel('Mensagem de agradecimento',{exact:true}).fill('Obrigado pela visita. Volte sempre!');
  await page.getByLabel('Logo da empresa',{exact:true}).setInputFiles(path.resolve(__dirname,'fixtures/logo.png'));
  await page.getByRole('img',{name:'Prévia da logo',exact:true}).waitFor();
  await page.getByRole('button',{name:'Salvar configurações',exact:true}).click();
  await page.getByText('Configurações salvas. A identidade da empresa já foi atualizada no sistema.',{exact:true}).waitFor();
  await page.reload();await page.getByLabel('Nome da empresa *',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Nome da empresa *',{exact:true}).inputValue(),'Bistrô da Praça');
  await page.getByRole('img',{name:'Logo de Bistrô da Praça',exact:true}).last().waitFor({state:'visible'});
  await page.screenshot({path:path.resolve(__dirname,'../docs/images/configuracoes.png'),fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  await page.getByRole('button',{name:'Remover logo',exact:true}).click();
  await page.getByRole('button',{name:'Salvar configurações',exact:true}).click();
  await page.getByText('Configurações salvas. A identidade da empresa já foi atualizada no sistema.',{exact:true}).waitFor();
  assert.equal((await (await page.request.get(base+'/api/settings',{headers})).json()).logo,null);
  assert.deepEqual(errors,[]);
  console.log('Navegador aprovado: menu Configurações, cadastro, upload, logo no cabeçalho, persistência após recarregar, remoção e layout móvel.');
 }finally{
  if(original){const keys=['companyName','legalName','cnpj','phone','email','address','city','state','postalCode','receiptMessage','logo'];await page.request.put(base+'/api/settings',{headers,data:Object.fromEntries(keys.map(key=>[key,original[key]]))});}
  await browser.close();
 }
})().catch(error=>{console.error(error.message);process.exit(1)});
