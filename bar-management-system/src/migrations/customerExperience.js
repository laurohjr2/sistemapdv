module.exports = async (sequelize) => {
  const { DataTypes } = require("sequelize"),
    q = sequelize.getQueryInterface();
  const fields = {
    users: {
      platformUserId: { type: DataTypes.UUID, allowNull: true, unique: true },
    },
    sales: {
      customerId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "customers", key: "id" },
      },
      payments: { type: DataTypes.JSONB, allowNull: true },
      discount_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
    },
    comandas: {
      customerId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "customers", key: "id" },
      },
      payments: { type: DataTypes.JSONB, allowNull: true },
    },
    business_settings: {
      pixKey: {
        type: DataTypes.STRING(200),
        allowNull: false,
        defaultValue: "",
      },
      pixQrCode: { type: DataTypes.TEXT, allowNull: true },
    },
  };
  for (const [table, columns] of Object.entries(fields)) {
    const current = await q.describeTable(table);
    for (const [name, definition] of Object.entries(columns))
      if (!current[name]) await q.addColumn(table, name, definition);
  }
};
