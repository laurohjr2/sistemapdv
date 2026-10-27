module.exports = async (sequelize) => {
  const q = sequelize.getQueryInterface();
  const columns = await q.describeTable("sales");
  if (!columns.sourceWorkOrderId)
    await q.addColumn("sales", "sourceWorkOrderId", {
      type: require("sequelize").DataTypes.UUID,
      allowNull: true,
    });
};
