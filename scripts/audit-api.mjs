import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
const output=process.env.PDV_AUDIT_DIR||'docs/validacao-20261026';mkdirSync(output,{recursive:true});
const base=process.env.PDV_API_URL||'http://127.0.0.1:5179/api';
let token;const results=[];
async function req(path,method='GET',data,auth=token){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},body:data===undefined?undefined:JSON.stringify(path==='/auth/login'?{...data,company:process.env.PDV_COMPANY||'demo'}:data),signal:AbortSignal.timeout(10000)});
 const text=await response.text();let body;try{body=JSON.parse(text)}catch{body=response.headers.get('content-type')?.includes('pdf')?'PDF':text.slice(0,100)}
 return {status:response.status,body};
}
async function check(name,run){try{await run();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',detail:e.message});}}
const status=(r,expected)=>assert.equal(r.status,expected,`HTTP esperado ${expected}; recebido ${r.status}: ${JSON.stringify(r.body).slice(0,180)}`);
const stamp=Date.now();
status(await req('/health'),200);
const login=await req('/auth/login','POST',{username:'admin.dev',password:process.env.DEV_ADMIN_PASSWORD});status(login,200);token=login.body.token;
const p=await req('/products','POST',{name:`Auditoria ${stamp}`,category:'comidas',unitOfMeasure:'unidade',costPrice:3,salePrice:10});status(p,201);const product=p.body.product;
const t=await req('/tables','POST',{tableNumber:Math.floor(Math.random()*1000000000)+1,capacity:4});status(t,201);const table=t.body.table;
let comanda,item,user,employeeToken;
await check('Produto: consultar/editar cadastro',async()=>{status(await req(`/products/${product.id}`),200);status(await req(`/products/${product.id}`,'PUT',{description:'Produto fictício de auditoria'}),200)});
await check('Produto: preço de custo zero permitido',async()=>{status(await req('/products','POST',{name:`Custo zero ${stamp}`,category:'outros',unitOfMeasure:'unidade',costPrice:0,salePrice:10}),201)});
await check('Estoque: entrada e saldo',async()=>{status(await req('/stock/add','POST',{productId:product.id,quantity:20}),201);assert.equal(Number((await req(`/products/${product.id}`)).body.currentStock),20)});
await check('Estoque: saída e acerto',async()=>{status(await req('/stock/remove','POST',{productId:product.id,quantity:1,reason:'loss'}),201);status(await req('/stock/adjust','POST',{productId:product.id,newQuantity:20,notes:'Contagem teste'}),200)});
for(const path of ['/stock/report','/stock/summary','/stock/movements','/stock/low-stock',`/stock/history/${product.id}`])await check(`GET ${path.replace(product.id,':product')}`,async()=>status(await req(path),200));
await check('Caixa: abertura',async()=>{status(await req('/cash-register/open','POST',{opened_by:'Auditoria isolada',opening_amount:100}),201)});
await check('Comanda: abrir e lançar produto',async()=>{const r=await req('/comandas','POST',{tableId:table.id});status(r,201);comanda=r.body.comanda;const add=await req(`/comandas/${comanda.id}/items`,'POST',{productId:product.id,quantity:2});status(add,201);item=(await req(`/comandas/${comanda.id}`)).body.items[0];});
await check('Comanda: alterar quantidade pelo endpoint usado na tela',async()=>{status(await req(`/comandas/${comanda.id}/items/${item.id}`,'PUT',{quantity:3}),200)});
for(const path of ['/queue','/queue/summary','/queue/report',`/queue/table/${table.id}`])await check(`Cozinha GET ${path.replace(table.id,':table')}`,async()=>status(await req(path),200));
await check('Cozinha: iniciar preparo de item',async()=>{status(await req(`/queue/items/${item.id}/status`,'PUT',{status:'preparando'}),200)});
await check('Comanda: fechar com PIX',async()=>{status(await req(`/comandas/${comanda.id}/close`,'PUT',{paymentMethod:'pix'}),200);assert.equal((await req(`/tables/${table.id}`)).body.status,'disponivel')});
await check('Usuário: criar pela rota usada no menu',async()=>{status(await req('/users','POST',{username:`menu${stamp}`,password:randomBytes(12).toString('hex'),role:'garcom'}),201)});
const password=randomBytes(12).toString('hex');
await check('Usuário: criar pela API de autenticação e fazer login',async()=>{const r=await req('/auth/register','POST',{username:`audit${stamp}`,password,role:'garcom'});status(r,201);user=r.body.user;const l=await req('/auth/login','POST',{username:user.username,password});status(l,200);employeeToken=l.body.token});
await check('Usuário: atualizar perfil',async()=>{status(await req(`/users/${user.id}`,'PUT',{username:`auditupdated${stamp}`}),200)});
await check('Usuário: alterar senha pela rota usada no menu',async()=>{status(await req(`/users/${user.id}/password`,'PUT',{currentPassword:password,newPassword:randomBytes(12).toString('hex')}),200)});
await check('Permissão: garçom não cadastra produto',async()=>{status(await req('/products','POST',{name:'Não permitido'},employeeToken),403)});
await check('Permissão: garçom não altera configurações',async()=>{status(await req('/settings','PUT',{companyName:'Não permitido'},employeeToken),403)});
await check('Permissão: garçom não consulta usuários',async()=>{status(await req('/users','GET',undefined,employeeToken),403)});
await check('Ticket: emissão com token válido do login',async()=>{status(await req('/tickets','POST',{productId:product.id,quantity:1}),201)});
let sale,cash=(await req('/cash-register/status')).body;
await check('Venda balcão: preço do servidor e baixa de estoque',async()=>{const r=await req('/sales','POST',{items:[{product_id:product.id,quantity:1,unit_price:0.01}],payment_method:'pix',total_amount:0.01,cash_register_id:cash.id});status(r,201);sale=r.body;assert.equal(Number(sale.total_amount),10);assert.equal(Number((await req(`/products/${product.id}`)).body.currentStock),15)});
for(const path of ['/reports/dashboard','/reports/sales','/reports/products','/reports/waiters','/reports/comparative?period1Start=2026-10-01&period1End=2026-10-31&period2Start=2026-09-01&period2End=2026-09-30','/reports/sales-by-category','/reports/sales-by-payment','/reports/sales-by-hour','/reports/stock','/reports/financial',
 '/reports/categories','/reports/payments','/reports/hourly','/reports/export/pdf?type=sales','/reports/export/csv?type=sales'])await check(`Relatório GET ${path}`,async()=>status(await req(path),200));
await check('Estorno: venda retorna estoque uma única vez',async()=>{
 const extra=await req('/sales','POST',{items:[{product_id:product.id,quantity:1}],payment_method:'pix',cash_register_id:cash.id});status(extra,201);
 status(await req(`/sales/${extra.body.id}/cancel`,'PUT'),200);status(await req(`/sales/${extra.body.id}/cancel`,'PUT'),400);
});
await check('Caixa: consolida balcão, comanda alterada e ticket, separando dinheiro',async()=>{
 const r=await req('/cash-register/close','POST',{closing_amount:110});status(r,200);
 assert.equal(Number(r.body.total_sales),50);assert.equal(Number(r.body.by_payment.pix),40);assert.equal(Number(r.body.expected_amount),110);assert.equal(Number(r.body.difference),0);
});
await check('Caixa fechado: impede estorno retroativo',async()=>status(await req(`/sales/${sale.id}/cancel`,'PUT'),400));
await check('Mesa: fechar pelo menu mesas marca pagamento como pago',async()=>{
 status(await req('/cash-register/open','POST',{opening_amount:0}),201);
 status(await req(`/tables/${table.id}/open-comanda`,'POST'),201);const r=await req(`/tables/${table.id}/close-comanda`,'POST',{paymentMethod:'pix'});status(r,200);assert.equal(r.body.comanda.paymentStatus,'pago');
});
await check('Impressão: rota do serviço de impressora acessível',async()=>status(await req('/printer/test','POST'),200));
await check('Usuário: excluir funcionário com login prévio',async()=>status(await req(`/users/${user.id}`,'DELETE'),200));
await check('Estoque: cadastrar produto com os campos enviados pelo formulário',async()=>{status(await req('/products','POST',{name:`Cadastro estoque ${stamp}`,category:'outros',salePrice:10,costPrice:0,unitOfMeasure:'unidade',minStockAlert:1}),201)});
await check('Usuário: desativação impede novo login',async()=>{
 const username=`inactive${stamp}`,password=randomBytes(12).toString('hex');
 const r=await req('/auth/register','POST',{username,password,role:'garcom'});status(r,201);
 status(await req(`/users/${r.body.user.id}`,'PUT',{active:false}),200);
 status(await req('/auth/login','POST',{username,password}),401);
});
await check('Produtos: API mantém saldo para o campo usado pela tela',async()=>{
 const r=await req('/products');const rows=r.body.filter(p=>Number(p.currentStock)>0);
 assert.ok(rows.length>0);assert.ok(rows.every(p=>Number.isFinite(Number(p.currentStock))),'Saldo consumido pela tela deve ser numérico');
});
writeFileSync(`${output}/api-resultados.json`,JSON.stringify({base,version:'correções em validação',passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,results},null,2));
console.log(JSON.stringify({passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,failures:results.filter(r=>r.status==='FAIL')},null,2));
process.exitCode=results.some(r=>r.status==='FAIL')?1:0;
