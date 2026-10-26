import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const base=process.env.PDV_API_URL||'http://127.0.0.1:5177/api';
let token,checks=0;
async function request(path,method='GET',data,status=200,auth=token){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},body:data===undefined?undefined:JSON.stringify(path==='/auth/login'?{...data,company:process.env.PDV_COMPANY||'demo'}:data),signal:AbortSignal.timeout(15000)});
 const body=await response.json();assert.equal(response.status,status,`${method} ${path}: ${JSON.stringify(body)}`);checks++;return body;
}
await request('/settings','GET',undefined,401);
const branding=await request(`/settings/branding?company=${encodeURIComponent(process.env.PDV_COMPANY||'demo')}`);assert.deepEqual(Object.keys(branding).sort(),['companyName','logo']);
token=(await request('/auth/login','POST',{username:'admin.dev',password:process.env.DEV_ADMIN_PASSWORD})).token;
const original=await request('/settings');
const keys=['companyName','legalName','cnpj','phone','email','address','city','state','postalCode','receiptMessage','logo'];
try{
 const profile={companyName:'Lanchonete de Teste',legalName:'Empresa Demonstração Ltda',cnpj:'11.222.333/0001-81',phone:'(11) 3333-4444',email:'contato@example.com',address:'Rua de Demonstração, 100',city:'São Paulo',state:'sp',postalCode:'01001-000',receiptMessage:'Volte sempre!',logo:null};
 const saved=await request('/settings','PUT',profile);
 assert.equal(saved.cnpj,'11222333000181');assert.equal(saved.state,'SP');assert.equal(saved.postalCode,'01001000');
 assert.equal((await request('/settings')).companyName,profile.companyName);
 await request('/settings','PUT',{companyName:''},400);
 await request('/settings','PUT',{cnpj:'11111111111111'},400);
 await request('/settings','PUT',{email:'invalido'},400);
 await request('/settings','PUT',{state:'ZZ'},400);
 await request('/settings','PUT',{logo:'data:image/svg+xml;base64,PHN2Zz4='},400);
 await request('/settings','PUT',{logo:'data:image/png;base64,aW52YWxpZG8='},400);
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFUlEQVR4nGNgCNAgDY1qGNUwfDUAAKXJeAHRLEfzAAAAAElFTkSuQmCC';
 await request('/settings','PUT',{logo:png});
 const partial=await request('/settings');assert.equal(partial.companyName,profile.companyName);assert.equal(partial.logo,png);
 const {comanda}=await request('/comandas','POST',{type:'balcao',customerName:'Teste configurações'},201);
 const pdf=await fetch(base+`/print/comanda/${comanda.id}`,{headers:{Authorization:`Bearer ${token}`}});
 assert.equal(pdf.status,200);checks++;
 const text=execFileSync('pdftotext',['-','-'],{input:Buffer.from(await pdf.arrayBuffer())}).toString();
 assert.ok(text.includes(profile.companyName));assert.ok(text.includes('11222333000181'));assert.ok(text.includes(profile.receiptMessage));
 await request('/settings','PUT',{logo:null});
 assert.equal((await request('/settings')).logo,null);
 for(const role of ['garcom','gerente']){
  const username=`settings.${role}.${Date.now()}`,password=randomBytes(18).toString('hex');
  await request('/auth/register','POST',{username,password,role},201);
  const employee=(await request('/auth/login','POST',{username,password})).token;
  await request('/settings','PUT',{companyName:'Não permitido'},403,employee);
  assert.equal((await request('/settings','GET',undefined,200,employee)).companyName,profile.companyName);
 }
 assert.equal((await request('/settings')).companyName,profile.companyName);
 console.log(`${checks} verificações HTTP aprovadas: cadastro, persistência, CNPJ, campos inválidos, logo, edição parcial, remoção e permissões.`);
} finally {await request('/settings','PUT',Object.fromEntries(keys.map(key=>[key,original[key]])));}
