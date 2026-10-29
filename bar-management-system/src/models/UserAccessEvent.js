const { DataTypes: D } = require("sequelize");
module.exports = (s) =>
  s.define(
    "UserAccessEvent",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      userId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      actorId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      actorName: { type: D.STRING(100), allowNull: false },
      reason: { type: D.STRING(1000), allowNull: false },
      before: { type: D.JSONB, allowNull: true },
      after: { type: D.JSONB, allowNull: false },
    },
    { tableName: "user_access_events" },
  );
