const { ComandaItem, Comanda, Product, User, Table } = require('../models');
const { logAction } = require('../utils/auditLogger');
const { Op } = require('sequelize');

const getQueueItems = async (req, res) => {
  try {
    const { status, priority, productCategory, limit = 100 } = req.query;
    
    const whereClause = {};
    
    // Filtrar apenas itens que precisam de preparo (não entregues)
    if (status) {
      whereClause.preparationStatus = status;
    } else {
      whereClause.preparationStatus = {
        [Op.in]: ['pendente', 'preparando', 'pronto']
      };
    }
    
    if (priority) {
      whereClause.priority = priority;
    }

    const includeClause = [
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'category', 'preparationTime'],
        where: productCategory ? { category: productCategory } : {}
      },
      {
        model: Comanda,
        as: 'comanda',
        attributes: ['id', 'type', 'customerName', 'tableId'],
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
          }
        ]
      },
      {
        model: User,
        as: 'deliveredByUser',
        attributes: ['id', 'username'],
        required: false
      }
    ];

    const items = await ComandaItem.findAll({
      where: whereClause,
      include: includeClause,
      order: [
        ['priority', 'DESC'], // Urgente primeiro
        ['created_at', 'ASC'] // Mais antigos primeiro
      ],
      limit: parseInt(limit)
    });

    // Agrupar por status para facilitar a visualização
    const groupedItems = {
      pendente: items.filter(item => item.preparationStatus === 'pendente'),
      preparando: items.filter(item => item.preparationStatus === 'preparando'),
      pronto: items.filter(item => item.preparationStatus === 'pronto')
    };

    res.json({
      items,
      groupedItems,
      summary: {
        total: items.length,
        pendente: groupedItems.pendente.length,
        preparando: groupedItems.preparando.length,
        pronto: groupedItems.pronto.length
      }
    });
  } catch (error) {
    console.error('Get queue items error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateItemStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['pendente', 'preparando', 'pronto', 'entregue'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const item = await ComandaItem.findByPk(id, {
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name']
        },
        {
          model: Comanda,
          as: 'comanda',
          attributes: ['id', 'type', 'customerName', 'tableId'],
          include: [
            {
              model: Table,
              as: 'table',
              attributes: ['id', 'tableNumber'],
              required: false
            }
          ]
        }
      ]
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const updateData = {
      preparationStatus: status,
      kitchenNotes: notes || item.kitchenNotes
    };

    // Atualizar timestamps baseado no status
    const now = new Date();
    switch (status) {
      case 'preparando':
        if (!item.preparationStartedAt) {
          updateData.preparationStartedAt = now;
        }
        break;
      case 'pronto':
        if (!item.preparationStartedAt) {
          updateData.preparationStartedAt = now;
        }
        updateData.preparationCompletedAt = now;
        break;
      case 'entregue':
        if (!item.preparationStartedAt) {
          updateData.preparationStartedAt = now;
        }
        if (!item.preparationCompletedAt) {
          updateData.preparationCompletedAt = now;
        }
        updateData.deliveredAt = now;
        updateData.deliveredByUserId = req.user.id;
        break;
    }

    await item.update(updateData);

    await logAction(req.user.id, 'queue_item_status_updated', {
      itemId: item.id,
      productName: item.product.name,
      comandaId: item.comandaId,
      oldStatus: item.preparationStatus,
      newStatus: status,
      tableNumber: item.comanda.table?.tableNumber,
      customerName: item.comanda.customerName
    });

    res.json({
      message: 'Item status updated successfully',
      item
    });
  } catch (error) {
    console.error('Update item status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateItemPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!['baixa', 'normal', 'alta', 'urgente'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    const item = await ComandaItem.findByPk(id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const oldPriority = item.priority;
    await item.update({ priority });

    await logAction(req.user.id, 'queue_item_priority_updated', {
      itemId: item.id,
      comandaId: item.comandaId,
      oldPriority,
      newPriority: priority
    });

    res.json({
      message: 'Item priority updated successfully',
      item
    });
  } catch (error) {
    console.error('Update item priority error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getQueueSummary = async (req, res) => {
  try {
    const summary = await ComandaItem.findAll({
      attributes: [
        'preparationStatus',
        [ComandaItem.sequelize.fn('COUNT', ComandaItem.sequelize.col('id')), 'count']
      ],
      where: {
        preparationStatus: {
          [Op.in]: ['pendente', 'preparando', 'pronto']
        }
      },
      group: ['preparationStatus']
    });
    const averagePreparationTime = await ComandaItem.findAll({
      attributes: [
        [
          ComandaItem.sequelize.fn(
            'AVG',
            ComandaItem.sequelize.literal(
              'EXTRACT(EPOCH FROM (preparation_completed_at - preparation_started_at))/60'
            )
          ),
          'avgMinutes'
        ]
      ],
      where: {
        preparationStatus: 'pronto',
        preparationStartedAt: { [Op.not]: null },
        preparationCompletedAt: { [Op.not]: null },
        createdAt: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
        }
      }
    });

    const oldestPendingItem = await ComandaItem.findOne({
      where: { preparationStatus: 'pendente' },
      order: [['created_at', 'ASC']],
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['name']
        }
      ]
    });

    const formattedSummary = {
      pendente: 0,
      preparando: 0,
      pronto: 0,
      averagePreparationTime: parseFloat(averagePreparationTime[0]?.dataValues?.avgMinutes || 0).toFixed(1),
      oldestPendingItem: oldestPendingItem ? {
        id: oldestPendingItem.id,
        productName: oldestPendingItem.product.name,
        waitingTime: Math.round((new Date() - new Date(oldestPendingItem.createdAt)) / (1000 * 60))
      } : null
    };

    summary.forEach(item => {
      formattedSummary[item.preparationStatus] = parseInt(item.dataValues.count);
    });

    res.json(formattedSummary);
  } catch (error) {
    console.error('Get queue summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getItemsByTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { status } = req.query;

    const whereClause = {};
    if (status) {
      whereClause.preparationStatus = status;
    } else {
      whereClause.preparationStatus = {
        [Op.in]: ['pendente', 'preparando', 'pronto']
      };
    }

    const items = await ComandaItem.findAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'category', 'preparationTime']
        },
        {
          model: Comanda,
          as: 'comanda',
          where: { tableId },
          attributes: ['id', 'type', 'customerName'],
          include: [
            {
              model: Table,
              as: 'table',
              attributes: ['id', 'tableNumber']
            }
          ]
        }
      ],
      order: [['created_at', 'ASC']]
    });

    res.json(items);
  } catch (error) {
    console.error('Get items by table error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const markMultipleItemsAsDelivered = async (req, res) => {
  try {
    const { itemIds } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'Item IDs array is required' });
    }

    const items = await ComandaItem.findAll({
      where: {
        id: { [Op.in]: itemIds },
        preparationStatus: { [Op.in]: ['pronto', 'preparando'] }
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
          attributes: ['id', 'customerName', 'tableId'],
          include: [
            {
              model: Table,
              as: 'table',
              attributes: ['id', 'tableNumber'],
              required: false
            }
          ]
        }
      ]
    });

    if (items.length === 0) {
      return res.status(404).json({ error: 'No valid items found' });
    }

    const now = new Date();
    const updatePromises = items.map(item => {
      const updateData = {
        preparationStatus: 'entregue',
        deliveredAt: now,
        deliveredByUserId: req.user.id
      };

      if (!item.preparationStartedAt) {
        updateData.preparationStartedAt = now;
      }
      if (!item.preparationCompletedAt) {
        updateData.preparationCompletedAt = now;
      }

      return item.update(updateData);
    });

    await Promise.all(updatePromises);

    // Log da ação
    await logAction(req.user.id, 'multiple_items_delivered', {
      itemCount: items.length,
      itemIds: itemIds,
      items: items.map(item => ({
        productName: item.product.name,
        comandaId: item.comandaId,
        tableNumber: item.comanda.table?.tableNumber,
        customerName: item.comanda.customerName
      }))
    });

    res.json({
      message: `${items.length} items marked as delivered successfully`,
      deliveredItems: items.length
    });
  } catch (error) {
    console.error('Mark multiple items as delivered error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getPreparationReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const whereClause = {
      preparationStatus: 'entregue',
      deliveredAt: { [Op.not]: null }
    };

    if (startDate || endDate) {
      whereClause.deliveredAt = {};
      if (startDate) whereClause.deliveredAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.deliveredAt[Op.lte] = new Date(endDate);
    }

    const items = await ComandaItem.findAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'category']
        }
      ],
      order: [['deliveredAt', 'DESC']]
    });

    // Calcular estatísticas
    const stats = {
      totalItems: items.length,
      averagePreparationTime: 0,
      itemsByCategory: {},
      itemsByHour: {},
      preparationTimes: []
    };

    items.forEach(item => {
      // Tempo de preparo
      if (item.preparationStartedAt && item.preparationCompletedAt) {
        const prepTime = (new Date(item.preparationCompletedAt) - new Date(item.preparationStartedAt)) / (1000 * 60);
        stats.preparationTimes.push(prepTime);
      }

      // Itens por categoria
      const category = item.product.category;
      stats.itemsByCategory[category] = (stats.itemsByCategory[category] || 0) + 1;

      // Itens por hora
      const hour = new Date(item.deliveredAt).getHours();
      stats.itemsByHour[hour] = (stats.itemsByHour[hour] || 0) + 1;
    });

    // Calcular tempo médio de preparo
    if (stats.preparationTimes.length > 0) {
      stats.averagePreparationTime = stats.preparationTimes.reduce((a, b) => a + b, 0) / stats.preparationTimes.length;
    }

    res.json({
      items,
      stats
    });
  } catch (error) {
    console.error('Get preparation report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getQueueItems,
  updateItemStatus,
  updateItemPriority,
  getQueueSummary,
  getItemsByTable,
  markMultipleItemsAsDelivered,
  getPreparationReport
};

