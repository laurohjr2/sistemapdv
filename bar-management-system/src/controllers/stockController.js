function createScopedModule() {
const { StockMovement, Product, User, Comanda, sequelize } = require('../models');
const { logAction } = require('../utils/auditLogger');
const { Op } = require('sequelize');

const changeStock = mode => async(req,res,next)=>{
 try {
  const result=await sequelize.transaction(async transaction=>{
   const product=await Product.findByPk(req.body.productId,{transaction,lock:transaction.LOCK.UPDATE});
   if(!product)throw Object.assign(new Error('Produto não encontrado'),{status:404});
   if(product.itemType==='service')throw Object.assign(new Error('Serviços não movimentam estoque'),{status:400});
   const oldStock=Number(product.currentStock),quantity=Number(mode==='adjust'?req.body.newQuantity:req.body.quantity);
   if(!Number.isFinite(quantity)||quantity<(mode==='adjust'?0:0.001)||Math.abs(quantity*1000-Math.round(quantity*1000))>1e-6)throw Object.assign(new Error('Quantidade inválida'),{status:400});
   const newStock=mode==='adjust'?quantity:oldStock+(mode==='add'?quantity:-quantity),difference=newStock-oldStock;
   if(newStock<0)throw Object.assign(new Error('Estoque insuficiente'),{status:400});
   const cost=Number(req.body.unitCost??product.costPrice);if(!Number.isFinite(cost)||cost<0)throw Object.assign(new Error('Custo inválido'),{status:400});
   let stockMovement;
   if(difference){
    stockMovement=await StockMovement.create({productId:product.id,userId:req.user.id,type:difference>0?'entrada':'saida',quantity:Math.abs(difference),unitCost:cost,reason:mode==='adjust'?'adjustment':mode==='add'?'purchase':req.body.reason||'manual_adjustment',notes:req.body.notes,batchNumber:req.body.batchNumber,expirationDate:req.body.expirationDate||null},{transaction});
    await product.update({currentStock:newStock},{transaction});
   }
   return {oldStock,newStock,difference,stockMovement};
  });
  await logAction(req.user.id,`stock_${mode}`,{productId:req.body.productId,oldStock:result.oldStock,newStock:result.newStock});
  res.status(mode==='adjust'?200:201).json(result);
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}
};
const addStock=changeStock('add'),removeStock=changeStock('remove'),adjustStock=changeStock('adjust');

const getStockMovements = async (req, res) => {
  try {
    const { productId, type, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    const whereClause = {};
    if (productId) whereClause.productId = productId;
    if (type) whereClause.type = type;
    if (startDate || endDate) {
      whereClause.movementDate = {};
      if (startDate) whereClause.movementDate[Op.gte] = new Date(startDate);
      if (endDate) whereClause.movementDate[Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;

    const { count, rows: movements } = await StockMovement.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'unitOfMeasure', 'category']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        },
        {
          model: Comanda,
          as: 'sourceComanda',
          attributes: ['id'],
          required: false
        }
      ],
      order: [['movementDate', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      movements,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get stock movements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: {
        active: true,itemType:'product',
        [Op.and]: [
          { currentStock: { [Op.lte]: { [Op.col]: 'min_stock_alert' } } }
        ]
      },
      order: [['currentStock', 'ASC']]
    });

    res.json(products);
  } catch (error) {
    console.error('Get low stock products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getStockReport = async (req, res) => {
  try {
    const { category } = req.query;
    
    const whereClause = { active: true,itemType:'product' };
    if (category) whereClause.category = category;

    const products = await Product.findAll({
      where: whereClause,
      attributes: [
        'id',
        'name',
        'category',
        'unitOfMeasure',
        'currentStock',
        'minStockAlert',
        'costPrice',
        'salePrice'
      ],
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    const report = products.map(product => ({
      ...product.dataValues,
      stockValue: parseFloat(product.currentStock) * parseFloat(product.costPrice),
      isLowStock: parseFloat(product.currentStock) <= parseFloat(product.minStockAlert),
      stockStatus: getStockStatus(product)
    }));

    const summary = {
      totalProducts: products.length,
      lowStockCount: report.filter(p => p.isLowStock).length,
      outOfStockCount: report.filter(p => p.currentStock <= 0).length,
      totalStockValue: report.reduce((sum, p) => sum + p.stockValue, 0),
      averageStockValue: report.length > 0 ? report.reduce((sum, p) => sum + p.stockValue, 0) / report.length : 0
    };

    res.json({
      report,
      summary
    });
  } catch (error) {
    console.error('Get stock report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getStockHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const whereClause = { productId: id };
    if (startDate || endDate) {
      whereClause.movementDate = {};
      if (startDate) whereClause.movementDate[Op.gte] = new Date(startDate);
      if (endDate) whereClause.movementDate[Op.lte] = new Date(endDate);
    }

    const movements = await StockMovement.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        },
        {
          model: Comanda,
          as: 'sourceComanda',
          attributes: ['id'],
          required: false
        }
      ],
      order: [['movementDate', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({
      product: {
        id: product.id,
        name: product.name,
        currentStock: product.currentStock,
        unitOfMeasure: product.unitOfMeasure
      },
      movements
    });
  } catch (error) {
    console.error('Get stock history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getStockSummary = async (req, res) => {
  try {
    const totalProducts = await Product.count({ where: { active: true,itemType:'product' } });

    const lowStockProducts = await Product.count({
      where: {
        active: true,itemType:'product',
        [Op.and]: [
          { currentStock: { [Op.lte]: { [Op.col]: 'min_stock_alert' } } }
        ]
      }
    });

    const outOfStockProducts = await Product.count({
      where: {
        active: true,itemType:'product',
        currentStock: { [Op.lte]: 0 }
      }
    });

    const valuation = await Product.findAll({attributes:[[sequelize.fn('SUM',sequelize.literal('"current_stock" * "cost_price"')),'total']],where:{active:true,itemType:'product'},raw:true});
    const totalStockValue = Number(valuation[0]?.total || 0);

    const recentMovements = await StockMovement.count({
      where: {
        movementDate: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    res.json({
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      totalStockValue: totalStockValue || 0,
      recentMovements
    });
  } catch (error) {
    console.error('Get stock summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getStockStatus = (product) => {
  const current = parseFloat(product.currentStock);
  const min = parseFloat(product.minStockAlert);

  if (current <= 0) return 'out_of_stock';
  if (current <= min) return 'low_stock';
  if (current <= min * 2) return 'medium_stock';
  return 'good_stock';
};

return {
  addStock,
  removeStock,
  adjustStock,
  getStockMovements,
  getLowStockProducts,
  getStockReport,
  getStockHistory,
  getStockSummary
};

}
module.exports=require('../tenancy/scopedModule')(createScopedModule,["addStock", "removeStock", "adjustStock", "getStockMovements", "getLowStockProducts", "getStockReport", "getStockHistory", "getStockSummary"]);
