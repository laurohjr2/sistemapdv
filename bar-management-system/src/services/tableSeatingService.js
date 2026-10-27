function createScopedModule() {
const { Table, Comanda, Customer } = require('../models');
const httpError = (status, message) => Object.assign(new Error(message), { status });
const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// Todas as formas de abrir mesa passam pelo mesmo bloqueio de registro.
async function openTable({ tableId, userId, customerName, customerPhone, customerId, numberOfPeople, transaction }) {
  if (!isUuid(tableId)) throw httpError(400, 'Selecione uma mesa válida.');
  const table = await Table.findByPk(tableId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!table) throw httpError(404, 'Mesa não encontrada.');
  if (table.status !== 'disponivel') throw httpError(409, 'Esta mesa não está mais disponível. Atualize a lista e escolha outra.');
  if (numberOfPeople && (!table.capacity || table.capacity < numberOfPeople)) {
    throw httpError(409, 'A capacidade da mesa não comporta este grupo.');
  }
  if (await Comanda.findOne({ where: { tableId, status: 'aberta' }, transaction })) {
    throw httpError(409, 'Esta mesa já possui uma comanda aberta.');
  }
  const customer=customerId?await Customer.findByPk(customerId,{transaction}):null;
  if(customerId&&!customer?.active)throw httpError(400,'Cliente não encontrado ou inativo');
  const comanda = await Comanda.create({customerId:customer?.id||null, tableId, type:'mesa', deliveryType:'mesa',
    customerName:customer?.name||customerName, customerPhone:customer?.phone||customerPhone, openedByUserId:userId }, { transaction });
  await table.update({status:'ocupada'}, { transaction });
  return { table, comanda };
}
return { openTable, httpError, isUuid };

}
module.exports=require('../tenancy/scopedModule')(createScopedModule,["openTable", "httpError", "isUuid"]);
