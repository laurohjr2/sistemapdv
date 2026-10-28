const { DataTypes: D } = require("sequelize");
module.exports = (s) =>
  s.define(
    "WorkOrderSignature",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      orderId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "work_orders", key: "id" },
      },
      purpose: { type: D.STRING(20), allowNull: false },
      payload: { type: D.JSONB, allowNull: false },
      digest: { type: D.STRING(64), allowNull: false },
      scopeDigest: { type: D.STRING(64), allowNull: false },
      voidedAt: { type: D.DATE, allowNull: true },
      voidReason: { type: D.STRING(1000), allowNull: true },
      voidedBy: { type: D.UUID, allowNull: true },
    },
    { tableName: "work_order_signatures" },
  );
