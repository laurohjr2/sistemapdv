import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.PDV_API_URL || 'http://127.0.0.1:5174/api';
let token;
let checks = 0;
async function request(path, method='GET', data, expected=200) {
  const response = await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(15000)});
  const body = await response.json();
  if (expected !== null) assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(body)}`);
  checks++;
  return {status:response.status,body};
}
token=(await request('/auth/login','POST',{username:'admin.dev',password:process.env.DEV_ADMIN_PASSWORD})).body.token;
const stamp=Date.now();
let tableNumber=100000000+Math.floor(Math.random()*1000000000);
const newTable=async (capacity=4) => (await request('/tables','POST',{tableNumber:tableNumber++,capacity},201)).body.table;
const newClient=async (people=2) => (await request('/waiting-queue','POST',{clientName:`Fila ${stamp} ${randomUUID().slice(0,8)}`,clientPhone:'11999990000',numberOfPeople:people},201)).body.queueEntry;
const small=await newTable(1), table=await newTable();
const entry=await newClient();
await request('/waiting-queue','POST',{clientName:'  ',numberOfPeople:2},400);
await request('/waiting-queue','POST',{clientName:'Inválido',numberOfPeople:1.5},400);
await request(`/waiting-queue/${entry.id}/seat`,'PUT',{},400);
await request(`/waiting-queue/${entry.id}/seat`,'PUT',{tableId:small.id},409);
await request(`/waiting-queue/${entry.id}/seat`,'PUT',{tableId:randomUUID()},404);
assert.equal((await request(`/tables/${small.id}`)).body.status,'disponivel');
assert.ok((await request('/waiting-queue')).body.some(e=>e.id===entry.id && !e.comandaId));
const {body:seated}=await request(`/waiting-queue/${entry.id}/seat`,'PUT',{tableId:table.id});
assert.equal(seated.comanda.customerName,entry.clientName);
assert.equal(seated.comanda.customerPhone,entry.clientPhone);
assert.equal(seated.comanda.deliveryType,'mesa');
assert.equal(seated.queueEntry.tableId,table.id);
assert.equal(seated.queueEntry.comandaId,seated.comanda.id);
assert.equal((await request(`/tables/${table.id}`)).body.status,'ocupada');
await request(`/waiting-queue/${entry.id}/seat`,'PUT',{tableId:small.id},409);
await request(`/waiting-queue/${entry.id}/cancel`,'PUT',{},409);
await request(`/tables/${table.id}/open-comanda`,'POST',{},409);
await request('/comandas','POST',{tableId:table.id},409);
await request(`/comandas/${seated.comanda.id}/close`,'PUT',{paymentMethod:'pix'});
assert.equal((await request(`/tables/${table.id}`)).body.status,'disponivel');
// Dois atendentes disputando a mesma mesa: somente um acomoda.
const a=await newClient(), b=await newClient();
const race=await Promise.all([a,b].map(client=>request(`/waiting-queue/${client.id}/seat`,'PUT',{tableId:table.id},null)));
assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
const winner=race.find(r=>r.status===200).body;
const loser=race[0].status===409?a:b;
assert.ok((await request('/waiting-queue')).body.some(e=>e.id===loser.id && !e.comandaId));
assert.equal((await request(`/tables/${table.id}`)).body.comandas.length,1);
await request(`/comandas/${winner.comanda.id}/close`,'PUT',{paymentMethod:'pix'});
// Um mesmo grupo disputando duas mesas: somente uma comanda é criada.
const other=await newTable();
const sameClient=await Promise.all([table,other].map(t=>request(`/waiting-queue/${loser.id}/seat`,'PUT',{tableId:t.id},null)));
assert.deepEqual(sameClient.map(r=>r.status).sort(),[200,409]);
await request(`/comandas/${sameClient.find(r=>r.status===200).body.comanda.id}/close`,'PUT',{paymentMethod:'pix'});
// Abrir mesa diretamente disputa o mesmo bloqueio usado pela fila.
const c=await newClient();
const mixed=await Promise.all([
 request(`/waiting-queue/${c.id}/seat`,'PUT',{tableId:table.id},null),
 request('/comandas','POST',{tableId:table.id},null)
]);
assert.equal(mixed.filter(r=>[200,201].includes(r.status)).length,1);
assert.equal(mixed.filter(r=>r.status===409).length,1);
await request(`/comandas/${mixed.find(r=>[200,201].includes(r.status)).body.comanda.id}/close`,'PUT',{paymentMethod:'pix'});
if (mixed[0].status===409) await request(`/waiting-queue/${c.id}/cancel`,'PUT');
assert.ok((await request('/waiting-queue?status=sentado')).body.some(e=>e.id===entry.id && e.comandaId===seated.comanda.id));
console.log(`${checks} verificações HTTP aprovadas: fila → mesa → comanda, capacidade, histórico, falhas sem alteração e disputas simultâneas.`);
