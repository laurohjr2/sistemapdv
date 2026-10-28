const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "Recipe",
    {
      productId: {
        type: D.UUID,
        primaryKey: true,
        references: { model: "products", key: "id" },
      },
      yieldQuantity: { type: D.DECIMAL(10, 3), allowNull: false },
      outputUnit: { type: D.STRING(20), allowNull: false },
      ingredients: { type: D.JSONB, allowNull: false },
      notes: { type: D.TEXT, allowNull: false, defaultValue: "" },
      revision: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
    },
    { tableName: "recipes" },
  );
