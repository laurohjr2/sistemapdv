const { DataTypes: D } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define(
    "WorkOrder",
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      number: { type: D.INTEGER, autoIncrement: true, unique: true },
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
      customerSnapshot: { type: D.JSONB, allowNull: false },
      vehicleSnapshot: { type: D.JSONB, allowNull: false },
      assignedUserId: {
        type: D.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
      },
      assignedName: { type: D.STRING(50), defaultValue: "" },
      status: { type: D.STRING(24), allowNull: false, defaultValue: "draft" },
      revision: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
      complaint: { type: D.TEXT, allowNull: false },
      diagnosis: { type: D.TEXT, defaultValue: "" },
      notes: { type: D.TEXT, defaultValue: "" },
      mileage: { type: D.INTEGER, allowNull: false },
      checklist: { type: D.JSONB, allowNull: false, defaultValue: {} },
      lines: { type: D.JSONB, allowNull: false, defaultValue: [] },
      subtotal: { type: D.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      discount: { type: D.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      total: { type: D.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      approvalNote: { type: D.TEXT, allowNull: true },
      approvedAt: { type: D.DATE, allowNull: true },
      saleId: {
        type: D.INTEGER,
        allowNull: true,
        unique: true,
        references: { model: "sales", key: "id" },
      },
      events: { type: D.JSONB, allowNull: false, defaultValue: [] },
      createdBy: {
        type: D.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
    },
    { tableName: "work_orders" },
  );
