module.exports = async (sequelize) => {
  const q = sequelize.getQueryInterface(),
    D = require("sequelize").DataTypes;
  for (const [table, fields] of Object.entries({
    products: {
      recipeEnabled: { type: D.BOOLEAN, allowNull: false, defaultValue: false },
    },
    sale_items: { recipe: { type: D.JSONB, allowNull: true } },
    comanda_items: { recipe: { type: D.JSONB, allowNull: true } },
  })) {
    const old = await q.describeTable(table);
    for (const [name, definition] of Object.entries(fields))
      if (!old[name]) await q.addColumn(table, name, definition);
  }
};
