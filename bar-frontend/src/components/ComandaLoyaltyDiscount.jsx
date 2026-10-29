import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { canAccess } from "../lib/access";
import api from "../lib/api";
import { Button } from "./ui/button";
export default function ComandaLoyaltyDiscount({
  comanda,
  customerId,
  onApply,
  onRefresh,
  disabled,
}) {
  const { user } = useAuth(),
    allowed =
      ["admin", "gerente"].includes(user?.role) &&
      (!user?.support || user?.master) &&
      canAccess(user, "loyalty.tables");
  const [profile, setProfile] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    setProfile(null);
    setError("");
    if (allowed && comanda?.customerId)
      api
        .get("/loyalty/profiles/" + comanda.customerId)
        .then((r) => {
          if (alive) setProfile(r.data);
        })
        .catch(() => {
          if (alive) setError("Não foi possível consultar a fidelidade");
        });
    return () => {
      alive = false;
    };
  }, [allowed, comanda?.customerId, version]);
  if (!allowed) return null;
  async function apply() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(
        "/loyalty/comandas/" + comanda.id + "/quote",
        { revision: profile.revision },
      );
      if (
        data.customerId !== customerId ||
        Math.round(Number(comanda.totalValue) * 100) !== data.subtotal ||
        new Date(comanda.updated_at).toISOString() !== data.comandaUpdatedAt
      )
        throw Error("A comanda mudou. Atualize antes de aplicar o benefício.");
      onApply({ ...data, discount: data.discount / 100 });
    } catch (e) {
      setError(
        e.response?.data?.error ||
          e.message ||
          "Não foi possível conferir o benefício",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="border rounded-lg p-3 space-y-2 text-sm">
      <strong>Fidelidade do cliente</strong>
      {!comanda?.customerId || customerId !== comanda.customerId ? (
        <p>
          Vincule e salve um cliente cadastrado na comanda antes de aplicar
          fidelidade.
        </p>
      ) : profile ? (
        <>
          <p>
            {profile.label} ·{" "}
            {(profile.basisPoints / 100).toLocaleString("pt-BR")}%
            {profile.active ? "" : " · Inativo"}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={
              disabled ||
              busy ||
              !profile.active ||
              profile.basisPoints <= 0 ||
              Number(comanda.totalValue) <= 0
            }
            onClick={apply}
          >
            Aplicar fidelidade na comanda
          </Button>
        </>
      ) : (
        <p>Nenhum benefício de fidelidade cadastrado para este cliente.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="link"
          disabled={busy || disabled}
          onClick={() => setVersion((v) => v + 1)}
        >
          Atualizar benefício
        </Button>
        {onRefresh && (
          <Button
            type="button"
            variant="link"
            disabled={busy || disabled}
            onClick={onRefresh}
          >
            Atualizar comanda
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-red-800 dark:text-red-200">
          {error}
        </p>
      )}
    </section>
  );
}
