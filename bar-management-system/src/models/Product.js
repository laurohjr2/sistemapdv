const { DataTypes } = require('sequelize');
module.exports = function defineModel(sequelize) {

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [1, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category: {
    type: DataTypes.ENUM(
      'bebidas_alcoolicas', 
      'bebidas_nao_alcoolicas', 
      'porcoes', 
      'comidas', 
      'petiscos', 
      'sobremesas',
      'outros'
    ),
    allowNull: false,
    defaultValue: 'outros'
  },
  subcategory: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: [0, 50]
    }
  },
  unitOfMeasure: {
    type: DataTypes.ENUM('litro', 'unidade', 'kg', 'gramas', 'ml'),
    allowNull: false,
    defaultValue: 'unidade',
    field: 'unit_of_measure'
  },
  costPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'cost_price',
    validate: {
      min: 0
    }
  },
  salePrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'sale_price',
    validate: {
      min: 0
    }
  },
  currentStock: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    defaultValue: 0,
    field: 'current_stock',
    validate: {
      min: 0
    }
  },
  minStockAlert: {
    type: DataTypes.DECIMAL(10, 3),
    defaultValue: 0,
    field: 'min_stock_alert',
    validate: {
      min: 0
    }
  },
  barcode: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    validate: {
      len: [0, 50]
    }
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  preparationTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'preparation_time',
    comment: 'Tempo de preparo em minutos'
  },
  ingredients: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Lista de ingredientes separados por vírgula'
  },
  allergens: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Informações sobre alérgenos'
  },
  nutritionalInfo: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'nutritional_info',
    comment: 'Informações nutricionais em formato JSON'
  }
}, {
  tableName: 'products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

return Product;


};
