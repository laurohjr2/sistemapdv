const { fail, uuid, text } = require("./commercialValidation"),
  V = require("./workshopEvidenceValidation");
function factory() {
  const {
      sequelize,
      WorkOrder,
      WorkOrderPhoto,
      WorkOrderSignature,
      AuditLog,
      Sale,
    } = require("../models"),
    ops = require("./workshopOperations");
  const manager = (u) => ["admin", "gerente"].includes(u.role),
    keys = ["general", ...Object.keys(ops.checkLabels), "fuelLevel"];
  async function locked(id, revision, transaction) {
    await ops.enabled(transaction);
    const o = await WorkOrder.findByPk(uuid(id), {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!o) throw fail("OS não encontrada", 404);
    if (revision !== o.revision)
      throw fail("A OS foi alterada. Recarregue antes de continuar.", 409);
    return o;
  }
  const audit = (u, action, details, t) =>
    AuditLog.create(
      { userId: u.id, action, details: JSON.stringify(details) },
      { transaction: t },
    );
  async function touch(o, u, action, note, t) {
    await o.update(
      { revision: o.revision + 1, events: ops.event(o, u, action, note) },
      { transaction: t },
    );
  }
  async function list(id) {
    const o = await WorkOrder.findByPk(uuid(id));
    if (!o) throw fail("OS não encontrada", 404);
    const photos = await WorkOrderPhoto.findAll({
      where: { orderId: o.id },
      attributes: { exclude: ["data"] },
      order: [["createdAt", "ASC"]],
    });
    const signatures = (
      await WorkOrderSignature.findAll({
        where: { orderId: o.id },
        order: [["createdAt", "ASC"]],
      })
    ).map((s) => ({ ...s.toJSON(), ...V.signatureState(s, o) }));
    return { revision: o.revision, photos, signatures };
  }
  async function addPhoto(id, b, u) {
    if (!b || typeof b !== "object" || Array.isArray(b))
      throw fail("Foto inválida");
    const file = V.image(b.image),
      caption = text(b.caption, "Descrição da foto", 200),
      checkKey = b.checkKey || "general";
    if (!keys.includes(checkKey)) throw fail("Item do checklist inválido");
    return sequelize.transaction(async (t) => {
      const o = await locked(id, b.revision, t);
      if (!manager(u) && o.assignedUserId !== u.id)
        throw fail(
          "Somente o responsável da OS ou a gerência pode anexar fotos",
          403,
        );
      if (["delivered", "cancelled"].includes(o.status))
        throw fail(
          "Anexe as fotos durante o atendimento, antes da entrega/cancelamento",
        );
      const all = await WorkOrderPhoto.findAll({
        where: { orderId: o.id },
        attributes: ["id", "archivedAt"],
        transaction: t,
      });
      if (all.length >= 20 || all.filter((p) => !p.archivedAt).length >= 10)
        throw fail("Limite de 10 fotos ativas e 20 registros por OS");
      const p = await WorkOrderPhoto.create(
        { ...file, caption, checkKey, orderId: o.id, createdBy: u.id },
        { transaction: t },
      );
      await touch(o, u, "photo_added", caption, t);
      await audit(
        u,
        "work_order_photo_added",
        { orderId: o.id, photoId: p.id, digest: p.digest, bytes: p.bytes },
        t,
      );
      const data = p.toJSON();
      delete data.data;
      return data;
    });
  }
  async function archivePhoto(id, photoId, b, u) {
    if (!manager(u))
      throw fail("Somente gerente e administrador podem arquivar fotos", 403);
    const reason = text(b?.reason, "Motivo do arquivamento", 1000);
    return sequelize.transaction(async (t) => {
      const o = await locked(id, b.revision, t),
        p = await WorkOrderPhoto.findOne({
          where: { id: uuid(photoId), orderId: o.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
      if (!p) throw fail("Foto não encontrada", 404);
      if (p.archivedAt) throw fail("Foto já arquivada", 409);
      await p.update(
        { archivedAt: new Date(), archivedBy: u.id, archiveReason: reason },
        { transaction: t },
      );
      await touch(o, u, "photo_archived", reason, t);
      await audit(
        u,
        "work_order_photo_archived",
        { orderId: o.id, photoId: p.id, digest: p.digest, reason },
        t,
      );
    });
  }
  async function sign(id, b, u) {
    if (!manager(u))
      throw fail(
        "O registro da assinatura exige gerente ou administrador",
        403,
      );
    if (!b || !Object.hasOwn(V.agreements, b.purpose) || b.confirmed !== true)
      throw fail(
        "Confirme que o cliente conferiu o conteúdo e assinou neste dispositivo",
      );
    const points = V.strokes(b.strokes),
      signerName = text(b.signerName, "Nome de quem assinou", 150),
      relationship = text(b.relationship, "Vínculo com o cliente", 200);
    return sequelize.transaction(async (t) => {
      const o = await locked(id, b.revision, t);
      if (
        (b.purpose === "approval" && o.status !== "approved") ||
        (b.purpose === "delivery" && o.status !== "delivered")
      )
        throw fail(
          "Registre o aceite após aprovar a OS; o recebimento é assinado após a entrega",
        );
      if (
        b.purpose === "delivery" &&
        (!o.saleId ||
          (await Sale.findByPk(o.saleId, { transaction: t }))?.status !==
            "completed")
      )
        throw fail("Recebimento da OS não confirmado");
      const snapshot = V.scope(o, b.purpose),
        scopeDigest = V.digest(snapshot),
        all = await WorkOrderSignature.findAll({
          where: { orderId: o.id },
          transaction: t,
        });
      if (all.length >= 20)
        throw fail("Limite de 20 registros de assinatura por OS");
      if (
        all.some(
          (s) =>
            s.purpose === b.purpose &&
            !s.voidedAt &&
            s.scopeDigest === scopeDigest,
        )
      )
        throw fail("Já existe assinatura para este escopo", 409);
      const photos = await WorkOrderPhoto.findAll({
        where: { orderId: o.id, archivedAt: null },
        attributes: ["id", "caption", "digest", "checkKey"],
        order: [["createdAt", "ASC"]],
        transaction: t,
        raw: true,
      });
      const payload = {
          purpose: b.purpose,
          orderRevision: o.revision,
          signerName,
          relationship,
          agreement: V.agreements[b.purpose],
          strokes: points,
          scope: snapshot,
          photos,
          signedAt: new Date().toISOString(),
          operator: {
            id: u.id,
            name: u.platformUserId ? "Master/Admin" : u.username,
          },
        },
        s = await WorkOrderSignature.create(
          {
            orderId: o.id,
            purpose: b.purpose,
            payload,
            scopeDigest,
            digest: V.digest(payload),
          },
          { transaction: t },
        );
      await touch(
        o,
        u,
        "signature_recorded",
        `${b.purpose === "approval" ? "Aceite" : "Recebimento"} — ${signerName}`,
        t,
      );
      await audit(
        u,
        "work_order_signature_recorded",
        {
          orderId: o.id,
          signatureId: s.id,
          purpose: s.purpose,
          digest: s.digest,
        },
        t,
      );
      return s;
    });
  }
  async function voidSignature(id, signatureId, b, u) {
    if (!manager(u))
      throw fail(
        "Somente a gerência pode cancelar um registro de assinatura",
        403,
      );
    const reason = text(b?.reason, "Motivo do cancelamento do registro", 1000);
    return sequelize.transaction(async (t) => {
      const o = await locked(id, b.revision, t),
        s = await WorkOrderSignature.findOne({
          where: { id: uuid(signatureId), orderId: o.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
      if (!s) throw fail("Assinatura não encontrada", 404);
      if (s.voidedAt) throw fail("Registro já cancelado", 409);
      await s.update(
        { voidedAt: new Date(), voidedBy: u.id, voidReason: reason },
        { transaction: t },
      );
      await touch(o, u, "signature_voided", reason, t);
      await audit(
        u,
        "work_order_signature_voided",
        { orderId: o.id, signatureId: s.id, digest: s.digest, reason },
        t,
      );
    });
  }
  async function file(id, photoId) {
    const p = await WorkOrderPhoto.findOne({
      where: { id: uuid(photoId), orderId: uuid(id) },
    });
    if (!p) throw fail("Foto não encontrada", 404);
    if (V.sha(p.data) !== p.digest)
      throw fail(
        "A integridade desta foto não confere. Consulte a administração.",
        409,
      );
    return p;
  }
  async function appendPdf(doc, o) {
    const data = await list(o.id);
    if (!data.photos.length && !data.signatures.length) return;
    const label = {
      general: "Geral",
      ...ops.checkLabels,
      fuelLevel: "Combustível",
    };
    for (const meta of data.photos) {
      if (meta.archivedAt) continue;
      doc.addPage();
      doc
        .fontSize(16)
        .text("Fotos do checklist — OS #" + o.number)
        .moveDown();
      doc.fontSize(11).text(label[meta.checkKey] + ": " + meta.caption);
      doc.fontSize(9).text(
        "Registro: " +
          new Date(meta.createdAt).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          }),
      );
      try {
        const p = await file(o.id, meta.id);
        doc.image(p.data, 40, 140, {
          fit: [doc.page.width - 80, doc.page.height - 220],
          align: "center",
          valign: "center",
        });
      } catch {
        doc.text(
          "Foto indisponível para impressão. Confira o registro anexado.",
        );
      }
      doc
        .fontSize(8)
        .text("SHA-256: " + meta.digest, 40, doc.page.height - 65, {
          width: doc.page.width - 80,
        });
    }
    for (const original of data.signatures) {
      const s = { ...original, ...V.signatureState(original, o) };
      doc.addPage();
      doc
        .fontSize(16)
        .text(
          (s.purpose === "approval"
            ? "Assinatura de aceite"
            : "Assinatura de recebimento") +
            " — OS #" +
            o.number,
        )
        .moveDown();
      doc
        .fontSize(11)
        .text("Signatário: " + s.payload.signerName)
        .text("Vínculo: " + s.payload.relationship)
        .text(s.payload.agreement)
        .moveDown();
      doc.fontSize(10).text(
        "Capturada em " +
          new Date(s.payload.signedAt).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          }) +
          " por " +
          s.payload.operator.name,
      );
      doc.text(
        s.voidedAt
          ? "REGISTRO CANCELADO: " + s.voidReason
          : s.current
            ? "Compatível com o escopo impresso da OS"
            : "Histórico de escopo anterior",
      );
      doc.text(
        "Total no ato: " +
          Number(s.payload.scope.total).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
      );
      const recorded = s.payload.scope;
      doc
        .moveDown()
        .fontSize(10)
        .text("Escopo apresentado no ato da assinatura");
      doc
        .fontSize(9)
        .text("Cliente: " + recorded.customer.name)
        .text(
          "Veículo: " +
            recorded.vehicle.plate +
            " · " +
            recorded.vehicle.brand +
            " " +
            recorded.vehicle.model +
            " · " +
            recorded.mileage +
            " km",
        )
        .text("Relato: " + recorded.complaint)
        .text("Diagnóstico: " + recorded.diagnosis);
      if (recorded.notes) doc.text("Observações: " + recorded.notes);
      for (const line of recorded.lines)
        doc.text(
          line.quantity +
            " " +
            line.unit +
            " × " +
            line.name +
            " — " +
            Number(line.total).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            }),
        );
      doc
        .text(
          "Desconto no ato: " +
            Number(recorded.discount).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            }),
        )
        .moveDown();
      if (s.integrity) {
        if (
          doc.y + ((doc.page.width - 100) * 200) / 640 + 100 >
          doc.page.height - 40
        ) {
          doc.addPage();
          doc
            .fontSize(12)
            .text(
              "Assinatura vinculada à OS #" +
                o.number +
                " — " +
                s.payload.signerName,
            )
            .moveDown();
        }
        const left = 50,
          top = doc.y + 20,
          width = doc.page.width - 100,
          height = (width * 200) / 640;
        doc
          .save()
          .rect(left, top, width, height)
          .strokeColor("#aaaaaa")
          .stroke();
        for (const line of s.payload.strokes) {
          doc.moveTo(left + line[0].x * width, top + line[0].y * height);
          for (const p of line.slice(1))
            doc.lineTo(left + p.x * width, top + p.y * height);
          doc.strokeColor("#111111").lineWidth(1.4).stroke();
        }
        doc.restore();
        doc.y = top + height + 20;
      } else doc.text("Integridade do registro não confirmada.");
      doc
        .fontSize(8)
        .text("SHA-256: " + s.digest)
        .text("Escopo: " + s.scopeDigest)
        .text(
          "Fotos referenciadas no ato: " +
            (s.payload.photos
              .map((p) => p.caption + " [" + p.digest.slice(0, 12) + "]")
              .join("; ") || "Nenhuma"),
        )
        .moveDown()
        .text(
          "Registro de assinatura desenhada no estabelecimento, sem certificação digital de identidade.",
        );
    }
    if (data.photos.some((p) => p.archivedAt)) {
      doc.addPage();
      doc.fontSize(14).text("Histórico de fotos arquivadas");
      for (const p of data.photos.filter((p) => p.archivedAt))
        doc
          .fontSize(9)
          .text(p.caption + " — " + p.archiveReason + " — SHA-256 " + p.digest);
    }
  }
  return { list, addPhoto, archivePhoto, sign, voidSignature, file, appendPdf };
}
module.exports = require("../tenancy/scopedModule")(factory, [
  "list",
  "addPhoto",
  "archivePhoto",
  "sign",
  "voidSignature",
  "file",
  "appendPdf",
]);
