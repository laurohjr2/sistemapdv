const { DataTypes } = require('sequelize');
module.exports = function defineModel(sequelize) {

const StockMovement = sequelize.define('StockMovement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'product_id',
    references: {
      model: 'products',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('entrada', 'saida'),
    allowNull: false
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    validate: {
      min: 0.001
    }
  },
  unitCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'unit_cost',
    comment: 'Custo unitário no momento da movimentação'
  },
  totalCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'total_cost',
    comment: 'Custo total da movimentação (quantity * unitCost)'
  },
  movementDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'movement_date'
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  sourceComandaId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'source_comanda_id',
    references: {
      model: 'comandas',
      key: 'id'
    }
  },
  reason: {
    type: DataTypes.ENUM(
      'purchase', 
      'sale', 
      'adjustment', 
      'loss', 
      'transfer', 
      'return', 
      'manual_adjustment',
      'expiration',
      'damage'
    ),
    allowNull: true,
    defaultValue: 'manual_adjustment',
    comment: 'Motivo da movimentação'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  batchNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'batch_number',
    comment: 'Número do lote para controle'
  },
  expirationDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expiration_date',
    comment: 'Data de validade do lote'
  },
  supplierId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'supplier_id',
    comment: 'ID do fornecedor (para entradas)'
  }
}, {
  tableName: 'stock_movements',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: (movement) => {
      if (movement.unitCost && movement.quantity) {
        movement.totalCost = parseFloat(movement.unitCost) * parseFloat(movement.quantity);
      }
    },
    beforeUpdate: (movement) => {
      if (movement.unitCost && movement.quantity) {
        movement.totalCost = parseFloat(movement.unitCost) * parseFloat(movement.quantity);
      }
    }
  }
});

return StockMovement;


};
