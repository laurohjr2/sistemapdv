const { DataTypes: D } = require("sequelize");
module.exports = (s) =>
  s.define(
    "LoyaltyProfile",
    {
      customerId: {
        type: D.UUID,
        primaryKey: true,
        references: { model: "customers", key: "id" },
      },
      label: { type: D.STRING(80), allowNull: false },
      basisPoints: { type: D.INTEGER, allowNull: false },
      active: { type: D.BOOLEAN, allowNull: false, defaultValue: true },
      validUntil: { type: D.DATEONLY, allowNull: true },
      revision: { type: D.INTEGER, defaultValue: 1, allowNull: false },
      events: { type: D.JSONB, defaultValue: [], allowNull: false },
    },
    { tableName: "loyalty_profiles" },
  );
