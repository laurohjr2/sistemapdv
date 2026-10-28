const { fail } = require("./commercialValidation"),
  crypto = require("node:crypto");
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.keys(v)
        .filter((k) => v[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(v);
}
const digest = (v) => sha(canonical(v));
function image(value) {
  if (typeof value !== "string" || value.length > 2900000)
    throw fail("Use foto PNG ou JPEG com até 2 MB");
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    value,
  );
  if (!m) throw fail("Foto inválida. Use PNG ou JPEG");
  const data = Buffer.from(m[2], "base64");
  if (
    !data.length ||
    data.length > 2 * 1024 * 1024 ||
    data.toString("base64") !== m[2]
  )
    throw fail("Arquivo de imagem inválido ou maior que 2 MB");
  const png = data
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    jpeg = data[0] === 255 && data[1] === 216 && data[2] === 255;
  if ((m[1] === "png" && !png) || (m[1] === "jpeg" && !jpeg))
    throw fail("Conteúdo da imagem não corresponde ao formato");
  let info;
  try {
    info = new (require("pdfkit"))({ autoFirstPage: false }).openImage(data);
    if (!info.width || !info.height || info.width > 2048 || info.height > 2048)
      throw Error();
    if (png) {
      const depth = data[24],
        color = data[25];
      if (depth !== 8 || ![0, 2, 4, 6].includes(color) || data[28] !== 0)
        throw Error();
      const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[color],
        row = info.width * channels + 1,
        parts = [];
      let at = 8,
        ended = false;
      while (at + 12 <= data.length) {
        const len = data.readUInt32BE(at),
          name = data.toString("ascii", at + 4, at + 8);
        if (len > data.length - at - 12) throw Error();
        if (name === "IDAT") parts.push(data.subarray(at + 8, at + 8 + len));
        at += len + 12;
        if (name === "IEND") {
          ended = true;
          break;
        }
      }
      if (!ended || !parts.length) throw Error();
      const raw = require("node:zlib").inflateSync(Buffer.concat(parts), {
        maxOutputLength: row * info.height,
      });
      if (raw.length !== row * info.height) throw Error();
      for (let y = 0; y < info.height; y++) if (raw[y * row] > 4) throw Error();
    }
  } catch {
    throw fail(
      "Não foi possível validar a foto. Use JPEG ou PNG padrão de até 2048 × 2048 pixels",
    );
  }
  return {
    data,
    mime: "image/" + m[1],
    bytes: data.length,
    width: info.width,
    height: info.height,
    digest: sha(data),
  };
}
function strokes(value) {
  if (!Array.isArray(value) || !value.length || value.length > 100)
    throw fail("Desenhe a assinatura");
  let count = 0,
    distance = 0;
  const result = value.map((line) => {
    if (!Array.isArray(line) || line.length < 2 || line.length > 5000)
      throw fail("Traço inválido");
    count += line.length;
    if (count > 5000) throw fail("Assinatura muito extensa");
    return line.map((point, i) => {
      if (
        !point ||
        typeof point !== "object" ||
        !["x", "y"].every(
          (k) =>
            typeof point[k] === "number" &&
            Number.isFinite(point[k]) &&
            point[k] >= 0 &&
            point[k] <= 1,
        )
      )
        throw fail("Coordenada da assinatura inválida");
      const p = {
        x: Math.round(point.x * 10000) / 10000,
        y: Math.round(point.y * 10000) / 10000,
      };
      if (i) distance += Math.hypot(p.x - line[i - 1].x, p.y - line[i - 1].y);
      return p;
    });
  });
  if (distance < 0.1) throw fail("A assinatura está vazia ou muito curta");
  return result;
}
function scope(o, purpose) {
  return {
    number: o.number,
    customerId: o.customerId,
    customer: o.customerSnapshot,
    vehicleId: o.vehicleId,
    vehicle: o.vehicleSnapshot,
    mileage: o.mileage,
    complaint: o.complaint,
    diagnosis: o.diagnosis,
    notes: o.notes || "",
    assignedUserId: o.assignedUserId,
    assignedName: o.assignedName,
    checklist: o.checklist,
    lines: o.lines,
    discount: Number(o.discount),
    total: Number(o.total),
    approvedAt: o.approvedAt ? new Date(o.approvedAt).toISOString() : null,
    approvalNote: o.approvalNote,
    warrantyTerms: o.warrantyTerms || {},
    ...(purpose === "delivery"
      ? {
          saleId: o.saleId,
          deliveryEvent:
            (o.events || []).filter((e) => e.action === "delivered").at(-1)
              ?.at || null,
        }
      : {}),
  };
}
const agreements = {
  approval:
    "Declaro que conferi e aceito o escopo e os valores desta ordem de serviço apresentados neste registro.",
  delivery:
    "Declaro o recebimento do veículo e a ciência dos serviços e observações apresentados nesta ordem de serviço.",
};
const signatureState = (s, o) => {
  const integrity =
    digest(s.payload) === s.digest && digest(s.payload.scope) === s.scopeDigest;
  return {
    integrity,
    current:
      integrity &&
      !s.voidedAt &&
      digest(scope(o, s.purpose)) === s.scopeDigest &&
      (s.purpose === "approval"
        ? ["approved", "in_progress", "ready", "delivered"].includes(o.status)
        : o.status === "delivered"),
  };
};
module.exports = {
  sha,
  digest,
  image,
  strokes,
  scope,
  agreements,
  signatureState,
};
