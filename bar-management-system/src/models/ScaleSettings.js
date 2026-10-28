const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "ScaleSettings",
    {
      id: { type: D.INTEGER, primaryKey: true, defaultValue: 1 },
      enabled: { type: D.BOOLEAN, allowNull: false, defaultValue: false },
      preset: {
        type: D.STRING(30),
        allowNull: false,
        defaultValue: "weight_5",
      },
      prefix: { type: D.STRING(2), allowNull: false, defaultValue: "20" },
      revision: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
    },
    { tableName: "scale_settings" },
  );
