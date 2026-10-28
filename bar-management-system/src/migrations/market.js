module.exports = async (sequelize) => {
  const q = sequelize.getQueryInterface(),
    D = require("sequelize").DataTypes;
  for (const [table, columns] of Object.entries({
    products: {
      lotTracked: { type: D.BOOLEAN, allowNull: false, defaultValue: false },
    },
    stock_movements: {
      lotId: { type: D.UUID, allowNull: true },
      lotAllocations: { type: D.JSONB, allowNull: true },
    },
  })) {
    const existing = await q.describeTable(table);
    for (const [name, definition] of Object.entries(columns))
      if (!existing[name]) await q.addColumn(table, name, definition);
  }
};
