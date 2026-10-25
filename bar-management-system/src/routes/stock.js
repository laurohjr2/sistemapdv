const express = require('express');
const { 
  addStock,
  removeStock,
  adjustStock,
  getStockMovements,
  getLowStockProducts,
  getStockReport,
  getStockHistory,
  getStockSummary
} = require('../controllers/stockController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Routes accessible by all authenticated users
router.get('/movements', getStockMovements);
router.get('/low-stock', getLowStockProducts);
router.get('/report', getStockReport);
router.get('/summary', getStockSummary);
router.get('/history/:id', getStockHistory);

// Routes for managers and admins only
router.post('/add', authorizeRoles('gerente', 'admin'), addStock);
router.post('/remove', authorizeRoles('gerente', 'admin'), removeStock);
router.post('/adjust', authorizeRoles('gerente', 'admin'), adjustStock);

module.exports = router;

