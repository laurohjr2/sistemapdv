const express = require('express');
const { 
  getAllTables, 
  getTableById, 
  createTable, 
  updateTable, 
  deleteTable,
  openTableComanda,
  closeTableComanda,
  getTableReceipt
} = require('../controllers/tableController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Routes accessible by all authenticated users
router.get('/', getAllTables);
router.get('/:id', getTableById);
router.get('/:id/receipt', getTableReceipt);

// Routes for garcom, managers and admins
router.post('/:id/open-comanda', authorizeRoles('garcom', 'gerente', 'admin'), openTableComanda);
router.post('/:id/close-comanda', authorizeRoles('garcom', 'gerente', 'admin'), closeTableComanda);

// Routes for managers and admins only
router.post('/', authorizeRoles('gerente', 'admin'), createTable);
router.put('/:id', authorizeRoles('gerente', 'admin'), updateTable);
router.delete('/:id', authorizeRoles('gerente', 'admin'), deleteTable);

module.exports = router;

