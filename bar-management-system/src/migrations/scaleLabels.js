module.exports = async (sequelize) => {
  const q = sequelize.getQueryInterface();
  if (!(await q.describeTable("sale_items")).scale)
    await q.addColumn("sale_items", "scale", {
      type: require("sequelize").DataTypes.JSONB,
      allowNull: true,
    });
};
