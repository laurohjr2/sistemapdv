const { DataTypes: D } = require("sequelize");
module.exports = (s) =>
  s.define(
    "WorkshopWarranty",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      orderId: {
        type: D.UUID,
        allowNull: false,
        unique: true,
        references: { model: "work_orders", key: "id" },
      },
      snapshot: { type: D.JSONB, allowNull: false },
      startsOn: { type: D.DATEONLY, allowNull: false },
      expiresOn: { type: D.DATEONLY, allowNull: false },
      mileageLimit: { type: D.INTEGER, allowNull: true },
      terms: { type: D.TEXT, allowNull: false },
      voidedAt: { type: D.DATE, allowNull: true },
      voidReason: { type: D.TEXT, allowNull: true },
      events: { type: D.JSONB, allowNull: false, defaultValue: [] },
      revision: { type: D.INTEGER, defaultValue: 1, allowNull: false },
      createdBy: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
    },
    { tableName: "workshop_warranties" },
  );
