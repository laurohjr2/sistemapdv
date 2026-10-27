import { useCallback, useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import {
  Feedback,
  Status,
  Metric,
  LineEditor,
} from "../components/commerce/shared";
import {
  useRecords,
  money,
  localDate,
  downloadPdf,
} from "../components/commerce/helpers";
import { Link } from "react-router-dom";
export default function Purchases() {
  const state = useRecords("/commerce/purchases"),
    { user } = useAuth();
  const readOnly = user?.support && !user.master;
  const [products, setProducts] = useState([]),
    [suppliers, setSuppliers] = useState([]),
    [form, setForm] = useState(null),
    [receipt, setReceipt] = useState(null),
    [selected, setSelected] = useState(null),
    [search, setSearch] = useState("");
  const { setError } = state;
  const loadOptions = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        api.get("/products"),
        api.get("/commerce/suppliers"),
      ]);
      setProducts(p.data);
      setSuppliers(s.data.filter((s) => s.active));
    } catch {
      setError("Não foi possível carregar os fornecedores e produtos.");
    }
  }, [setError]);
  useEffect(() => {
    loadOptions();
  }, [loadOptions]);
  async function save(e) {
    e.preventDefault();
    const ok = await state.run(() => api.post("/commerce/purchases", form));
    if (ok) setForm(null);
  }
  async function receive(e) {
    e.preventDefault();
    const lines = receipt.lines
      .filter((l) => Number(l.quantity) > 0)
      .map((l) => ({ lineId: l.lineId, quantity: Number(l.quantity) }));
    if (!lines.length) {
      setError("Informe pelo menos uma quantidade recebida.");
      return;
    }
    const ok = await state.run(() =>
      api.post(`/commerce/purchases/${receipt.order.id}/receive`, {
        requestKey: receipt.requestKey,
        dueDate: receipt.dueDate,
        lines,
      }),
    );
    if (ok) setReceipt(null);
  }
  async function details(order) {
    await state.run(async () =>
      setSelected((await api.get("/commerce/purchases/" + order.id)).data),
    );
  }
  return (
    <div className="space-y-6">
      <div className="commerce-header">
        <div>
          <p className="commerce-eyebrow">Compras</p>
          <h1 className="text-3xl font-bold">Pedidos de compra</h1>
          <p className="text-muted-foreground">
            Receba os produtos e registre estoque e contas a pagar na mesma
            operação.
          </p>
        </div>
        <Button
          disabled={readOnly}
          onClick={() => {
            loadOptions();
            setForm({
              supplierId: "",
              expectedDate: localDate(7),
              notes: "",
              lines: [],
            });
          }}
        >
          Novo pedido de compra
        </Button>
      </div>
      <Feedback state={state} />
      <div className="grid sm:grid-cols-3 gap-3">
        <Metric
          label="Aguardando recebimento"
          value={state.data.filter((o) => o.status === "ordered").length}
        />
        <Metric
          label="Recebidos parcialmente"
          value={state.data.filter((o) => o.status === "partial").length}
        />
        <Metric
          label="Pedidos concluídos"
          value={state.data.filter((o) => o.status === "received").length}
        />
      </div>
      <Input
        aria-label="Buscar compras"
        placeholder="Buscar número ou fornecedor"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="commerce-panel overflow-x-auto">
        <table className="commerce-table">
          <thead>
            <tr>
              <th>Pedido / fornecedor</th>
              <th>Previsão</th>
              <th>Situação</th>
              <th>Total pedido</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {state.data
              .filter((o) =>
                (o.number + " " + o.supplierName)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>#{o.number}</strong>
                    <p>{o.supplierName}</p>
                  </td>
                  <td>
                    {o.expectedDate?.split("-").reverse().join("/") ||
                      "Não informada"}
                  </td>
                  <td>
                    <Status value={o.status} />
                  </td>
                  <td className="tabular-nums whitespace-nowrap">
                    {money(o.total)}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => details(o)}>
                        Ver pedido
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          state.run(() =>
                            downloadPdf(
                              `/commerce/purchases/${o.id}/pdf`,
                              `compra-${o.number}.pdf`,
                            ),
                          )
                        }
                      >
                        PDF
                      </Button>
                      {!readOnly &&
                        ["ordered", "partial"].includes(o.status) && (
                          <Button
                            onClick={() =>
                              setReceipt({
                                order: o,
                                requestKey: crypto.randomUUID(),
                                dueDate: localDate(30),
                                lines: o.lines.map((l) => ({
                                  ...l,
                                  quantity: "",
                                  pending:
                                    (Math.round(l.quantity * 1000) -
                                      Math.round(l.receivedQuantity * 1000)) /
                                    1000,
                                })),
                              })
                            }
                          >
                            Registrar recebimento
                          </Button>
                        )}
                      {!readOnly && o.status === "ordered" && (
                        <Button
                          variant="ghost"
                          disabled={state.busy}
                          onClick={() =>
                            state.run(() =>
                              api.post(`/commerce/purchases/${o.id}/cancel`),
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
        {!state.loading && !state.data.length && (
          <p className="commerce-empty">
            Nenhum pedido cadastrado. O estoque só muda quando você registra um
            recebimento.
          </p>
        )}
      </div>
      <Dialog
        open={Boolean(form)}
        onOpenChange={(open) => {
          if (!open && !state.busy) setForm(null);
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo pedido de compra</DialogTitle>
            <DialogDescription>
              Os custos ficam registrados no pedido. Produtos recebidos geram
              contas a pagar.
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
                <div className="grid sm:grid-cols-2 gap-4">
                  <label>
                    Fornecedor
                    <select
                      className="commerce-select"
                      required
                      aria-label="Fornecedor"
                      value={form.supplierId}
                      onChange={(e) =>
                        setForm({ ...form, supplierId: e.target.value })
                      }
                    >
                      <option value="">Selecione o fornecedor</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Previsão de entrega
                    <Input
                      type="date"
                      value={form.expectedDate}
                      onChange={(e) =>
                        setForm({ ...form, expectedDate: e.target.value })
                      }
                    />
                  </label>
                </div>
                {!suppliers.length && (
                  <p>
                    Cadastre um fornecedor em{" "}
                    <Link className="underline" to="/suppliers">
                      Fornecedores
                    </Link>
                    .
                  </p>
                )}
                <LineEditor
                  purchase
                  products={products}
                  rows={form.lines}
                  onChange={(lines) => setForm({ ...form, lines })}
                />
                <label className="block">
                  Observações
                  <Input
                    maxLength={2000}
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </label>
                <Button disabled={state.busy || !form.lines.length}>
                  Salvar pedido
                </Button>
              </fieldset>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(receipt)}
        onOpenChange={(open) => {
          if (!open && !state.busy) setReceipt(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receber pedido #{receipt?.order.number}</DialogTitle>
            <DialogDescription>
              Informe somente as quantidades que chegaram nesta entrega.
            </DialogDescription>
          </DialogHeader>
          {state.error && (
            <p role="alert" className="text-red-700">
              {state.error}
            </p>
          )}
          {receipt && (
            <form onSubmit={receive}>
              <fieldset disabled={state.busy} className="space-y-4">
                {receipt.lines
                  .filter((l) => l.pending > 0)
                  .map((l) => (
                    <label key={l.lineId} className="block">
                      {l.name}
                      <span className="block text-xs text-muted-foreground">
                        Pendente: {l.pending} · Custo: {money(l.unitCost)}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max={l.pending}
                        step="0.001"
                        aria-label={"Receber " + l.name}
                        value={l.quantity}
                        onChange={(e) =>
                          setReceipt({
                            ...receipt,
                            requestKey: crypto.randomUUID(),
                            lines: receipt.lines.map((row) =>
                              row.lineId === l.lineId
                                ? { ...row, quantity: e.target.value }
                                : row,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                <label className="block">
                  Vencimento da conta a pagar
                  <Input
                    required
                    type="date"
                    value={receipt.dueDate}
                    onChange={(e) =>
                      setReceipt({
                        ...receipt,
                        dueDate: e.target.value,
                        requestKey: crypto.randomUUID(),
                      })
                    }
                  />
                </label>
                <p className="text-sm text-muted-foreground">
                  Uma conta a pagar será criada com o valor desta entrega. O
                  restante do pedido continua pendente.
                </p>
                <Button disabled={state.busy}>Confirmar recebimento</Button>
              </fieldset>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido #{selected?.number}</DialogTitle>
            <DialogDescription>{selected?.supplierName}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <Status value={selected.status} />
              {selected.lines.map((l) => (
                <div key={l.lineId} className="border-b py-2">
                  <strong>{l.name}</strong>
                  <p>
                    Pedido: {l.quantity} · Recebido: {l.receivedQuantity} ·
                    Custo unitário: {money(l.unitCost)}
                  </p>
                </div>
              ))}
              <strong>Total pedido: {money(selected.total)}</strong>
              <h3 className="font-semibold">Entregas registradas</h3>
              {selected.receipts?.length ? (
                selected.receipts.map((r) => (
                  <p key={r.id}>
                    {new Date(r.createdAt).toLocaleString("pt-BR")} ·{" "}
                    {money(r.total)}
                  </p>
                ))
              ) : (
                <p>Nenhuma entrega registrada.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
