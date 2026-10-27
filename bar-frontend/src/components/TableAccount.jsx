import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useBusiness } from "../hooks/useBusiness";
import api from "../lib/api";
import { receiptHeader, escapeHtml } from "../lib/receipt";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import CustomerSelect from "./CustomerSelect";
import PixPayment from "./PixPayment";
const methods = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  vale_refeicao: "Vale-refeição",
};
const money = (v) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
export default function TableAccount({ table, onClose, onUpdate }) {
  const { user } = useAuth(),
    { business } = useBusiness();
  const [comanda, setComanda] = useState(null),
    [products, setProducts] = useState([]),
    [customerId, setCustomerId] = useState(""),
    [name, setName] = useState(""),
    [productId, setProductId] = useState(""),
    [quantity, setQuantity] = useState("1"),
    [notes, setNotes] = useState(""),
    [discount, setDiscount] = useState(""),
    [payments, setPayments] = useState([{ method: "dinheiro", amount: "" }]),
    [people, setPeople] = useState(2),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const totalCents = Math.max(
      0,
      Math.round(
        (Number(comanda?.totalValue || 0) - Number(discount || 0)) * 100,
      ),
    ),
    paidCents = payments.reduce(
      (s, p) => s + Math.round(Number(p.amount || 0) * 100),
      0,
    );
  const load = useCallback(async () => {
    const id = table.comandas?.[0]?.id;
    if (id) {
      const r = await api.get("/comandas/" + id);
      setComanda(r.data);
      setCustomerId(r.data.customerId || "");
      setName(r.data.customerName || "");
    }
    const r = await api.get("/products");
    setProducts(r.data.filter((p) => p.active));
    setLoaded(true);
  }, [table]);
  useEffect(() => {
    load().catch(() => setError("Não foi possível carregar a comanda"));
  }, [load]);
  useEffect(() => {
    if (!comanda?.id) return;
    let active = true;
    const timer = setInterval(
      () =>
        api
          .get("/comandas/" + comanda.id)
          .then((r) => {
            if (active) setComanda(r.data);
          })
          .catch(() => {}),
      10000,
    );
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [comanda?.id]);
  async function action(fn) {
    setError("");
    setBusy(true);
    try {
      await fn();
      await onUpdate();
    } catch (e) {
      setError(
        e.response?.data?.error || "Não foi possível concluir a operação",
      );
    } finally {
      setBusy(false);
    }
  }
  async function open() {
    await action(async () => {
      const r = await api.post("/comandas", {
        tableId: table.id,
        type: "mesa",
        customerName: name,
        customerId: customerId || null,
      });
      setComanda(r.data.comanda);
      setLoaded(true);
    });
  }
  async function saveCustomer() {
    await action(async () => {
      const r = await api.put("/comandas/" + comanda.id + "/customer", {
        customerName: name,
        customerId: customerId || null,
      });
      setComanda({ ...comanda, ...r.data });
    });
  }
  async function add(e) {
    e.preventDefault();
    await action(async () => {
      await api.post("/comandas/" + comanda.id + "/items", {
        productId,
        quantity: Number(quantity),
        notes,
      });
      const fresh = await api.get("/comandas/" + comanda.id);
      setComanda(fresh.data);
      setNotes("");
    });
  }
  function split() {
    const n = Math.max(1, Math.min(100, Number(people) || 1)),
      part = Math.floor(totalCents / n);
    setPayments(
      Array.from({ length: n }, (_, i) => ({
        method: payments[0].method,
        amount: (
          (part + (i === n - 1 ? totalCents - part * n : 0)) /
          100
        ).toFixed(2),
      })),
    );
  }
  function print(account) {
    const popup = window.open("", "_blank");
    if (!popup) {
      setError("Permita abrir a janela de impressão no navegador");
      return;
    }
    popup.document.write(
      `<html><head><title>Comanda — Mesa ${table.tableNumber}</title><style>body{font-family:Arial;margin:24px}table{width:100%;border-collapse:collapse}td,th{padding:8px;text-align:left;border-bottom:1px solid #ddd}</style></head><body>${receiptHeader(business)}<h2>Mesa ${table.tableNumber}</h2><p>Cliente: ${escapeHtml(account.customerName || name || "Não informado")}</p><p>${account.status === "fechada" ? "Conta paga" : "CONFERÊNCIA — conta aberta"}</p><table><tr><th>Produto</th><th>Qtd</th><th>Total</th></tr>${(comanda?.items || []).map((i) => `<tr><td>${escapeHtml(i.product?.name || "Produto")}</td><td>${Number(i.quantity)}</td><td>${money(i.totalItemValue)}</td></tr>`).join("")}</table><p>Subtotal: ${money(account.totalValue)}</p><p>Desconto: ${money(account.discountValue)}</p><strong>Total: ${money(account.finalValue ?? account.totalValue)}</strong>${(account.payments || []).map((p) => `<p>${escapeHtml(methods[p.method])}: ${money(p.amount)}</p>`).join("")}<p>${escapeHtml(business.receiptMessage)}</p></body></html>`,
    );
    popup.document.close();
    popup.onload = () => popup.print();
  }
  async function close() {
    await action(async () => {
      const r = await api.post("/tables/" + table.id + "/close-comanda", {
        paymentMethod: payments[0].method,
        payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
        discountValue: Number(discount || 0),
        paymentStatus: "pago",
      });
      print(r.data.comanda);
      onClose();
    });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Mesa {table.tableNumber} — {comanda ? "Comanda" : "Abrir mesa"}
          </DialogTitle>
          <DialogDescription>
            Cliente, pedidos, preparo e pagamento da mesa.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <fieldset disabled={busy} className="space-y-4">
          <CustomerSelect
            value={customerId}
            onChange={(id, c) => {
              setCustomerId(id);
              if (c) setName(c.name);
            }}
          />
          <label className="block">
            Nome do cliente
            <Input
              maxLength={150}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setCustomerId("");
              }}
            />
          </label>
          {!comanda ? (
            <Button onClick={open} disabled={!loaded}>
              Abrir comanda
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={saveCustomer}>
                Salvar cliente na comanda
              </Button>
              <div className="divide-y">
                {(comanda.items || []).map((i) => (
                  <div
                    key={i.id}
                    className="py-2 flex flex-wrap justify-between gap-2"
                  >
                    <div>
                      <strong>{i.product?.name}</strong> × {Number(i.quantity)}
                      <p>{i.notes}</p>
                      <span
                        className={
                          i.preparationStatus === "pronto"
                            ? "text-green-700 font-bold"
                            : ""
                        }
                      >
                        {i.preparationStatus === "pronto"
                          ? "Pronto para entregar nesta mesa"
                          : i.preparationStatus}
                      </span>
                    </div>
                    <span>{money(i.totalItemValue)}</span>
                    {i.preparationStatus === "pronto" && (
                      <Button
                        onClick={() =>
                          action(async () => {
                            await api.put("/queue/items/" + i.id + "/status", {
                              preparationStatus: "entregue",
                              status: "entregue",
                            });
                            const fresh = await api.get(
                              "/comandas/" + comanda.id,
                            );
                            setComanda(fresh.data);
                          })
                        }
                      >
                        Entregue
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <form onSubmit={add} className="space-y-3 border rounded p-3">
                <label>
                  Adicionar produto
                  <select
                    required
                    className="border p-2 rounded w-full"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {products.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name} — {money(p.salePrice)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantidade
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
                <label>
                  Observação para o pedido
                  <Input
                    maxLength={1000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <Button>Adicionar à comanda</Button>
              </form>
              <Button variant="outline" onClick={() => print(comanda)}>
                Imprimir conferência
              </Button>
              {["admin", "gerente"].includes(user?.role) && (
                <label className="block">
                  Desconto (R$)
                  <Input
                    currency
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </label>
              )}
              <p className="text-xl font-bold">
                Total: {money(totalCents / 100)}
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <label>
                  Dividir entre pessoas
                  <Input
                    aria-label="Quantidade de pessoas"
                    type="number"
                    min="1"
                    max="100"
                    value={people}
                    onChange={(e) => setPeople(e.target.value)}
                  />
                </label>
                <Button variant="outline" onClick={split}>
                  Dividir igualmente
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setPayments([...payments, { method: "pix", amount: "" }])
                  }
                >
                  Adicionar pagamento
                </Button>
              </div>
              {payments.map((p, i) => (
                <div className="flex gap-2 items-end" key={i}>
                  <label className="flex-1">
                    Pagamento {i + 1}
                    <select
                      className="w-full border rounded p-2"
                      aria-label={"Forma do pagamento " + (i + 1)}
                      value={p.method}
                      onChange={(e) =>
                        setPayments(
                          payments.map((v, j) =>
                            j === i ? { ...v, method: e.target.value } : v,
                          ),
                        )
                      }
                    >
                      {Object.entries(methods).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex-1">
                    Valor
                    <Input
                      currency
                      aria-label={"Valor do pagamento " + (i + 1)}
                      value={p.amount}
                      onChange={(e) =>
                        setPayments(
                          payments.map((v, j) =>
                            j === i ? { ...v, amount: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  {payments.length > 1 && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        setPayments(payments.filter((_, j) => j !== i))
                      }
                    >
                      Remover
                    </Button>
                  )}
                </div>
              ))}
              {payments.length === 1 && (
                <Button
                  variant="outline"
                  onClick={() =>
                    setPayments([
                      { ...payments[0], amount: (totalCents / 100).toFixed(2) },
                    ])
                  }
                >
                  Preencher total
                </Button>
              )}
              {payments.some((p) => p.method === "pix") && <PixPayment />}
              <p aria-live="polite">
                {paidCents === totalCents
                  ? "Valores conferem"
                  : `Falta distribuir: ${money((totalCents - paidCents) / 100)}`}
              </p>
              <Button
                disabled={busy || paidCents !== totalCents || totalCents <= 0}
                onClick={close}
              >
                Receber, fechar e imprimir
              </Button>
            </>
          )}
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
