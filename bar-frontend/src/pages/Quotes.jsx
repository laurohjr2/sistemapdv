import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useBusiness } from "../hooks/useBusiness";
import { receiptHeader, escapeHtml } from "../lib/receipt";
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
import PixPayment from "../components/PixPayment";
import {
  Feedback,
  Status,
  Metric,
  LineEditor,
} from "../components/commerce/shared";
import {
  useRecords,
  linesTotal,
  money,
  localDate,
  downloadPdf,
} from "../components/commerce/helpers";
const blank = () => ({
  customerId: "",
  customerName: "",
  validUntil: localDate(15),
  discount: "",
  notes: "",
  lines: [],
});
export default function Quotes() {
  const state = useRecords("/commerce/quotes"),
    { user } = useAuth(),
    { business } = useBusiness();
  const manager = ["admin", "gerente"].includes(user?.role);
  const [products, setProducts] = useState([]),
    [form, setForm] = useState(null),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(null),
    [action, setAction] = useState(null),
    [approvalNote, setApprovalNote] = useState(""),
    [method, setMethod] = useState("dinheiro"),
    [cash, setCash] = useState(null);
  const { setError } = state;
  useEffect(() => {
    api
      .get("/products")
      .then((r) => setProducts(r.data))
      .catch(() => setError("Não foi possível carregar os produtos."));
  }, [setError]);
  const rows = state.data.filter((q) =>
    (q.customerName + " " + q.number)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  async function save(e) {
    e.preventDefault();
    const ok = await state.run(() =>
      form.id
        ? api.put("/commerce/quotes/" + form.id, form)
        : api.post("/commerce/quotes", form),
    );
    if (ok) setForm(null);
  }
  async function status(q, value) {
    await state.run(() =>
      api.post(`/commerce/quotes/${q.id}/status`, { status: value }),
    );
  }
  async function approve(e) {
    e.preventDefault();
    const ok = await state.run(() =>
      api.post(`/commerce/quotes/${action.quote.id}/status`, {
        status: "approved",
        approvalNote,
      }),
    );
    if (ok) setAction(null);
  }
  async function openConvert(q) {
    setMethod("dinheiro");
    setCash(null);
    setAction({ kind: "convert", quote: q });
    try {
      setCash((await api.get("/cash-register/status")).data);
    } catch {
      state.setError("Não foi possível consultar o caixa.");
    }
  }
  async function convert(e) {
    e.preventDefault();
    const ok = await state.run(async () => {
      const { data } = await api.post(
        `/commerce/quotes/${action.quote.id}/convert`,
        { payment_method: method, cash_register_id: cash.id },
      );
      const quote = action.quote;
      const popup = window.open("", "_blank");
      if (popup) {
        popup.document.write(
          `<html><head><title>Venda ${data.id}</title></head><body>${receiptHeader(business)}<h2>Venda #${data.id} — orçamento #${quote.number}</h2><p>Cliente: ${escapeHtml(quote.customerName)}</p>${quote.lines.map((l) => `<p>${escapeHtml(l.name)} × ${Number(l.quantity)}: ${money(l.total)}</p>`).join("")}<p>Desconto: ${money(data.discount_amount)}</p><strong>Total pago: ${money(data.total_amount)}</strong><p>Pagamento: ${escapeHtml(method)}</p></body></html>`,
        );
        popup.document.close();
        popup.onload = () => popup.print();
      }
    });
    if (ok) setAction(null);
  }
  return (
    <div className="space-y-6">
      <div className="commerce-header">
        <div>
          <p className="commerce-eyebrow">Comercial</p>
          <h1 className="text-3xl font-bold">Orçamentos</h1>
          <p className="text-muted-foreground">
            Da proposta aprovada à venda, com os itens e preços preservados.
          </p>
        </div>
        <Button
          disabled={state.busy || (user?.support && !user?.master)}
          onClick={() => setForm(blank())}
        >
          Novo orçamento
        </Button>
      </div>
      <Feedback state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Aguardando aprovação"
          value={state.data.filter((q) => q.status === "sent").length}
        />
        <Metric
          label="Aprovados para vender"
          value={state.data.filter((q) => q.status === "approved").length}
        />
        <Metric
          label="Valor das propostas aprovadas"
          value={money(
            state.data
              .filter((q) => q.status === "approved")
              .reduce((n, q) => n + Number(q.total), 0),
          )}
        />
      </div>
      <Input
        aria-label="Buscar orçamentos"
        placeholder="Buscar por número ou cliente"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="commerce-panel overflow-x-auto">
        <table className="commerce-table">
          <thead>
            <tr>
              <th>Número / cliente</th>
              <th>Validade</th>
              <th>Situação</th>
              <th>Total</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id}>
                <td>
                  <strong>#{q.number}</strong>
                  <p>{q.customerName}</p>
                  {q.saleId && <small>Venda #{q.saleId}</small>}
                </td>
                <td>{q.validUntil.split("-").reverse().join("/")}</td>
                <td>
                  <Status value={q.status} />
                </td>
                <td className="whitespace-nowrap tabular-nums">
                  {money(q.total)}
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setSelected(q)}>
                      Ver
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        state.run(() =>
                          downloadPdf(
                            `/commerce/quotes/${q.id}/pdf`,
                            `orcamento-${q.number}.pdf`,
                          ),
                        )
                      }
                    >
                      PDF
                    </Button>
                    {!user?.support || user.master ? (
                      <>
                        {q.status === "draft" &&
                          (manager || q.createdBy === user?.id) && (
                            <>
                              <Button
                                variant="outline"
                                onClick={() =>
                                  setForm({
                                    ...q,
                                    discount: String(q.discount),
                                  })
                                }
                              >
                                Editar
                              </Button>
                              <Button
                                onClick={() => status(q, "sent")}
                                disabled={state.busy}
                              >
                                Marcar como enviado
                              </Button>
                            </>
                          )}
                        {q.status === "sent" && manager && (
                          <Button
                            onClick={() => {
                              setApprovalNote("");
                              setAction({ kind: "approve", quote: q });
                            }}
                          >
                            Registrar aceite
                          </Button>
                        )}
                        {q.status === "sent" &&
                          (manager || q.createdBy === user?.id) && (
                            <Button
                              variant="outline"
                              onClick={() => status(q, "rejected")}
                              disabled={state.busy}
                            >
                              Recusado
                            </Button>
                          )}
                        {q.status === "approved" && (
                          <Button onClick={() => openConvert(q)}>
                            Converter em venda
                          </Button>
                        )}
                        {["draft", "sent", "approved"].includes(q.status) &&
                          (manager || q.createdBy === user?.id) && (
                            <Button
                              variant="ghost"
                              onClick={() => status(q, "cancelled")}
                              disabled={state.busy}
                            >
                              Cancelar
                            </Button>
                          )}
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!state.loading && !rows.length && (
          <p className="commerce-empty">
            Nenhum orçamento encontrado. Crie a primeira proposta para começar.
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
            <DialogTitle>
              {form?.id ? "Editar orçamento" : "Novo orçamento"}
            </DialogTitle>
            <DialogDescription>
              Salvar cria um rascunho. A venda só ocorre após aprovação e
              conversão.
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
                <CustomerSelect
                  value={form.customerId}
                  onChange={(id, c) =>
                    setForm({
                      ...form,
                      customerId: id,
                      customerName: c?.name || form.customerName,
                    })
                  }
                />
                <div className="grid sm:grid-cols-2 gap-4">
                  <label>
                    Nome do cliente
                    <Input
                      required
                      maxLength={150}
                      readOnly={Boolean(form.customerId)}
                      value={form.customerName}
                      onChange={(e) =>
                        setForm({ ...form, customerName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Validade
                    <Input
                      required
                      type="date"
                      value={form.validUntil}
                      onChange={(e) =>
                        setForm({ ...form, validUntil: e.target.value })
                      }
                    />
                  </label>
                </div>
                <LineEditor
                  products={products}
                  rows={form.lines}
                  canPriceEdit={manager}
                  onChange={(lines) => setForm({ ...form, lines })}
                />
                {manager && (
                  <label className="block">
                    Desconto (R$)
                    <Input
                      currency
                      value={form.discount}
                      onChange={(e) =>
                        setForm({ ...form, discount: e.target.value })
                      }
                    />
                  </label>
                )}
                <label className="block">
                  Observações
                  <Input
                    maxLength={2000}
                    value={form.notes || ""}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </label>
                <div className="flex justify-between items-center">
                  <strong>
                    Total previsto:{" "}
                    {money(linesTotal(form.lines) - Number(form.discount || 0))}
                  </strong>
                  <Button disabled={!form.lines.length || state.busy}>
                    Salvar orçamento
                  </Button>
                </div>
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
            <DialogTitle>Orçamento #{selected?.number}</DialogTitle>
            <DialogDescription>{selected?.customerName}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <Status value={selected.status} />
              {selected.lines.map((l) => (
                <div
                  key={l.productId}
                  className="flex justify-between border-b py-2"
                >
                  <span>
                    {l.name} × {l.quantity}
                  </span>
                  <strong>{money(l.total)}</strong>
                </div>
              ))}
              <p>Desconto: {money(selected.discount)}</p>
              <strong>Total: {money(selected.total)}</strong>
              <p>{selected.notes}</p>
              {selected.approvalNote && (
                <p>Aceite registrado: {selected.approvalNote}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(action)}
        onOpenChange={(open) => {
          if (!open && !state.busy) setAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action?.kind === "approve"
                ? "Registrar aceite do cliente"
                : "Converter em venda"}
            </DialogTitle>
            <DialogDescription>
              Orçamento #{action?.quote.number} · {action?.quote.customerName}
            </DialogDescription>
          </DialogHeader>
          {state.error && (
            <p role="alert" className="text-red-700">
              {state.error}
            </p>
          )}
          {action?.kind === "approve" ? (
            <form onSubmit={approve} className="space-y-4">
              <label>
                Como o cliente aprovou?
                <Input
                  required
                  maxLength={2000}
                  placeholder="Ex.: aprovado presencialmente pelo cliente"
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                />
              </label>
              <Button disabled={state.busy}>Confirmar aprovação</Button>
            </form>
          ) : (
            <form onSubmit={convert} className="space-y-4">
              <p className="text-xl font-semibold">
                Total a receber: {money(action?.quote.total)}
              </p>
              {!cash?.is_open ? (
                <p role="status">
                  Abra um caixa em{" "}
                  <Link to="/sales" className="underline">
                    Vendas
                  </Link>{" "}
                  para receber este orçamento.
                </p>
              ) : (
                <>
                  <label>
                    Pagamento
                    <select
                      className="commerce-select"
                      aria-label="Pagamento"
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    >
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">Pix</option>
                      <option value="cartao_credito">Cartão de crédito</option>
                      <option value="cartao_debito">Cartão de débito</option>
                    </select>
                  </label>
                  {method === "pix" && <PixPayment />}
                  <p className="text-sm text-muted-foreground">
                    A confirmação registra o pagamento e a venda, movimenta o
                    estoque dos produtos e encerra o orçamento.
                  </p>
                  <Button disabled={state.busy}>Receber e converter</Button>
                </>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
