module.exports = async (sequelize) => {
  const { DataTypes: D } = require("sequelize"),
    q = sequelize.getQueryInterface();
  for (const table of ["sale_items", "comanda_items"]) {
    const columns = await q.describeTable(table);
    if (!columns.pizza)
      await q.addColumn(table, "pizza", { type: D.JSONB, allowNull: true });
  }
  const columns = await q.describeTable("sale_items");
  for (const [name, type] of Object.entries({
    preparationStatus: D.STRING(12),
    preparationStartedAt: D.DATE,
    preparationCompletedAt: D.DATE,
    deliveredAt: D.DATE,
  }))
    if (!columns[name])
      await q.addColumn("sale_items", name, { type, allowNull: true });
};
