const { DataTypes } = require('sequelize');
module.exports = function defineModel(sequelize) {

const CashRegister = sequelize.define('CashRegister', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  opened_by: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome do responsável que abriu o caixa'
  },
  opening_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Valor inicial do caixa'
  },
  closing_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Valor final do caixa'
  },
  total_sales: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
    comment: 'Total de vendas do período'
  },
  difference: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
    comment: 'Diferença entre esperado e real'
  },
  opened_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  closed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_open: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Observações sobre o caixa'
  }
}, {
  tableName: 'cash_registers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

return CashRegister;


};
