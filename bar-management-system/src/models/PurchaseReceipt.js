const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "PurchaseReceipt",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      purchaseOrderId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "purchase_orders", key: "id" },
      },
      requestKey: { type: D.UUID, allowNull: false, unique: true },
      requestHash: { type: D.STRING(64), allowNull: false },
      lines: { type: D.JSONB, allowNull: false },
      total: { type: D.DECIMAL(10, 2), allowNull: false },
      createdBy: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
    },
    { tableName: "purchase_receipts" },
  );
