import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useBusiness } from "../hooks/useBusiness";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import CustomerSelect from "../components/CustomerSelect";
import { Feedback, Status, Metric } from "../components/commerce/shared";
import {
  useRecords,
  money,
  localDate,
  downloadPdf,
} from "../components/commerce/helpers";
const methods = {
  pix: "Pix",
  transferencia: "Transferência",
  boleto: "Boleto",
  dinheiro: "Dinheiro do caixa",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
};
export default function Finance() {
  const [filters, setFilters] = useState({
      direction: "",
      status: "",
      from: "",
      to: "",
    }),
    [search, setSearch] = useState("");
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v),
  );
  const state = useRecords("/commerce/finance?" + params.toString()),
    { user } = useAuth(),
    { business } = useBusiness();
  const readOnly = user?.support && !user.master;
  const [suppliers, setSuppliers] = useState([]),
    [form, setForm] = useState(null),
    [payment, setPayment] = useState(null),
    [selected, setSelected] = useState(null);
  const rows = (
    Array.isArray(state.data.entries) ? state.data.entries : []
  ).filter((e) =>
    (e.description + " " + e.partyName)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const summary = state.data.summary || {};
  useEffect(() => {
    if (business.modules?.purchasing === false) return;
    api
      .get("/commerce/suppliers")
      .then((r) => setSuppliers(r.data.filter((s) => s.active)))
      .catch(() => {});
  }, [business.modules?.purchasing]);
  async function save(e) {
    e.preventDefault();
    const ok = await state.run(() => api.post("/commerce/finance", form));
    if (ok) setForm(null);
  }
  async function pay(e) {
    e.preventDefault();
    const ok = await state.run(() =>
      api.post(`/commerce/finance/${payment.entry.id}/payments`, {
        amount: Number(payment.amount),
        method: payment.method,
        paidOn: payment.paidOn,
        requestKey: payment.requestKey,
      }),
    );
    if (ok) setPayment(null);
  }
  function changePayment(values) {
    setPayment({ ...payment, ...values, requestKey: crypto.randomUUID() });
  }
  return (
    <div className="space-y-6">
      <div className="commerce-header">
        <div>
          <p className="commerce-eyebrow">Financeiro</p>
          <h1 className="text-3xl font-bold">Contas a pagar e receber</h1>
          <p className="text-muted-foreground">
            Vencimentos, pagamentos parciais e saldo de cada compromisso.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              state.run(() =>
                downloadPdf(
                  "/commerce/finance/export.pdf?" + params.toString(),
                  "contas-a-pagar-e-receber.pdf",
                ),
              )
            }
          >
            Exportar financeiro
          </Button>
          <Button
            disabled={readOnly}
            onClick={() =>
              setForm({
                direction: "payable",
                description: "",
                partyName: "",
                supplierId: "",
                customerId: "",
                amount: "",
                dueDate: localDate(30),
              })
            }
          >
            Nova conta
          </Button>
        </div>
      </div>
      <Feedback state={state} />
      <div className="grid sm:grid-cols-3 gap-3">
        <Metric
          label="Saldo a receber"
          value={money(summary.receivable)}
          help="Nas contas do período e situação selecionados"
        />
        <Metric
          label="Saldo a pagar"
          value={money(summary.payable)}
          help="Nas contas do período e situação selecionados"
        />
        <Metric
          label="Contas vencidas"
          value={summary.overdue || 0}
          help="Com saldo pendente"
        />
      </div>
      <div className="commerce-panel p-4 grid gap-3 sm:grid-cols-4">
        <label>
          Tipo
          <select
            className="commerce-select"
            value={filters.direction}
            onChange={(e) =>
              setFilters({ ...filters, direction: e.target.value })
            }
          >
            <option value="">Pagar e receber</option>
            <option value="payable">A pagar</option>
            <option value="receivable">A receber</option>
          </select>
        </label>
        <label>
          Situação
          <select
            className="commerce-select"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Todas</option>
            <option value="open">Em aberto</option>
            <option value="partial">Parciais</option>
            <option value="overdue">Vencidas</option>
            <option value="paid">Quitadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </label>
        <label>
          Vencimento de
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </label>
        <label>
          Vencimento até
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </label>
      </div>
      <Input
        aria-label="Buscar contas"
        placeholder="Buscar descrição ou cliente / fornecedor"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="commerce-panel overflow-x-auto">
        <table className="commerce-table">
          <thead>
            <tr>
              <th>Conta</th>
              <th>Cliente / fornecedor</th>
              <th>Vencimento</th>
              <th>Situação</th>
              <th>Total</th>
              <th>Saldo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>
                  <span className="text-xs text-muted-foreground">
                    {e.direction === "payable" ? "A PAGAR" : "A RECEBER"}
                  </span>
                  <p className="font-medium">{e.description}</p>
                  {e.sourceKey && (
                    <small>Gerada por recebimento de compra</small>
                  )}
                </td>
                <td>{e.partyName}</td>
                <td className="whitespace-nowrap">
                  {e.dueDate.split("-").reverse().join("/")}
                </td>
                <td>
                  <Status value={e.status} overdue={e.overdue} />
                </td>
                <td className="whitespace-nowrap tabular-nums">
                  {money(e.amount)}
                </td>
                <td className="whitespace-nowrap tabular-nums font-medium">
                  {money(e.balance)}
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setSelected(e)}>
                      Histórico
                    </Button>
                    {!readOnly && !e.cancelled && e.balance > 0 && (
                      <Button
                        onClick={() =>
                          setPayment({
                            entry: e,
                            amount: String(e.balance),
                            method: "pix",
                            paidOn: localDate(),
                            requestKey: crypto.randomUUID(),
                          })
                        }
                      >
                        {e.direction === "payable" ? "Pagar" : "Receber"}
                      </Button>
                    )}
                    {!readOnly && !e.sourceKey && !e.cancelled && !e.paid && (
                      <Button
                        variant="ghost"
                        disabled={state.busy}
                        onClick={() =>
                          state.run(() =>
                            api.post(`/commerce/finance/${e.id}/cancel`),
                          )
                        }
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!state.loading && !rows.length && (
          <p className="commerce-empty">
            Nenhuma conta neste filtro. Compras recebidas geram contas a pagar
            automaticamente.
          </p>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Cadastre aqui compromissos avulsos. Vendas à vista já recebidas no PDV
        não devem ser lançadas novamente como contas a receber.
      </p>
      <Dialog
        open={Boolean(form)}
        onOpenChange={(open) => {
          if (!open && !state.busy) setForm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conta</DialogTitle>
            <DialogDescription>
              Registre um compromisso avulso ou uma parcela com seu vencimento.
            </DialogDescription>
          </DialogHeader>
          {state.error && (
            <p role="alert" className="text-red-700">
              {state.error}
            </p>
          )}
          {form && (
            <form onSubmit={save}>
              <fieldset disabled={state.busy} className="space-y-4">
                <label className="block">
                  Tipo de conta
                  <select
                    className="commerce-select"
                    aria-label="Tipo de conta"
                    value={form.direction}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        direction: e.target.value,
                        customerId: "",
                        supplierId: "",
                        partyName: "",
                      })
                    }
                  >
                    <option value="payable">A pagar</option>
                    <option value="receivable">A receber</option>
                  </select>
                </label>
                <label className="block">
                  Descrição
                  <Input
                    required
                    maxLength={200}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </label>
                {form.direction === "receivable" ? (
                  <CustomerSelect
                    value={form.customerId}
                    onChange={(id, c) =>
                      setForm({
                        ...form,
                        customerId: id,
                        partyName: c?.name || "",
                      })
                    }
                  />
                ) : (
                  <label className="block">
                    Fornecedor cadastrado
                    <select
                      className="commerce-select"
                      value={form.supplierId}
                      onChange={(e) => {
                        const supplier = suppliers.find(
                          (s) => s.id === e.target.value,
                        );
                        setForm({
                          ...form,
                          supplierId: e.target.value,
                          partyName: supplier?.name || "",
                        });
                      }}
                    >
                      <option value="">Sem vínculo</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block">
                  Nome do cliente / fornecedor
                  <Input
                    required
                    maxLength={150}
                    readOnly={Boolean(form.supplierId || form.customerId)}
                    value={form.partyName}
                    onChange={(e) =>
                      setForm({ ...form, partyName: e.target.value })
                    }
                  />
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label>
                    Valor (R$)
                    <Input
                      required
                      currency
                      value={form.amount}
                      onChange={(e) =>
                        setForm({ ...form, amount: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Vencimento
                    <Input
                      required
                      type="date"
                      value={form.dueDate}
                      onChange={(e) =>
                        setForm({ ...form, dueDate: e.target.value })
                      }
                    />
                  </label>
                </div>
                <Button disabled={state.busy}>Salvar conta</Button>
              </fieldset>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(payment)}
        onOpenChange={(open) => {
          if (!open && !state.busy) setPayment(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {payment?.entry.direction === "payable"
                ? "Registrar pagamento"
                : "Registrar recebimento"}
            </DialogTitle>
            <DialogDescription>
              {payment?.entry.description} · Saldo{" "}
              {money(payment?.entry.balance)}
            </DialogDescription>
          </DialogHeader>
          {state.error && (
            <p role="alert" className="text-red-700">
              {state.error}
            </p>
          )}
          {payment && (
            <form onSubmit={pay}>
              <fieldset disabled={state.busy} className="space-y-4">
                <label className="block">
                  Valor a registrar
                  <Input
                    currency
                    required
                    value={payment.amount}
                    onChange={(e) => changePayment({ amount: e.target.value })}
                  />
                </label>
                <label className="block">
                  Data do pagamento
                  <Input
                    required
                    type="date"
                    max={localDate()}
                    value={payment.paidOn}
                    onChange={(e) => changePayment({ paidOn: e.target.value })}
                  />
                </label>
                <label className="block">
                  Forma de pagamento
                  <select
                    className="commerce-select"
                    aria-label="Forma de pagamento"
                    value={payment.method}
                    onChange={(e) => changePayment({ method: e.target.value })}
                  >
                    {Object.entries(methods).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-sm text-muted-foreground">
                  {payment.method === "dinheiro"
                    ? "O caixa precisa estar aberto. Este valor entrará na conferência física do caixa."
                    : "Confira o pagamento antes de registrar. A confirmação bancária não é automática."}
                </p>
                <Button disabled={state.busy}>Confirmar registro</Button>
              </fieldset>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico financeiro</DialogTitle>
            <DialogDescription>
              {selected?.description} · {selected?.partyName}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <p>
                Total: {money(selected.amount)} · Saldo:{" "}
                {money(selected.balance)}
              </p>
              {selected.payments.length ? (
                selected.payments.map((p) => (
                  <div key={p.id} className="border-b py-2">
                    <strong>{money(p.amount)}</strong>
                    <p>
                      {p.paidOn.split("-").reverse().join("/")} ·{" "}
                      {methods[p.method]}
                    </p>
                  </div>
                ))
              ) : (
                <p>Nenhum pagamento registrado.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
