import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { money, useRecords } from "../components/commerce/helpers";
import { Feedback } from "../components/commerce/shared";
export default function Recipes() {
  const { user } = useAuth(),
    writable =
      ["admin", "gerente"].includes(user?.role) &&
      (!user?.support || user?.master);
  const state = useRecords("/recipes"),
    [products, setProducts] = useState([]),
    [selected, setSelected] = useState(""),
    [draft, setDraft] = useState(null),
    [choice, setChoice] = useState(""),
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
        if (live) setError("Não foi possível carregar os produtos.");
      });
    return () => {
      live = false;
    };
  }, [setError]);
  function choose(id) {
    const r = state.data.find((r) => r.productId === id),
      p = products.find((p) => p.id === id);
    setSelected(id);
    setChoice("");
    setSaved(false);
    setDraft(
      id
        ? {
            enabled: Boolean(p?.recipeEnabled),
            yieldQuantity: r?.yieldQuantity || "1",
            ingredients: r?.ingredients.map((i) => ({ ...i })) || [],
            notes: r?.notes || "",
            revision: r?.revision || 0,
          }
        : null,
    );
  }
  const output = products.find((p) => p.id === selected),
    inputs = products.filter(
      (p) =>
        p.active &&
        p.itemType !== "service" &&
        !p.recipeEnabled &&
        p.id !== selected,
    ),
    cost = (draft?.ingredients || []).reduce(
      (n, i) =>
        n +
        Number(i.quantity || 0) *
          Number(products.find((p) => p.id === i.productId)?.costPrice || 0),
      0,
    );
  async function save(e) {
    e.preventDefault();
    setSaved(false);
    const ok = await state.run(async () => {
      const r = await api.put("/recipes/" + selected, draft);
      setDraft({ ...draft, ...r.data });
      setProducts((await api.get("/products")).data);
    });
    if (ok) setSaved(true);
  }
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Fichas técnicas</h1>
        <p className="text-muted-foreground">
          Defina o rendimento e os insumos dos produtos preparados. A baixa
          acontece na venda ou ao adicionar na comanda.
        </p>
      </div>
      <Feedback state={state} />
      {saved && (
        <p role="status" className="text-green-700">
          Ficha técnica salva.
        </p>
      )}
      <div className="commerce-panel p-4 space-y-3">
        <label className="block">
          Produto preparado
          <select
            aria-label="Produto preparado"
            className="commerce-select"
            value={selected}
            disabled={state.busy || state.loading}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">Selecione um produto cadastrado</option>
            {products
              .filter((p) => p.itemType !== "service")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.recipeEnabled ? " — ficha ativa" : ""}
                  {!p.active ? " — inativo" : ""}
                </option>
              ))}
          </select>
        </label>
        <p className="text-sm text-muted-foreground">
          Cadastre o item pronto em Produtos e serviços, com seu preço de venda.
          Para ativar a ficha, ele deve estar sem estoque físico. Cadastre os
          insumos separadamente, usando a unidade em que serão consumidos: kg,
          litro ou unidade, por exemplo.
        </p>
      </div>
      {draft && (
        <form onSubmit={save} className="commerce-panel p-4 space-y-4">
          <fieldset
            disabled={!writable || state.busy || state.loading}
            className="space-y-4 min-w-0"
          >
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) =>
                  setDraft({ ...draft, enabled: e.target.checked })
                }
              />
              Ativar baixa por ingredientes
            </label>
            <div className="flex gap-4 flex-wrap">
              <label>
                Rendimento em {output?.unitOfMeasure}
                <Input
                  required
                  aria-label="Rendimento"
                  type="number"
                  step="0.001"
                  min="0.001"
                  max="9999999.999"
                  value={draft.yieldQuantity}
                  onChange={(e) =>
                    setDraft({ ...draft, yieldQuantity: e.target.value })
                  }
                />
              </label>
              <div>
                <p>
                  Custo estimado dos insumos: <strong>{money(cost)}</strong>
                </p>
                <p>
                  Por {output?.unitOfMeasure}:{" "}
                  <strong>
                    {money(cost / Number(draft.yieldQuantity || 1))}
                  </strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Custos cadastrais atuais. Não inclui mão de obra, perdas ou
                  despesas.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="flex-1 min-w-40">
                Insumo
                <select
                  aria-label="Insumo"
                  className="commerce-select"
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                >
                  <option value="">Selecione um insumo físico</option>
                  {inputs
                    .filter(
                      (p) =>
                        !draft.ingredients.some((i) => i.productId === p.id),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.unitOfMeasure}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                type="button"
                disabled={!choice}
                onClick={() => {
                  const p = inputs.find((p) => p.id === choice);
                  if (p) {
                    setDraft({
                      ...draft,
                      ingredients: [
                        ...draft.ingredients,
                        {
                          productId: p.id,
                          name: p.name,
                          unit: p.unitOfMeasure,
                          quantity: "1",
                        },
                      ],
                    });
                    setChoice("");
                  }
                }}
              >
                Adicionar insumo
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="commerce-table">
                <thead>
                  <tr>
                    <th>Insumo</th>
                    <th>Quantidade para o rendimento</th>
                    <th>Unidade</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.ingredients.map((i, index) => (
                    <tr key={i.productId}>
                      <td>
                        {products.find((p) => p.id === i.productId)?.name ||
                          i.name}
                      </td>
                      <td>
                        <Input
                          required
                          aria-label={"Quantidade de " + i.name}
                          type="number"
                          step="0.001"
                          min="0.001"
                          max="9999999.999"
                          value={i.quantity}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              ingredients: draft.ingredients.map((v, n) =>
                                n === index
                                  ? { ...v, quantity: e.target.value }
                                  : v,
                              ),
                            })
                          }
                        />
                      </td>
                      <td>{i.unit}</td>
                      <td>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              ingredients: draft.ingredients.filter(
                                (_, n) => n !== index,
                              ),
                            })
                          }
                        >
                          Remover insumo
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="block">
              Observações
              <textarea
                className="commerce-input w-full"
                maxLength="4000"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
            <p className="text-sm text-muted-foreground">
              Exemplo: rendimento de 10 unidades com 1 kg de carne consome 0,100
              kg por unidade vendida. Use até três casas decimais; frações
              menores são arredondadas para cima. Cada atendimento preserva a
              composição usada. Cancelamentos mantêm o consumo, salvo
              confirmação do gerente de que os insumos não foram usados.
            </p>
            {writable && (
              <Button disabled={!draft.ingredients.length}>
                Salvar ficha técnica
              </Button>
            )}
          </fieldset>
        </form>
      )}
      <div className="commerce-panel p-4">
        <h2 className="font-semibold">Fichas cadastradas</h2>
        <div className="divide-y">
          {state.data.map((r) => {
            const p = products.find((p) => p.id === r.productId);
            return (
              <button
                type="button"
                className="block w-full text-left py-3"
                key={r.productId}
                disabled={state.busy}
                onClick={() => choose(r.productId)}
              >
                {p?.name || "Produto"} ·{" "}
                {p?.recipeEnabled ? "Ativa" : "Desativada"} · rendimento{" "}
                {Number(r.yieldQuantity).toLocaleString("pt-BR")} {r.outputUnit}{" "}
                · {r.ingredients.length} insumos · revisão {r.revision}
              </button>
            );
          })}
          {!state.data.length && (
            <p className="py-3 text-sm">Nenhuma ficha cadastrada.</p>
          )}
        </div>
      </div>
    </div>
  );
}
