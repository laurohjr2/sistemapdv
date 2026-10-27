const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "Quote",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      number: { type: D.INTEGER, autoIncrement: true, unique: true },
      customerId: {
        type: D.UUID,
        allowNull: true,
        references: { model: "customers", key: "id" },
      },
      customerName: { type: D.STRING(150), allowNull: false },
      status: { type: D.STRING(20), allowNull: false, defaultValue: "draft" },
      validUntil: { type: D.DATEONLY, allowNull: false },
      lines: { type: D.JSONB, allowNull: false },
      subtotal: { type: D.DECIMAL(10, 2), allowNull: false },
      discount: { type: D.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      total: { type: D.DECIMAL(10, 2), allowNull: false },
      notes: { type: D.TEXT, defaultValue: "" },
      createdBy: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      approvalNote: { type: D.TEXT, allowNull: true },
      approvedAt: { type: D.DATE, allowNull: true },
      approvedBy: {
        type: D.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
      },
      saleId: {
        type: D.INTEGER,
        allowNull: true,
        unique: true,
        references: { model: "sales", key: "id" },
      },
    },
    { tableName: "quotes" },
  );
