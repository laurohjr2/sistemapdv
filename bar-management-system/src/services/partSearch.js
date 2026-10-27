const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
function matches(part, query = {}) {
  const detail = part.partDetails || {};
  const term = normalize(query.search);
  if (
    term &&
    !normalize(
      [
        part.name,
        part.barcode,
        detail.manufacturer,
        detail.partNumber,
        ...(detail.originalCodes || []),
      ].join(" "),
    ).includes(term)
  )
    return false;
  if (query.active === "true" && !part.active) return false;
  if (query.active === "false" && part.active) return false;
  const keys = ["brand", "model", "engine", "version"];
  const year = query.year ? Number(query.year) : null;
  if (!keys.some((k) => normalize(query[k])) && !year) return true;
  // All constraints must match the same application; unknown fields never mean "fits all".
  return (detail.applications || []).some(
    (a) =>
      keys.every(
        (k) => !normalize(query[k]) || normalize(a[k]) === normalize(query[k]),
      ) &&
      (!year || (year >= a.yearFrom && year <= a.yearTo)),
  );
}
module.exports = { normalize, matches };
