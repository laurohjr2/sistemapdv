const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "PartEquivalence",
    {
      firstProductId: {
        type: D.UUID,
        primaryKey: true,
        references: { model: "products", key: "id" },
      },
      secondProductId: {
        type: D.UUID,
        primaryKey: true,
        references: { model: "products", key: "id" },
      },
      note: { type: D.TEXT, allowNull: false },
    },
    { tableName: "part_equivalences" },
  );
