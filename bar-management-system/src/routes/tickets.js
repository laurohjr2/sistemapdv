const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const requireRole = require('../middleware/requireRole');
const {
  createTicket,
  getTickets,
  getTicketByNumber,
  redeemTicket,
  cancelTicket
} = require('../controllers/ticketController');

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Rotas protegidas por papéis
router.post('/', requireRole(['garcom', 'gerente', 'admin']), createTicket);
router.get('/', requireRole(['garcom', 'gerente', 'admin']), getTickets);
router.get('/:ticketNumber', requireRole(['garcom', 'gerente', 'admin']), getTicketByNumber);
router.post('/:ticketNumber/redeem', requireRole(['garcom', 'gerente', 'admin']), redeemTicket);
router.post('/:ticketNumber/cancel', requireRole(['gerente', 'admin']), cancelTicket);

module.exports = router;
