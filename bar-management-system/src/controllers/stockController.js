const { StockMovement, Product, User, Comanda, sequelize } = require('../models');
const { logAction } = require('../utils/auditLogger');
const { Op } = require('sequelize');

const addStock = async (req, res) => {
  try {
    const { productId, quantity, notes, unitCost } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ 
        error: 'Product ID and positive quantity are required' 
      });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const stockMovement = await StockMovement.create({
      productId,
      type: 'entrada',
      quantity,
      userId: req.user.id,
      notes,
      unitCost: unitCost || product.costPrice
    });

    const newStock = parseFloat(product.currentStock) + parseFloat(quantity);
    await product.update({
      currentStock: newStock
    });

    await logAction(req.user.id, 'stock_added', {
      productId,
      productName: product.name,
      quantity,
      oldStock: product.currentStock,
      newStock: newStock
    });

    res.status(201).json({
      message: 'Stock added successfully',
      stockMovement,
      newStock: newStock
    });
  } catch (error) {
    console.error('Add stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeStock = async (req, res) => {
  try {
    const { productId, quantity, notes, reason } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ 
        error: 'Product ID and positive quantity are required' 
      });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (parseFloat(product.currentStock) < parseFloat(quantity)) {
      return res.status(400).json({ 
        error: 'Insufficient stock. Available: ' + product.currentStock 
      });
    }

    const stockMovement = await StockMovement.create({
      productId,
      type: 'saida',
      quantity,
      userId: req.user.id,
      notes: notes || reason,
      reason: reason || 'manual_adjustment'
    });

    const newStock = parseFloat(product.currentStock) - parseFloat(quantity);
    await product.update({
      currentStock: newStock
    });

    await logAction(req.user.id, 'stock_removed', {
      productId,
      productName: product.name,
      quantity,
      reason,
      oldStock: product.currentStock,
      newStock: newStock
    });

    res.status(201).json({
      message: 'Stock removed successfully',
      stockMovement,
      newStock: newStock
    });
  } catch (error) {
    console.error('Remove stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const adjustStock = async (req, res) => {
  try {
    const { productId, newQuantity, notes } = req.body;

    if (!productId || newQuantity < 0) {
      return res.status(400).json({ 
        error: 'Product ID and non-negative quantity are required' 
      });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const oldStock = parseFloat(product.currentStock);
    const newStock = parseFloat(newQuantity);
    const difference = newStock - oldStock;

    if (difference !== 0) {
      await StockMovement.create({
        productId,
        type: difference > 0 ? 'entrada' : 'saida',
        quantity: Math.abs(difference),
        userId: req.user.id,
        notes: notes || 'Stock adjustment',
        reason: 'adjustment'
      });

      await product.update({
        currentStock: newStock
      });

      await logAction(req.user.id, 'stock_adjusted', {
        productId,
        productName: product.name,
        oldStock,
        newStock,
        difference
      });
    }

    res.json({
      message: 'Stock adjusted successfully',
      oldStock,
      newStock,
      difference
    });
  } catch (error) {
    console.error('Adjust stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getStockMovements = async (req, res) => {
  try {
    const { productId, type, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    const whereClause = {};
    if (productId) whereClause.productId = productId;
    if (type) whereClause.type = type;
    if (startDate || endDate) {
      whereClause.movementDate = {};
      if (startDate) whereClause.movementDate[Op.gte] = new Date(startDate);
      if (endDate) whereClause.movementDate[Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;

    const { count, rows: movements } = await StockMovement.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'unitOfMeasure', 'category']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        },
        {
          model: Comanda,
          as: 'sourceComanda',
          attributes: ['id'],
          required: false
        }
      ],
      order: [['movementDate', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      movements,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get stock movements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: {
        active: true,
        [Op.and]: [
          { currentStock: { [Op.lte]: { [Op.col]: 'min_stock_alert' } } }
        ]
      },
      order: [['currentStock', 'ASC']]
    });

    res.json(products);
  } catch (error) {
    console.error('Get low stock products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getStockReport = async (req, res) => {
  try {
    const { category } = req.query;
    
    const whereClause = { active: true };
    if (category) whereClause.category = category;

    const products = await Product.findAll({
      where: whereClause,
      attributes: [
        'id',
        'name',
        'category',
        'unitOfMeasure',
        'currentStock',
        'minStockAlert',
        'costPrice',
        'salePrice'
      ],
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    const report = products.map(product => ({
      ...product.dataValues,
      stockValue: parseFloat(product.currentStock) * parseFloat(product.costPrice),
      isLowStock: parseFloat(product.currentStock) <= parseFloat(product.minStockAlert),
      stockStatus: getStockStatus(product)
    }));

    const summary = {
      totalProducts: products.length,
      lowStockCount: report.filter(p => p.isLowStock).length,
      outOfStockCount: report.filter(p => p.currentStock <= 0).length,
      totalStockValue: report.reduce((sum, p) => sum + p.stockValue, 0),
      averageStockValue: report.length > 0 ? report.reduce((sum, p) => sum + p.stockValue, 0) / report.length : 0
    };

    res.json({
      report,
      summary
    });
  } catch (error) {
    console.error('Get stock report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getStockHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const whereClause = { productId: id };
    if (startDate || endDate) {
      whereClause.movementDate = {};
      if (startDate) whereClause.movementDate[Op.gte] = new Date(startDate);
      if (endDate) whereClause.movementDate[Op.lte] = new Date(endDate);
    }

    const movements = await StockMovement.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        },
        {
          model: Comanda,
          as: 'sourceComanda',
          attributes: ['id'],
          required: false
        }
      ],
      order: [['movementDate', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({
      product: {
        id: product.id,
        name: product.name,
        currentStock: product.currentStock,
        unitOfMeasure: product.unitOfMeasure
      },
      movements
    });
  } catch (error) {
    console.error('Get stock history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getStockSummary = async (req, res) => {
  try {
    const totalProducts = await Product.count({ where: { active: true } });

    const lowStockProducts = await Product.count({
      where: {
        active: true,
        [Op.and]: [
          { currentStock: { [Op.lte]: { [Op.col]: 'min_stock_alert' } } }
        ]
      }
    });

    const outOfStockProducts = await Product.count({
      where: {
        active: true,
        currentStock: { [Op.lte]: 0 }
      }
    });

    const totalStockValue = await Product.sum(
      sequelize.literal('"currentStock" * "costPrice"'),
      { where: { active: true } }
    );

    const recentMovements = await StockMovement.count({
      where: {
        movementDate: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    res.json({
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      totalStockValue: totalStockValue || 0,
      recentMovements
    });
  } catch (error) {
    console.error('Get stock summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getStockStatus = (product) => {
  const current = parseFloat(product.currentStock);
  const min = parseFloat(product.minStockAlert);

  if (current <= 0) return 'out_of_stock';
  if (current <= min) return 'low_stock';
  if (current <= min * 2) return 'medium_stock';
  return 'good_stock';
};

module.exports = {
  addStock,
  removeStock,
  adjustStock,
  getStockMovements,
  getLowStockProducts,
  getStockReport,
  getStockHistory,
  getStockSummary
};
