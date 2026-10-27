const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "PurchaseOrder",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      number: { type: D.INTEGER, autoIncrement: true, unique: true },
      supplierId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "suppliers", key: "id" },
      },
      supplierName: { type: D.STRING(150), allowNull: false },
      status: { type: D.STRING(20), allowNull: false, defaultValue: "ordered" },
      lines: { type: D.JSONB, allowNull: false },
      total: { type: D.DECIMAL(10, 2), allowNull: false },
      expectedDate: { type: D.DATEONLY, allowNull: true },
      notes: { type: D.TEXT, defaultValue: "" },
      createdBy: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
    },
    { tableName: "purchase_orders" },
  );
