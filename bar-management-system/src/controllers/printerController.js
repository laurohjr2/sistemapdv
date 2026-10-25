const { Comanda, ComandaItem, Table, Product, User } = require('../models');
const printerService = require('../services/printerService');
const { logAction } = require('../utils/auditLogger');

const printComanda = async (req, res) => {
  try {
    const { id } = req.params;

    const comanda = await Comanda.findByPk(id, {
      include: [
        {
          model: Table,
          as: 'table',
          attributes: ['id', 'tableNumber']
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
      ]
    });

    if (!comanda) {
      return res.status(404).json({ error: 'Comanda not found' });
    }

    const result = await printerService.printComanda(comanda);

    if (result.success) {
      await logAction(req.user.id, 'comanda_printed', {
        comandaId: comanda.id,
        tableNumber: comanda.table.tableNumber
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Print comanda error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const printReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    const comanda = await Comanda.findByPk(id, {
      include: [
        {
          model: Table,
          as: 'table',
          attributes: ['id', 'tableNumber']
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
      ]
    });

    if (!comanda) {
      return res.status(404).json({ error: 'Comanda not found' });
    }

    if (comanda.status !== 'fechada') {
      return res.status(400).json({ error: 'Can only print receipt for closed comandas' });
    }

    const result = await printerService.printReceipt(comanda);

    if (result.success) {
      await logAction(req.user.id, 'receipt_printed', {
        comandaId: comanda.id,
        tableNumber: comanda.table.tableNumber
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Print receipt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const testPrint = async (req, res) => {
  try {
    const result = await printerService.testPrint();

    if (result.success) {
      await logAction(req.user.id, 'printer_test', {});
    }

    res.json(result);
  } catch (error) {
    console.error('Test print error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  printComanda,
  printReceipt,
  testPrint
};

