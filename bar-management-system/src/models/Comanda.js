const { DataTypes } = require('sequelize');
module.exports = function defineModel(sequelize) {

const Comanda = sequelize.define('Comanda', {
  customerId: {type:DataTypes.UUID,allowNull:true},
  payments: {type:DataTypes.JSONB,allowNull:true},
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tableId: {
    type: DataTypes.UUID,
    allowNull: true, // Permitir null para comandas de balcão
    field: 'table_id',
    references: {
      model: 'tables',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('mesa', 'balcao'),
    allowNull: false,
    defaultValue: 'mesa',
    comment: 'Tipo da comanda: mesa ou balcão'
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'customer_name',
    comment: 'Nome do cliente para comandas de balcão'
  },
  customerPhone: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'customer_phone',
    comment: 'Telefone do cliente'
  },
  openedByUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'opened_by_user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  openedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'opened_at'
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'closed_at'
  },
  closedByUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'closed_by_user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('aberta', 'fechada', 'cancelada'),
    allowNull: false,
    defaultValue: 'aberta'
  },
  totalValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'total_value',
    validate: {
      min: 0
    }
  },
  discountValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'discount_value',
    validate: {
      min: 0
    }
  },
  discountPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'discount_percentage',
    validate: {
      min: 0,
      max: 100
    }
  },
  finalValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'final_value',
    validate: {
      min: 0
    }
  },
  paymentMethod: {
    type: DataTypes.ENUM('dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'vale_refeicao'),
    allowNull: true,
    field: 'payment_method'
  },
  paymentStatus: {
    type: DataTypes.ENUM('pendente', 'pago', 'nao_pago'),
    allowNull: false,
    defaultValue: 'pendente',
    field: 'payment_status'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Observações da comanda'
  },
  deliveryType: {
    type: DataTypes.ENUM('balcao', 'mesa', 'delivery'),
    allowNull: false,
    defaultValue: 'balcao',
    field: 'delivery_type'
  }
}, {
  tableName: 'comandas',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeSave: (comanda) => {
      // Calcular valor final considerando desconto
      const total = parseFloat(comanda.totalValue) || 0;
      const discountValue = parseFloat(comanda.discountValue) || 0;
      const discountPercentage = parseFloat(comanda.discountPercentage) || 0;
      
      let finalDiscount = discountValue;
      if (discountPercentage > 0) {
        finalDiscount += (total * discountPercentage / 100);
      }
      
      comanda.finalValue = Math.max(0, Math.round((total - finalDiscount) * 100) / 100);
    }
  }
});

return Comanda;


};
