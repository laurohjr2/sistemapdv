const express = require('express');
const { 
  generateComandaReceipt,
  generateSalesReport,
  generateProductReport,
  reprintReceipt
} = require('../controllers/printController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Routes for garcom, gerente and admin
router.get('/comanda/:id', authorizeRoles('garcom', 'gerente', 'admin'), generateComandaReceipt);
router.get('/comanda/:id/reprint', authorizeRoles('garcom', 'gerente', 'admin'), reprintReceipt);

// Routes for gerente and admin only
router.get('/sales-report', authorizeRoles('gerente', 'admin'), generateSalesReport);
router.get('/product-report', authorizeRoles('gerente', 'admin'), generateProductReport);

module.exports = router;

