import { useEffect, useState } from "react";
import api from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export default function SupportAccessCodes({ token, companies }) {
  const [operators, setOperators] = useState([]),
    [grants, setGrants] = useState([]),
    [company, setCompany] = useState(""),
    [operator, setOperator] = useState(""),
    [minutes, setMinutes] = useState("15"),
    [reason, setReason] = useState(""),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revoke, setRevoke] = useState(null),
    [revokeReason, setRevokeReason] = useState("");
  const config = { headers: { Authorization: "Bearer " + token } };
  async function load() {
    const [a, b] = await Promise.all([
      api.get("/support/access-codes/operators", config),
      api.get("/support/access-codes", config),
    ]);
    setOperators(a.data);
    setGrants(b.data);
  }
  useEffect(() => {
    let alive = true;
    const config = { headers: { Authorization: "Bearer " + token } };
    Promise.all([
      api.get("/support/access-codes/operators", config),
      api.get("/support/access-codes", config),
    ])
      .then(([a, b]) => {
        if (alive) {
          setOperators(a.data);
          setGrants(b.data);
        }
      })
      .catch(() => {
        if (alive) setError("Não foi possível carregar os acessos temporários");
      });
    return () => {
      alive = false;
    };
  }, [token]);
  async function issue(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { data } = await api.post(
        "/support/access-codes",
        { company, supportUserId: operator, minutes: Number(minutes), reason },
        config,
      );
      setResult(data);
      setReason("");
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Não foi possível gerar o acesso");
    } finally {
      setBusy(false);
    }
  }
  async function cancel(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post(
        "/support/access-codes/" + revoke.id + "/revoke",
        { reason: revokeReason },
        config,
      );
      setRevoke(null);
      setRevokeReason("");
      if (result?.id === revoke.id) setResult(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Não foi possível revogar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="border rounded-xl p-4 space-y-4">
      <h2 className="text-xl font-semibold">
        Acessos temporários — exclusivo Master
      </h2>
      <p className="text-sm text-muted-foreground">
        Código de uso único para um operador de suporte e uma empresa. Dá acesso
        de consulta por até 15 minutos, limitado à validade do código.
      </p>
      {error && (
        <p role="alert" className="text-red-800 dark:text-red-200">
          {error}
        </p>
      )}
      <form onSubmit={issue}>
        <fieldset disabled={busy} className="space-y-3">
          <label className="block">
            Empresa autorizada
            <select
              required
              className="commerce-select"
              aria-label="Empresa autorizada"
              value={company}
              onChange={(e) => {
                setCompany(e.target.value);
                setResult(null);
              }}
            >
              <option value="">Selecione</option>
              {companies
                .filter((c) => c.status === "active")
                .map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name} · {c.slug}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            Operador de suporte
            <select
              required
              className="commerce-select"
              aria-label="Operador de suporte"
              value={operator}
              onChange={(e) => {
                setOperator(e.target.value);
                setResult(null);
              }}
            >
              <option value="">Selecione</option>
              {operators.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Validade para uso do código
            <select
              className="commerce-select"
              aria-label="Validade para uso do código"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            >
              {[5, 15, 30, 60].map((n) => (
                <option key={n} value={n}>
                  {n} minutos
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Motivo do acesso
            <Input
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <Button>Gerar código temporário</Button>
        </fieldset>
      </form>
      {result && (
        <div
          role="status"
          className="rounded-lg border border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100 p-3 space-y-2"
        >
          <strong>Código mostrado somente nesta emissão</strong>
          <code className="block break-all select-all text-lg">
            {result.code}
          </code>
          <p>
            Operador:{" "}
            {operators.find((u) => u.id === result.supportUserId)?.username} ·
            Expira em {new Date(result.expiresAt).toLocaleString("pt-BR")}
          </p>
          <p className="text-sm">
            Entregue apenas ao operador autorizado. Entre em Acesso do
            fornecedor → Entrar com código temporário. O código não pode ser
            recuperado depois.
          </p>
          <Button variant="outline" onClick={() => setResult(null)}>
            Ocultar código
          </Button>
        </div>
      )}
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">Últimos 100 acessos emitidos</h3>
        <Button
          disabled={busy}
          variant="outline"
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await load();
            } catch {
              setError("Falha ao atualizar os acessos");
            } finally {
              setBusy(false);
            }
          }}
        >
          Atualizar acessos temporários
        </Button>
      </div>
      {grants.map((g) => (
        <article className="border rounded p-3 space-y-1" key={g.id}>
          <strong>
            {companies.find((c) => c.id === g.tenantId)?.name || "Empresa"} ·{" "}
            {operators.find((u) => u.id === g.supportUserId)?.username ||
              "Operador"}
          </strong>
          <p>{g.reason}</p>
          <p className="text-sm">
            {g.revokedAt
              ? "Revogado"
              : new Date(g.expiresAt) <= new Date()
                ? "Expirado"
                : g.usedAt
                  ? "Usado · sessão de consulta iniciada"
                  : "Aguardando uso"}{" "}
            · Validade: {new Date(g.expiresAt).toLocaleString("pt-BR")}
          </p>
          {g.revokeReason && <p>Revogação: {g.revokeReason}</p>}
          {!g.revokedAt && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setRevoke(g);
                setRevokeReason("");
              }}
            >
              Revogar acesso temporário
            </Button>
          )}
        </article>
      ))}
      {revoke && (
        <form onSubmit={cancel} className="border rounded p-3 space-y-2">
          <strong>
            Revogar acesso de{" "}
            {operators.find((u) => u.id === revoke.supportUserId)?.username}
          </strong>
          <p className="text-sm">
            Encerra também a sessão de consulta iniciada por este código.
          </p>
          <label className="block">
            Motivo da revogação
            <Input
              required
              maxLength={1000}
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <Button disabled={busy}>Confirmar revogação</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevoke(null)}
            >
              Voltar
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
