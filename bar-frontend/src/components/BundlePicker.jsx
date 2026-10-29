import { useBusiness } from "../hooks/useBusiness";
import PizzaBuilder from "./pizza/PizzaBuilder";
import usePizzaCatalog from "./pizza/usePizzaCatalog";
import { useEffect, useState } from "react";
import api from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { money } from "./commerce/helpers";
export default function BundlePicker({ onAdd, onClose }) {
  const { business } = useBusiness();
  const { menu, error: menuError } = usePizzaCatalog(
    Boolean(business.modules?.pizza),
  );
  const [pizzas, setPizzas] = useState({}),
    [pizzaSlot, setPizzaSlot] = useState(null);
  const [bundles, setBundles] = useState([]),
    [products, setProducts] = useState([]),
    [id, setId] = useState(""),
    [extras, setExtras] = useState({}),
    [amount, setAmount] = useState("1"),
    [notes, setNotes] = useState(""),
    [preview, setPreview] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const selected = bundles.find((b) => b.id === id),
    signature = JSON.stringify({
      id,
      revision: selected?.revision,
      pizzas: Object.entries(pizzas).map(([slot, pizza]) => ({
        slot: Number(slot),
        pizza,
      })),
      extras: Object.entries(extras)
        .filter(([, n]) => Number(n) > 0)
        .map(([productId, quantity]) => ({
          productId,
          quantity: Number(quantity),
        })),
    });
  const slots = (selected?.components || []).flatMap((c) =>
    Array.from({ length: c.quantity }, () => c),
  );
  const missingPizzas = slots.some((c, slot) => c.pizzaSizeId && !pizzas[slot]);
  useEffect(() => {
    let live = true;
    Promise.all([api.get("/bundles"), api.get("/products")])
      .then(([b, p]) => {
        if (live) {
          setBundles(b.data.filter((b) => b.active));
          setProducts(p.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (live) {
          setError("Não foi possível carregar os combos.");
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    setPreview(null);
    setError("");
    if (!id || missingPizzas) return;
    const timer = setTimeout(
      () =>
        api
          .post("/bundles/price", JSON.parse(signature))
          .then((r) => {
            if (live) setPreview({ ...r.data, signature });
          })
          .catch((e) => {
            if (live)
              setError(
                e.response?.data?.error || "Não foi possível conferir o preço.",
              );
          }),
      180,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [id, signature, missingPizzas]);
  async function submit(e) {
    e.preventDefault();
    if (!preview || preview.signature !== signature || missingPizzas) return;
    setBusy(true);
    setError("");
    try {
      await onAdd({
        selection: JSON.parse(signature),
        preview,
        quantity: Number(amount),
        notes,
      });
      onClose();
    } catch (e) {
      setError(
        e.response?.data?.error ||
          e.message ||
          "Não foi possível lançar o combo",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Selecionar combo e adicionais</DialogTitle>
          <DialogDescription>
            Confira a composição e os adicionais antes de lançar. O estoque é
            validado ao registrar o pedido.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Carregando combos...</p>
        ) : (
          <form onSubmit={submit}>
            <fieldset disabled={busy} className="space-y-4 min-w-0">
              <label className="block">
                Combo
                <select
                  required
                  className="commerce-select"
                  aria-label="Combo"
                  value={id}
                  onChange={(e) => {
                    setId(e.target.value);
                    setExtras({});
                    setPizzas({});
                    setPizzaSlot(null);
                  }}
                >
                  <option value="">Selecione</option>
                  {bundles.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {money(b.price)}
                    </option>
                  ))}
                </select>
              </label>
              {!bundles.length && (
                <p>Cadastre um combo no menu Combos e adicionais.</p>
              )}
              {slots.map((c, slot) =>
                c.pizzaSizeId ? (
                  <section className="border rounded p-3 space-y-2" key={slot}>
                    <h3 className="font-semibold">
                      Pizza {slot + 1} ·{" "}
                      {menu?.sizes.find((s) => s.id === c.pizzaSizeId)?.name ||
                        "Tamanho configurado"}
                    </h3>
                    <p className="text-sm">
                      Sabores incluídos no preço fixo do combo. Borda e
                      adicionais são cobrados à parte.
                    </p>
                    {pizzas[slot] && (
                      <p>
                        Pizza montada · {pizzas[slot].flavorIds.length}{" "}
                        sabor(es). Confira a descrição na prévia.
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPizzaSlot(slot)}
                    >
                      {pizzas[slot] ? "Editar" : "Montar"} pizza {slot + 1}
                    </Button>
                  </section>
                ) : null,
              )}
              {menuError && slots.some((c) => c.pizzaSizeId) && (
                <p role="alert" className="text-destructive">
                  {menuError}
                </p>
              )}
              {missingPizzas && (
                <p role="status">
                  Monte todas as pizzas para conferir o total do combo.
                </p>
              )}
              {selected?.extras.map((e) => (
                <label key={e.productId} className="block">
                  Adicional:{" "}
                  {products.find((p) => p.id === e.productId)?.name ||
                    "Indisponível"}{" "}
                  ·{" "}
                  {money(products.find((p) => p.id === e.productId)?.salePrice)}{" "}
                  cada
                  <Input
                    aria-label={
                      "Adicional " +
                      (products.find((p) => p.id === e.productId)?.name ||
                        "indisponível")
                    }
                    type="number"
                    min="0"
                    max={e.maxQuantity}
                    step="1"
                    value={extras[e.productId] || "0"}
                    onChange={(v) =>
                      setExtras({ ...extras, [e.productId]: v.target.value })
                    }
                  />
                </label>
              ))}
              <label className="block">
                Quantidade de combos
                <Input
                  required
                  aria-label="Quantidade de combos"
                  type="number"
                  min="1"
                  max="99"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label className="block">
                Observações do combo
                <textarea
                  className="border rounded p-2 bg-background w-full"
                  aria-label="Observações do combo"
                  maxLength="500"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              {preview && (
                <div role="status" className="border rounded p-3 space-y-2">
                  <p>
                    <strong>{money(preview.unitPrice)}</strong> por combo ·
                    Total {money(preview.unitPrice * Number(amount || 0))}
                  </p>
                  <ul>
                    {preview.lines.map((l, i) => (
                      <li key={i}>
                        {l.kind === "extra" ? "Adicional: " : ""}
                        {l.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                disabled={
                  !preview ||
                  preview.signature !== signature ||
                  missingPizzas ||
                  busy
                }
              >
                Adicionar combo
              </Button>
            </fieldset>
          </form>
        )}
        {pizzaSlot !== null && slots[pizzaSlot]?.pizzaSizeId && (
          <PizzaBuilder
            key={pizzaSlot}
            combo
            fixedSizeId={slots[pizzaSlot].pizzaSizeId}
            onClose={() => setPizzaSlot(null)}
            onAdd={async (data) => {
              setPizzas((prev) => ({
                ...prev,
                [pizzaSlot]: data.pizza.selection,
              }));
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
