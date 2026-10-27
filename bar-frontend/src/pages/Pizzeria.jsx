import { useEffect, useState } from "react";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useRecords } from "../components/commerce/helpers";
import { Feedback } from "../components/commerce/shared";
export default function Pizzeria() {
  const state = useRecords("/pizza/catalog"),
    [form, setForm] = useState(null),
    [products, setProducts] = useState([]),
    [tab, setTab] = useState("sizes"),
    [success, setSuccess] = useState("");
  useEffect(() => {
    api
      .get("/products")
      .then((r) =>
        setProducts(
          r.data.filter(
            (p) =>
              p.active &&
              p.itemType !== "service" &&
              p.unitOfMeasure === "unidade",
          ),
        ),
      )
      .catch(() => {});
  }, []);
  const data = form || (!Array.isArray(state.data) ? state.data : null);
  const update = (value) => {
    setForm({ ...data, ...value });
    setSuccess("");
  };
  function row(index, patch) {
    update({
      [tab]: data[tab].map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });
  }
  function add() {
    const base = { id: crypto.randomUUID(), name: "", active: true };
    update({
      [tab]: [
        ...data[tab],
        tab === "sizes"
          ? { ...base, productId: "", slices: 8, maxFlavors: 2 }
          : { ...base, prices: {} },
      ],
    });
  }
  async function save(e) {
    e.preventDefault();
    if (await state.run(() => api.put("/pizza/catalog", data))) {
      setForm(null);
      setSuccess(
        "Cardápio de pizzas salvo. Novos pedidos usarão estes preços.",
      );
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <p className="commerce-eyebrow">Pizzaria</p>
        <h1 className="text-3xl font-bold">Cardápio de pizzas</h1>
        <p className="text-muted-foreground">
          Tamanhos, sabores, bordas e adicionais, com preços por tamanho.
        </p>
      </div>
      <Feedback
        state={{
          ...state,
          load: async () => {
            if (
              form &&
              !window.confirm(
                "Descartar alterações locais e recarregar o cardápio salvo?",
              )
            )
              return;
            setForm(null);
            setSuccess("");
            await state.load();
          },
        }}
      />
      {success && (
        <p role="status" className="rounded-lg border border-green-300 p-3">
          {success}
        </p>
      )}
      {data && (
        <form onSubmit={save} className="space-y-5">
          <div className="commerce-panel p-4 space-y-2">
            <label>
              Regra para vários sabores
              <select
                aria-label="Regra de preço"
                className="commerce-select"
                value={data.pricingRule}
                onChange={(e) => update({ pricingRule: e.target.value })}
              >
                <option value="highest">Cobrar pelo sabor mais caro</option>
                <option value="average">Cobrar pela média dos sabores</option>
              </select>
            </label>
            <p className="text-sm text-muted-foreground">
              Os sabores ocupam partes iguais. Borda e adicionais são somados ao
              valor da pizza inteira. Cada pizza baixa uma unidade do
              produto-base escolhido no tamanho; ingredientes ainda não têm
              consumo automático.
            </p>
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label="Itens do cardápio"
          >
            {[
              ["sizes", "Tamanhos"],
              ["flavors", "Sabores"],
              ["crusts", "Bordas"],
              ["extras", "Adicionais"],
            ].map(([id, name]) => (
              <Button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                variant={tab === id ? "default" : "outline"}
                onClick={() => setTab(id)}
              >
                {name}
              </Button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">
              {
                {
                  sizes: "Tamanhos",
                  flavors: "Sabores",
                  crusts: "Bordas",
                  extras: "Adicionais",
                }[tab]
              }
            </h2>
            <Button type="button" variant="outline" onClick={add}>
              Adicionar{" "}
              {
                {
                  sizes: "tamanho",
                  flavors: "sabor",
                  crusts: "borda",
                  extras: "adicional",
                }[tab]
              }
            </Button>
          </div>
          <div className="space-y-4">
            {data[tab].map((r, i) => (
              <section key={r.id} className="commerce-panel p-4 space-y-3">
                <div className="flex gap-3 items-end">
                  <label className="flex-1">
                    Nome
                    <Input
                      aria-label={
                        "Nome " +
                        {
                          sizes: "do tamanho",
                          flavors: "do sabor",
                          crusts: "da borda",
                          extras: "do adicional",
                        }[tab] +
                        " " +
                        (i + 1)
                      }
                      value={r.name}
                      maxLength={100}
                      required
                      onChange={(e) => row(i, { name: e.target.value })}
                    />
                  </label>
                  <label className="mb-2 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={r.active}
                      onChange={(e) => row(i, { active: e.target.checked })}
                    />{" "}
                    Ativo
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Remover esta opção do cardápio? Pedidos anteriores serão preservados.",
                        )
                      ) {
                        const patch = {
                          [tab]: data[tab].filter((_, j) => i !== j),
                        };
                        if (tab === "sizes")
                          for (const kind of ["flavors", "crusts", "extras"])
                            patch[kind] = data[kind].map((o) => ({
                              ...o,
                              prices: Object.fromEntries(
                                Object.entries(o.prices).filter(
                                  ([id]) => id !== r.id,
                                ),
                              ),
                            }));
                        update(patch);
                      }
                    }}
                  >
                    Remover
                  </Button>
                </div>
                {tab === "sizes" ? (
                  <div className="grid sm:grid-cols-3 gap-3">
                    <label>
                      Produto-base do estoque
                      <select
                        required
                        aria-label={"Produto-base " + (i + 1)}
                        className="commerce-select"
                        value={r.productId}
                        onChange={(e) => row(i, { productId: e.target.value })}
                      >
                        <option value="">Selecione um produto</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {Number(p.currentStock)} un.
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Fatias
                      <Input
                        aria-label={"Fatias " + (i + 1)}
                        required
                        type="number"
                        min="1"
                        max="24"
                        value={r.slices}
                        onChange={(e) =>
                          row(i, { slices: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Máximo de sabores
                      <Input
                        aria-label={"Máximo de sabores " + (i + 1)}
                        required
                        type="number"
                        min="1"
                        max="4"
                        value={r.maxFlavors}
                        onChange={(e) =>
                          row(i, { maxFlavors: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-3 gap-3">
                    {data.sizes.map((s) => (
                      <label key={s.id}>
                        Preço — {s.name || "Tamanho sem nome"}
                        <Input
                          aria-label={"Preço " + r.name + " " + s.name}
                          currency
                          value={r.prices[s.id] ?? ""}
                          placeholder="Indisponível"
                          onChange={(e) =>
                            row(i, {
                              prices: { ...r.prices, [s.id]: e.target.value },
                            })
                          }
                        />
                      </label>
                    ))}
                    {!data.sizes.length && <p>Cadastre um tamanho primeiro.</p>}
                  </div>
                )}
              </section>
            ))}
            {!data[tab].length && (
              <p className="commerce-panel p-6 text-muted-foreground">
                Nenhuma opção cadastrada nesta aba.
              </p>
            )}
          </div>
          <Button disabled={state.busy || !data.sizes.length}>
            Salvar cardápio
          </Button>
          <p className="text-xs text-muted-foreground">
            Deixe o preço vazio para tornar uma opção indisponível naquele
            tamanho. Zero permite borda ou adicional gratuito. Salvar considera
            todas as abas; pedidos existentes mantêm a montagem e o preço
            originais.
          </p>
        </form>
      )}
    </div>
  );
}
