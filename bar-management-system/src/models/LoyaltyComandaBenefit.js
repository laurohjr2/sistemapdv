const { DataTypes: D } = require("sequelize");
module.exports = (s) =>
  s.define(
    "LoyaltyComandaBenefit",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      comandaId: {
        type: D.UUID,
        allowNull: false,
        unique: true,
        references: { model: "comandas", key: "id" },
      },
      customerId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "customers", key: "id" },
      },
      profile: { type: D.JSONB, allowNull: false },
      discount: { type: D.DECIMAL(10, 2), allowNull: false },
      subtotal: { type: D.DECIMAL(10, 2), allowNull: false },
      scopeDigest: { type: D.STRING(64), allowNull: false },
      createdBy: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
    },
    { tableName: "loyalty_comanda_benefits" },
  );
