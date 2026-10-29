import { toast } from "sonner";
import ComandaLoyaltyDiscount from "./ComandaLoyaltyDiscount";
import { canAccess } from "../lib/access";
import BundlePicker from "./BundlePicker";
import PizzaBuilder from "./pizza/PizzaBuilder";
import usePizzaCatalog from "./pizza/usePizzaCatalog";
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
const wholeUnits = new Set(["unidade", "caixa", "par"]);
const quantityStep = (product) =>
  wholeUnits.has(product?.unitOfMeasure) ? "1" : "0.001";
function ItemQuantity({ item, onSave }) {
  const [value, setValue] = useState(String(Number(item.quantity)));
  useEffect(() => setValue(String(Number(item.quantity))), [item.quantity]);
  const step = item.pizza ? "1" : quantityStep(item.product);
  return (
    <div className="flex flex-wrap gap-2 items-end">
      <label>
        Quantidade lançada
        <Input
          aria-label={"Quantidade lançada de " + item.product?.name}
          type="number"
          min={step}
          step={step}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <Button
        variant="outline"
        disabled={
          !Number.isFinite(Number(value)) ||
          Number(value) <= 0 ||
          (step === "1" && !Number.isInteger(Number(value))) ||
          Number(value) === Number(item.quantity)
        }
        onClick={() => onSave(Number(value))}
      >
        Atualizar quantidade
      </Button>
    </div>
  );
}
export default function TableAccount({ table, onClose, onUpdate }) {
  const { user } = useAuth(),
    { business } = useBusiness();
  const [pizzaOpen, setPizzaOpen] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const { menu: pizzaMenu } = usePizzaCatalog(Boolean(business.modules?.pizza));
  const pizzaBases = new Set(
    (pizzaMenu?.sizes || []).filter((s) => s.active).map((s) => s.productId),
  );
  const [comanda, setComanda] = useState(null),
    [products, setProducts] = useState([]),
    [customerId, setCustomerId] = useState(""),
    [name, setName] = useState(""),
    [productId, setProductId] = useState(""),
    [quantity, setQuantity] = useState("1"),
    [notes, setNotes] = useState(""),
    [discount, setDiscount] = useState(""),
    [discountMode, setDiscountMode] = useState("value"),
    [loyalty, setLoyalty] = useState(null),
    [payments, setPayments] = useState([{ method: "dinheiro", amount: "" }]),
    [people, setPeople] = useState(2),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const subtotal = Number(comanda?.totalValue || 0),
    discountNumber = Number(discount || 0),
    invalidDiscount =
      !Number.isFinite(discountNumber) ||
      discountNumber < 0 ||
      (discountMode === "percentage"
        ? discountNumber > 100
        : discountNumber > subtotal),
    totalCents = Math.max(
      0,
      Math.round(
        (subtotal -
          (discountMode === "percentage"
            ? (subtotal * discountNumber) / 100
            : discountNumber)) *
          100,
      ),
    ),
    paidCents = payments.reduce(
      (s, p) => s + Math.round(Number(p.amount || 0) * 100),
      0,
    );
  const selectedProduct = products.find((p) => p.id === productId);
  const step = quantityStep(selectedProduct);
  const validQuantity =
    Number.isFinite(Number(quantity)) &&
    Number(quantity) > 0 &&
    (step === "1"
      ? Number.isInteger(Number(quantity))
      : Math.abs(
          Number(quantity) * 1000 - Math.round(Number(quantity) * 1000),
        ) < 1e-6);
  const previewCents = Math.round(
    Number(selectedProduct?.salePrice || 0) * Number(quantity) * 100,
  );
  const load = useCallback(async () => {
    const id = comanda?.id || table.comandas?.[0]?.id;
    if (id) {
      const r = await api.get("/comandas/" + id);
      setComanda(r.data);
      setCustomerId(r.data.customerId || "");
      setName(r.data.customerName || "");
    }
    const r = await api.get("/products");
    setProducts(r.data.filter((p) => p.active));
    setLoaded(true);
  }, [table, comanda?.id]);
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
  useEffect(() => {
    if (
      loyalty &&
      (loyalty.customerId !== customerId ||
        loyalty.customerId !== comanda?.customerId ||
        loyalty.comandaUpdatedAt !== comanda?.updated_at)
    ) {
      setLoyalty(null);
      setDiscount("");
    }
  }, [loyalty, customerId, comanda?.customerId, comanda?.updated_at]);
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
      setQuantity("1");
      toast.success("Produto adicionado à comanda.", { duration: 2000 });
    });
  }
  async function updateQuantity(item, amount) {
    await action(async () => {
      await api.put("/comandas/" + comanda.id + "/items/" + item.id, {
        quantity: amount,
      });
      setComanda((await api.get("/comandas/" + comanda.id)).data);
      setPayments((prev) => prev.map((p) => ({ ...p, amount: "" })));
      toast.success("Quantidade e total atualizados.", { duration: 2000 });
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
      `<html><head><title>Comanda — Mesa ${table.tableNumber}</title><style>body{font-family:Arial;margin:24px}table{width:100%;border-collapse:collapse}td,th{padding:8px;text-align:left;border-bottom:1px solid #ddd}</style></head><body>${receiptHeader(business)}<h2>Mesa ${table.tableNumber}</h2><p>Cliente: ${escapeHtml(account.customerName || name || "Não informado")}</p><p>${account.status === "fechada" ? "Conta paga" : "CONFERÊNCIA — conta aberta"}</p><table><tr><th>Produto</th><th>Qtd</th><th>Total</th></tr>${(comanda?.items || []).map((i) => `<tr><td>${escapeHtml(i.bundle?.component?.name || i.pizza?.description || i.product?.name || "Produto")}${i.notes ? `<br>${escapeHtml(i.notes)}` : ""}</td><td>${Number(i.quantity)}</td><td>${money(i.totalItemValue)}</td></tr>`).join("")}</table><p>Subtotal: ${money(account.totalValue)}</p><p>Desconto${Number(account.discountPercentage) > 0 ? ` (${Number(account.discountPercentage).toLocaleString("pt-BR")}%)` : ""}: ${money(Number(account.totalValue) - Number(account.finalValue ?? account.totalValue))}</p>${account.loyaltyBenefit ? `<p>Fidelidade: ${escapeHtml(account.loyaltyBenefit.profile.label)} · ${Number(account.loyaltyBenefit.profile.basisPoints / 100).toLocaleString("pt-BR")}%</p>` : ""}<strong>Total: ${money(account.finalValue ?? account.totalValue)}</strong>${(account.payments || []).map((p) => `<p>${escapeHtml(methods[p.method])}: ${money(p.amount)}</p>`).join("")}<p>${escapeHtml(business.receiptMessage)}</p></body></html>`,
    );
    popup.document.close();
    popup.onload = () => popup.print();
  }
  async function close() {
    await action(async () => {
      const r = await api.post("/tables/" + table.id + "/close-comanda", {
        paymentMethod: payments[0].method,
        payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
        discountValue: discountMode === "value" ? discountNumber : 0,
        discountPercentage: discountMode === "percentage" ? discountNumber : 0,
        loyalty: loyalty
          ? {
              customerId: loyalty.customerId,
              comandaId: loyalty.comandaId,
              revision: loyalty.revision,
              scopeDigest: loyalty.scopeDigest,
            }
          : undefined,
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
                      <strong>
                        {i.bundle?.component?.name ||
                          i.pizza?.description ||
                          i.product?.name}
                      </strong>{" "}
                      ×{" "}
                      {Number(i.quantity).toLocaleString("pt-BR", {
                        maximumFractionDigits: 3,
                      })}
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
                    <span>
                      {money(i.priceAtSale)} por{" "}
                      {i.product?.unitOfMeasure || "unidade"} · Total:{" "}
                      {money(i.totalItemValue)}
                    </span>
                    {!i.bundle && canAccess(user, "tables.edit") && (
                      <ItemQuantity
                        item={i}
                        onSave={(amount) => updateQuantity(i, amount)}
                      />
                    )}
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
              {business.modules?.pizza && (
                <Button onClick={() => setPizzaOpen(true)} disabled={busy}>
                  Montar pizza
                </Button>
              )}
              {business.modules?.bundles && (
                <Button
                  variant="outline"
                  onClick={() => setBundleOpen(true)}
                  disabled={busy}
                >
                  Selecionar combo
                </Button>
              )}
              {bundleOpen && (
                <BundlePicker
                  onClose={() => setBundleOpen(false)}
                  onAdd={async (data) => {
                    await api.post("/bundles/comandas/" + comanda.id, {
                      selection: data.selection,
                      quantity: data.quantity,
                      notes: data.notes,
                      expectedUnitPrice: data.preview.unitPrice,
                    });
                    setComanda((await api.get("/comandas/" + comanda.id)).data);
                    await onUpdate();
                  }}
                />
              )}
              {pizzaOpen && (
                <PizzaBuilder
                  onClose={() => setPizzaOpen(false)}
                  onAdd={async (data) => {
                    await api.post("/comandas/" + comanda.id + "/items", {
                      productId: data.productId,
                      pizza: data.pizza.selection,
                      quantity: data.quantity,
                      notes: data.notes,
                      expectedUnitPrice: data.unitPrice,
                    });
                    setComanda((await api.get("/comandas/" + comanda.id)).data);
                    await onUpdate();
                  }}
                />
              )}
              <form onSubmit={add} className="space-y-3 border rounded p-3">
                <label>
                  Adicionar produto
                  <select
                    required
                    aria-label="Adicionar produto"
                    className="border p-2 rounded w-full"
                    value={productId}
                    onChange={(e) => {
                      setProductId(e.target.value);
                      setQuantity("1");
                    }}
                  >
                    <option value="">Selecione</option>
                    {products
                      .filter((p) => !pizzaBases.has(p.id))
                      .map((p) => (
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
                    aria-label="Quantidade a adicionar"
                    min={step}
                    step={step}
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
                {selectedProduct && validQuantity && (
                  <p aria-live="polite" className="font-semibold">
                    Próximo lançamento:{" "}
                    {Number(quantity).toLocaleString("pt-BR")} ×{" "}
                    {money(selectedProduct.salePrice)} ={" "}
                    {money(previewCents / 100)}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  A quantidade acima será incluída no total ao clicar em
                  Adicionar à comanda. Para corrigir um item já lançado, use
                  Atualizar quantidade.
                </p>
                <Button disabled={!productId || !validQuantity}>
                  Adicionar à comanda
                </Button>
              </form>
              <Button variant="outline" onClick={() => print(comanda)}>
                Imprimir conferência
              </Button>
              {["admin", "gerente"].includes(user?.role) &&
                canAccess(user, "discounts.apply") && (
                  <div className="space-y-2">
                    <label className="block">
                      Tipo de desconto
                      <select
                        aria-label="Tipo de desconto"
                        className="border p-2 rounded w-full"
                        value={discountMode}
                        onChange={(e) => {
                          setDiscountMode(e.target.value);
                          setDiscount("");
                          setLoyalty(null);
                          setPayments((prev) =>
                            prev.map((p) => ({ ...p, amount: "" })),
                          );
                        }}
                      >
                        <option value="value">Valor (R$)</option>
                        <option value="percentage">Porcentagem (%)</option>
                      </select>
                    </label>
                    <label className="block">
                      {discountMode === "percentage"
                        ? "Desconto (%)"
                        : "Desconto (R$)"}
                      <Input
                        aria-label={
                          discountMode === "percentage"
                            ? "Desconto (%)"
                            : "Desconto (R$)"
                        }
                        currency={discountMode === "value"}
                        type={discountMode === "percentage" ? "number" : "text"}
                        min="0"
                        max="100"
                        step="0.01"
                        value={discount}
                        onChange={(e) => {
                          setLoyalty(null);
                          setDiscount(e.target.value);
                          setPayments((prev) =>
                            prev.map((p) => ({ ...p, amount: "" })),
                          );
                        }}
                      />
                    </label>
                    {invalidDiscount && (
                      <p role="alert" className="text-destructive">
                        Informe um desconto entre zero e{" "}
                        {discountMode === "percentage"
                          ? "100%."
                          : "o subtotal da conta."}
                      </p>
                    )}
                  </div>
                )}
              <p>Subtotal lançado: {money(subtotal)}</p>
              {!invalidDiscount && (
                <p>
                  Desconto
                  {discountMode === "percentage"
                    ? ` (${discountNumber.toLocaleString("pt-BR")}%)`
                    : ""}
                  : {money((Math.round(subtotal * 100) - totalCents) / 100)}
                </p>
              )}
              <p className="text-xl font-bold" aria-live="polite">
                Total:{" "}
                {invalidDiscount
                  ? "Confira o desconto"
                  : money(totalCents / 100)}
              </p>
              <ComandaLoyaltyDiscount
                comanda={comanda}
                customerId={customerId}
                disabled={busy}
                onRefresh={() =>
                  action(async () => {
                    await load();
                  })
                }
                onApply={(quote) => {
                  setLoyalty(quote);
                  setDiscountMode("value");
                  setDiscount(String(quote.discount));
                  setPayments((prev) =>
                    prev.map((p) => ({ ...p, amount: "" })),
                  );
                }}
              />
              {loyalty && (
                <p className="font-semibold text-sm">
                  {loyalty.description} aplicado. Confira os valores dos
                  pagamentos.
                </p>
              )}
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
                disabled={
                  busy ||
                  invalidDiscount ||
                  paidCents !== totalCents ||
                  totalCents <= 0
                }
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
