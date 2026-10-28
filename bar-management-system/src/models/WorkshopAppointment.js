const { DataTypes: D } = require("sequelize");
module.exports = (s) =>
  s.define(
    "WorkshopAppointment",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      vehicleId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "vehicles", key: "id" },
      },
      customerId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "customers", key: "id" },
      },
      assignedUserId: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      snapshot: { type: D.JSONB, allowNull: false },
      startsAt: { type: D.DATE, allowNull: false },
      endsAt: { type: D.DATE, allowNull: false },
      reason: { type: D.STRING(1000), allowNull: false },
      status: {
        type: D.STRING(20),
        allowNull: false,
        defaultValue: "scheduled",
      },
      orderId: {
        type: D.UUID,
        allowNull: true,
        unique: true,
        references: { model: "work_orders", key: "id" },
      },
      revision: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
      events: { type: D.JSONB, allowNull: false, defaultValue: [] },
      createdBy: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
    },
    { tableName: "workshop_appointments" },
  );
