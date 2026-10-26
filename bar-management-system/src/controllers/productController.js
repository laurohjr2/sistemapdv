const { Product } = require('../models');
const { logAction } = require('../utils/auditLogger');
const { Op } = require('sequelize');

function validateFields(body) {
 if(body.unitOfMeasure!==undefined&&!Product.rawAttributes.unitOfMeasure.values.includes(body.unitOfMeasure))return 'Unidade de medida inválida';
 if(body.category!==undefined&&!Product.rawAttributes.category.values.includes(body.category))return 'Categoria inválida';
 for(const key of ['costPrice','salePrice','minStockAlert'])if(body[key]!==undefined&&(!Number.isFinite(Number(body[key]))||Number(body[key])<0))return 'Preço ou estoque mínimo inválido';
 return null;
}

const getAllProducts = async (req, res) => {
  try {
    const { category, lowStock, active, search } = req.query;
    
    const whereClause = {};
    if (category) {
      whereClause.category = category;
    }
    if (active !== undefined) {
      whereClause.active = active === 'true';
    }
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const products = await Product.findAll({
      where: whereClause,
      order: [['name', 'ASC']]
    });

    let filteredProducts = products;
    if (lowStock === 'true') {
      filteredProducts = products.filter(product => 
        product.currentStock <= product.minStockAlert
      );
    }

    res.json(filteredProducts);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createProduct = async (req, res) => {
  try {
    const validationError=validateFields(req.body);if(validationError)return res.status(400).json({error:validationError});
    const { 
      name, 
      description,
      category, 
      subcategory,
      unitOfMeasure, 
      costPrice, 
      salePrice, 
      minStockAlert,
      barcode,
      active,
      preparationTime,
      ingredients,
      allergens,
      nutritionalInfo
    } = req.body;

    if (!name || !category || !unitOfMeasure || costPrice === undefined || salePrice === undefined) {
      return res.status(400).json({ 
        error: 'Name, category, unit of measure, cost price, and sale price are required' 
      });
    }

    // Check if product name already exists
    const existingProduct = await Product.findOne({ where: { name } });
    if (existingProduct) {
      return res.status(409).json({ error: 'Product name already exists' });
    }

    // Check if barcode already exists (if provided)
    if (barcode) {
      const existingBarcode = await Product.findOne({ where: { barcode } });
      if (existingBarcode) {
        return res.status(409).json({ error: 'Barcode already exists' });
      }
    }

    const product = await Product.create({
      name,
      description,
      category,
      subcategory,
      unitOfMeasure,
      costPrice,
      salePrice,
      minStockAlert: minStockAlert || 0,
      barcode: barcode?.trim() || null,
      active: active !== undefined ? active : true,
      preparationTime,
      ingredients,
      allergens,
      nutritionalInfo
    });

    await logAction(req.user.id, 'product_created', {
      productId: product.id,
      name: product.name,
      category: product.category
    });

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const validationError=validateFields(req.body);if(validationError)return res.status(400).json({error:validationError});
    const { id } = req.params;
    const { 
      name, 
      description,
      category, 
      subcategory,
      unitOfMeasure, 
      costPrice, 
      salePrice, 
      minStockAlert,
      barcode,
      active,
      preparationTime,
      ingredients,
      allergens,
      nutritionalInfo
    } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const oldData = { ...product.dataValues };

    // Check if new name conflicts with existing product
    if (name && name !== product.name) {
      const existingProduct = await Product.findOne({ 
        where: { 
          name,
          id: { [Op.ne]: id }
        } 
      });
      if (existingProduct) {
        return res.status(409).json({ error: 'Product name already exists' });
      }
    }

    // Check if new barcode conflicts with existing product
    if (barcode && barcode !== product.barcode) {
      const existingBarcode = await Product.findOne({ 
        where: { 
          barcode,
          id: { [Op.ne]: id }
        } 
      });
      if (existingBarcode) {
        return res.status(409).json({ error: 'Barcode already exists' });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (subcategory !== undefined) updateData.subcategory = subcategory;
    if (unitOfMeasure !== undefined) updateData.unitOfMeasure = unitOfMeasure;
    if (costPrice !== undefined) updateData.costPrice = costPrice;
    if (salePrice !== undefined) updateData.salePrice = salePrice;
    if (minStockAlert !== undefined) updateData.minStockAlert = minStockAlert;
    if (barcode !== undefined) updateData.barcode = barcode?.trim() || null;
    if (active !== undefined) updateData.active = active;
    if (preparationTime !== undefined) updateData.preparationTime = preparationTime;
    if (ingredients !== undefined) updateData.ingredients = ingredients;
    if (allergens !== undefined) updateData.allergens = allergens;
    if (nutritionalInfo !== undefined) updateData.nutritionalInfo = nutritionalInfo;

    await product.update(updateData);

    await logAction(req.user.id, 'product_updated', {
      productId: product.id,
      oldData,
      newData: updateData
    });

    res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await logAction(req.user.id, 'product_deleted', {
      productId: product.id,
      name: product.name,
      category: product.category
    });

    await product.destroy();

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = [
      { value: 'bebidas_alcoolicas', label: 'Bebidas Alcoólicas' },
      { value: 'bebidas_nao_alcoolicas', label: 'Bebidas Não Alcoólicas' },
      { value: 'porcoes', label: 'Porções' },
      { value: 'comidas', label: 'Comidas' },
      { value: 'petiscos', label: 'Petiscos' },
      { value: 'sobremesas', label: 'Sobremesas' },
      { value: 'outros', label: 'Outros' }
    ];

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
    const products = await Product.findAll({
      where: { 
        category,
        active: true
      },
      order: [['name', 'ASC']]
    });

    res.json(products);
  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: {
        active: true,
        [Op.and]: [
          { currentStock: { [Op.lte]: { [Op.col]: 'min_stock_alert' } } }
        ]
      },
      order: [['name', 'ASC']]
    });

    res.json(products);
  } catch (error) {
    console.error('Get low stock products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const searchProducts = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const products = await Product.findAll({
      where: {
        active: true,
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { description: { [Op.iLike]: `%${q}%` } },
          { barcode: { [Op.iLike]: `%${q}%` } },
          { ingredients: { [Op.iLike]: `%${q}%` } }
        ]
      },
      order: [['name', 'ASC']],
      limit: 20
    });

    res.json(products);
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  getProductsByCategory,
  getLowStockProducts,
  searchProducts
};

