module.exports = async (s) => {
  const q = s.getQueryInterface(),
    D = require("sequelize").DataTypes;
  for (const table of ["sale_items", "comanda_items"])
    if (!(await q.describeTable(table)).bundle)
      await q.addColumn(table, "bundle", { type: D.JSONB, allowNull: true });
};
