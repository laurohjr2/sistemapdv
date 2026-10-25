const express = require('express');
const { 
  getAllProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getCategories,
  getProductsByCategory,
  getLowStockProducts,
  searchProducts
} = require('../controllers/productController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Routes accessible by all authenticated users
router.get('/', getAllProducts);
router.get('/search', searchProducts);
router.get('/categories', getCategories);
router.get('/low-stock', getLowStockProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/:id', getProductById);

// Routes for managers and admins only
router.post('/', authorizeRoles('gerente', 'admin'), createProduct);
router.put('/:id', authorizeRoles('gerente', 'admin'), updateProduct);
router.delete('/:id', authorizeRoles('gerente', 'admin'), deleteProduct);

module.exports = router;

