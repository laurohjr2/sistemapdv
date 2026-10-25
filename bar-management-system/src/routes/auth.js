const express = require('express');
const { login, register, validateToken } = require('../controllers/authController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes
router.post('/register', authenticateToken, authorizeRoles('admin'), register);
router.get('/validate', authenticateToken, validateToken);

module.exports = router;

