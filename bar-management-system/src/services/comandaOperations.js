function createScopedModule() {
const {sequelize,Comanda,ComandaItem,Product,StockMovement,Table,CashRegister}=require('../models');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const quantity=value=>{const n=Number(value);if(!Number.isFinite(n)||n<=0||Math.abs(n*1000-Math.round(n*1000))>1e-6)throw fail('Quantidade positiva com até três casas decimais obrigatória');return n};
async function changeItem({comandaId,itemId,productId,amount,notes,userId,remove=false}){
 return sequelize.transaction(async transaction=>{
  const comanda=await Comanda.findByPk(comandaId,{transaction,lock:transaction.LOCK.UPDATE});
  if(!comanda)throw fail('Comanda não encontrada',404);
  if(comanda.status!=='aberta')throw fail('Comanda não está aberta');
  const item=itemId?await ComandaItem.findOne({where:{id:itemId,comandaId},transaction,lock:transaction.LOCK.UPDATE}):null;
  if(itemId&&!item)throw fail('Item não encontrado',404);
  const product=await Product.findByPk(item?.productId||productId,{transaction,lock:transaction.LOCK.UPDATE});
  if(!product||(!product.active&&!remove))throw fail('Produto não encontrado ou inativo');
  const next=remove?0:quantity(amount),old=Number(item?.quantity||0),difference=next-old;
  if(difference>Number(product.currentStock))throw fail('Estoque insuficiente');
  const price=Number(item?.priceAtSale??product.salePrice);
  const itemTotal=Math.round(next*price*100)/100,previousTotal=Number(item?.totalItemValue||0);
  await product.update({currentStock:Number(product.currentStock)-difference},{transaction});
  if(difference)await StockMovement.create({productId:product.id,userId,sourceComandaId:comandaId,type:difference>0?'saida':'entrada',quantity:Math.abs(difference),reason:difference>0?'sale':'return',notes:`Comanda ${comandaId}`},{transaction});
  await comanda.update({totalValue:Math.max(0,Number(comanda.totalValue)-previousTotal+itemTotal)},{transaction});
  if(remove){await item.destroy({transaction});return null;}
  if(item)return item.update({quantity:next,totalItemValue:itemTotal,notes:notes??item.notes},{transaction});
  return ComandaItem.create({comandaId,productId:product.id,quantity:next,priceAtSale:price,totalItemValue:itemTotal,notes},{transaction});
 });
}
async function close({id,tableId,userId,paymentMethod,paymentStatus='pago',discountValue=0,discountPercentage=0,notes}){
 if(!['dinheiro','pix','cartao_credito','cartao_debito','vale_refeicao'].includes(paymentMethod))throw fail('Forma de pagamento inválida');
 if(!['pago','pendente','nao_pago'].includes(paymentStatus))throw fail('Estado de pagamento inválido');
 discountValue=Number(discountValue);discountPercentage=Number(discountPercentage);
 if(!Number.isFinite(discountValue)||discountValue<0||!Number.isFinite(discountPercentage)||discountPercentage<0||discountPercentage>100)throw fail('Desconto inválido');
 return sequelize.transaction(async transaction=>{
  // Mesma ordem de bloqueio usada pelas vendas: caixa antes dos produtos/comandas.
  const cash=paymentStatus==='pago'?await CashRegister.findOne({where:{is_open:true},transaction,lock:transaction.LOCK.UPDATE}):null;
  if(paymentStatus==='pago'&&!cash)throw fail('Abra o caixa antes de receber o pagamento');
  const comanda=await Comanda.findOne({where:id?{id}:{tableId,status:'aberta'},transaction,lock:transaction.LOCK.UPDATE});
  if(!comanda)throw fail('Comanda não encontrada',404);
  if(comanda.status!=='aberta')throw fail('Comanda não está aberta');
  if(discountValue+Number(comanda.totalValue)*discountPercentage/100>Number(comanda.totalValue))throw fail('Desconto excede o total');
  await comanda.update({status:'fechada',closedAt:new Date(),closedByUserId:userId,paymentMethod,paymentStatus,discountValue,discountPercentage,notes,cashRegisterId:cash?.id||null},{transaction});
  if(comanda.tableId)await Table.update({status:'disponivel'},{where:{id:comanda.tableId},transaction});
  return comanda;
 });
}
return {changeItem,close,fail};

}
module.exports=require('../tenancy/scopedModule')(createScopedModule,["changeItem", "close", "fail"]);
