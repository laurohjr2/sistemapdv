const { DataTypes: D } = require("sequelize");
module.exports = (s) =>
  s.define(
    "WorkOrderPhoto",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      orderId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "work_orders", key: "id" },
      },
      checkKey: { type: D.STRING(24), allowNull: false },
      caption: { type: D.STRING(200), allowNull: false },
      data: { type: D.BLOB, allowNull: false },
      mime: { type: D.STRING(20), allowNull: false },
      bytes: { type: D.INTEGER, allowNull: false },
      width: { type: D.INTEGER, allowNull: false },
      height: { type: D.INTEGER, allowNull: false },
      digest: { type: D.STRING(64), allowNull: false },
      createdBy: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      archivedAt: { type: D.DATE, allowNull: true },
      archiveReason: { type: D.STRING(1000), allowNull: true },
      archivedBy: { type: D.UUID, allowNull: true },
    },
    { tableName: "work_order_photos" },
  );
