const { DataTypes } = require('sequelize');
module.exports = function defineModel(sequelize) {

const ComandaItem = sequelize.define('ComandaItem', {
  recipe:{type:DataTypes.JSONB,allowNull:true},
  pizza:{type:DataTypes.JSONB,allowNull:true},
  stockTracked:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  comandaId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'comanda_id',
    references: {
      model: 'comandas',
      key: 'id'
    }
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
  quantity: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    validate: {
      min: 0.001
    }
  },
  priceAtSale: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'price_at_sale',
    validate: {
      min: 0
    }
  },
  totalItemValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'total_item_value',
    validate: {
      min: 0
    }
  },
  preparationStatus: {
    type: DataTypes.ENUM('pendente', 'preparando', 'pronto', 'entregue'),
    allowNull: false,
    defaultValue: 'pendente',
    field: 'preparation_status',
    comment: 'Status de preparo do item'
  },
  kitchenNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'kitchen_notes',
    comment: 'Observações para a cozinha'
  },
  preparationStartedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'preparation_started_at',
    comment: 'Quando o preparo foi iniciado'
  },
  preparationCompletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'preparation_completed_at',
    comment: 'Quando o preparo foi concluído'
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'delivered_at',
    comment: 'Quando o item foi entregue'
  },
  deliveredByUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'delivered_by_user_id',
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'Usuário que entregou o item'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Observações gerais do item'
  },
  priority: {
    type: DataTypes.ENUM('baixa', 'normal', 'alta', 'urgente'),
    allowNull: false,
    defaultValue: 'normal',
    comment: 'Prioridade do item na fila'
  }
}, {
  tableName: 'comanda_items',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

return ComandaItem;


};
