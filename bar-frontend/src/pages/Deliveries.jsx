import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Feedback } from "../components/commerce/shared";
import { useRecords, money, downloadPdf } from "../components/commerce/helpers";
const labels = {
  received: "Recebido",
  preparing: "Em separação / preparo",
  ready: "Pronto para saída",
  dispatched: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Entrega cancelada",
};
const next = {
  received: ["preparing", "Iniciar separação / preparo"],
  preparing: ["ready", "Marcar pronto"],
  ready: ["dispatched", "Registrar saída"],
  dispatched: ["delivered", "Confirmar entrega"],
};
const blank = () => ({
  saleId: "",
  customerName: "",
  phone: "",
  address: {
    street: "",
    number: "",
    district: "",
    city: "",
    state: "",
    postalCode: "",
    complement: "",
    reference: "",
  },
  notes: "",
});
export default function Deliveries() {
  const [params] = useSearchParams(),
    requested = params.get("sale"),
    state = useRecords("/deliveries"),
    { user } = useAuth(),
    writable = !user?.support || user?.master,
    manager = ["admin", "gerente"].includes(user?.role);
  const [draft, setDraft] = useState(blank),
    [sale, setSale] = useState(null),
    [open, setOpen] = useState(Boolean(requested)),
    [editId, setEditId] = useState(null),
    [selected, setSelected] = useState(null),
    [courier, setCourier] = useState(""),
    [reason, setReason] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("");
  const { setError } = state;
  useEffect(() => {
    if (requested) setDraft((d) => ({ ...d, saleId: requested }));
  }, [requested]);
  const current = state.data.find((o) => o.id === selected),
    rows = state.data.filter(
      (o) =>
        (!filter || o.status === filter) &&
        [o.customerName, o.phone, String(o.saleId), o.courierName].some((v) =>
          v.toLowerCase().includes(search.toLowerCase()),
        ),
    );
  async function verify() {
    setError("");
    setSale(null);
    try {
      const r = await api.get("/sales/" + Number(draft.saleId));
      if (r.data.status !== "completed") throw new Error("Venda cancelada");
      setSale(r.data);
      if (r.data.customerId) {
        const customers = (await api.get("/customers")).data;
        const customer = customers.find((c) => c.id === r.data.customerId);
        if (customer)
          setDraft((d) => ({
            ...d,
            customerName: customer.name,
            phone: customer.phone || "",
          }));
      }
    } catch (e) {
      setError(
        e.response?.data?.error ||
          "Não foi possível conferir uma venda concluída.",
      );
    }
  }
  async function save(e) {
    e.preventDefault();
    const ok = await state.run(async () => {
      if (editId) await api.put("/deliveries/" + editId, draft);
      else await api.post("/deliveries", draft);
    });
    if (ok) {
      setOpen(false);
      setDraft(blank());
      setSale(null);
      setEditId(null);
    }
  }
  async function advance(status) {
    const ok = await state.run(() =>
      api.post("/deliveries/" + current.id + "/status", {
        status,
        revision: current.revision,
        courierName: courier,
        reason,
      }),
    );
    if (ok) {
      setCourier("");
      setReason("");
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Pedidos de entrega</h1>
          <p className="text-muted-foreground">
            Acompanhe entregas vinculadas a vendas com pagamento já registrado.
          </p>
        </div>
        {writable && (
          <Button
            onClick={() => {
              setDraft(blank());
              setSale(null);
              setEditId(null);
              setOpen(true);
            }}
          >
            Novo pedido de entrega
          </Button>
        )}
      </div>
      <Feedback state={state} />
      <div className="commerce-panel p-4 flex flex-wrap gap-3">
        <Input
          className="sm:max-w-md"
          aria-label="Buscar entregas"
          placeholder="Cliente, telefone, venda ou entregador"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label>
          Situação
          <select
            className="commerce-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Todas</option>
            {Object.entries(labels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" onClick={state.load}>
          Atualizar entregas
        </Button>
      </div>
      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map((o) => (
          <article className="commerce-panel p-4 space-y-2" key={o.id}>
            <div className="flex justify-between gap-2">
              <strong>Venda #{o.saleId}</strong>
              <span className="text-sm">{labels[o.status]}</span>
            </div>
            <h2 className="font-semibold">{o.customerName}</h2>
            <p>
              {o.address.district} · {o.address.city}/{o.address.state}
            </p>
            <p className="text-sm">
              {new Date(o.createdAt).toLocaleString("pt-BR")} ·{" "}
              {money(o.paidTotal)} ·{" "}
              {o.sale?.status === "cancelled"
                ? "venda cancelada"
                : "pagamento registrado"}
            </p>
            {o.courierName && <p>Responsável pela entrega: {o.courierName}</p>}
            <Button
              variant="outline"
              onClick={() => {
                setSelected(o.id);
                setCourier(o.courierName);
                setReason("");
              }}
            >
              Ver pedido #{o.saleId}
            </Button>
          </article>
        ))}
      </div>
      {!state.loading && !rows.length && <p>Nenhuma entrega nesta seleção.</p>}
      <p className="text-xs text-muted-foreground">
        Exibindo os 200 pedidos mais recentes. Entregas não efetuam uma nova
        baixa de estoque ou cobrança. Se houver taxa, inclua o serviço de
        entrega na venda antes de finalizar o pagamento.
      </p>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!state.busy) setOpen(v);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Editar contato da entrega" : "Novo pedido de entrega"}
            </DialogTitle>
            <DialogDescription>
              Confira a venda e o endereço com o cliente. O pagamento permanece
              na venda original.
            </DialogDescription>
          </DialogHeader>
          <Feedback state={state} />
          <form onSubmit={save}>
            <fieldset
              disabled={state.busy || !writable}
              className="space-y-3 min-w-0"
            >
              {!editId && (
                <div className="flex gap-2 items-end">
                  <label className="flex-1 min-w-0">
                    Número da venda
                    <Input
                      required
                      aria-label="Número da venda"
                      type="number"
                      min="1"
                      step="1"
                      value={draft.saleId}
                      onChange={(e) => {
                        setDraft({ ...draft, saleId: e.target.value });
                        setSale(null);
                      }}
                    />
                  </label>
                  <Button type="button" variant="outline" onClick={verify}>
                    Conferir venda
                  </Button>
                </div>
              )}
              {sale && (
                <p role="status">
                  Venda #{sale.id} · {money(sale.total_amount)} · pagamento
                  registrado
                </p>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <label>
                  Nome do destinatário
                  <Input
                    required
                    aria-label="Nome do destinatário"
                    maxLength="150"
                    value={draft.customerName}
                    onChange={(e) =>
                      setDraft({ ...draft, customerName: e.target.value })
                    }
                  />
                </label>
                <label>
                  Telefone de contato
                  <Input
                    required
                    aria-label="Telefone de contato"
                    maxLength="30"
                    value={draft.phone}
                    onChange={(e) =>
                      setDraft({ ...draft, phone: e.target.value })
                    }
                  />
                </label>
                {[
                  ["street", "Logradouro", 200, true],
                  ["number", "Número ou s/n", 30, true],
                  ["district", "Bairro", 100, true],
                  ["city", "Cidade", 100, true],
                  ["state", "UF", 2, true],
                  ["postalCode", "CEP", 9, false],
                  ["complement", "Complemento", 150, false],
                  ["reference", "Ponto de referência", 200, false],
                ].map(([key, label, max, required]) => (
                  <label key={key}>
                    {label}
                    <Input
                      required={required}
                      aria-label={label}
                      maxLength={max}
                      value={draft.address[key]}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          address: { ...draft.address, [key]: e.target.value },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="block">
                Observações da entrega
                <textarea
                  aria-label="Observações da entrega"
                  className="border rounded p-2 bg-background w-full"
                  maxLength="2000"
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                />
              </label>
              <Button
                disabled={
                  !editId && (!sale || String(sale.id) !== String(draft.saleId))
                }
              >
                Salvar pedido de entrega
              </Button>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(current)}
        onOpenChange={(v) => {
          if (!v && !state.busy) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Entrega da venda #{current?.saleId}</DialogTitle>
            <DialogDescription>
              {current && labels[current.status]} ·{" "}
              {current?.sale?.status === "cancelled"
                ? "venda cancelada"
                : "pagamento registrado na venda"}
            </DialogDescription>
          </DialogHeader>
          {current && (
            <div className="space-y-4">
              <Feedback state={state} />
              <div>
                <strong>{current.customerName}</strong>
                <p>{current.phone}</p>
                <p>
                  {current.address.street}, {current.address.number}{" "}
                  {current.address.complement}
                </p>
                <p>
                  {current.address.district} · {current.address.city}/
                  {current.address.state} · {current.address.postalCode}
                </p>
                <p>{current.address.reference}</p>
              </div>
              <ul className="space-y-2">
                {current.items.map((i, n) => (
                  <li key={n}>
                    {Number(i.quantity).toLocaleString("pt-BR")} {i.unit} ×{" "}
                    {i.name} · {money(i.total)}
                    {i.notes && <p className="text-sm">{i.notes}</p>}
                  </li>
                ))}
              </ul>
              <p>
                Total da venda: <strong>{money(current.paidTotal)}</strong>
              </p>
              {current.notes && <p>Observações: {current.notes}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={state.busy}
                  onClick={() =>
                    state.run(() =>
                      downloadPdf(
                        "/deliveries/" + current.id + "/pdf",
                        "entrega-" + current.saleId + ".pdf",
                      ),
                    )
                  }
                >
                  Imprimir pedido de entrega
                </Button>
                {writable &&
                  ["received", "preparing", "ready"].includes(
                    current.status,
                  ) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDraft({
                          ...current,
                          address: { ...current.address },
                        });
                        setEditId(current.id);
                        setSale(null);
                        setOpen(true);
                        setSelected(null);
                      }}
                    >
                      Editar contato / endereço
                    </Button>
                  )}
              </div>
              {writable && next[current.status] && (
                <div className="border rounded p-3 space-y-3">
                  {current.status === "ready" && (
                    <label className="block">
                      Entregador ou transportador responsável
                      <Input
                        aria-label="Entregador ou transportador responsável"
                        maxLength="120"
                        value={courier}
                        onChange={(e) => setCourier(e.target.value)}
                      />
                    </label>
                  )}
                  <Button
                    disabled={
                      state.busy ||
                      (current.status === "ready" && !courier.trim())
                    }
                    onClick={() => advance(next[current.status][0])}
                  >
                    {next[current.status][1]}
                  </Button>
                </div>
              )}
              {writable &&
                manager &&
                ["received", "preparing", "ready"].includes(current.status) && (
                  <div className="border rounded p-3 space-y-2">
                    <p className="text-sm">
                      Cancelar apenas a entrega mantém a venda paga e o estoque
                      baixado, por exemplo se o cliente optar por retirada.
                      Estornos financeiros são feitos no menu Vendas.
                    </p>
                    <label>
                      Motivo
                      <Input
                        aria-label="Motivo do cancelamento da entrega"
                        maxLength="1000"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <Button
                      variant="outline"
                      disabled={state.busy || !reason.trim()}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Cancelar somente a entrega? A venda permanecerá paga.",
                          )
                        )
                          advance("cancelled");
                      }}
                    >
                      Cancelar apenas a entrega
                    </Button>
                  </div>
                )}
              <div className="space-y-2">
                <h3 className="font-semibold">Histórico</h3>
                {current.history.map((h, n) => (
                  <p className="text-sm" key={n}>
                    {new Date(h.at).toLocaleString("pt-BR")} · {h.username} ·{" "}
                    {labels[h.action] || "Contato atualizado"}
                    {h.note ? " · " + h.note : ""}
                  </p>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
