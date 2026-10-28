const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "DeliveryOrder",
    {
      id: { type: D.UUID, primaryKey: true, defaultValue: D.UUIDV4 },
      saleId: {
        type: D.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "sales", key: "id" },
      },
      customerId: { type: D.UUID, allowNull: true },
      customerName: { type: D.STRING(150), allowNull: false },
      phone: { type: D.STRING(30), allowNull: false },
      address: { type: D.JSONB, allowNull: false },
      items: { type: D.JSONB, allowNull: false },
      paidTotal: { type: D.DECIMAL(10, 2), allowNull: false },
      status: {
        type: D.STRING(20),
        allowNull: false,
        defaultValue: "received",
      },
      courierName: { type: D.STRING(120), allowNull: false, defaultValue: "" },
      notes: { type: D.TEXT, allowNull: false, defaultValue: "" },
      history: { type: D.JSONB, allowNull: false, defaultValue: [] },
      revision: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
    },
    { tableName: "delivery_orders" },
  );
