async function authenticateToken(req, res, next) {
  if (req.supportUser?.isMaster) {
    try {
      const { User, sequelize } = require("../models");
      const where = { platformUserId: req.supportUser.id };
      let actor = await User.findOne({ where });
      if (!actor)
        actor = await sequelize.transaction(async (transaction) => {
          await sequelize.query(
            "SELECT pg_advisory_xact_lock(hashtextextended(:actor, 0))",
            {
              replacements: { actor: "platform-user:" + req.supportUser.id },
              transaction,
            },
          );
          const [record] = await User.findOrCreate({
            where,
            defaults: {
              id: req.supportUser.id,
              username: "master." + req.supportUser.id,
              passwordHash: require("node:crypto")
                .randomBytes(32)
                .toString("hex"),
              role: "admin",
              active: true,
            },
            transaction,
          });
          return record;
        });
      req.user = actor;
      req.master = true;
      if (!["GET", "HEAD"].includes(req.method))
        await req.platform.SupportAudit.create({
          supportUserId: req.supportUser.id,
          tenantId: req.tenant.id,
          action: `master:${req.method}:${req.path}`.slice(0, 255),
        });
      return next();
    } catch (e) {
      return next(e);
    }
  }
  if (req.supportUser) {
    req.user = {
      id: req.supportUser.id,
      username: req.supportUser.username,
      role: "gerente",
      support: true,
    };
    return next();
  }
  if (req.claims?.scope !== "tenant" || req.claims.company !== req.tenant?.slug)
    return res.status(401).json({ error: "Sessão inválida" });
  try {
    const { User } = require("../models");
    const user = await User.findByPk(req.claims.userId);
    if (
      !user?.active ||
      user.platformUserId ||
      req.claims.credentialVersion !==
        require("node:crypto")
          .createHash("sha256")
          .update(user.passwordHash)
          .digest("hex")
    )
      return res.status(401).json({ error: "Sessão inválida" });
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
const authorizeRoles =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return res.sendStatus(401);
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: "Permissão insuficiente" });
    next();
  };
module.exports = { authenticateToken, authorizeRoles };
