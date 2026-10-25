const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Sale = sequelize.define('Sale', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'ID do usuário que realizou a venda'
  },
  cash_register_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'cash_registers',
      key: 'id'
    },
    comment: 'ID do caixa onde a venda foi realizada'
  },
  payment_method: {
    type: DataTypes.ENUM('dinheiro', 'cartao_credito', 'cartao_debito', 'pix'),
    allowNull: false,
    comment: 'Método de pagamento utilizado'
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Valor total da venda'
  },
  status: {
    type: DataTypes.ENUM('completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'completed',
    comment: 'Status da venda'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Observações sobre a venda'
  }
}, {
  tableName: 'sales',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Sale;

