const catalog = require("../config/accessCatalog");
function factory() {
  const { UserAccess } = require("../models");
  async function info(user, transaction) {
    if (user.platformUserId)
      return {
        kind: "master",
        mode: "full",
        revision: 0,
        permissions: catalog.ceiling("admin"),
        home: "/",
      };
    if (user.support)
      return {
        kind: "support",
        mode: "readonly",
        revision: 0,
        permissions: catalog
          .ceiling("gerente")
          .filter((p) =>
            /\.(view|read|menu|report|export|ranking|financial|print)$/.test(p),
          ),
        home: "/settings",
      };
    if (user.role === "admin")
      return {
        kind: "administrator",
        mode: "full",
        revision: 0,
        permissions: catalog.ceiling("admin"),
        home: "/",
      };
    const record = await UserAccess.findByPk(user.id, { transaction }),
      allowed = new Set(catalog.ceiling(user.role));
    const restricted = record?.mode === "restricted",
      permissions = restricted
        ? record.permissions.filter((p) => allowed.has(p))
        : catalog.ceiling(user.role);
    const home = restricted
      ? Object.entries(catalog.navigation).find(
          ([path, p]) => path !== "/settings" && permissions.includes(p),
        )?.[0] || "/my-access"
      : user.role === "garcom"
        ? "/sales"
        : "/";
    return {
      kind: "tenant",
      mode: restricted ? "restricted" : "legacy",
      template: record?.template || null,
      profileName:
        catalog.templates.find((t) => t.id === record?.template)?.name ||
        "Personalizado",
      revision: record?.revision || 0,
      permissions,
      home,
    };
  }
  return { info };
}
module.exports = {
  ...catalog,
  ...require("../tenancy/scopedModule")(factory, ["info"]),
};
