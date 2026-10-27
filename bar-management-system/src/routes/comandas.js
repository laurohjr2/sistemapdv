const express = require('express');
const { 
  openComanda,
  addItemToComanda,
  updateItemQuantity,
  getComandaById,
  closeComanda,
  removeItemFromComanda,
  getAllComandas,
  getOpenComandas,
  updateComandaPaymentStatus,
  cancelComanda
} = require('../controllers/comandaController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);
router.use((req,res,next)=>['GET','HEAD'].includes(req.method)?next():require('../middleware/businessModule')('tables')(req,res,next));

// Routes accessible by all authenticated users
router.get('/', getAllComandas);
router.get('/open', getOpenComandas);
router.get('/:id', getComandaById);

// Routes for garcom, gerente and admin
router.post('/', authorizeRoles('garcom', 'gerente', 'admin'), openComanda);
router.post('/:comandaId/items', authorizeRoles('garcom', 'gerente', 'admin'), addItemToComanda);
router.put('/:comandaId/items/:itemId', authorizeRoles('garcom','gerente','admin'), updateItemQuantity);
router.delete('/:comandaId/items/:itemId', authorizeRoles('garcom', 'gerente', 'admin'), removeItemFromComanda);

// Routes for gerente and admin only
router.put('/:id/close', authorizeRoles('gerente', 'admin'), closeComanda);
router.put('/:id/payment-status', authorizeRoles('gerente', 'admin'), updateComandaPaymentStatus);
router.put('/:id/cancel', authorizeRoles('gerente', 'admin'), cancelComanda);

module.exports = router;