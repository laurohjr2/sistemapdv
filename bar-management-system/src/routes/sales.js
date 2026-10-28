function createRouter() {
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Importar modelos necessários
const { Sale, SaleItem, Product, StockMovement, CashRegister, Ticket } = require('../models');
const { logAction } = require('../utils/auditLogger');

const { sequelize } = require('../models');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

router.post('/',authenticateToken,require('../services/commercialValidation').handler(async(req,res)=>{
 if(req.body.sourceQuoteId){const {effectiveModules}=require('../config/businessProfiles');if(!effectiveModules(await require('../services/businessSettingsService').getSettings()).quotes)throw fail('Módulo Orçamentos desativado',403);}
 res.status(201).json(await require('../services/saleOperations').create({body:req.body,user:req.user}));
}));

// Listar vendas
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const sales = await Sale.findAll({
      where: whereClause,
      include: [
        {
          model: SaleItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['name']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json(sales);
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Obter detalhes de uma venda
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findByPk(id, {
      include: [
        {
          model: SaleItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['name', 'unitOfMeasure']
            }
          ]
        }
      ]
    });

    if (!sale) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    res.json(sale);
  } catch (error) {
    console.error('Erro ao buscar venda:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Cancelamento único com reposição de estoque na mesma transação.
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'gerente'].includes(req.user.role)) throw fail('Sem permissão para cancelar vendas', 403);
    const sale = await sequelize.transaction(async transaction => {
      const snapshot = await Sale.findByPk(req.params.id, { transaction });
      if (!snapshot) throw fail('Venda não encontrada',404);
      const cash = await CashRegister.findByPk(snapshot.cash_register_id,{transaction,lock:transaction.LOCK.UPDATE});
      if (!cash?.is_open) throw fail('O caixa desta venda já foi fechado');
      const workOrder=snapshot.sourceWorkOrderId?await require('../models').WorkOrder.findByPk(snapshot.sourceWorkOrderId,{transaction,lock:transaction.LOCK.UPDATE}):null;
      if(workOrder?.status==='delivered')throw fail('A OS já foi entregue. O recebimento não pode ser cancelado por este fluxo.');
      const sale = await Sale.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      const ticket = await Ticket.findOne({where:{sale_id:sale.id},transaction,lock:transaction.LOCK.UPDATE});
      if(ticket && ticket.status !== 'pending') throw fail('Ticket já utilizado ou cancelado');
      if(ticket) await ticket.update({status:'cancelled'},{transaction});
      if (!sale) throw fail('Venda não encontrada', 404);
      if (sale.status === 'cancelled') throw fail('Venda já foi cancelada');
      const delivery=await require('../models').DeliveryOrder.findOne({where:{saleId:sale.id},transaction,lock:transaction.LOCK.UPDATE});
      if(delivery&&['dispatched','delivered'].includes(delivery.status))throw fail('A venda saiu para entrega. Confira a devolução com a administração antes de estornar.');
      if(delivery&&delivery.status!=='cancelled')await delivery.update({status:'cancelled',revision:delivery.revision+1,history:require('../services/deliveryOperations').event(delivery,req.user,'cancelled','Venda cancelada no caixa')},{transaction});
      const items = await SaleItem.findAll({ where: { sale_id: sale.id }, order: [['product_id', 'ASC']], transaction });
      const recipeOps=require('../services/recipeOperations');
      const returned=await recipeOps.physicalLocks(items.flatMap(i=>[...(i.stockTracked?[i.product_id]:[]),...(i.recipe?.consumed||[]).map(c=>c.productId)]),transaction);
      for (const item of items) {
        if(item.recipe){await recipeOps.restore(item.recipe,req.body?.restoreIngredients===true,{userId:req.user.id,transaction,locked:{products:returned},note:`Cancelamento da venda #${sale.id}`});continue;}
        if(!item.stockTracked)continue;
        const product = returned.get(item.product_id);
        await product.update({ currentStock: Number(product.currentStock) + Number(item.quantity) }, { transaction });
        await StockMovement.create({ productId: product.id, userId: req.user.id,
          type: 'entrada', quantity: item.quantity, reason: 'return',
          notes: `Cancelamento da venda #${sale.id}` }, { transaction });
      }
      await sale.update({ status: 'cancelled' }, { transaction });
      if(workOrder)await workOrder.update({revision:workOrder.revision+1,events:require('../services/workshopOperations').event(workOrder,req.user,'payment_cancelled',`Venda #${sale.id} cancelada; estoque reposto`)},{transaction});
      return sale;
    });
    await logAction(req.user.id, 'sale_cancelled', { saleId: sale.id });
    res.json({ message: 'Venda cancelada com sucesso', sale });
  } catch (error) {
    console.error('Erro ao cancelar venda:', error.message);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro interno do servidor' });
  }
});

return router;

}
module.exports=require('../tenancy/scopedModule').router(createRouter);
