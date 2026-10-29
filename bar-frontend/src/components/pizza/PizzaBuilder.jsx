import usePizzaCatalog from "./usePizzaCatalog";
import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { money } from "../commerce/helpers";
export default function PizzaBuilder({
  onAdd,
  onClose,
  fixedSizeId = "",
  combo = false,
}) {
  const { menu, error: loadError } = usePizzaCatalog(true);
  const [sizeId, setSizeId] = useState(fixedSizeId),
    [flavorIds, setFlavors] = useState([]),
    [crustId, setCrust] = useState(""),
    [extras, setExtras] = useState([]),
    [quantity, setQuantity] = useState("1"),
    [notes, setNotes] = useState(""),
    [price, setPrice] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const selection = { sizeId, flavorIds, crustId: crustId || null, extras };
  const signature = JSON.stringify(selection);
  const size = menu?.sizes.find((s) => s.id === sizeId);
  useEffect(() => {
    let active = true;
    setPrice(null);
    setError("");
    if (!sizeId || !flavorIds.length) return;
    const timer = setTimeout(
      () =>
        api
          .post("/pizza/price", JSON.parse(signature))
          .then((r) => {
            if (active) setPrice(r.data);
          })
          .catch((e) => {
            if (active)
              setError(
                e.response?.data?.error || "Não foi possível calcular a pizza.",
              );
          }),
      180,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [signature, sizeId, flavorIds.length]);
  const available = (kind) =>
    (menu?.[kind] || []).filter(
      (o) => o.active && Object.hasOwn(o.prices, sizeId),
    );
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fresh = (await api.post("/pizza/price", selection)).data;
      if (
        price &&
        fresh.pizza.catalogRevision !== price.pizza.catalogRevision
      ) {
        setPrice(fresh);
        throw new Error(
          "O cardápio mudou. Confira a composição e o novo preço antes de adicionar novamente.",
        );
      }
      await onAdd({ ...fresh, quantity: Number(quantity), notes });
      onClose();
    } catch (e) {
      setError(
        e.response?.data?.error ||
          e.message ||
          "Não foi possível adicionar a pizza.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {combo ? "Montar pizza do combo" : "Montar pizza"}
          </DialogTitle>
          <DialogDescription>
            Escolha o tamanho, sabores e complementos. As porções de cada sabor
            são iguais.
          </DialogDescription>
        </DialogHeader>
        {(error || loadError) && (
          <p role="alert" className="text-red-700">
            {error || loadError}
          </p>
        )}
        {!menu ? (
          <p role="status">Carregando cardápio...</p>
        ) : !menu.sizes.some((s) => s.active) ? (
          <p>
            O cardápio ainda não foi configurado. Peça ao gerente para cadastrar
            tamanhos e sabores no menu Pizzaria.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              Tamanho
              <select
                aria-label="Tamanho da pizza"
                disabled={Boolean(fixedSizeId) || busy}
                className="commerce-select"
                required
                value={sizeId}
                onChange={(e) => {
                  setSizeId(e.target.value);
                  setFlavors([]);
                  setCrust("");
                  setExtras([]);
                  setPrice(null);
                }}
              >
                <option value="">Selecione o tamanho</option>
                {menu.sizes
                  .filter(
                    (s) => s.active && (!fixedSizeId || s.id === fixedSizeId),
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.slices} fatias · até {s.maxFlavors} sabores
                    </option>
                  ))}
              </select>
            </label>
            {size && (
              <>
                <fieldset className="space-y-2">
                  <legend className="font-semibold">
                    Sabores — escolha até {size.maxFlavors}
                  </legend>
                  {available("flavors").map((f) => (
                    <label
                      key={f.id}
                      className="flex justify-between gap-3 rounded-lg border p-3"
                    >
                      <span>
                        <input
                          type="checkbox"
                          aria-label={"Sabor " + f.name}
                          checked={flavorIds.includes(f.id)}
                          disabled={
                            busy ||
                            (!flavorIds.includes(f.id) &&
                              flavorIds.length >= size.maxFlavors)
                          }
                          onChange={(e) =>
                            setFlavors(
                              e.target.checked
                                ? [...flavorIds, f.id]
                                : flavorIds.filter((id) => id !== f.id),
                            )
                          }
                        />{" "}
                        {f.name}
                      </span>
                      <span>{money(f.prices[sizeId])}</span>
                    </label>
                  ))}
                  {!available("flavors").length && (
                    <p>Nenhum sabor disponível neste tamanho.</p>
                  )}
                </fieldset>
                <p className="text-sm text-muted-foreground">
                  Regra:{" "}
                  {menu.pricingRule === "highest"
                    ? "preço do sabor mais caro"
                    : "média dos sabores escolhidos"}
                  {combo
                    ? ". Os sabores estão incluídos no preço fixo do combo. Borda e adicionais são cobrados à parte por pizza inteira."
                    : ". Borda e adicionais são cobrados por pizza inteira."}
                </p>
                <label className="block">
                  Borda
                  <select
                    aria-label="Borda da pizza"
                    className="commerce-select"
                    value={crustId}
                    onChange={(e) => setCrust(e.target.value)}
                  >
                    <option value="">Sem borda recheada</option>
                    {available("crusts").map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · +{money(c.prices[sizeId])}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="space-y-2">
                  <legend className="font-semibold">Adicionais</legend>
                  {available("extras").map((extra) => {
                    const selected = extras.find((e) => e.id === extra.id);
                    return (
                      <div
                        key={extra.id}
                        className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                      >
                        <label className="flex-1">
                          <input
                            type="checkbox"
                            aria-label={"Adicional " + extra.name}
                            checked={Boolean(selected)}
                            onChange={(e) =>
                              setExtras(
                                e.target.checked
                                  ? [...extras, { id: extra.id, quantity: 1 }]
                                  : extras.filter((x) => x.id !== extra.id),
                              )
                            }
                          />{" "}
                          {extra.name} · +{money(extra.prices[sizeId])}
                        </label>
                        {selected && (
                          <Input
                            aria-label={"Quantidade de " + extra.name}
                            className="w-20"
                            type="number"
                            min="1"
                            max="5"
                            value={selected.quantity}
                            onChange={(e) =>
                              setExtras(
                                extras.map((x) =>
                                  x.id === extra.id
                                    ? { ...x, quantity: Number(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </fieldset>
              </>
            )}
            {!combo && (
              <div className="grid sm:grid-cols-2 gap-3">
                <label>
                  Quantidade de pizzas
                  <Input
                    aria-label="Quantidade de pizzas"
                    required
                    type="number"
                    min="1"
                    max="99"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
                <label>
                  Observações para o preparo
                  <Input
                    aria-label="Observações da pizza"
                    maxLength={1000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </div>
            )}
            {price && (
              <div className="rounded-xl border bg-muted p-4">
                <p>{price.pizza.description}</p>
                <p className="mt-2 text-xl font-semibold">
                  {combo ? (
                    `Acréscimo por pizza no combo: ${money(price.unitPrice - price.pizza.flavorPrice)}`
                  ) : (
                    <>
                      {money(price.unitPrice)} por pizza · Total{" "}
                      {money(price.unitPrice * Number(quantity))}
                    </>
                  )}
                </p>
              </div>
            )}
            <Button
              type="submit"
              disabled={
                !price ||
                busy ||
                !Number.isInteger(Number(quantity)) ||
                Number(quantity) < 1 ||
                Number(quantity) > 99
              }
            >
              {busy
                ? "Conferindo..."
                : combo
                  ? "Confirmar pizza no combo"
                  : "Adicionar pizza"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
