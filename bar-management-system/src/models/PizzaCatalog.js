const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "PizzaCatalog",
    {
      id: { type: D.INTEGER, primaryKey: true, defaultValue: 1 },
      revision: { type: D.INTEGER, allowNull: false, defaultValue: 0 },
      pricingRule: {
        type: D.STRING(12),
        allowNull: false,
        defaultValue: "highest",
      },
      sizes: { type: D.JSONB, allowNull: false, defaultValue: [] },
      flavors: { type: D.JSONB, allowNull: false, defaultValue: [] },
      crusts: { type: D.JSONB, allowNull: false, defaultValue: [] },
      extras: { type: D.JSONB, allowNull: false, defaultValue: [] },
    },
    { tableName: "pizza_catalogs" },
  );
