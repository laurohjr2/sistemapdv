function createScopedModule() {
const {sequelize,Ticket,Product,CashRegister,Sale,SaleItem,StockMovement}=require('../models');
const {randomUUID}=require('node:crypto');
const fail=m=>Object.assign(new Error(m),{status:400});
const handler=fn=>async(req,res,next)=>{try{await fn(req,res)}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}};
const createTicket=handler(async(req,res)=>{
 const amount=Number(req.body.quantity??1);if(!Number.isFinite(amount)||amount<=0||Math.abs(amount*1000-Math.round(amount*1000))>1e-6)throw fail('Quantidade inválida');
 const method=req.body.paymentMethod||'dinheiro';if(!['dinheiro','pix','cartao_credito','cartao_debito'].includes(method))throw fail('Pagamento inválido');
 const ticket=await sequelize.transaction(async transaction=>{
  const cash=await CashRegister.findOne({where:{is_open:true},transaction,lock:transaction.LOCK.UPDATE});if(!cash)throw fail('Abra o caixa antes de emitir tickets');
  const product=await Product.findByPk(req.body.productId,{transaction,lock:transaction.LOCK.UPDATE});if(!product?.active||Number(product.currentStock)<amount)throw fail('Produto indisponível ou estoque insuficiente');
  const price=Number(product.salePrice),total=Math.round(price*amount*100)/100;
  const sale=await Sale.create({user_id:req.user.id,cash_register_id:cash.id,total_amount:total,payment_method:method},{transaction});
  await SaleItem.create({sale_id:sale.id,product_id:product.id,quantity:amount,unit_price:price,total_price:total},{transaction});
  await product.update({currentStock:Number(product.currentStock)-amount},{transaction});
  await StockMovement.create({productId:product.id,userId:req.user.id,type:'saida',quantity:amount,reason:'sale',notes:`Ticket da venda ${sale.id}`},{transaction});
  return Ticket.create({ticket_number:`TK${randomUUID().replaceAll('-','').slice(0,20).toUpperCase()}`,product_id:product.id,sale_id:sale.id,quantity:amount,unit_price:price,total_amount:total,issued_by:req.user.username,customer_name:req.body.customerName,notes:req.body.notes,expires_at:new Date(Date.now()+86400000)},{transaction});
 });res.status(201).json(ticket);
});
const getTickets=handler(async(req,res)=>{const page=Math.max(1,parseInt(req.query.page)||1),limit=Math.min(100,Math.max(1,parseInt(req.query.limit)||50));const {rows,count}=await Ticket.findAndCountAll({where:req.query.status?{status:req.query.status}:{},include:[{model:Product,as:'product'}],order:[['issued_at','DESC']],limit,offset:(page-1)*limit});res.json({tickets:rows,total:count,page,totalPages:Math.ceil(count/limit)})});
const getTicketByNumber=handler(async(req,res)=>{const t=await Ticket.findOne({where:{ticket_number:req.params.ticketNumber},include:[{model:Product,as:'product'}]});if(!t)return res.sendStatus(404);res.json(t)});
const redeemTicket=handler(async(req,res)=>{
 const ticket=await sequelize.transaction(async transaction=>{
  const t=await Ticket.findOne({where:{ticket_number:req.params.ticketNumber},transaction,lock:transaction.LOCK.UPDATE});
  if(!t||t.status!=='pending'||(t.expires_at&&new Date()>t.expires_at))throw fail('Ticket indisponível ou expirado');
  return t.update({status:'redeemed',redeemed_by:req.user.username,redeemed_at:new Date()},{transaction});
 });res.json({ticket});
});
const cancelTicket=handler(async(req,res)=>{
 const snapshot=await Ticket.findOne({where:{ticket_number:req.params.ticketNumber}});if(!snapshot)throw fail('Ticket não encontrado');
 const ticket=await sequelize.transaction(async transaction=>{
  const sale=snapshot.sale_id?await Sale.findByPk(snapshot.sale_id,{transaction}):null;
  if(!sale)throw fail('Ticket legado: requer conferência manual do caixa antes de estornar');
  const cash=await CashRegister.findByPk(sale.cash_register_id,{transaction,lock:transaction.LOCK.UPDATE});if(!cash?.is_open)throw fail('O caixa desta venda já foi fechado');
  const t=await Ticket.findByPk(snapshot.id,{transaction,lock:transaction.LOCK.UPDATE});if(t.status!=='pending')throw fail('Ticket já utilizado ou cancelado');
  const p=await Product.findByPk(t.product_id,{transaction,lock:transaction.LOCK.UPDATE});await p.update({currentStock:Number(p.currentStock)+Number(t.quantity)},{transaction});
  await StockMovement.create({productId:p.id,userId:req.user.id,type:'entrada',quantity:t.quantity,reason:'return',notes:`Cancelamento de ticket ${t.ticket_number}`},{transaction});
  await sale.update({status:'cancelled'},{transaction});return t.update({status:'cancelled'},{transaction});
 });res.json({ticket});
});
return {createTicket,getTickets,getTicketByNumber,redeemTicket,cancelTicket};

}
module.exports=require('../tenancy/scopedModule')(createScopedModule,["createTicket", "getTickets", "getTicketByNumber", "redeemTicket", "cancelTicket"]);
