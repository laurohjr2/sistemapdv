const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "CashMovement",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      cashRegisterId: {
        type: D.INTEGER,
        allowNull: false,
        references: { model: "cash_registers", key: "id" },
      },
      paymentId: {
        type: D.UUID,
        allowNull: false,
        unique: true,
        references: { model: "financial_payments", key: "id" },
      },
      direction: { type: D.STRING(5), allowNull: false },
      amount: { type: D.DECIMAL(10, 2), allowNull: false },
      description: { type: D.STRING(200), allowNull: false },
      userId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
    },
    { tableName: "cash_movements" },
  );
