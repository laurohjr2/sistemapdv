const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "FinancialPayment",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      entryId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "financial_entries", key: "id" },
      },
      requestKey: { type: D.UUID, allowNull: false, unique: true },
      requestHash: { type: D.STRING(64), allowNull: false },
      amount: { type: D.DECIMAL(10, 2), allowNull: false },
      paidOn: { type: D.DATEONLY, allowNull: false },
      method: { type: D.STRING(20), allowNull: false },
      createdBy: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
    },
    { tableName: "financial_payments" },
  );
