function createScopedModule() {
const operations = require('../services/comandaOperations');
const { openTable } = require('../services/tableSeatingService');
const { LoyaltyComandaBenefit, Customer, Comanda, ComandaItem, Table, Product, User, StockMovement, sequelize } = require('../models');
const { logAction } = require('../utils/auditLogger');
const { Op } = require('sequelize');

const openComanda = async (req, res) => {
  try {
    const { tableId, type = 'mesa', customerName, customerPhone, deliveryType = 'balcao' } = req.body;

    // Validação baseada no tipo de comanda
    if (type === 'mesa' && !tableId) {
      return res.status(400).json({ error: 'Table ID is required for table comandas' });
    }

    if (type === 'balcao' && !customerName && !req.body.customerId) {
      return res.status(400).json({ error: 'Customer name is required for counter comandas' });
    }

    let comanda;
    let table;
    if (type === 'mesa') {
      ({table, comanda} = await sequelize.transaction(transaction => openTable({
        tableId, userId:req.user.id, customerName, customerPhone, customerId:req.body.customerId, transaction
      })));
    } else if (type === 'balcao' && !tableId) {
      comanda=await sequelize.transaction(async transaction=>{
        const customer=req.body.customerId?await Customer.findByPk(require('../services/commercialValidation').uuid(req.body.customerId),{transaction}):null;
        if(req.body.customerId&&!customer?.active)throw operations.fail('Cliente não encontrado ou inativo');
        return Comanda.create({type,customerName:customer?.name||customerName,customerPhone:customer?.phone||customerPhone,customerId:customer?.id||null,deliveryType,openedByUserId:req.user.id},{transaction});
      });
    } else {
      return res.status(400).json({error:'Tipo de comanda ou mesa inválido.'});
    }

    await logAction(req.user.id, 'comanda_opened', {
      comandaId: comanda.id,
      type,
      tableNumber: table?.tableNumber,
      customerName
    });

    res.status(201).json({
      message: 'Comanda opened successfully',
      comanda
    });
  } catch (error) {
    console.error('Open comanda error:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Internal server error' });
  }
};

const addItemToComanda = async(req,res,next)=>{
 try {const item=await operations.changeItem({comandaId:req.params.comandaId,productId:req.body.productId,amount:req.body.quantity,notes:req.body.notes,pizza:req.body.pizza,expectedUnitPrice:req.body.expectedUnitPrice,userId:req.user.id,role:req.user.role});res.status(201).json({item});}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}
};
const updateItemQuantity = async(req,res,next)=>{
 try {const item=await operations.changeItem({comandaId:req.params.comandaId,itemId:req.params.itemId,amount:req.body.quantity,userId:req.user.id,role:req.user.role,restoreIngredients:req.body.restoreIngredients===true});res.json({item});}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}
};

const getComandaById = async (req, res) => {
  try {
    const { id } = req.params;

    const comanda = await Comanda.findByPk(id, {
      include: [
        {model:LoyaltyComandaBenefit,as:'loyaltyBenefit',required:false},
        {
          model: Table,
          as: 'table',
          attributes: ['id', 'tableNumber'],
          required: false
        },
        {
          model: User,
          as: 'openedByUser',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'closedByUser',
          attributes: ['id', 'username'],
          required: false
        },
        {
          model: ComandaItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'unitOfMeasure', 'category']
            }
          ]
        }
      ]
    });

    if (!comanda) {
      return res.status(404).json({ error: 'Comanda not found' });
    }

    res.json(comanda);
  } catch (error) {
    console.error('Get comanda error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const closeComanda = async(req,res,next)=>{
 try{const comanda=await operations.close({...req.body,id:req.params.id,userId:req.user.id,role:req.user.role});await logAction(req.user.id,'comanda_closed',{comandaId:comanda.id});res.json({comanda});}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}
};
const removeItemFromComanda = async(req,res,next)=>{
 try{await operations.changeItem({comandaId:req.params.comandaId,itemId:req.params.itemId,userId:req.user.id,role:req.user.role,restoreIngredients:req.body?.restoreIngredients===true,remove:true});res.json({message:'Item removido'});}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}
};

const getAllComandas = async (req, res) => {
  try {
    const { 
      status, 
      type, 
      paymentStatus,
      startDate, 
      endDate, 
      tableId, 
      userId, 
      customerName,
      page = 1, 
      limit = 50 
    } = req.query;
    
    const whereClause = {};
    if (status) whereClause.status = status;
    if (type) whereClause.type = type;
    if (paymentStatus) whereClause.paymentStatus = paymentStatus;
    if (tableId) whereClause.tableId = tableId;
    if (userId) whereClause.openedByUserId = userId;
    if (customerName) {
      whereClause.customerName = { [Op.iLike]: `%${customerName}%` };
    }
    if (startDate || endDate) {
      whereClause.openedAt = {};
      if (startDate) whereClause.openedAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.openedAt[Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;

    const { count, rows: comandas } = await Comanda.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Table,
          as: 'table',
          attributes: ['id', 'tableNumber'],
          required: false
        },
        {
          model: User,
          as: 'openedByUser',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'closedByUser',
          attributes: ['id', 'username'],
          required: false
        }
      ],
      order: [['openedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      comandas,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get comandas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getOpenComandas = async (req, res) => {
  try {
    const { type } = req.query;
    
    const whereClause = { status: 'aberta' };
    if (type) whereClause.type = type;

    const comandas = await Comanda.findAll({
      where: whereClause,
      include: [
        {
          model: Table,
          as: 'table',
          attributes: ['id', 'tableNumber'],
          required: false
        },
        {
          model: User,
          as: 'openedByUser',
          attributes: ['id', 'username']
        },
        {
          model: ComandaItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'unitOfMeasure']
            }
          ]
        }
      ],
      order: [['openedAt', 'ASC']]
    });

    res.json(comandas);
  } catch (error) {
    console.error('Get open comandas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateComandaPaymentStatus = async(req,res,next)=>{
 try{
  const {paymentStatus,notes}=req.body;if(!['pago','pendente','nao_pago'].includes(paymentStatus))throw operations.fail('Estado inválido');
  const comanda=await sequelize.transaction(async transaction=>{
   const cash=await require('../models').CashRegister.findOne({where:{is_open:true},transaction,lock:transaction.LOCK.UPDATE});
   const c=await Comanda.findByPk(req.params.id,{transaction,lock:transaction.LOCK.UPDATE});
   if(!c||c.status!=='fechada')throw operations.fail('A comanda deve estar fechada');
   if(c.paymentStatus==='pago'&&paymentStatus!=='pago')throw operations.fail('Pagamento já registrado; não é possível removê-lo por esta opção');
   if(paymentStatus==='pago'&&c.paymentStatus!=='pago'){
    if(!cash)throw operations.fail('Abra o caixa antes de receber');
    await c.update({paymentStatus,cashRegisterId:cash.id,closedAt:new Date(),notes:notes??c.notes},{transaction});
   }else await c.update({paymentStatus,notes:notes??c.notes},{transaction});
   return c;
  });res.json({comanda});
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}
};

const cancelComanda = async(req,res,next)=>{
 try{
  const comanda=await sequelize.transaction(async transaction=>{
   const c=await Comanda.findByPk(req.params.id,{transaction,lock:transaction.LOCK.UPDATE});
   if(!c||c.status!=='aberta')throw operations.fail('Apenas comandas abertas podem ser canceladas');
   const items=await ComandaItem.findAll({where:{comandaId:c.id},order:[['productId','ASC']],transaction});
   const recipeOps=require('../services/recipeOperations'),returned=await recipeOps.physicalLocks(items.flatMap(i=>[...(i.stockTracked?[i.productId]:[]),...(i.recipe?.consumed||[]).map(c=>c.productId)]),transaction);
   for(const item of items){if(item.recipe){await recipeOps.restore(item.recipe,req.body?.restoreIngredients===true,{userId:req.user.id,transaction,locked:{products:returned},sourceComandaId:c.id,note:`Cancelamento da comanda ${c.id}`});continue;}if(!item.stockTracked)continue;const p=returned.get(item.productId);await p.update({currentStock:Number(p.currentStock)+Number(item.quantity)},{transaction});await StockMovement.create({productId:p.id,userId:req.user.id,sourceComandaId:c.id,type:'entrada',quantity:item.quantity,reason:'return',notes:`Cancelamento da comanda ${c.id}`},{transaction});}
   await c.update({status:'cancelada',closedAt:new Date(),closedByUserId:req.user.id,notes:req.body.reason||'Comanda cancelada'},{transaction});
   if(c.tableId)await Table.update({status:'disponivel'},{where:{id:c.tableId},transaction});return c;
  });
  await logAction(req.user.id,'comanda_cancelled',{comandaId:comanda.id});res.json({comanda});
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}
};

return {
  openComanda,
  addItemToComanda,
  updateItemQuantity,
  getComandaById,
  closeComanda,
  removeItemFromComanda,
  getAllComandas,
  getOpenComandas,
  updateComandaPaymentStatus,
  cancelComanda
};


}
module.exports=require('../tenancy/scopedModule')(createScopedModule,["openComanda", "addItemToComanda", "updateItemQuantity", "getComandaById", "closeComanda", "removeItemFromComanda", "getAllComandas", "getOpenComandas", "updateComandaPaymentStatus", "cancelComanda"]);
