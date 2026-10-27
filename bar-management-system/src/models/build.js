module.exports = function buildModels(sequelize) {
const User = require('./User')(sequelize);
const Product = require('./Product')(sequelize);
const StockMovement = require('./StockMovement')(sequelize);
const Table = require('./Table')(sequelize);
const Comanda = require('./Comanda')(sequelize);
const ComandaItem = require('./ComandaItem')(sequelize);
const WaitingQueue = require('./WaitingQueue')(sequelize);
const AuditLog = require('./AuditLog')(sequelize);
const CashRegister = require('./CashRegister')(sequelize);
const Sale = require('./Sale')(sequelize);
const SaleItem = require('./SaleItem')(sequelize);
const Ticket = require('./Ticket')(sequelize);
const Customer = require('./Customer')(sequelize);
const PasswordReset = require('./PasswordReset')(sequelize);
const BusinessSettings = require('./BusinessSettings')(sequelize);

Sale.belongsTo(Customer,{foreignKey:'customerId',as:'customer'});
Comanda.belongsTo(Customer,{foreignKey:'customerId',as:'customer'});
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

return {
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
  BusinessSettings, Customer, PasswordReset
};


};
