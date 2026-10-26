const { DataTypes } = require('sequelize');
module.exports = function defineModel(sequelize) {

const WaitingQueue = sequelize.define('WaitingQueue', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  clientName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'client_name',
    validate: {
      len: [1, 100]
    }
  },
  clientPhone: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'client_phone'
  },
  numberOfPeople: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'number_of_people',
    validate: {
      min: 1
    }
  },
  arrivedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'arrived_at'
  },
  tableId: { type: DataTypes.UUID, allowNull: true, field: 'table_id', references: { model: 'tables', key: 'id' } },
  comandaId: { type: DataTypes.UUID, allowNull: true, field: 'comanda_id', references: { model: 'comandas', key: 'id' } },
  seatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'seated_at'
  },
  status: {
    type: DataTypes.ENUM('aguardando', 'sentado', 'cancelado'),
    allowNull: false,
    defaultValue: 'aguardando'
  }
}, {
  tableName: 'waiting_queue',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

return WaitingQueue;


};
