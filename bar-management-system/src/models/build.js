module.exports = function buildModels(sequelize) {
const WorkshopWarranty=require('./WorkshopWarranty')(sequelize);
const WorkshopReturn=require('./WorkshopReturn')(sequelize);
const WorkshopAppointment=require('./WorkshopAppointment')(sequelize);
const WorkOrderPhoto=require('./WorkOrderPhoto')(sequelize);
const WorkOrderSignature=require('./WorkOrderSignature')(sequelize);
const MenuBundle=require('./MenuBundle')(sequelize);
const Recipe=require('./Recipe')(sequelize);
const DeliveryOrder=require('./DeliveryOrder')(sequelize);
const ScaleSettings=require('./ScaleSettings')(sequelize);
const ScaleProduct=require('./ScaleProduct')(sequelize);
const StockLot=require('./StockLot')(sequelize);
const PartDetail=require('./PartDetail')(sequelize);
const PartEquivalence=require('./PartEquivalence')(sequelize);
const Vehicle=require('./Vehicle')(sequelize);
const WorkOrder=require('./WorkOrder')(sequelize);
const PizzaCatalog=require('./PizzaCatalog')(sequelize);
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
const Supplier=require('./Supplier')(sequelize);
const Quote=require('./Quote')(sequelize);
const PurchaseOrder=require('./PurchaseOrder')(sequelize);
const PurchaseReceipt=require('./PurchaseReceipt')(sequelize);
const FinancialEntry=require('./FinancialEntry')(sequelize);
const FinancialPayment=require('./FinancialPayment')(sequelize);
const CashMovement=require('./CashMovement')(sequelize);
const BusinessSettings = require('./BusinessSettings')(sequelize);

DeliveryOrder.belongsTo(Sale,{foreignKey:'saleId',as:'sale'});
StockLot.belongsTo(Product,{foreignKey:'productId',as:'product'});
StockMovement.addHook('afterCreate','lotControl',(movement,options)=>require('../services/lotOperations').apply({StockLot,Product},movement,options));
Product.hasOne(PartDetail,{foreignKey:'productId',as:'partDetails'});
Vehicle.belongsTo(Customer,{foreignKey:'customerId',as:'customer'});
WorkOrder.belongsTo(Sale,{foreignKey:'saleId',as:'sale'});
FinancialEntry.hasMany(FinancialPayment,{foreignKey:'entryId',as:'payments'});
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
  sequelize, WorkshopWarranty, WorkshopReturn, WorkshopAppointment, WorkOrderPhoto, WorkOrderSignature, MenuBundle, DeliveryOrder, Recipe, ScaleSettings, ScaleProduct, StockLot, PartDetail, PartEquivalence, Vehicle, WorkOrder,
  PizzaCatalog,
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
  BusinessSettings, Customer, PasswordReset, Supplier, Quote, PurchaseOrder, PurchaseReceipt, FinancialEntry, FinancialPayment, CashMovement
};


};
