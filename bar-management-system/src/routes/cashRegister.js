const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Importar o modelo de caixa (será criado)
const CashRegister = require('../models/CashRegister');
const Sale = require('../models/Sale');

// Obter status atual do caixa
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const cashRegister = await CashRegister.findOne({
      where: { is_open: true },
      order: [['created_at', 'DESC']]
    });

    res.json(cashRegister || { is_open: false });
  } catch (error) {
    console.error('Erro ao buscar status do caixa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Abrir caixa
router.post('/open', authenticateToken, async (req, res) => {
  try {
    const { opened_by, opening_amount } = req.body;

    if (!opened_by || opening_amount === undefined) {
      return res.status(400).json({ error: 'Dados obrigatórios não fornecidos' });
    }

    // Verificar se já existe um caixa aberto
    const existingCashRegister = await CashRegister.findOne({
      where: { is_open: true }
    });

    if (existingCashRegister) {
      return res.status(400).json({ error: 'Já existe um caixa aberto' });
    }

    const cashRegister = await CashRegister.create({
      opened_by,
      opening_amount: parseFloat(opening_amount),
      opened_at: new Date(),
      is_open: true
    });

    res.status(201).json(cashRegister);
  } catch (error) {
    console.error('Erro ao abrir caixa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Fechar caixa
router.post('/close', authenticateToken, async (req, res) => {
  try {
    const { closing_amount } = req.body;

    if (closing_amount === undefined) {
      return res.status(400).json({ error: 'Valor de fechamento é obrigatório' });
    }

    const cashRegister = await CashRegister.findOne({
      where: { is_open: true }
    });

    if (!cashRegister) {
      return res.status(400).json({ error: 'Nenhum caixa aberto encontrado' });
    }

    // Calcular total de vendas do dia
    const totalSales = await Sale.sum('total_amount', {
      where: {
        cash_register_id: cashRegister.id,
        status: 'completed'
      }
    }) || 0;

    const expectedAmount = Number(cashRegister.opening_amount) + Number(totalSales);
    const difference = parseFloat(closing_amount) - expectedAmount;

    // Atualizar o registro do caixa
    await cashRegister.update({
      closing_amount: parseFloat(closing_amount),
      closed_at: new Date(),
      is_open: false,
      total_sales: totalSales,
      difference: difference
    });

    res.json({
      message: 'Caixa fechado com sucesso',
      opening_amount: cashRegister.opening_amount,
      total_sales: totalSales,
      expected_amount: expectedAmount,
      closing_amount: parseFloat(closing_amount),
      difference: difference
    });
  } catch (error) {
    console.error('Erro ao fechar caixa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Obter relatório do caixa
router.get('/report/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const cashRegister = await CashRegister.findByPk(id, {
      include: [{
        model: Sale,
        as: 'sales',
        where: { status: 'completed' },
        required: false
      }]
    });

    if (!cashRegister) {
      return res.status(404).json({ error: 'Registro de caixa não encontrado' });
    }

    res.json(cashRegister);
  } catch (error) {
    console.error('Erro ao buscar relatório do caixa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

