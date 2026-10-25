const { openTable } = require('../services/tableSeatingService');
const { Comanda, ComandaItem, Table, Product, User, StockMovement, sequelize } = require('../models');
const { logAction } = require('../utils/auditLogger');
const { Op } = require('sequelize');

const openComanda = async (req, res) => {
  try {
    const { tableId, type = 'mesa', customerName, customerPhone, deliveryType = 'balcao' } = req.body;

    // Validação baseada no tipo de comanda
    if (type === 'mesa' && !tableId) {
      return res.status(400).json({ error: 'Table ID is required for table comandas' });
    }

    if (type === 'balcao' && !customerName) {
      return res.status(400).json({ error: 'Customer name is required for counter comandas' });
    }

    let comanda;
    let table;
    if (type === 'mesa') {
      ({table, comanda} = await sequelize.transaction(transaction => openTable({
        tableId, userId:req.user.id, customerName, customerPhone, transaction
      })));
    } else if (type === 'balcao' && !tableId) {
      comanda = await Comanda.create({ type, customerName, customerPhone, deliveryType, openedByUserId:req.user.id });
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

const addItemToComanda = async (req, res) => {
  try {
    const { comandaId } = req.params;
    const { productId, quantity, notes } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ 
        error: 'Product ID and positive quantity are required' 
      });
    }

    const comanda = await Comanda.findByPk(comandaId);
    if (!comanda) {
      return res.status(404).json({ error: 'Comanda not found' });
    }

    if (comanda.status !== 'aberta') {
      return res.status(400).json({ error: 'Comanda is not open' });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!product.active) {
      return res.status(400).json({ error: 'Product is not active' });
    }

    // Check stock availability
    if (product.currentStock < quantity) {
      return res.status(400).json({ 
        error: `Insufficient stock. Available: ${product.currentStock}` 
      });
    }

    const totalItemValue = parseFloat(product.salePrice) * parseFloat(quantity);

    // Add item to comanda
    const comandaItem = await ComandaItem.create({
      comandaId,
      productId,
      quantity,
      priceAtSale: product.salePrice,
      totalItemValue,
      notes
    });

    // Update product stock
    await product.update({
      currentStock: parseFloat(product.currentStock) - parseFloat(quantity)
    });

    // Create stock movement
    await StockMovement.create({
      productId,
      type: 'saida',
      quantity,
      userId: req.user.id,
      sourceComandaId: comandaId,
      reason: 'sale',
      notes: `Venda - Comanda ${comandaId}`
    });

    // Update comanda total
    const newTotal = parseFloat(comanda.totalValue) + totalItemValue;
    await comanda.update({
      totalValue: newTotal
    });

    const itemWithProduct = await ComandaItem.findByPk(comandaItem.id, {
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'unitOfMeasure', 'category']
        }
      ]
    });

    res.status(201).json({
      message: 'Item added to comanda successfully',
      item: itemWithProduct
    });
  } catch (error) {
    console.error('Add item to comanda error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getComandaById = async (req, res) => {
  try {
    const { id } = req.params;

    const comanda = await Comanda.findByPk(id, {
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

const closeComanda = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, paymentStatus = 'pago', discountValue = 0, discountPercentage = 0, notes } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    const comanda = await Comanda.findByPk(id, {
      include: [
        {
          model: Table,
          as: 'table',
          required: false
        }
      ]
    });

    if (!comanda) {
      return res.status(404).json({ error: 'Comanda not found' });
    }

    if (comanda.status !== 'aberta') {
      return res.status(400).json({ error: 'Comanda is not open' });
    }

    await comanda.update({
      status: 'fechada',
      closedAt: new Date(),
      closedByUserId: req.user.id,
      paymentMethod,
      paymentStatus,
      discountValue: parseFloat(discountValue),
      discountPercentage: parseFloat(discountPercentage),
      notes
    });

    // Update table status if it's a table comanda
    if (comanda.table) {
      await comanda.table.update({ status: 'disponivel' });
    }

    await logAction(req.user.id, 'comanda_closed', {
      comandaId: comanda.id,
      type: comanda.type,
      tableNumber: comanda.table?.tableNumber,
      customerName: comanda.customerName,
      totalValue: comanda.totalValue,
      finalValue: comanda.finalValue,
      paymentMethod,
      paymentStatus
    });

    res.json({
      message: 'Comanda closed successfully',
      comanda
    });
  } catch (error) {
    console.error('Close comanda error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeItemFromComanda = async (req, res) => {
  try {
    const { comandaId, itemId } = req.params;

    const comanda = await Comanda.findByPk(comandaId);
    if (!comanda) {
      return res.status(404).json({ error: 'Comanda not found' });
    }

    if (comanda.status !== 'aberta') {
      return res.status(400).json({ error: 'Comanda is not open' });
    }

    const item = await ComandaItem.findOne({
      where: { id: itemId, comandaId },
      include: [
        {
          model: Product,
          as: 'product'
        }
      ]
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found in comanda' });
    }

    // Return stock
    await item.product.update({
      currentStock: parseFloat(item.product.currentStock) + parseFloat(item.quantity)
    });

    // Create stock movement for return
    await StockMovement.create({
      productId: item.productId,
      type: 'entrada',
      quantity: item.quantity,
      userId: req.user.id,
      reason: 'return',
      notes: `Devolução - Remoção de item da comanda ${comandaId}`
    });

    // Update comanda total
    const newTotal = parseFloat(comanda.totalValue) - parseFloat(item.totalItemValue);
    await comanda.update({
      totalValue: Math.max(0, newTotal)
    });

    await item.destroy();

    res.json({ message: 'Item removed from comanda successfully' });
  } catch (error) {
    console.error('Remove item from comanda error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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

const updateComandaPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, notes } = req.body;

    if (!['pendente', 'pago', 'nao_pago'].includes(paymentStatus)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }

    const comanda = await Comanda.findByPk(id);
    if (!comanda) {
      return res.status(404).json({ error: 'Comanda not found' });
    }

    await comanda.update({
      paymentStatus,
      notes: notes || comanda.notes
    });

    await logAction(req.user.id, 'comanda_payment_updated', {
      comandaId: comanda.id,
      oldPaymentStatus: comanda.paymentStatus,
      newPaymentStatus: paymentStatus
    });

    res.json({
      message: 'Payment status updated successfully',
      comanda
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const cancelComanda = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const comanda = await Comanda.findByPk(id, {
      include: [
        {
          model: ComandaItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product'
            }
          ]
        },
        {
          model: Table,
          as: 'table',
          required: false
        }
      ]
    });

    if (!comanda) {
      return res.status(404).json({ error: 'Comanda not found' });
    }

    if (comanda.status !== 'aberta') {
      return res.status(400).json({ error: 'Only open comandas can be cancelled' });
    }

    // Return stock for all items
    for (const item of comanda.items) {
      await item.product.update({
        currentStock: parseFloat(item.product.currentStock) + parseFloat(item.quantity)
      });

      // Create stock movement for return
      await StockMovement.create({
        productId: item.productId,
        type: 'entrada',
        quantity: item.quantity,
        userId: req.user.id,
        reason: 'return',
        notes: `Cancelamento da comanda ${id} - ${reason || 'Sem motivo especificado'}`
      });
    }

    await comanda.update({
      status: 'cancelada',
      closedAt: new Date(),
      closedByUserId: req.user.id,
      notes: reason || 'Comanda cancelada'
    });

    // Update table status if it's a table comanda
    if (comanda.table) {
      await comanda.table.update({ status: 'disponivel' });
    }

    await logAction(req.user.id, 'comanda_cancelled', {
      comandaId: comanda.id,
      reason,
      totalValue: comanda.totalValue
    });

    res.json({
      message: 'Comanda cancelled successfully',
      comanda
    });
  } catch (error) {
    console.error('Cancel comanda error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  openComanda,
  addItemToComanda,
  getComandaById,
  closeComanda,
  removeItemFromComanda,
  getAllComandas,
  getOpenComandas,
  updateComandaPaymentStatus,
  cancelComanda
};

