const { DataTypes: D } = require("sequelize");
module.exports = (s) =>
  s.define(
    "LoyaltyBenefit",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      saleId: {
        type: D.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "sales", key: "id" },
      },
      customerId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "customers", key: "id" },
      },
      profile: { type: D.JSONB, allowNull: false },
      discount: { type: D.DECIMAL(10, 2), allowNull: false },
    },
    { tableName: "loyalty_benefits" },
  );
