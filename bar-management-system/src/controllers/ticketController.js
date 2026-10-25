const { Ticket, Product, CashRegister } = require('../models');
const { logAction } = require('../utils/auditLogger');

// Gerar número único para o ticket
const generateTicketNumber = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `TK${timestamp}${random}`.toUpperCase();
};

// Criar ticket rápido
const createTicket = async (req, res) => {
  try {
    const { productId, quantity = 1, customerName, notes } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;

    // Verificar se há caixa aberto
    const openCashRegister = await CashRegister.findOne({
      where: { is_open: true },
      order: [['opened_at', 'DESC']]
    });

    if (!openCashRegister) {
      return res.status(400).json({
        error: 'Não é possível emitir tickets sem um caixa aberto'
      });
    }

    // Buscar produto
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    // Verificar estoque
    if (product.currentStock < quantity) {
      return res.status(400).json({
        error: `Estoque insuficiente. Disponível: ${product.currentStock} ${product.unitOfMeasure}`
      });
    }

    const unitPrice = parseFloat(product.price);
    const totalAmount = unitPrice * parseFloat(quantity);
    const ticketNumber = generateTicketNumber();

    // Criar ticket
    const ticket = await Ticket.create({
      ticket_number: ticketNumber,
      product_id: productId,
      quantity: parseFloat(quantity),
      unit_price: unitPrice,
      total_amount: totalAmount,
      customer_name: customerName,
      issued_by: userName,
      notes,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
    });

    // Reduzir estoque
    await product.update({
      currentStock: parseFloat(product.currentStock) - parseFloat(quantity)
    });

    // Log da ação
    await logAction(userId, 'ticket_created', 'Ticket', ticket.id, {
      ticket_number: ticketNumber,
      product: product.name,
      quantity,
      total_amount: totalAmount
    });

    // Buscar ticket com produto para retorno
    const ticketWithProduct = await Ticket.findByPk(ticket.id, {
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'unitOfMeasure']
      }]
    });

    res.status(201).json(ticketWithProduct);
  } catch (error) {
    console.error('Erro ao criar ticket:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Listar tickets
const getTickets = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const tickets = await Ticket.findAndCountAll({
      where: whereClause,
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'unitOfMeasure']
      }],
      order: [['issued_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      tickets: tickets.rows,
      total: tickets.count,
      page: parseInt(page),
      totalPages: Math.ceil(tickets.count / limit)
    });
  } catch (error) {
    console.error('Erro ao buscar tickets:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Buscar ticket por número
const getTicketByNumber = async (req, res) => {
  try {
    const { ticketNumber } = req.params;

    const ticket = await Ticket.findOne({
      where: { ticket_number: ticketNumber },
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'unitOfMeasure', 'price']
      }]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Erro ao buscar ticket:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Resgatar ticket
const redeemTicket = async (req, res) => {
  try {
    const { ticketNumber } = req.params;
    const userId = req.user.id;
    const userName = req.user.name;

    const ticket = await Ticket.findOne({
      where: { ticket_number: ticketNumber },
      include: [{
        model: Product,
        as: 'product'
      }]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    if (ticket.status !== 'pending') {
      return res.status(400).json({ error: 'Ticket já foi resgatado ou cancelado' });
    }

    if (ticket.expires_at && new Date() > ticket.expires_at) {
      return res.status(400).json({ error: 'Ticket expirado' });
    }

    // Atualizar ticket
    await ticket.update({
      status: 'redeemed',
      redeemed_by: userName,
      redeemed_at: new Date()
    });

    // Log da ação
    await logAction(userId, 'ticket_redeemed', 'Ticket', ticket.id, {
      ticket_number: ticketNumber,
      product: ticket.product.name,
      quantity: ticket.quantity
    });

    res.json({ message: 'Ticket resgatado com sucesso', ticket });
  } catch (error) {
    console.error('Erro ao resgatar ticket:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Cancelar ticket
const cancelTicket = async (req, res) => {
  try {
    const { ticketNumber } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;

    const ticket = await Ticket.findOne({
      where: { ticket_number: ticketNumber },
      include: [{
        model: Product,
        as: 'product'
      }]
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    if (ticket.status !== 'pending') {
      return res.status(400).json({ error: 'Ticket já foi resgatado ou cancelado' });
    }

    // Devolver estoque
    await ticket.product.update({
      currentStock: parseFloat(ticket.product.currentStock) + parseFloat(ticket.quantity)
    });

    // Atualizar ticket
    await ticket.update({
      status: 'cancelled',
      notes: ticket.notes ? `${ticket.notes}\nCancelado: ${reason}` : `Cancelado: ${reason}`
    });

    // Log da ação
    await logAction(userId, 'ticket_cancelled', 'Ticket', ticket.id, {
      ticket_number: ticketNumber,
      product: ticket.product.name,
      quantity: ticket.quantity,
      reason
    });

    res.json({ message: 'Ticket cancelado com sucesso', ticket });
  } catch (error) {
    console.error('Erro ao cancelar ticket:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = {
  createTicket,
  getTickets,
  getTicketByNumber,
  redeemTicket,
  cancelTicket
};

