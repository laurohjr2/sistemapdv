const { entries, catalogs, normalize } = require("../config/starterCatalogs");
const { profiles } = require("../config/businessProfiles");
function createScopedModule() {
  const { Product, AuditLog, sequelize } = require("../models");
  const describe = async (_req, res, next) => {
    try {
      const existing = await Product.findAll({
        attributes: ["id", "name"],
        raw: true,
      });
      const ids = new Set(existing.map((p) => p.id));
      const names = new Set(existing.map((p) => normalize(p.name)));
      res.json(
        profiles.map((profile) => ({
          id: profile.id,
          name: profile.name,
          items: catalogs[profile.id].map((id) => ({
            ...entries.get(id),
            exists: ids.has(id) || names.has(normalize(entries.get(id).name)),
          })),
        })),
      );
    } catch (error) {
      next(error);
    }
  };
  const importItems = async (req, res, next) => {
    const { profile, itemIds } = req.body || {};
    if (
      typeof profile !== "string" ||
      !Object.hasOwn(catalogs, profile) ||
      !Array.isArray(itemIds) ||
      !itemIds.length ||
      itemIds.length > 1000 ||
      itemIds.some(
        (id) => typeof id !== "string" || !catalogs[profile].includes(id),
      )
    ) {
      return res.status(400).json({
        error: "Escolha um catálogo e seus itens válidos para importar.",
      });
    }
    try {
      const result = await sequelize.transaction(async (transaction) => {
        // Serialize imports in this tenant; stable product IDs also survive renames.
        await sequelize.query("SELECT pg_advisory_xact_lock(882023)", {
          transaction,
        });
        await sequelize.query(
          "LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE",
          { transaction },
        );
        const selected = [...new Set(itemIds)];
        const existing = await Product.findAll({
          attributes: ["id", "name"],
          transaction,
          raw: true,
        });
        const ids = new Set(existing.map((p) => p.id));
        const names = new Set(existing.map((p) => normalize(p.name)));
        const missing = selected.filter(
          (id) => !ids.has(id) && !names.has(normalize(entries.get(id).name)),
        );
        const created = await Product.bulkCreate(
          missing.map((id) => ({
            ...entries.get(id),
            costPrice: 0,
            salePrice: 0,
            currentStock: 0,
            minStockAlert: 0,
            active: false,
            barcode: null,
          })),
          { transaction, validate: true },
        );
        const count = created.length;
        await AuditLog.create(
          {
            userId: req.user.id,
            action: "starter_catalog_imported",
            details: JSON.stringify({
              profile,
              requested: selected.length,
              created: count,
              productIds: missing,
            }),
          },
          { transaction },
        );
        return { created: count, skipped: selected.length - count };
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
  return { describe, importItems };
}
module.exports = require("../tenancy/scopedModule")(createScopedModule, [
  "describe",
  "importItems",
]);
