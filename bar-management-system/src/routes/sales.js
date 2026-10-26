const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Importar modelos necessários
const { Sale, SaleItem, Product, StockMovement, CashRegister, Ticket } = require('../models');
const { logAction } = require('../utils/auditLogger');

const { sequelize } = require('../models');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// Uma transação mantém venda, itens e estoque consistentes em caso de falha.
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { items, payment_method, cash_register_id } = req.body;
    if (!Array.isArray(items) || !items.length) throw fail('Itens são obrigatórios');
    if (!['dinheiro', 'cartao_credito', 'cartao_debito', 'pix'].includes(payment_method)) {
      throw fail('Método de pagamento inválido');
    }
    if (!cash_register_id) throw fail('Caixa aberto é obrigatório');
    const quantities = new Map();
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!item.product_id || !Number.isFinite(quantity) || quantity <= 0 ||
          Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.000001) {
        throw fail('Produto e quantidade positiva com até três casas decimais são obrigatórios');
      }
      quantities.set(item.product_id, (quantities.get(item.product_id) || 0) + quantity);
    }
    const sale = await sequelize.transaction(async transaction => {
      const cashRegister = await CashRegister.findByPk(cash_register_id, {
        transaction, lock: transaction.LOCK.UPDATE
      });
      if (!cashRegister?.is_open) throw fail('Caixa deve estar aberto para realizar vendas');
      const lines = [];
      let totalCents = 0;
      // Ordem fixa evita impasses entre vendas com produtos em ordem diferente.
      for (const [productId, quantity] of [...quantities].sort(([a], [b]) => a.localeCompare(b))) {
        const product = await Product.findByPk(productId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!product?.active) throw fail('Produto não encontrado ou inativo');
        if (Number(product.currentStock) < quantity) throw fail(`Estoque insuficiente para ${product.name}`);
        const cents = Math.round(Number(product.salePrice) * quantity * 100);
        totalCents += cents;
        lines.push({ product, quantity, cents });
      }
      const sale = await Sale.create({
        user_id: req.user.id, cash_register_id, payment_method,
        total_amount: totalCents / 100, status: 'completed'
      }, { transaction });
      for (const { product, quantity, cents } of lines) {
        await SaleItem.create({ sale_id: sale.id, product_id: product.id,
          quantity, unit_price: product.salePrice, total_price: cents / 100 }, { transaction });
        await product.update({ currentStock: Number(product.currentStock) - quantity }, { transaction });
        await StockMovement.create({ productId: product.id, userId: req.user.id,
          type: 'saida', quantity, reason: 'sale', notes: `Venda #${sale.id}` }, { transaction });
      }
      return sale;
    });
    await logAction(req.user.id, 'sale_created', { saleId: sale.id, totalAmount: sale.total_amount });
    res.status(201).json(sale);
  } catch (error) {
    console.error('Erro ao criar venda:', error.message);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro interno do servidor' });
  }
});

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
      const sale = await Sale.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      const ticket = await Ticket.findOne({where:{sale_id:sale.id},transaction,lock:transaction.LOCK.UPDATE});
      if(ticket && ticket.status !== 'pending') throw fail('Ticket já utilizado ou cancelado');
      if(ticket) await ticket.update({status:'cancelled'},{transaction});
      if (!sale) throw fail('Venda não encontrada', 404);
      if (sale.status === 'cancelled') throw fail('Venda já foi cancelada');
      const items = await SaleItem.findAll({ where: { sale_id: sale.id }, order: [['product_id', 'ASC']], transaction });
      for (const item of items) {
        const product = await Product.findByPk(item.product_id, { transaction, lock: transaction.LOCK.UPDATE });
        await product.update({ currentStock: Number(product.currentStock) + Number(item.quantity) }, { transaction });
        await StockMovement.create({ productId: product.id, userId: req.user.id,
          type: 'entrada', quantity: item.quantity, reason: 'return',
          notes: `Cancelamento da venda #${sale.id}` }, { transaction });
      }
      await sale.update({ status: 'cancelled' }, { transaction });
      return sale;
    });
    await logAction(req.user.id, 'sale_cancelled', { saleId: sale.id });
    res.json({ message: 'Venda cancelada com sucesso', sale });
  } catch (error) {
    console.error('Erro ao cancelar venda:', error.message);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro interno do servidor' });
  }
});

module.exports = router;
