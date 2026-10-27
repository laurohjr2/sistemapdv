const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "FinancialEntry",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      direction: { type: D.STRING(12), allowNull: false },
      description: { type: D.STRING(200), allowNull: false },
      partyName: { type: D.STRING(150), allowNull: false },
      customerId: {
        type: D.UUID,
        allowNull: true,
        references: { model: "customers", key: "id" },
      },
      supplierId: {
        type: D.UUID,
        allowNull: true,
        references: { model: "suppliers", key: "id" },
      },
      amount: { type: D.DECIMAL(10, 2), allowNull: false },
      dueDate: { type: D.DATEONLY, allowNull: false },
      sourceKey: { type: D.STRING(100), allowNull: true, unique: true },
      cancelled: { type: D.BOOLEAN, allowNull: false, defaultValue: false },
      createdBy: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
    },
    { tableName: "financial_entries" },
  );
