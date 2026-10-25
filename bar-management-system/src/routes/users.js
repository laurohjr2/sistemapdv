const express = require('express');
const { getAllUsers, getUserById, updateUser, deleteUser } = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Admin only routes
router.get('/', authorizeRoles('admin'), getAllUsers);
router.get('/:id', authorizeRoles('admin'), getUserById);
router.put('/:id', authorizeRoles('admin'), updateUser);
router.delete('/:id', authorizeRoles('admin'), deleteUser);

module.exports = router;

