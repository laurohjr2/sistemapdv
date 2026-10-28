const { DataTypes: D } = require("sequelize");
module.exports = (s) =>
  s.define(
    "WorkshopReturn",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      warrantyId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "workshop_warranties", key: "id" },
      },
      reason: { type: D.TEXT, allowNull: false },
      mileage: { type: D.INTEGER, allowNull: false },
      receivedOn: { type: D.DATEONLY, allowNull: false },
      eligibility: { type: D.JSONB, allowNull: false },
      status: { type: D.STRING(20), allowNull: false, defaultValue: "open" },
      orderId: {
        type: D.UUID,
        allowNull: true,
        unique: true,
        references: { model: "work_orders", key: "id" },
      },
      revision: { type: D.INTEGER, defaultValue: 1, allowNull: false },
      events: { type: D.JSONB, allowNull: false, defaultValue: [] },
      createdBy: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
    },
    { tableName: "workshop_returns" },
  );
