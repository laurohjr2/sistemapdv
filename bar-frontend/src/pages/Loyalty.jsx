import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useRecords, money, downloadPdf } from "../components/commerce/helpers";
import { Feedback } from "../components/commerce/shared";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
export default function Loyalty() {
  const profiles = useRecords("/loyalty/profiles"),
    customers = useRecords("/customers"),
    history = useRecords("/loyalty/history"),
    { user } = useAuth(),
    writable = !user?.support || user?.master;
  const [choice, setChoice] = useState(""),
    [form, setForm] = useState(null),
    [reason, setReason] = useState("");
  function choose(id) {
    setChoice(id);
    setReason("");
    const p = profiles.data?.find((p) => p.customerId === id);
    setForm(
      id
        ? {
            label: p?.label || "Cliente fidelidade",
            percent: String((p?.basisPoints || 0) / 100),
            active: p?.active ?? true,
            validUntil: p?.validUntil || "",
            revision: p?.revision || 0,
          }
        : null,
    );
  }
  async function save(e) {
    e.preventDefault();
    if (
      await profiles.run(() =>
        api.put("/loyalty/profiles/" + choice, { ...form, reason }),
      )
    ) {
      setForm(null);
      setChoice("");
      setReason("");
    }
  }
  const visible = (history.data || []).filter(
      (b) => !choice || b.customerId === choice,
    ),
    total =
      visible
        .filter((b) => b.sale?.status === "completed")
        .reduce((sum, b) => sum + Math.round(Number(b.discount) * 100), 0) /
      100;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <h1 className="text-3xl font-bold">Fidelidade de clientes</h1>
        <Button
          variant="outline"
          onClick={async () => {
            await profiles.load();
            await history.load();
            setForm(null);
            setChoice("");
          }}
        >
          Atualizar fidelidade
        </Button>
      </div>
      <Link className="underline" to="/customers">
        Cadastro de clientes
      </Link>
      <p className="text-muted-foreground">
        Percentual por cliente nas vendas diretas. Gerente ou administrador
        confere e aplica no carrinho. Não acumula com outro desconto.
      </p>
      <Feedback state={profiles} />
      <Feedback state={customers} />
      <Feedback state={history} />
      <label className="block max-w-xl">
        Cliente
        <select
          className="commerce-select"
          aria-label="Cliente"
          value={choice}
          onChange={(e) => choose(e.target.value)}
        >
          <option value="">Todos / selecione para configurar</option>
          {customers.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.active ? "" : " (inativo)"}
            </option>
          ))}
        </select>
      </label>
      {form && (
        <form onSubmit={save} className="border rounded-xl bg-card p-4">
          <fieldset disabled={!writable || profiles.busy} className="space-y-3">
            <h2 className="font-semibold">Condição do cliente selecionado</h2>
            <label className="block">
              Nome do benefício
              <Input
                required
                maxLength={80}
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </label>
            <label className="block">
              Desconto percentual (0 a 50%)
              <Input
                required
                type="number"
                min="0"
                max="50"
                step="0.01"
                value={form.percent}
                onChange={(e) => setForm({ ...form, percent: e.target.value })}
              />
            </label>
            <label className="block">
              Válido até (opcional)
              <Input
                type="date"
                value={form.validUntil}
                onChange={(e) =>
                  setForm({ ...form, validUntil: e.target.value })
                }
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Benefício ativo
            </label>
            <label className="block">
              Motivo da concessão ou alteração
              <Input
                required
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <Button>Salvar benefício</Button>
          </fieldset>
        </form>
      )}
      <div className="space-y-2">
        {profiles.data
          ?.filter((p) => !choice || p.customerId === choice)
          .map((p) => (
            <article key={p.customerId} className="border rounded p-3">
              <strong>
                {customers.data?.find((c) => c.id === p.customerId)?.name ||
                  "Cliente"}{" "}
                · {p.label} · {p.basisPoints / 100}%
              </strong>
              <p>
                {p.active ? "Ativo" : "Inativo"} · Validade:{" "}
                {p.validUntil || "Sem data final"}
              </p>
              <details>
                <summary>Histórico das condições</summary>
                {p.events.map((e, i) => (
                  <p key={i} className="text-sm">
                    {new Date(e.at).toLocaleString("pt-BR")} · {e.username} ·{" "}
                    {e.basisPoints / 100}% · {e.active ? "Ativo" : "Inativo"} ·{" "}
                    {e.reason}
                  </p>
                ))}
              </details>
            </article>
          ))}
      </div>
      <section className="space-y-3">
        <div className="flex flex-wrap gap-3 justify-between">
          <h2 className="text-xl font-semibold">Benefícios aplicados</h2>
          <Button
            variant="outline"
            onClick={() =>
              history.run(() =>
                downloadPdf(
                  "/loyalty/history.pdf" +
                    (choice ? "?customerId=" + choice : ""),
                  "fidelidade.pdf",
                ),
              )
            }
          >
            Imprimir histórico de fidelidade
          </Button>
        </div>
        <p>
          Descontos em vendas concluídas nesta seleção:{" "}
          <strong>{money(total)}</strong>
        </p>
        <p className="text-xs text-muted-foreground">
          Até 500 registros recentes. Vendas canceladas são preservadas e
          excluídas do total efetivo.
        </p>
        <div className="overflow-auto">
          <table className="commerce-table">
            <thead>
              <tr>
                <th>Venda</th>
                <th>Cliente</th>
                <th>Benefício no ato</th>
                <th>Desconto</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((b) => (
                <tr key={b.id}>
                  <td>#{b.saleId}</td>
                  <td>
                    {customers.data?.find((c) => c.id === b.customerId)?.name ||
                      "Cliente"}
                  </td>
                  <td>
                    {b.profile.label} · {b.profile.basisPoints / 100}%
                  </td>
                  <td>{money(b.discount)}</td>
                  <td>
                    {b.sale?.status === "completed" ? "Concluída" : "Cancelada"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && <p>Nenhum benefício aplicado nesta seleção.</p>}
      </section>
    </div>
  );
}
