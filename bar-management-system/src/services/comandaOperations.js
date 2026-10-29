function createScopedModule() {
const {sequelize,Comanda,ComandaItem,Product,StockMovement,Table,CashRegister}=require('../models');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const quantity=value=>{const n=Number(value);if(!Number.isFinite(n)||n<=0||Math.abs(n*1000-Math.round(n*1000))>1e-6)throw fail('Quantidade positiva com até três casas decimais obrigatória');return n};
async function changeItem({comandaId,itemId,productId,amount,notes,userId,pizza,expectedUnitPrice,restoreIngredients=false,role,remove=false,bundleSnapshot,transactionContext,lockedInventory,bundleGroupRemoval=false}){
 const perform=async transaction=>{
  await sequelize.query("SELECT pg_advisory_xact_lock(882021)",{transaction});
  const comanda=await Comanda.findByPk(comandaId,{transaction,lock:transaction.LOCK.UPDATE});
  if(!comanda)throw fail('Comanda não encontrada',404);
  if(comanda.status!=='aberta')throw fail('Comanda não está aberta');
  const item=itemId?await ComandaItem.findOne({where:{id:itemId,comandaId},transaction,lock:transaction.LOCK.UPDATE}):null;
  if(itemId&&!item)throw fail('Item não encontrado',404);
  if(item?.bundle&&!bundleGroupRemoval)throw fail('Remova o combo completo ou adicione um novo grupo para alterar sua quantidade.');
  const resolved=!item&&pizza?await require('./pizzaOperations').resolve(pizza,transaction):null;
  if(resolved&&expectedUnitPrice!==undefined&&require('./commercialValidation').cents(expectedUnitPrice)!==require('./commercialValidation').cents(resolved.unitPrice))throw fail('O preço da pizza mudou. Monte novamente para confirmar o valor atual.',409);
  if(!item&&!resolved&&require('../config/businessProfiles').effectiveModules(await require('./businessSettingsService').getSettings(transaction)).pizza&&(await require('./pizzaOperations').baseIds(transaction)).has(productId))throw fail('Use Montar pizza para escolher os sabores deste produto');
  if(resolved&&productId&&resolved.productId!==productId)throw fail('Produto-base divergente da montagem');
  const recipeOps=require('./recipeOperations'),target=String(item?.productId||resolved?.productId||productId).toLowerCase();
  const inventory=lockedInventory||await recipeOps.lockProducts([target],transaction,item?{[target]:item.recipe?.plan||null}:{});
  const product=inventory.products.get(target);
  if(!product||(!product.active&&!remove))throw fail('Produto não encontrado ou inativo');
  const next=remove?0:quantity(amount),old=Number(item?.quantity||0),difference=next-old;
  if((item?.pizza||resolved)&&!remove&&(!Number.isInteger(next)||next>99))throw fail('Informe de 1 a 99 pizzas inteiras por item');
  const stockTracked=item?item.stockTracked:product.itemType!=='service'&&!product.recipeEnabled;
  if(stockTracked&&difference>Number(product.currentStock))throw fail('Estoque insuficiente');
  if(restoreIngredients&&!['admin','gerente'].includes(role))throw fail('Somente gerente e administrador podem repor insumos',403);
  const recipeCtx={userId,transaction,locked:inventory,sourceComandaId:comandaId,note:`Insumos da comanda ${comandaId}`};
  const recipe=item?.recipe?await recipeOps.resize(item.recipe,item.recipe.plan,next,restoreIngredients,recipeCtx):await recipeOps.consume(product.id,next,recipeCtx);
  const price=Number(item?.priceAtSale??bundleSnapshot?.allocatedUnitPrice??resolved?.unitPrice??product.salePrice);
  const itemTotal=Math.round(next*price*100)/100,previousTotal=Number(item?.totalItemValue||0);
  if(stockTracked)await product.update({currentStock:Number(product.currentStock)-difference},{transaction});
  if(stockTracked&&difference)await StockMovement.create({productId:product.id,userId,sourceComandaId:comandaId,type:difference>0?'saida':'entrada',quantity:Math.abs(difference),reason:difference>0?'sale':'return',notes:`Comanda ${comandaId}`},{transaction});
  await comanda.update({totalValue:Math.max(0,Number(comanda.totalValue)-previousTotal+itemTotal)},{transaction});
  if(remove){await item.destroy({transaction});return null;}
  if(item)return item.update({recipe,quantity:next,totalItemValue:itemTotal,notes:notes??item.notes},{transaction});
  return ComandaItem.create({bundle:bundleSnapshot||null,recipe,pizza:resolved?.pizza||null,stockTracked,preparationStatus:recipe||stockTracked?'pendente':'entregue',comandaId,productId:product.id,quantity:next,priceAtSale:price,totalItemValue:itemTotal,notes},{transaction});
 };
 return transactionContext?perform(transactionContext):sequelize.transaction(perform);
}
async function close({id,tableId,userId,role,payments,paymentMethod,paymentStatus='pago',discountValue=0,discountPercentage=0,notes,loyalty}){
 if(payments?.length)paymentMethod=payments[0].method;
 if((Number(discountValue)||Number(discountPercentage))&&!['admin','gerente'].includes(role))throw fail('Somente gerente e administrador podem dar descontos',403);
 if(!['dinheiro','pix','cartao_credito','cartao_debito','vale_refeicao'].includes(paymentMethod))throw fail('Forma de pagamento inválida');
 if(!['pago','pendente','nao_pago'].includes(paymentStatus))throw fail('Estado de pagamento inválido');
 discountValue=Number(discountValue);discountPercentage=Number(discountPercentage);
 if(!Number.isFinite(discountValue)||discountValue<0||!Number.isFinite(discountPercentage)||discountPercentage<0||discountPercentage>100)throw fail('Desconto inválido');
 return sequelize.transaction(async transaction=>{
  await sequelize.query("SELECT pg_advisory_xact_lock(882021)",{transaction});
  // Mesma ordem de bloqueio usada pelas vendas: caixa antes dos produtos/comandas.
  const cash=paymentStatus==='pago'?await CashRegister.findOne({where:{is_open:true},transaction,lock:transaction.LOCK.UPDATE}):null;
  if(paymentStatus==='pago'&&!cash)throw fail('Abra o caixa antes de receber o pagamento');
  const comanda=await Comanda.findOne({where:id?{id}:{tableId,status:'aberta'},transaction,lock:transaction.LOCK.UPDATE});
  if(!comanda)throw fail('Comanda não encontrada',404);
  if(comanda.status!=='aberta')throw fail('Comanda não está aberta');
  const benefit=loyalty?await require('./comandaLoyalty').apply(comanda,loyalty,discountValue,discountPercentage,userId,role,transaction):null;
  if(discountValue+Number(comanda.totalValue)*discountPercentage/100>Number(comanda.totalValue))throw fail('Desconto excede o total');
  const total=Math.round((Number(comanda.totalValue)-discountValue-Number(comanda.totalValue)*discountPercentage/100)*100)/100;
  const normalized=require('./payments').settlement(payments,paymentMethod,total);
  await comanda.update({payments:normalized,status:'fechada',closedAt:new Date(),closedByUserId:userId,paymentMethod,paymentStatus,discountValue,discountPercentage,notes,cashRegisterId:cash?.id||null},{transaction});
  if(benefit)comanda.setDataValue('loyaltyBenefit',benefit.toJSON());
  if(comanda.tableId)await Table.update({status:'disponivel'},{where:{id:comanda.tableId},transaction});
  return comanda;
 });
}
return {changeItem,close,fail};

}
module.exports=require('../tenancy/scopedModule')(createScopedModule,["changeItem", "close", "fail"]);
