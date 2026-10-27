const { DataTypes } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "Customer",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(150), allowNull: false },
      phone: { type: DataTypes.STRING(40), defaultValue: "" },
      email: { type: DataTypes.STRING(150), defaultValue: "" },
      notes: { type: DataTypes.TEXT, defaultValue: "" },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: "customers" },
  );
