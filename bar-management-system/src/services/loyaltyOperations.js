function factory() {
  const { LoyaltyProfile, Customer } = require("../models"),
    { fail, uuid, today } = require("./commercialValidation");
  async function quote(customerId, subtotal, revision, transaction) {
    const customer = await Customer.findByPk(uuid(customerId), { transaction }),
      profile = await LoyaltyProfile.findByPk(customerId, { transaction });
    if (
      !customer?.active ||
      !profile?.active ||
      profile.basisPoints <= 0 ||
      (profile.validUntil && profile.validUntil < today())
    )
      throw fail("Cliente sem benefício de fidelidade ativo");
    if (revision !== profile.revision)
      throw fail("A condição de fidelidade mudou. Confira novamente.", 409);
    const amount = Number(
      (BigInt(subtotal) * BigInt(profile.basisPoints) + 5000n) / 10000n,
    );
    return {
      customerId,
      discount: amount,
      snapshot: {
        label: profile.label,
        basisPoints: profile.basisPoints,
        revision: profile.revision,
        validUntil: profile.validUntil,
      },
      description:
        "Fidelidade: " +
        profile.label +
        " · " +
        (profile.basisPoints / 100).toLocaleString("pt-BR") +
        "%",
    };
  }
  return { quote };
}
module.exports = require("../tenancy/scopedModule")(factory, ["quote"]);
