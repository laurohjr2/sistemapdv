const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Table = sequelize.define('Table', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tableNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    field: 'table_number',
    validate: {
      min: 1
    }
  },
  status: {
    type: DataTypes.ENUM('disponivel', 'ocupada', 'aguardando_fechamento'),
    allowNull: false,
    defaultValue: 'disponivel'
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1
    }
  }
}, {
  tableName: 'tables',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Table;

