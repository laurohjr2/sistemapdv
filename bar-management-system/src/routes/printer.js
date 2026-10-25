const express = require('express');
const { printComanda, printReceipt, testPrint } = require('../controllers/printerController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Print routes accessible by all authenticated users
router.post('/comanda/:id', printComanda);
router.post('/receipt/:id', printReceipt);
router.post('/test', testPrint);

module.exports = router;

