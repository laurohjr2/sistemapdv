const { DataTypes: D } = require("sequelize");
module.exports = (s) =>
  s.define(
    "MenuBundle",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      name: { type: D.STRING(150), allowNull: false },
      price: { type: D.DECIMAL(10, 2), allowNull: false },
      components: { type: D.JSONB, allowNull: false },
      extras: { type: D.JSONB, allowNull: false, defaultValue: [] },
      active: { type: D.BOOLEAN, allowNull: false, defaultValue: true },
      revision: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
    },
    { tableName: "menu_bundles" },
  );
