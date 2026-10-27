const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "Supplier",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      name: { type: D.STRING(150), allowNull: false },
      document: { type: D.STRING(30), defaultValue: "" },
      phone: { type: D.STRING(40), defaultValue: "" },
      email: { type: D.STRING(150), defaultValue: "" },
      contact: { type: D.STRING(100), defaultValue: "" },
      notes: { type: D.TEXT, defaultValue: "" },
      active: { type: D.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: "suppliers" },
  );
