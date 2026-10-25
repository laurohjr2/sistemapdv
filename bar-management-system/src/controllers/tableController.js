const { openTable } = require('../services/tableSeatingService');
const { Table, Comanda, ComandaItem, Product, User, sequelize } = require('../models');
const { logAction } = require('../utils/auditLogger');

const getAllTables = async (req, res) => {
  try {
    const tables = await Table.findAll({
      include: [
        {
          model: Comanda,
          as: 'comandas',
          where: { status: 'aberta' },
          required: false,
          attributes: ['id', 'openedAt', 'totalValue'],
          include: [
            {
              model: ComandaItem,
              as: 'items',
              include: [
                {
                  model: Product,
                  as: 'product',
                  attributes: ['name']
                }
              ]
            }
          ]
        }
      ],
      order: [['tableNumber', 'ASC']]
    });

    res.json(tables);
  } catch (error) {
    console.error('Get tables error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTableById = async (req, res) => {
  try {
    const { id } = req.params;
    const table = await Table.findByPk(id, {
      include: [
        {
          model: Comanda,
          as: 'comandas',
          where: { status: 'aberta' },
          required: false,
          attributes: ['id', 'openedAt', 'totalValue'],
          include: [
            {
              model: ComandaItem,
              as: 'items',
              include: [
                {
                  model: Product,
                  as: 'product',
                  attributes: ['name', 'salePrice']
                }
              ]
            }
          ]
        }
      ]
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    res.json(table);
  } catch (error) {
    console.error('Get table error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createTable = async (req, res) => {
  try {
    const { tableNumber, capacity } = req.body;

    if (!tableNumber) {
      return res.status(400).json({ error: 'Table number is required' });
    }

    const existingTable = await Table.findOne({ where: { tableNumber } });
    if (existingTable) {
      return res.status(409).json({ error: 'Table number already exists' });
    }

    const table = await Table.create({
      tableNumber,
      capacity
    });

    await logAction(req.user.id, 'table_created', {
      tableId: table.id,
      tableNumber: table.tableNumber
    });

    res.status(201).json({
      message: 'Table created successfully',
      table
    });
  } catch (error) {
    console.error('Create table error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { tableNumber, capacity, status } = req.body;

    const table = await Table.findByPk(id);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const updateData = {};
    if (tableNumber !== undefined) updateData.tableNumber = tableNumber;
    if (capacity !== undefined) updateData.capacity = capacity;
    if (status !== undefined) updateData.status = status;

    await table.update(updateData);

    await logAction(req.user.id, 'table_updated', {
      tableId: table.id,
      changes: updateData
    });

    res.json({
      message: 'Table updated successfully',
      table
    });
  } catch (error) {
    console.error('Update table error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteTable = async (req, res) => {
  try {
    const { id } = req.params;

    const table = await Table.findByPk(id);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Check if table has open comandas
    const openComandas = await Comanda.findOne({
      where: { tableId: id, status: 'aberta' }
    });

    if (openComandas) {
      return res.status(400).json({ 
        error: 'Cannot delete table with open comandas' 
      });
    }

    await logAction(req.user.id, 'table_deleted', {
      tableId: table.id,
      tableNumber: table.tableNumber
    });

    await table.destroy();

    res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    console.error('Delete table error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const openTableComanda = async (req, res) => {
  try {
    const { id } = req.params;

    const {table, comanda} = await sequelize.transaction(transaction => openTable({
      tableId:id, userId:req.user.id, transaction
    }));

    await logAction(req.user.id, 'comanda_opened', {
      comandaId: comanda.id,
      tableNumber: table.tableNumber
    });

    res.status(201).json({
      message: 'Comanda opened successfully',
      comanda
    });
  } catch (error) {
    console.error('Open table comanda error:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Internal server error' });
  }
};

const closeTableComanda = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;

    const table = await Table.findByPk(id);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const comanda = await Comanda.findOne({
      where: { tableId: id, status: 'aberta' },
      include: [
        {
          model: ComandaItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['name', 'salePrice']
            }
          ]
        }
      ]
    });

    if (!comanda) {
      return res.status(404).json({ error: 'No open comanda found for this table' });
    }

    await comanda.update({
      status: 'fechada',
      closedAt: new Date(),
      paymentMethod
    });

    // Update table status
    await table.update({ status: 'disponivel' });

    await logAction(req.user.id, 'comanda_closed', {
      comandaId: comanda.id,
      tableNumber: table.tableNumber,
      totalValue: comanda.totalValue,
      paymentMethod
    });

    res.json({
      message: 'Comanda closed successfully',
      comanda,
      receipt: {
        tableNumber: table.tableNumber,
        items: comanda.items,
        totalValue: comanda.totalValue,
        paymentMethod,
        closedAt: comanda.closedAt
      }
    });
  } catch (error) {
    console.error('Close table comanda error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTableReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    const table = await Table.findByPk(id);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const comanda = await Comanda.findOne({
      where: { tableId: id, status: 'aberta' },
      include: [
        {
          model: ComandaItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['name', 'salePrice']
            }
          ]
        },
        {
          model: User,
          as: 'openedByUser',
          attributes: ['username']
        }
      ]
    });

    if (!comanda) {
      return res.status(404).json({ error: 'No open comanda found for this table' });
    }

    const receipt = {
      tableNumber: table.tableNumber,
      comandaId: comanda.id,
      openedAt: comanda.openedAt,
      openedBy: comanda.openedByUser.username,
      items: comanda.items.map(item => ({
        productName: item.product.name,
        quantity: item.quantity,
        priceAtSale: item.priceAtSale,
        totalItemValue: item.totalItemValue
      })),
      totalValue: comanda.totalValue,
      status: comanda.status
    };

    res.json(receipt);
  } catch (error) {
    console.error('Get table receipt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllTables,
  getTableById,
  createTable,
  updateTable,
  deleteTable,
  openTableComanda,
  closeTableComanda,
  getTableReceipt
};

