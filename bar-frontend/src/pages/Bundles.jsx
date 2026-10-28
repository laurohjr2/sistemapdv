import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Feedback } from "../components/commerce/shared";
import { useRecords, money } from "../components/commerce/helpers";
const blank = () => ({
  name: "",
  price: "0",
  components: [],
  extras: [],
  active: true,
  revision: 0,
});
function Parts({ title, rows, onChange, products, extra = false }) {
  const [choice, setChoice] = useState("");
  const field = extra ? "maxQuantity" : "quantity";
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">{title}</h3>
      <div className="flex gap-2 flex-wrap items-end">
        <label className="flex-1 min-w-40">
          {extra ? "Adicional opcional" : "Componente do combo"}
          <select
            className="commerce-select"
            aria-label={extra ? "Adicional opcional" : "Componente do combo"}
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            <option value="">Selecione um produto</option>
            {products
              .filter(
                (p) =>
                  p.active &&
                  (p.unitOfMeasure === "unidade" || p.itemType === "service") &&
                  !rows.some((i) => i.productId === p.id),
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {money(p.salePrice)}
                </option>
              ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={!choice}
          onClick={() => {
            onChange([...rows, { productId: choice, [field]: 1 }]);
            setChoice("");
          }}
        >
          Adicionar {extra ? "opção" : "componente"}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="commerce-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>{extra ? "Máximo opcional" : "Unidades por combo"}</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, index) => (
              <tr key={r.productId}>
                <td>
                  {products.find((p) => p.id === r.productId)?.name ||
                    "Produto indisponível"}
                </td>
                <td>
                  <Input
                    aria-label={
                      (extra ? "Máximo de " : "Unidades de ") +
                      (products.find((p) => p.id === r.productId)?.name ||
                        "produto")
                    }
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    value={r[field]}
                    onChange={(e) =>
                      onChange(
                        rows.map((v, i) =>
                          i === index ? { ...v, [field]: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  >
                    Remover {extra ? "opção" : "componente"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export default function Bundles() {
  const state = useRecords("/bundles"),
    { user } = useAuth(),
    writable =
      ["admin", "gerente"].includes(user?.role) &&
      (!user?.support || user?.master);
  const [products, setProducts] = useState([]),
    [draft, setDraft] = useState(blank),
    [id, setId] = useState(null),
    [saved, setSaved] = useState(false);
  const { setError } = state;
  useEffect(() => {
    let live = true;
    api
      .get("/products")
      .then((r) => {
        if (live) setProducts(r.data);
      })
      .catch(() => {
        if (live) setError("Não foi possível carregar os componentes.");
      });
    return () => {
      live = false;
    };
  }, [setError]);
  useEffect(() => {
    setDraft((prev) =>
      id ? state.data.find((b) => b.id === id) || prev : prev,
    );
  }, [state.data, id]);
  async function save(e) {
    e.preventDefault();
    setSaved(false);
    const ok = await state.run(async () => {
      const r = id
        ? await api.put("/bundles/" + id, draft)
        : await api.post("/bundles", draft);
      setId(r.data.id);
      setDraft(r.data);
    });
    if (ok) setSaved(true);
  }
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Combos e adicionais</h1>
          <p className="text-muted-foreground">
            Defina a composição, o preço do conjunto e as opções que o cliente
            pode acrescentar.
          </p>
        </div>
        {writable && (
          <Button
            disabled={state.busy}
            onClick={() => {
              setId(null);
              setDraft(blank());
              setSaved(false);
            }}
          >
            Novo combo
          </Button>
        )}
      </div>
      <Feedback state={state} />
      {saved && <p role="status">Combo salvo.</p>}
      <form onSubmit={save} className="commerce-panel p-4">
        <fieldset
          disabled={!writable || state.busy}
          className="space-y-4 min-w-0"
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <label>
              Nome do combo
              <Input
                required
                aria-label="Nome do combo"
                maxLength="150"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Preço do conjunto
              <Input
                required
                currency
                aria-label="Preço do conjunto"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </label>
          </div>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Disponível para venda
          </label>
          <Parts
            title="Composição incluída no preço"
            products={products}
            rows={draft.components}
            onChange={(components) => setDraft({ ...draft, components })}
          />
          <Parts
            title="Adicionais cobrados separadamente"
            extra
            products={products}
            rows={draft.extras}
            onChange={(extras) => setDraft({ ...draft, extras })}
          />
          <p className="text-sm text-muted-foreground">
            Os adicionais usam o preço cadastrado do próprio produto. Use itens
            em unidade; para porções de ingredientes, cadastre uma porção em
            unidade com ficha técnica. Um combo com só um lanche e opções de
            adicionais também funciona como lanche personalizado. Pizzas com
            sabores continuam pelo botão Montar pizza.
          </p>
          <p className="text-sm text-muted-foreground">
            O valor do combo é distribuído entre os componentes, mantendo a soma
            exata nos relatórios. O estoque de cada produto ou ingrediente é
            conferido no lançamento. Para alterar a quantidade de um combo na
            comanda, remova o grupo completo e lance novamente.
          </p>
          {writable && (
            <Button disabled={!draft.components.length}>Salvar combo</Button>
          )}
        </fieldset>
      </form>
      <div className="commerce-panel p-4 space-y-2">
        <h2 className="font-semibold">Catálogo cadastrado</h2>
        {state.data.map((b) => (
          <button
            key={b.id}
            disabled={state.busy}
            type="button"
            className="block w-full text-left border-b py-3"
            onClick={() => {
              setId(b.id);
              setDraft({
                ...b,
                components: b.components.map((i) => ({ ...i })),
                extras: b.extras.map((i) => ({ ...i })),
              });
              setSaved(false);
            }}
          >
            {b.name} · {money(b.price)} · {b.active ? "Ativo" : "Inativo"} ·
            revisão {b.revision}
          </button>
        ))}
        {!state.data.length && <p>Nenhum combo cadastrado.</p>}
      </div>
    </div>
  );
}
