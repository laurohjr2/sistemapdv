import { useEffect, useState } from "react";
import api from "../lib/api";
import { Button } from "./ui/button";
export default function LoyaltyDiscount({
  customerId,
  subtotal,
  onApply,
  disabled,
}) {
  const [profile, setProfile] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setProfile(null);
    setError("");
    if (customerId)
      api
        .get("/loyalty/profiles/" + customerId)
        .then((r) => {
          if (alive) setProfile(r.data);
        })
        .catch(() => {
          if (alive)
            setError(
              "Não foi possível consultar a fidelidade. Selecione o cliente novamente.",
            );
        });
    return () => {
      alive = false;
    };
  }, [customerId]);
  async function apply() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/loyalty/quote", {
        customerId,
        subtotal,
        revision: profile.revision,
      });
      onApply({
        customerId,
        revision: profile.revision,
        discount: data.discount / 100,
        description: data.description,
      });
    } catch (e) {
      setError(
        e.response?.data?.error || "Não foi possível conferir o benefício",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="text-sm space-y-2">
      {profile && (
        <>
          <p>
            Fidelidade: {profile.label} · {profile.basisPoints / 100}%
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
              subtotal <= 0
            }
            onClick={apply}
          >
            Aplicar desconto de fidelidade
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-red-800 dark:text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
