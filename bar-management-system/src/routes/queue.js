const express = require('express');
const { 
  getQueueItems,
  updateItemStatus,
  updateItemPriority,
  getQueueSummary,
  getItemsByTable,
  markMultipleItemsAsDelivered,
  getPreparationReport
} = require('../controllers/queueController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Routes accessible by all authenticated users
router.get('/', getQueueItems);
router.get('/summary', getQueueSummary);
router.get('/table/:tableId', getItemsByTable);
router.get('/report', getPreparationReport);

// Routes for garcom, gerente and admin
router.put('/items/:id/status', authorizeRoles('garcom', 'gerente', 'admin'), updateItemStatus);
router.put('/items/:id/priority', authorizeRoles('garcom', 'gerente', 'admin'), updateItemPriority);
router.put('/items/deliver-multiple', authorizeRoles('garcom', 'gerente', 'admin'), markMultipleItemsAsDelivered);

module.exports = router;

