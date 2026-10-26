const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Ticket = sequelize.define('Ticket', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sale_id: {type:DataTypes.INTEGER,allowNull:true},
  ticket_number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Número único do ticket'
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: false,
    defaultValue: 1
  },
  unit_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  customer_name: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Nome do cliente (opcional)'
  },
  issued_by: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Usuário que emitiu o ticket'
  },
  redeemed_by: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Usuário que resgatou o ticket'
  },
  status: {
    type: DataTypes.ENUM('pending', 'redeemed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  issued_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  redeemed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data de expiração do ticket'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'tickets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Ticket;

