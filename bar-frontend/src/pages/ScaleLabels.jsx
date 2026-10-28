import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Feedback } from "../components/commerce/shared";
import { useRecords, money } from "../components/commerce/helpers";
export default function ScaleLabels() {
  const { user } = useAuth(),
    writable =
      ["admin", "gerente"].includes(user?.role) &&
      (!user?.support || user?.master);
  const state = useRecords("/scale/products"),
    [config, setConfig] = useState(null),
    [presets, setPresets] = useState([]),
    [products, setProducts] = useState([]),
    [choice, setChoice] = useState(""),
    [plu, setPlu] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [code, setCode] = useState(""),
    [preview, setPreview] = useState(null),
    [selected, setSelected] = useState({}),
    [search, setSearch] = useState("");
  const { setError } = state;
  useEffect(() => {
    let active = true;
    Promise.all([api.get("/scale/settings"), api.get("/products")])
      .then(([c, p]) => {
        if (active) {
          setConfig(c.data);
          setPresets(c.data.presets);
          setProducts(p.data);
        }
      })
      .catch(() => {
        if (active)
          setError("Não foi possível carregar a configuração de etiquetas.");
      });
    return () => {
      active = false;
    };
  }, [setError]);
  async function refresh() {
    const [c, p] = await Promise.all([
      api.get("/scale/settings"),
      api.get("/products"),
    ]);
    setConfig(c.data);
    setPresets(c.data.presets);
    setProducts(p.data);
    setConfirmed(false);
    setPreview(null);
  }
  async function save(e) {
    e.preventDefault();
    await state.run(async () => {
      await api.put("/scale/settings", {
        ...config,
        priceConfirmed: confirmed,
      });
      await refresh();
    });
  }
  async function bind(e) {
    e.preventDefault();
    await state.run(async () => {
      await api.put("/scale/products/" + choice, {
        plu,
        revision: state.data.find((b) => b.productId === choice)?.revision || 0,
      });
      await refresh();
    });
  }
  async function test(e) {
    e.preventDefault();
    await state.run(async () => {
      setPreview(null);
      setPreview(
        (await api.post("/scale/scan", { barcode: code.trim() })).data,
      );
    });
  }
  async function labels(e) {
    e.preventDefault();
    await state.run(async () => {
      const items = Object.entries(selected)
        .filter(([, n]) => Number(n) > 0)
        .map(([id, n]) => ({
          productId: id,
          copies: Number(n),
          expectedPrice: products.find((p) => p.id === id)?.salePrice,
        }));
      const r = await api.post(
        "/scale/labels",
        { items },
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(r.data),
        a = document.createElement("a");
      a.href = url;
      a.download = "etiquetas-gondola.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  }
  const current = presets.find((p) => p.id === config?.preset),
    regular = products.filter((p) => p.active && p.itemType !== "service"),
    rows = regular.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()),
    );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="commerce-eyebrow">Mercado</p>
          <h1 className="text-3xl font-bold">Balanças e etiquetas</h1>
          <p className="text-muted-foreground">
            Leitura de etiquetas EAN-13 e impressão de preços de gôndola.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={state.busy}
          onClick={() => state.run(refresh)}
        >
          Recarregar configuração
        </Button>
      </div>
      <Feedback state={state} />
      <div className="rounded-lg border p-4 text-sm space-y-2">
        <p>
          Pré-configurações por formato de código, com PLU de 5 ou 6 dígitos. A
          marca da balança, sozinha, não define o formato gravado nela.
        </p>
        <p>
          O leitor do caixa deve enviar o código como teclado e finalizar com
          Enter. Não há conexão direta por USB/COM/rede com a balança nem carga
          automática de preços nesta etapa.
        </p>
        <p>
          Deixe a leitura desativada até conferir uma etiqueta real. Quando
          tiver o equipamento, selecione o formato, vincule os PLUs e teste a
          leitura abaixo.
        </p>
      </div>
      {config && (
        <form onSubmit={save} className="commerce-panel p-4 space-y-4">
          <h2 className="font-semibold">Formato da etiqueta</h2>
          <fieldset disabled={!writable || state.busy} className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) =>
                  setConfig({ ...config, enabled: e.target.checked })
                }
              />
              Ativar leitura de etiquetas da balança
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label>
                Pré-configuração
                <select
                  className="commerce-select"
                  aria-label="Pré-configuração"
                  value={config.preset}
                  onChange={(e) => {
                    const preset = presets.find((p) => p.id === e.target.value);
                    setConfig({
                      ...config,
                      preset: preset.id,
                      prefix: preset.prefix,
                    });
                    setConfirmed(false);
                  }}
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prefixo interno
                <Input
                  required
                  maxLength={current?.codeLength === 5 ? 2 : 1}
                  value={config.prefix}
                  onChange={(e) =>
                    setConfig({ ...config, prefix: e.target.value })
                  }
                />
              </label>
            </div>
            <p className="text-sm">
              Estrutura:{" "}
              {current?.codeLength === 5
                ? "2 dígitos de prefixo + 5 de PLU"
                : "1 dígito de prefixo + 6 de PLU"}{" "}
              + 5 de{" "}
              {current?.mode === "weight"
                ? "peso em gramas"
                : "preço em centavos"}{" "}
              + verificador EAN-13. Prefixo reservado para uso interno:{" "}
              {current?.codeLength === 5 ? "20 a 29" : "2"}.
            </p>
            {current?.mode === "price" && (
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-sm">
                  O peso será calculado a partir do preço total e do preço/kg.
                  Um preço diferente na balança produz peso incorreto. Após
                  alterar o preço do produto, atualize a balança e salve
                  novamente seu vínculo do PLU.
                </p>
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  Confirmo que o preço/kg dos produtos vinculados está
                  sincronizado com a balança.
                </label>
              </div>
            )}
            {writable && <Button>Salvar formato</Button>}
          </fieldset>
        </form>
      )}
      <div className="commerce-panel p-4 space-y-3">
        <h2 className="font-semibold">PLUs dos produtos por kg</h2>
        <p className="text-sm text-muted-foreground">
          Vincule o código usado na balança ao produto existente. Não altera o
          estoque nem o código de barras comum do produto.
        </p>
        {writable && (
          <form onSubmit={bind}>
            <fieldset
              disabled={state.busy}
              className="flex flex-wrap gap-3 items-end"
            >
              <label className="flex-1 min-w-40">
                Produto por kg
                <select
                  required
                  className="commerce-select"
                  aria-label="Produto por kg"
                  value={choice}
                  onChange={(e) => {
                    setChoice(e.target.value);
                    setPlu(
                      String(
                        state.data.find((b) => b.productId === e.target.value)
                          ?.plu || "",
                      ),
                    );
                  }}
                >
                  <option value="">Selecione um produto ativo</option>
                  {regular
                    .filter((p) => p.unitOfMeasure === "kg")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {money(p.salePrice)}/kg
                      </option>
                    ))}
                </select>
              </label>
              <label>
                PLU
                <Input
                  required
                  inputMode="numeric"
                  maxLength={current?.codeLength || 5}
                  value={plu}
                  onChange={(e) => setPlu(e.target.value)}
                />
              </label>
              <Button disabled={!choice}>
                Salvar vínculo / preço conferido
              </Button>
            </fieldset>
          </form>
        )}
        <div className="overflow-x-auto">
          <table className="commerce-table">
            <thead>
              <tr>
                <th>PLU</th>
                <th>Produto</th>
                <th>Preço/kg conferido</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((b) => (
                <tr key={b.productId}>
                  <td>
                    {String(b.plu).padStart(current?.codeLength || 5, "0")}
                  </td>
                  <td>
                    {products.find((p) => p.id === b.productId)?.name ||
                      "Produto"}
                  </td>
                  <td>{money(b.unitPriceSnapshot)}</td>
                  <td>
                    {writable && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          state.run(async () => {
                            await api.delete("/scale/products/" + b.productId);
                            if (choice === b.productId) {
                              setChoice("");
                              setPlu("");
                            }
                          })
                        }
                      >
                        Remover vínculo
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!state.data.length && (
            <p className="text-sm py-3">Nenhum PLU vinculado.</p>
          )}
        </div>
      </div>
      {(!user?.support || user?.master) && (
        <form onSubmit={test} className="commerce-panel p-4 space-y-3">
          <h2 className="font-semibold">Testar uma etiqueta</h2>
          <label className="block">
            Código da etiqueta
            <Input
              required
              maxLength={50}
              inputMode="numeric"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <Button disabled={state.busy}>Conferir leitura</Button>
          {preview && (
            <div role="status" className="border rounded p-3">
              {preview.kind === "regular" ? (
                `Código comum: ${products.find((p) => p.id === preview.productId)?.name || "Produto"}`
              ) : (
                <>
                  <p>
                    {preview.productName} · PLU {preview.plu}
                  </p>
                  <p>
                    {preview.quantity.toLocaleString("pt-BR", {
                      minimumFractionDigits: 3,
                    })}{" "}
                    kg × {money(preview.unitPrice)}/kg = {money(preview.total)}
                  </p>
                </>
              )}
            </div>
          )}
        </form>
      )}
      {writable && (
        <form onSubmit={labels} className="commerce-panel p-4 space-y-4">
          <h2 className="font-semibold">Etiquetas de gôndola</h2>
          <p className="text-sm text-muted-foreground">
            PDF A4 com etiquetas de 90 × 60 mm, oito por página. Imprima em
            tamanho real, 100%, sem ajustar à página. As barras são geradas
            apenas para códigos EAN-13 válidos já cadastrados; outros códigos
            aparecem como texto.
          </p>
          <Input
            aria-label="Buscar produtos para etiquetas"
            placeholder="Buscar produto"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-80 overflow-auto">
            <table className="commerce-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Preço</th>
                  <th>Quantidade de etiquetas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      <p className="text-xs">
                        {p.barcode || "Sem código cadastrado"}
                      </p>
                    </td>
                    <td>
                      {money(p.salePrice)} / {p.unitOfMeasure}
                    </td>
                    <td>
                      <Input
                        aria-label={"Etiquetas de " + p.name}
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={selected[p.id] || ""}
                        onChange={(e) =>
                          setSelected({ ...selected, [p.id]: e.target.value })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm">
            Até 200 etiquetas por arquivo. Confira o PDF e o preço antes de
            colocar na gôndola.
          </p>
          <Button
            disabled={
              state.busy || !Object.values(selected).some((n) => Number(n) > 0)
            }
          >
            Gerar PDF de etiquetas
          </Button>
        </form>
      )}
    </div>
  );
}
