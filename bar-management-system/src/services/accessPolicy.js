// Unknown authenticated endpoints fail closed for users with a restricted profile.
function required(req) {
  const method = req.method,
    read = method === "GET" || method === "HEAD";
  let path;
  try {
    path = decodeURIComponent(req.originalUrl.split("?")[0]).replace(
      /\/+$/,
      "",
    );
  } catch {
    return ["unmapped"];
  }
  const p = path.replace(/^\/api\//, "").split("/"),
    root = p.shift(),
    tail = p.join("/"),
    b = req.body || {};
  const result = [];
  const one = (id) => result.push(id),
    any = (...ids) => result.push({ any: ids });
  if (
    (root === "auth" && tail === "validate") ||
    (root === "access" && tail === "me") ||
    (root === "settings" && read)
  ) {
    return [];
  }
  if (root === "access" || root === "users" || root === "auth")
    one("users.manage");
  else if (root === "products") {
    if (read) one("products.read");
    else
      one(
        tail === "starter-catalogs/import"
          ? "products.import"
          : "products.edit",
      );
    if (!read) one("costs.view");
  } else if (root === "customers") one("customers." + (read ? "view" : "edit"));
  else if (root === "sales") {
    one(
      "sales." +
        (read ? "view" : tail.endsWith("/cancel") ? "cancel" : "create"),
    );
  } else if (root === "cash-register")
    one(
      "cash." +
        (read
          ? tail === "status"
            ? "view"
            : "report"
          : tail === "open"
            ? "open"
            : tail === "close"
              ? "close"
              : "unmapped"),
    );
  else if (root === "tables") {
    one(
      "tables." +
        (read
          ? tail.endsWith("/receipt")
            ? "print"
            : "view"
          : tail.endsWith("/open-comanda")
            ? "edit"
            : tail.endsWith("/close-comanda")
              ? "receive"
              : "manage"),
    );
  } else if (root === "comandas") {
    one(
      "tables." +
        (read
          ? "view"
          : /\/(close|payment-status)$/.test(tail)
            ? "receive"
            : tail.endsWith("/cancel")
              ? "cancel"
              : "edit"),
    );
  } else if (root === "waiting-queue")
    one("tables." + (read ? "view" : "edit"));
  else if (root === "queue") one("kitchen." + (read ? "view" : "update"));
  else if (root === "tickets")
    one(
      tail.endsWith("/cancel")
        ? "sales.cancel"
        : read
          ? "sales.view"
          : "sales.create",
    );
  else if (root === "stock") {
    one(
      "stock." +
        (read
          ? tail === "report"
            ? "export"
            : "view"
          : ["add", "remove", "adjust"].includes(tail)
            ? tail
            : "unmapped"),
    );
    if (tail === "report") one("costs.view");
  } else if (root === "reports") {
    if (tail === "dashboard") one("dashboard.view");
    else {
      one("reports.view");
      if (tail.startsWith("export/")) one("reports.export");
      if (tail === "waiters" || req.query?.type === "waiters")
        one("reports.ranking");
      if (tail === "financial" || req.query?.type === "financial")
        one("reports.financial");
      if (tail === "stock" || ["stock", "catalog"].includes(req.query?.type))
        one("costs.view");
    }
  } else if (root === "commerce") {
    const area = p[0],
      action = p.at(-1);
    if (area === "quotes")
      one(
        "quotes." +
          (read
            ? "view"
            : action === "convert"
              ? "convert"
              : action === "status"
                ? "approve"
                : "edit"),
      );
    else if (area === "suppliers") one("suppliers." + (read ? "view" : "edit"));
    else if (area === "purchases") {
      one(
        "purchases." +
          (read
            ? "view"
            : action === "receive"
              ? "receive"
              : action === "cancel"
                ? "cancel"
                : "edit"),
      );
      one("costs.view");
    } else if (area === "finance")
      one(
        "finance." +
          (read
            ? action === "export.pdf"
              ? "export"
              : "view"
            : action === "payments"
              ? "pay"
              : action === "cancel"
                ? "cancel"
                : "edit"),
      );
    else one("unmapped");
  } else if (root === "workshop") {
    if (tail === "staff" || (tail === "vehicles" && read))
      any("workshop.view", "agenda.view", "warranty.view");
    else if (/\/photos\/[^/]+\/file$/.test(tail) || tail.endsWith("/evidence"))
      one("workshop.view");
    else if (tail.endsWith("/photos")) one("workshop.photo");
    else if (/\/(archive|signatures|void)$/.test(tail))
      one("workshop.evidence");
    else if (tail.endsWith("/pdf")) one("workshop.print");
    else if (read) any("workshop.view", "agenda.view", "warranty.view");
    else if (tail.endsWith("/checkout")) one("workshop.receive");
    else if (tail.endsWith("/status"))
      one(
        "workshop." +
          (["in_progress", "ready"].includes(b.status)
            ? "execute"
            : b.status === "delivered"
              ? "receive"
              : b.status === "cancelled"
                ? "cancel"
                : "approve"),
      );
    else one("workshop.manage");
  } else if (root === "workshop-agenda")
    one("agenda." + (read ? "view" : "edit"));
  else if (root === "workshop-warranty")
    one(
      "warranty." +
        (read ? (tail.endsWith("/pdf") ? "print" : "view") : "edit"),
    );
  else if (root === "part-imports") {
    one("parts.import");
    one("costs.view");
  } else if (root === "autoparts") one("parts." + (read ? "view" : "edit"));
  else if (root === "market") {
    one("lots." + (read ? "view" : "manage"));
    if (tail === "report") one("costs.view");
  } else if (root === "deliveries")
    one(
      "delivery." +
        (read
          ? tail.endsWith("/pdf")
            ? "print"
            : "view"
          : tail.endsWith("/status")
            ? b.status === "cancelled"
              ? "cancel"
              : "status"
            : "edit"),
    );
  else if (root === "recipes") {
    if (tail === "kitchen" || tail.startsWith("kitchen/"))
      one("kitchen." + (read ? "view" : "update"));
    else {
      one("recipes." + (read ? "view" : "edit"));
      one("costs.view");
    }
  } else if (root === "pizza") {
    if (tail === "kitchen" || tail.startsWith("kitchen/"))
      one("kitchen." + (read ? "view" : "update"));
    else one("pizza." + (read || tail === "price" ? "view" : "edit"));
  } else if (root === "bundles") {
    one(
      "bundles." +
        (read || tail === "price" || tail.startsWith("comandas/")
          ? "view"
          : "edit"),
    );
    if (tail.startsWith("comandas/")) one("tables.edit");
  } else if (root === "scale")
    one(
      "scales." +
        (tail === "scan"
          ? "scan"
          : tail === "labels"
            ? "print"
            : read
              ? "view"
              : "edit"),
    );
  else if (root === "loyalty")
    one(
      "loyalty." +
        (tail === "quote"
          ? "apply"
          : tail === "history.pdf"
            ? "export"
            : read
              ? "view"
              : "edit"),
    );
  else if (root === "settings") one("settings.edit");
  else if (root === "print") {
    if (tail.startsWith("comanda/")) one("tables.print");
    else {
      one("reports.export");
      one("reports.view");
    }
  } else if (root === "printer") {
    if (tail === "test") one("printer.manage");
    else if (tail.startsWith("comanda/")) one("tables.print");
    else one("sales.view");
  } else one("unmapped");
  if (!read) {
    if (
      ["costPrice", "cost_price", "unitCost", "unit_cost"].some((k) =>
        Object.hasOwn(b, k),
      )
    )
      one("costs.view");
    if (
      [
        "discount",
        "discount_amount",
        "discountValue",
        "discountPercentage",
      ].some((k) => Number(b[k]) > 0)
    )
      one("discounts.apply");
    if (b.loyalty) one("loyalty.apply");
    if (b.restoreIngredients === true) one("recipes.restore");
  }
  return result;
}
const denied = (access, requirements) =>
  requirements.filter((r) =>
    typeof r === "string"
      ? !access.permissions.includes(r)
      : !r.any.some((p) => access.permissions.includes(p)),
  );
const hiddenCosts = new Set([
  "costPrice",
  "cost_price",
  "unitCost",
  "unit_cost",
  "totalCost",
  "cost",
  "costs",
  "costValue",
  "totalStockValue",
  "stockValue",
  "averageCost",
  "profit",
  "margin",
  "grossProfit",
  "total_cost",
  "cost_amount",
]);
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !hiddenCosts.has(key))
        .map(([k, v]) => [k, redact(v)]),
    );
  return value;
}
function enforce(req, res, access) {
  if (access.mode !== "restricted") return true;
  const missing = denied(access, required(req));
  if (missing.length) {
    res.status(403).json({
      code: "ACCESS_DENIED",
      error:
        "Seu perfil não permite esta operação. Solicite ao administrador a revisão dos seus acessos.",
      required: missing,
    });
    return false;
  }
  if (!access.permissions.includes("costs.view")) {
    const json = res.json.bind(res);
    res.json = (value) => json(redact(JSON.parse(JSON.stringify(value))));
  }
  return true;
}
module.exports = { required, denied, redact, enforce };
