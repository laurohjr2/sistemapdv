const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "ScaleProduct",
    {
      productId: {
        type: D.UUID,
        primaryKey: true,
        references: { model: "products", key: "id" },
      },
      plu: { type: D.INTEGER, allowNull: false, unique: true },
      unitPriceSnapshot: { type: D.DECIMAL(10, 2), allowNull: false },
      revision: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
    },
    { tableName: "scale_products" },
  );
