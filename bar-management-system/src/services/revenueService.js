const {Sale,SaleItem,Comanda,ComandaItem,Product,User}=require('../models');
const {Op}=require('sequelize');
const money=n=>Math.round(Number(n)*100)/100;
async function revenue({startDate,endDate,cashRegisterId,transaction}={}){
 const range={};
 for(const [key,value] of [[Op.gte,startDate],[Op.lte,endDate]])if(value){const date=new Date(value);if(Number.isNaN(date.getTime()))throw Object.assign(new Error('Data inválida'),{status:400});range[key]=date;}
 const s={status:'completed'},c={status:'fechada',paymentStatus:'pago'};
 if(Object.getOwnPropertySymbols(range).length){s.created_at=range;c.closedAt=range;}
 if(cashRegisterId!==undefined){s.cash_register_id=cashRegisterId;c.cashRegisterId=cashRegisterId;}
 const includeProduct={model:Product,as:'product'};
 const sales=await Sale.findAll({where:s,include:[{model:SaleItem,as:'items',include:[includeProduct]}],transaction});
 const comandas=await Comanda.findAll({where:c,include:[{model:ComandaItem,as:'items',include:[includeProduct]}],transaction});
 const users=await User.findAll({paranoid:false,transaction});const names=new Map(users.map(u=>[u.id,u.username]));
 return [...sales.map(s=>({id:`venda-${s.id}`,origin:'balcao',date:s.created_at,user:names.get(s.user_id)||'Usuário',paymentMethod:s.payment_method,total:money(s.total_amount),items:s.items.map(i=>({name:i.product?.name||'Produto',category:i.product?.category||'outros',quantity:Number(i.quantity),revenue:money(i.total_price)}))})),
 ...comandas.map(c=>{const ratio=Number(c.totalValue)?Number(c.finalValue)/Number(c.totalValue):0;return {id:`comanda-${c.id}`,origin:c.type,date:c.closedAt,user:names.get(c.closedByUserId||c.openedByUserId)||'Usuário',paymentMethod:c.paymentMethod,total:money(c.finalValue),items:c.items.map(i=>({name:i.product?.name||'Produto',category:i.product?.category||'outros',quantity:Number(i.quantity),revenue:money(Number(i.totalItemValue)*ratio)}))};})];
}
function summary(rows){
 const byPayment={};for(const row of rows)byPayment[row.paymentMethod]=money((byPayment[row.paymentMethod]||0)+row.total);
 const totalRevenue=money(rows.reduce((n,r)=>n+r.total,0));return {totalRevenue,totalSales:rows.length,averageTicket:rows.length?money(totalRevenue/rows.length):0,byPayment,cashRevenue:byPayment.dinheiro||0};
}
module.exports={revenue,summary,money};
