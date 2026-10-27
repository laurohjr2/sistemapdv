const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "PartDetail",
    {
      productId: {
        type: D.UUID,
        primaryKey: true,
        references: { model: "products", key: "id" },
      },
      manufacturer: { type: D.STRING(100), allowNull: false, defaultValue: "" },
      partNumber: { type: D.STRING(100), allowNull: false, defaultValue: "" },
      originalCodes: { type: D.JSONB, allowNull: false, defaultValue: [] },
      applications: { type: D.JSONB, allowNull: false, defaultValue: [] },
      notes: { type: D.TEXT, allowNull: false, defaultValue: "" },
      revision: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
    },
    { tableName: "part_details" },
  );
