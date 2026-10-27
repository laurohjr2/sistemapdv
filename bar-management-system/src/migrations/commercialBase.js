module.exports = async (sequelize) => {
  const { DataTypes: D } = require("sequelize"),
    q = sequelize.getQueryInterface();
  const additions = {
    products: {
      itemType: {
        type: D.STRING(12),
        allowNull: false,
        defaultValue: "product",
      },
    },
    sale_items: {
      stockTracked: { type: D.BOOLEAN, allowNull: false, defaultValue: true },
    },
    comanda_items: {
      stockTracked: { type: D.BOOLEAN, allowNull: false, defaultValue: true },
    },
    sales: { sourceQuoteId: { type: D.UUID, allowNull: true, unique: true } },
    business_settings: {
      businessProfile: {
        type: D.STRING(30),
        allowNull: false,
        defaultValue: "bar_restaurante",
      },
      modules: { type: D.JSONB, allowNull: true },
    },
  };
  for (const [table, fields] of Object.entries(additions)) {
    const columns = await q.describeTable(table);
    for (const [name, definition] of Object.entries(fields))
      if (!columns[name]) await q.addColumn(table, name, definition);
  }
  const columns = await q.describeTable("products");
  if (!columns.category.type.startsWith("VARCHAR"))
    await sequelize.query(
      "ALTER TABLE products ALTER COLUMN category TYPE VARCHAR(80) USING category::text",
    );
  for (const unit of ["hora", "servico", "metro", "caixa", "par"])
    await sequelize.query(
      `ALTER TYPE enum_products_unit_of_measure ADD VALUE IF NOT EXISTS '${unit}'`,
    );
};
