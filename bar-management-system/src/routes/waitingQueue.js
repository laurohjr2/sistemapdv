const express = require('express');
const { 
  addToQueue,
  getQueue,
  seatClient,
  cancelQueueEntry,
  getQueueStats
} = require('../controllers/waitingQueueController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Routes accessible by all authenticated users
router.post('/', addToQueue);
router.get('/', getQueue);
router.put('/:id/seat', seatClient);
router.put('/:id/cancel', cancelQueueEntry);
router.get('/stats', getQueueStats);

module.exports = router;

