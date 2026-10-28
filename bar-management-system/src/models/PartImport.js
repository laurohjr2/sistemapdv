const { DataTypes: D } = require("sequelize");
module.exports = (s) =>
  s.define(
    "PartImport",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      filename: { type: D.STRING(150), allowNull: false },
      source: { type: D.STRING(200), allowNull: false },
      payload: { type: D.JSONB, allowNull: false },
      digest: { type: D.STRING(64), allowNull: false },
      status: { type: D.STRING(20), allowNull: false, defaultValue: "preview" },
      expiresAt: { type: D.DATE, allowNull: false },
      createdBy: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      result: { type: D.JSONB, allowNull: true },
    },
    { tableName: "part_imports" },
  );
