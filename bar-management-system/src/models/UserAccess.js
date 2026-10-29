const { DataTypes: D } = require("sequelize");
module.exports = (s) =>
  s.define(
    "UserAccess",
    {
      userId: {
        type: D.UUID,
        primaryKey: true,
        references: { model: "users", key: "id" },
      },
      mode: { type: D.STRING(20), allowNull: false, defaultValue: "legacy" },
      template: { type: D.STRING(40), allowNull: true },
      permissions: { type: D.JSONB, allowNull: false, defaultValue: [] },
      revision: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
    },
    { tableName: "user_access" },
  );
