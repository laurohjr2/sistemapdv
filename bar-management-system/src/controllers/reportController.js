const { Comanda, ComandaItem, Product, User, Table, StockMovement } = require('../models');
const { Op } = require('sequelize');

const getSalesReport = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      category, 
      productId, 
      userId, 
      tableId, 
      paymentMethod,
      groupBy = 'day'
    } = req.query;

    const whereClause = { status: 'fechada' };
    
    if (startDate || endDate) {
      whereClause.closedAt = {};
      if (startDate) whereClause.closedAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.closedAt[Op.lte] = new Date(endDate);
    }
    
    if (userId) whereClause.openedByUserId = userId;
    if (tableId) whereClause.tableId = tableId;
    if (paymentMethod) whereClause.paymentMethod = paymentMethod;

    const includeClause = [
      {
        model: User,
        as: 'openedByUser',
        attributes: ['id', 'username']
      },
      {
        model: Table,
        as: 'table',
        attributes: ['id', 'tableNumber'],
        required: false
      },
      {
        model: ComandaItem,
        as: 'items',
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'category', 'unitOfMeasure'],
            where: category ? { category } : undefined
          }
        ],
        where: productId ? { productId } : undefined
      }
    ];

    const comandas = await Comanda.findAll({
      where: whereClause,
      include: includeClause,
      order: [['closedAt', 'DESC']]
    });

    const totalSales = comandas.reduce((sum, comanda) => sum + parseFloat(comanda.finalValue || comanda.totalValue), 0);
    const totalComandas = comandas.length;
    const averageTicket = totalComandas > 0 ? totalSales / totalComandas : 0;

    // Agrupar dados por período
    const groupedData = groupSalesByPeriod(comandas, groupBy);

    res.json({
      comandas,
      groupedData,
      summary: {
        totalSales,
        totalComandas,
        averageTicket,
        totalDiscount: comandas.reduce((sum, c) => sum + parseFloat(c.discountValue || 0), 0)
      }
    });
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProductConsumptionReport = async (req, res) => {
  try {
    const { startDate, endDate, category, productId, limit = 20 } = req.query;

    const whereClause = {};
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) whereClause.created_at[Op.gte] = new Date(startDate);
      if (endDate) whereClause.created_at[Op.lte] = new Date(endDate);
    }

    const includeClause = [
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'category', 'unitOfMeasure', 'salePrice'],
        where: {}
      },
      {
        model: Comanda,
        as: 'comanda',
        where: { status: 'fechada' },
        attributes: []
      }
    ];

    if (category) includeClause[0].where.category = category;
    if (productId) includeClause[0].where.id = productId;

    const items = await ComandaItem.findAll({
      where: whereClause,
      include: includeClause,
      attributes: [
        'productId',
        [ComandaItem.sequelize.fn('SUM', ComandaItem.sequelize.col('quantity')), 'totalQuantity'],
        [ComandaItem.sequelize.fn('SUM', ComandaItem.sequelize.col('total_item_value')), 'totalRevenue'],
        [ComandaItem.sequelize.fn('COUNT', ComandaItem.sequelize.col('ComandaItem.id')), 'orderCount'],
        [ComandaItem.sequelize.fn('AVG', ComandaItem.sequelize.col('total_item_value')), 'averageRevenue']
      ],
      group: ['productId', 'product.id'],
      order: [[ComandaItem.sequelize.fn('SUM', ComandaItem.sequelize.col('total_item_value')), 'DESC']],
      limit: parseInt(limit)
    });

    res.json(items);
  } catch (error) {
    console.error('Get product consumption report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getWaiterPerformanceReport = async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;

    const whereClause = { status: 'fechada' };
    
    if (startDate || endDate) {
      whereClause.closedAt = {};
      if (startDate) whereClause.closedAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.closedAt[Op.lte] = new Date(endDate);
    }
    
    if (userId) whereClause.openedByUserId = userId;

    const performance = await Comanda.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'openedByUser',
          attributes: ['id', 'username']
        }
      ],
      attributes: [
        'openedByUserId',
        [Comanda.sequelize.fn('COUNT', Comanda.sequelize.col('Comanda.id')), 'totalComandas'],
        [Comanda.sequelize.fn('SUM', Comanda.sequelize.col('final_value')), 'totalSales'],
        [Comanda.sequelize.fn('AVG', Comanda.sequelize.col('final_value')), 'averageTicket'],
        [Comanda.sequelize.fn('SUM', Comanda.sequelize.col('discount_value')), 'totalDiscounts']
      ],
      group: ['openedByUserId', 'openedByUser.id'],
      order: [[Comanda.sequelize.fn('SUM', Comanda.sequelize.col('final_value')), 'DESC']]
    });

    res.json(performance);
  } catch (error) {
    console.error('Get waiter performance report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getComparativeReport = async (req, res) => {
  try {
    const { 
      period1Start, 
      period1End, 
      period2Start, 
      period2End 
    } = req.query;

    if (!period1Start || !period1End || !period2Start || !period2End) {
      return res.status(400).json({ 
        error: 'All period dates are required for comparative report' 
      });
    }

    const getPeriodData = async (startDate, endDate) => {
      const comandas = await Comanda.findAll({
        where: {
          status: 'fechada',
          closedAt: {
            [Op.gte]: new Date(startDate),
            [Op.lte]: new Date(endDate)
          }
        },
        attributes: [
          [Comanda.sequelize.fn('COUNT', Comanda.sequelize.col('id')), 'totalComandas'],
          [Comanda.sequelize.fn('SUM', Comanda.sequelize.col('final_value')), 'totalSales'],
          [Comanda.sequelize.fn('AVG', Comanda.sequelize.col('final_value')), 'averageTicket'],
          [Comanda.sequelize.fn('SUM', Comanda.sequelize.col('discount_value')), 'totalDiscounts']
        ],
        raw: true
      });

      return comandas[0] || { totalComandas: 0, totalSales: 0, averageTicket: 0, totalDiscounts: 0 };
    };

    const period1Data = await getPeriodData(period1Start, period1End);
    const period2Data = await getPeriodData(period2Start, period2End);

    const comparison = {
      period1: {
        ...period1Data,
        startDate: period1Start,
        endDate: period1End
      },
      period2: {
        ...period2Data,
        startDate: period2Start,
        endDate: period2End
      },
      changes: {
        salesChange: parseFloat(period1Data.totalSales || 0) - parseFloat(period2Data.totalSales || 0),
        salesChangePercent: period2Data.totalSales > 0 
          ? ((parseFloat(period1Data.totalSales || 0) - parseFloat(period2Data.totalSales || 0)) / parseFloat(period2Data.totalSales)) * 100 
          : 0,
        comandasChange: parseInt(period1Data.totalComandas || 0) - parseInt(period2Data.totalComandas || 0),
        ticketChange: parseFloat(period1Data.averageTicket || 0) - parseFloat(period2Data.averageTicket || 0)
      }
    };

    res.json(comparison);
  } catch (error) {
    console.error('Get comparative report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getDashboardData = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    // Today's sales
    const todaySales = await Comanda.findAll({
      where: {
        status: 'fechada',
        closedAt: {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay
        }
      },
      attributes: [
        [Comanda.sequelize.fn('COUNT', Comanda.sequelize.col('id')), 'totalComandas'],
        [Comanda.sequelize.fn('SUM', Comanda.sequelize.col('final_value')), 'totalSales'],
        [Comanda.sequelize.fn('AVG', Comanda.sequelize.col('final_value')), 'averageTicket']
      ],
      raw: true
    });

    // Open comandas
    const openComandas = await Comanda.count({
      where: { status: 'aberta' }
    });

    // Low stock products
    const lowStockCount = await Product.count({
      where: {
        currentStock: {
          [Op.lte]: Product.sequelize.col('min_stock_alert')
        }
      }
    });

    // Top products today
    const topProducts = await ComandaItem.findAll({
      where: {
        created_at: {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay
        }
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name']
        },
        {
          model: Comanda,
          as: 'comanda',
          where: { status: 'fechada' },
          attributes: []
        }
      ],
      attributes: [
        'productId',
        [ComandaItem.sequelize.fn('SUM', ComandaItem.sequelize.col('quantity')), 'totalQuantity'],
        [ComandaItem.sequelize.fn('SUM', ComandaItem.sequelize.col('total_item_value')), 'totalRevenue']
      ],
      group: ['productId', 'product.id'],
      order: [[ComandaItem.sequelize.fn('SUM', ComandaItem.sequelize.col('total_item_value')), 'DESC']],
      limit: 5
    });

    res.json({
      todaySales: todaySales[0] || { totalComandas: 0, totalSales: 0, averageTicket: 0 },
      openComandas,
      lowStockCount,
      topProducts
    });
  } catch (error) {
    console.error('Get dashboard data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSalesByCategory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereClause = {};
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) whereClause.created_at[Op.gte] = new Date(startDate);
      if (endDate) whereClause.created_at[Op.lte] = new Date(endDate);
    }

    const categoryData = await ComandaItem.findAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['category']
        },
        {
          model: Comanda,
          as: 'comanda',
          where: { status: 'fechada' },
          attributes: []
        }
      ],
      attributes: [
        [ComandaItem.sequelize.col('product.category'), 'category'],
        [ComandaItem.sequelize.fn('SUM', ComandaItem.sequelize.col('total_item_value')), 'totalRevenue'],
        [ComandaItem.sequelize.fn('SUM', ComandaItem.sequelize.col('quantity')), 'totalQuantity'],
        [ComandaItem.sequelize.fn('COUNT', ComandaItem.sequelize.col('ComandaItem.id')), 'orderCount']
      ],
      group: ['product.category'],
      order: [[ComandaItem.sequelize.fn('SUM', ComandaItem.sequelize.col('total_item_value')), 'DESC']]
    });

    res.json(categoryData);
  } catch (error) {
    console.error('Get sales by category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSalesByPaymentMethod = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereClause = { status: 'fechada' };
    if (startDate || endDate) {
      whereClause.closedAt = {};
      if (startDate) whereClause.closedAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.closedAt[Op.lte] = new Date(endDate);
    }

    const paymentData = await Comanda.findAll({
      where: whereClause,
      attributes: [
        'paymentMethod',
        [Comanda.sequelize.fn('COUNT', Comanda.sequelize.col('id')), 'totalComandas'],
        [Comanda.sequelize.fn('SUM', Comanda.sequelize.col('final_value')), 'totalRevenue'],
        [Comanda.sequelize.fn('AVG', Comanda.sequelize.col('final_value')), 'averageTicket']
      ],
      group: ['paymentMethod'],
      order: [[Comanda.sequelize.fn('SUM', Comanda.sequelize.col('final_value')), 'DESC']]
    });

    res.json(paymentData);
  } catch (error) {
    console.error('Get sales by payment method error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSalesByHour = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereClause = { status: 'fechada' };
    if (startDate || endDate) {
      whereClause.closedAt = {};
      if (startDate) whereClause.closedAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.closedAt[Op.lte] = new Date(endDate);
    }

    const hourlyData = await Comanda.findAll({
      where: whereClause,
      attributes: [
        [Comanda.sequelize.fn('EXTRACT', Comanda.sequelize.literal('HOUR FROM closed_at')), 'hour'],
        [Comanda.sequelize.fn('COUNT', Comanda.sequelize.col('id')), 'totalComandas'],
        [Comanda.sequelize.fn('SUM', Comanda.sequelize.col('final_value')), 'totalRevenue'],
        [Comanda.sequelize.fn('AVG', Comanda.sequelize.col('final_value')), 'averageTicket']
      ],
      group: [Comanda.sequelize.fn('EXTRACT', Comanda.sequelize.literal('HOUR FROM closed_at'))],
      order: [[Comanda.sequelize.fn('EXTRACT', Comanda.sequelize.literal('HOUR FROM closed_at')), 'ASC']]
    });

    res.json(hourlyData);
  } catch (error) {
    console.error('Get sales by hour error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getStockReport = async (req, res) => {
  try {
    const { startDate, endDate, type, productId } = req.query;

    const whereClause = {};
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) whereClause.created_at[Op.gte] = new Date(startDate);
      if (endDate) whereClause.created_at[Op.lte] = new Date(endDate);
    }
    if (type) whereClause.type = type;
    if (productId) whereClause.productId = productId;

    const movements = await StockMovement.findAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'category', 'unitOfMeasure']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Agrupar por produto
    const productSummary = await StockMovement.findAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'category']
        }
      ],
      attributes: [
        'productId',
        'type',
        [StockMovement.sequelize.fn('SUM', StockMovement.sequelize.col('quantity')), 'totalQuantity'],
        [StockMovement.sequelize.fn('COUNT', StockMovement.sequelize.col('StockMovement.id')), 'movementCount']
      ],
      group: ['productId', 'type', 'product.id'],
      order: [['productId', 'ASC'], ['type', 'ASC']]
    });

    res.json({
      movements,
      productSummary
    });
  } catch (error) {
    console.error('Get stock report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getFinancialSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereClause = { status: 'fechada' };
    if (startDate || endDate) {
      whereClause.closedAt = {};
      if (startDate) whereClause.closedAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.closedAt[Op.lte] = new Date(endDate);
    }

    const summary = await Comanda.findAll({
      where: whereClause,
      attributes: [
        [Comanda.sequelize.fn('COUNT', Comanda.sequelize.col('id')), 'totalComandas'],
        [Comanda.sequelize.fn('SUM', Comanda.sequelize.col('total_value')), 'grossRevenue'],
        [Comanda.sequelize.fn('SUM', Comanda.sequelize.col('discount_value')), 'totalDiscounts'],
        [Comanda.sequelize.fn('SUM', Comanda.sequelize.col('final_value')), 'netRevenue'],
        [Comanda.sequelize.fn('AVG', Comanda.sequelize.col('final_value')), 'averageTicket']
      ],
      raw: true
    });

    // Comandas não pagas
    const unpaidComandas = await Comanda.findAll({
      where: {
        ...whereClause,
        paymentStatus: 'nao_pago'
      },
      attributes: [
        [Comanda.sequelize.fn('COUNT', Comanda.sequelize.col('id')), 'count'],
        [Comanda.sequelize.fn('SUM', Comanda.sequelize.col('final_value')), 'totalValue']
      ],
      raw: true
    });

    res.json({
      ...summary[0],
      unpaidComandas: unpaidComandas[0] || { count: 0, totalValue: 0 }
    });
  } catch (error) {
    console.error('Get financial summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Função auxiliar para agrupar vendas por período
const groupSalesByPeriod = (comandas, groupBy) => {
  const grouped = {};

  comandas.forEach(comanda => {
    const date = new Date(comanda.closedAt);
    let key;

    switch (groupBy) {
      case 'hour':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
        break;
      case 'day':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        break;
      case 'week':
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        key = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      default:
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    if (!grouped[key]) {
      grouped[key] = {
        period: key,
        totalSales: 0,
        totalComandas: 0,
        totalDiscounts: 0
      };
    }

    grouped[key].totalSales += parseFloat(comanda.finalValue || comanda.totalValue);
    grouped[key].totalComandas += 1;
    grouped[key].totalDiscounts += parseFloat(comanda.discountValue || 0);
  });

  return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
};

module.exports = {
  getSalesReport,
  getProductConsumptionReport,
  getWaiterPerformanceReport,
  getComparativeReport,
  getDashboardData,
  getSalesByCategory,
  getSalesByPaymentMethod,
  getSalesByHour,
  getStockReport,
  getFinancialSummary
};

