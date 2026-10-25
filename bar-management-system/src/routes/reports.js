const express = require('express');
const { 
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
} = require('../controllers/reportController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Routes accessible by gerente and admin
router.get('/sales', authorizeRoles('gerente', 'admin'), getSalesReport);
router.get('/products', authorizeRoles('gerente', 'admin'), getProductConsumptionReport);
router.get('/waiters', authorizeRoles('gerente', 'admin'), getWaiterPerformanceReport);
router.get('/comparative', authorizeRoles('gerente', 'admin'), getComparativeReport);
router.get('/dashboard', authorizeRoles('gerente', 'admin'), getDashboardData);
router.get('/sales-by-category', authorizeRoles('gerente', 'admin'), getSalesByCategory);
router.get('/sales-by-payment', authorizeRoles('gerente', 'admin'), getSalesByPaymentMethod);
router.get('/sales-by-hour', authorizeRoles('gerente', 'admin'), getSalesByHour);
router.get('/stock', authorizeRoles('gerente', 'admin'), getStockReport);
router.get('/financial', authorizeRoles('gerente', 'admin'), getFinancialSummary);

module.exports = router;

