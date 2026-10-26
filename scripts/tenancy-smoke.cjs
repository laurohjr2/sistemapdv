const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
process.loadEnvFile(path.resolve(__dirname,'../.pdv-local/development.env'));
const {provisionTenant}=require('../bar-management-system/src/tenancy/provision');
const {platform,readConfig,connection}=require('../bar-management-system/src/tenancy/platform');const build=require('../bar-management-system/src/models/build');
const base=process.env.PDV_API_URL||'http://127.0.0.1:5187/api';let checks=0;
async function request(url,method='GET',body,token,status=200,headers={}){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...headers,...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text.slice(0,80)}assert.equal(r.status,status,`${method} ${url}: HTTP ${r.status} ${JSON.stringify(data)}`);checks++;return data;}
(async()=>{
 const stamp=Date.now(),password=crypto.randomBytes(18).toString('hex'),alpha=`alpha-${stamp}`,beta=`beta-${stamp}`;
 const a=await provisionTenant({slug:alpha,name:'Empresa Alfa — teste',adminUsername:'admin.dev',adminPassword:password});
 const b=await provisionTenant({slug:beta,name:'Empresa Beta — teste',adminUsername:'admin.dev',adminPassword:password});assert.notEqual(a.id,b.id);
 const central=platform(readConfig());const configs=readConfig();const ta=await central.Tenant.findByPk(a.id),tb=await central.Tenant.findByPk(b.id);
 const ca=configs.connections[ta.connectionKey],cb=configs.connections[tb.connectionKey];assert.notEqual(ca.database,cb.database);assert.notEqual(ca.username,cb.username);
 const da=connection(ca),db=connection(cb);const sameUserId=crypto.randomUUID();
 try{
  for(const sequelize of [da,db])await build(sequelize).User.create({id:sameUserId,username:'same.user',passwordHash:password,role:'admin'});
  const [[qa]]=await da.query('SELECT current_database() AS name,current_user AS role');const [[qb]]=await db.query('SELECT current_database() AS name,current_user AS role');assert.notEqual(qa.name,qb.name);assert.notEqual(qa.role,qb.role);checks+=2;
  for(const target of [cb.database,configs.central.database]){const denied=connection({...ca,database:target});try{await assert.rejects(()=>denied.authenticate(),e=>e.parent?.code==='42501');checks++;}finally{await denied.close()}}
  await request('/auth/login','POST',{username:'same.user',password},null,400);
  await request('/auth/login','POST',{company:'nao-existe',username:'same.user',password},null,401);
  const la=await request('/auth/login','POST',{company:alpha,username:'same.user',password});const lb=await request('/auth/login','POST',{company:beta,username:'same.user',password});
  const tokenA=la.token,tokenB=lb.token;assert.equal(la.user.id,lb.user.id);
  const payload=JSON.parse(Buffer.from(tokenA.split('.')[1],'base64url'));assert.equal(payload.company,alpha);assert.ok(!JSON.stringify(payload).includes(a.id));
  const modified=tokenA.split('.');payload.company=beta;modified[1]=Buffer.from(JSON.stringify(payload)).toString('base64url');await request('/products','GET',undefined,modified.join('.'),401);
  await request('/products','GET',undefined,null,401);
  const pa=(await request('/products','POST',{name:'Produto exclusivo Alfa',category:'outros',unitOfMeasure:'unidade',costPrice:1,salePrice:10},tokenA,201)).product;
  const pb=(await request('/products','POST',{name:'Produto exclusivo Beta',category:'outros',unitOfMeasure:'unidade',costPrice:2,salePrice:20},tokenB,201)).product;
  await request(`/products/${pb.id}`,'GET',undefined,tokenA,404);await request(`/products/${pa.id}`,'GET',undefined,tokenB,404);
  await request(`/products/${pb.id}`,'PUT',{name:'Tentativa cruzada'},tokenA,404);
  await request('/stock/add','POST',{productId:pb.id,quantity:1},tokenA,404);
  const concurrent=await Promise.all(Array.from({length:24},(_,i)=>request(`/products?company=${i%2?alpha:beta}`,'GET',undefined,i%2?tokenB:tokenA,200,{'X-Tenant-ID':i%2?a.id:b.id})));
  concurrent.forEach((rows,i)=>assert.deepEqual(rows.map(p=>p.name),[i%2?'Produto exclusivo Beta':'Produto exclusivo Alfa']));
  await request('/settings','PUT',{companyName:'Marca Alfa',clientId:b.id},tokenA);assert.equal((await request('/settings','GET',undefined,tokenB)).companyName,'Empresa Beta — teste');
  assert.equal((await request(`/settings/branding?company=${alpha}`)).companyName,'Marca Alfa');
  for(const token of [tokenA,tokenB]){const settings=await request('/settings','GET',undefined,token);assert.ok(!JSON.stringify(settings).includes(a.id));assert.ok(!JSON.stringify(settings).includes(b.id));await request('/support/company-info','GET',undefined,token,403);await request('/support/companies','GET',undefined,token,401);}
  const support=await request('/support/login','POST',{username:'support.dev',password:process.env.DEV_SUPPORT_PASSWORD});
  const companies=await request('/support/companies','GET',undefined,support.token);assert.ok(companies.some(c=>c.id===a.id));assert.ok(companies.every(c=>!('connectionKey' in c)));
  const session=await request('/support/sessions','POST',{company:alpha},support.token);assert.equal(session.user.support,true);
  assert.equal((await request('/support/company-info','GET',undefined,session.token)).clientId,a.id);
  await request('/settings','PUT',{companyName:'Alteração não autorizada'},session.token,403);
  await request('/products','GET',undefined,support.token,401);
  await central.Tenant.update({status:'suspended'},{where:{id:a.id}});
  await request('/products','GET',undefined,tokenA,403);await request('/auth/login','POST',{company:alpha,username:'same.user',password},null,403);
  await request('/products','GET',undefined,tokenB);
  assert.equal((await request('/support/company-info','GET',undefined,session.token)).clientId,a.id);
  await request('/support/session/end','POST',{},session.token,204);await request('/settings','GET',undefined,session.token,401);
  await central.Tenant.update({status:'active'},{where:{id:a.id}});await request('/products','GET',undefined,tokenA);
  assert.ok(await central.SupportAudit.count({where:{tenantId:a.id}})>=3);
  const stable=await provisionTenant({slug:alpha,name:'Não altera identidade',adminUsername:'admin.dev',adminPassword:password});assert.equal(stable.id,a.id);checks++;
  const report={passed:checks,failed:0,coverage:['bancos e credenciais diferentes','CONNECT cruzado e central recusado pelo PostgreSQL','usuários com o mesmo UUID nos dois bancos','JWT adulterado recusado','24 requisições concorrentes','cabeçalhos e parâmetros não trocam o banco','leituras e escritas cruzadas recusadas','configurações separadas','ID ausente para clientes e visível só ao suporte','sessão suporte somente consulta e revogável','suspensão afeta somente a empresa correta','auditoria central','ID estável após reprovisionamento']};
  fs.writeFileSync(path.resolve(__dirname,'../docs/multiempresa-20261026/isolamento.json'),JSON.stringify(report,null,2));console.log(`${checks} verificações aprovadas: isolamento de bancos, suporte, ID protegido e suspensão.`);
 }finally{await da.close();await db.close();await central.sequelize.close()}
})().catch(error=>{console.error(error.message);process.exit(1)});
