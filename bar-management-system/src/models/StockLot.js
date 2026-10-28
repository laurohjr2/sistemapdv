const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "StockLot",
    {
      id: { type: D.UUID, primaryKey: true, defaultValue: D.UUIDV4 },
      productId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "products", key: "id" },
      },
      batchNumber: { type: D.STRING(100), allowNull: true },
      expirationDate: { type: D.DATEONLY, allowNull: true },
      kind: { type: D.STRING(20), allowNull: false },
      quantity: { type: D.DECIMAL(10, 3), allowNull: false, defaultValue: 0 },
      revision: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
    },
    { tableName: "stock_lots" },
  );
