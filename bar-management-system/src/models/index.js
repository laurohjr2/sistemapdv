const { sequelize } = require('../config/database');
const User = require('./User');
const Product = require('./Product');
const StockMovement = require('./StockMovement');
const Table = require('./Table');
const Comanda = require('./Comanda');
const ComandaItem = require('./ComandaItem');
const WaitingQueue = require('./WaitingQueue');
const AuditLog = require('./AuditLog');
const CashRegister = require('./CashRegister');
const Sale = require('./Sale');
const SaleItem = require('./SaleItem');
const Ticket = require('./Ticket');
const BusinessSettings = require('./BusinessSettings');

// Define associations
User.hasMany(StockMovement, { foreignKey: 'userId', as: 'stockMovements' });
StockMovement.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Product.hasMany(StockMovement, { foreignKey: 'productId', as: 'stockMovements' });
StockMovement.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

Table.hasMany(Comanda, { foreignKey: 'tableId', as: 'comandas' });
Comanda.belongsTo(Table, { foreignKey: 'tableId', as: 'table' });

User.hasMany(Comanda, { foreignKey: 'openedByUserId', as: 'comandas' });
Comanda.belongsTo(User, { foreignKey: 'openedByUserId', as: 'openedByUser' });

Comanda.hasMany(ComandaItem, { foreignKey: 'comandaId', as: 'items' });
ComandaItem.belongsTo(Comanda, { foreignKey: 'comandaId', as: 'comanda' });

Product.hasMany(ComandaItem, { foreignKey: 'productId', as: 'comandaItems' });
ComandaItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

Comanda.hasMany(StockMovement, { foreignKey: 'sourceComandaId', as: 'stockMovements' });
StockMovement.belongsTo(Comanda, { foreignKey: 'sourceComandaId', as: 'sourceComanda' });

User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// CashRegister associations
CashRegister.hasMany(Comanda, { foreignKey: 'cashRegisterId', as: 'comandas' });
Comanda.belongsTo(CashRegister, { foreignKey: 'cashRegisterId', as: 'cashRegister' });

CashRegister.hasMany(Sale, { foreignKey: 'cash_register_id', as: 'sales' });
Sale.belongsTo(CashRegister, { foreignKey: 'cash_register_id', as: 'cashRegister' });

// Sale associations
User.hasMany(Sale, { foreignKey: 'user_id', as: 'sales' });
Sale.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Sale.hasMany(SaleItem, { foreignKey: 'sale_id', as: 'items' });
SaleItem.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });

Product.hasMany(SaleItem, { foreignKey: 'product_id', as: 'saleItems' });
SaleItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Comanda.belongsTo(User, { foreignKey: 'closedByUserId', as: 'closedByUser' });

ComandaItem.belongsTo(User, {foreignKey:'deliveredByUserId',as:'deliveredByUser'});

// Ticket associations
Product.hasMany(Ticket, { foreignKey: 'product_id', as: 'tickets' });
Ticket.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

module.exports = {
  sequelize,
  User,
  Product,
  StockMovement,
  Table,
  Comanda,
  ComandaItem,
  WaitingQueue,
  AuditLog,
  CashRegister,
  Sale,
  SaleItem,
  Ticket,
  BusinessSettings
};

