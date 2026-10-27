function createRouter() {
  const router = require("express").Router();
  const { authenticateToken } = require("../middleware/auth");
  const { sequelize, Comanda, Customer } = require("../models");
  router.put("/:id/customer", authenticateToken, async (req, res, next) => {
    try {
      const result = await sequelize.transaction(async (transaction) => {
        const comanda = await Comanda.findByPk(req.params.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!comanda || comanda.status !== "aberta")
          throw Object.assign(new Error("Comanda aberta não encontrada"), {
            status: 400,
          });
        const { customerId, customerName } = req.body;
        if (typeof customerName !== "string" || customerName.length > 150)
          throw Object.assign(new Error("Nome inválido"), { status: 400 });
        const customer = customerId
          ? await Customer.findByPk(customerId, { transaction })
          : null;
        if (customerId && !customer?.active)
          throw Object.assign(new Error("Cliente não encontrado ou inativo"), {
            status: 400,
          });
        return comanda.update(
          {
            customerId: customer?.id || null,
            customerName: customer?.name || customerName,
            customerPhone: customer?.phone || null,
          },
          { transaction },
        );
      });
      res.json(result);
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  });
  return router;
}
module.exports = require("../tenancy/scopedModule").router(createRouter);
