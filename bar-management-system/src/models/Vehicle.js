const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "Vehicle",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      customerId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "customers", key: "id" },
      },
      plate: { type: D.STRING(7), allowNull: false, unique: true },
      brand: { type: D.STRING(60), allowNull: false },
      model: { type: D.STRING(100), allowNull: false },
      year: { type: D.INTEGER, allowNull: true },
      mileage: { type: D.INTEGER, allowNull: false, defaultValue: 0 },
      color: { type: D.STRING(50), defaultValue: "" },
      notes: { type: D.TEXT, defaultValue: "" },
      active: { type: D.BOOLEAN, allowNull: false, defaultValue: true },
      revision: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
    },
    { tableName: "vehicles" },
  );
