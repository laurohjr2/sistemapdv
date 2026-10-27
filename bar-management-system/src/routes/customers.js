function createRouter() {
  const router = require("express").Router();
  const { Customer } = require("../models");
  const { authenticateToken } = require("../middleware/auth");
  router.use(authenticateToken);
  router.get("/", async (req, res, next) => {
    try {
      res.json(await Customer.findAll({ order: [["name", "ASC"]] }));
    } catch (e) {
      next(e);
    }
  });
  const save = async (req, res, next) => {
    try {
      const data = {};
      for (const [key, max] of Object.entries({
        name: 150,
        phone: 40,
        email: 150,
        notes: 2000,
      }))
        if (req.body[key] !== undefined) {
          if (typeof req.body[key] !== "string" || req.body[key].length > max)
            return res.status(400).json({ error: "Cadastro inválido" });
          data[key] = req.body[key].trim();
        }
      if (!data.name) return res.status(400).json({ error: "Informe o nome" });
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
        return res.status(400).json({ error: "E-mail inválido" });
      if (req.body.active !== undefined) {
        if (typeof req.body.active !== "boolean") return res.sendStatus(400);
        data.active = req.body.active;
      }
      const customer = req.params.id
        ? await Customer.findByPk(req.params.id)
        : null;
      if (req.params.id && !customer) return res.sendStatus(404);
      res
        .status(customer ? 200 : 201)
        .json(
          customer ? await customer.update(data) : await Customer.create(data),
        );
    } catch (e) {
      next(e);
    }
  };
  router.post("/", save);
  router.put("/:id", save);
  return router;
}
module.exports = require("../tenancy/scopedModule").router(createRouter);
