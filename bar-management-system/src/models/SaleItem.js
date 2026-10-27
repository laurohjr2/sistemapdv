const { DataTypes } = require('sequelize');
module.exports = function defineModel(sequelize) {

const SaleItem = sequelize.define('SaleItem', {
  preparationStatus:{type:DataTypes.STRING(12),allowNull:true},
  preparationStartedAt:{type:DataTypes.DATE,allowNull:true},
  preparationCompletedAt:{type:DataTypes.DATE,allowNull:true},
  deliveredAt:{type:DataTypes.DATE,allowNull:true},
  pizza:{type:DataTypes.JSONB,allowNull:true},
  stockTracked:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sale_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'sales',
      key: 'id'
    },
    comment: 'ID da venda'
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    },
    comment: 'ID do produto vendido'
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    comment: 'Quantidade vendida'
  },
  unit_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Preço unitário no momento da venda'
  },
  total_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Preço total do item (quantidade x preço unitário)'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Observações sobre o item'
  }
}, {
  tableName: 'sale_items',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

return SaleItem;


};
