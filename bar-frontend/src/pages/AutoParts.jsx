import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import { useRecords, money } from "../components/commerce/helpers";
const emptyFilters = {
  search: "",
  brand: "",
  model: "",
  year: "",
  engine: "",
  version: "",
  active: "true",
};
const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export default function AutoParts() {
  const { user } = useAuth();
  const writable =
    ["admin", "gerente"].includes(user?.role) &&
    (!user?.support || user?.master);
  const [filters, setFilters] = useState(emptyFilters),
    [query, setQuery] = useState(emptyFilters),
    [products, setProducts] = useState([]),
    [selected, setSelected] = useState(null),
    [form, setForm] = useState(null),
    [choice, setChoice] = useState(""),
    [equivalent, setEquivalent] = useState(""),
    [reason, setReason] = useState(""),
    [remove, setRemove] = useState(null);
  const state = useRecords("/autoparts/catalog?" + new URLSearchParams(query));
  const { setError } = state;
  useEffect(() => {
    let active = true;
    api
      .get("/products")
      .then((r) => {
        if (active) setProducts(r.data.filter((p) => p.itemType !== "service"));
      })
      .catch(() => {
        if (active)
          setError(
            "Não foi possível carregar os produtos. Recarregue a página.",
          );
      });
    return () => {
      active = false;
    };
  }, [setError]);
  async function refreshProducts() {
    setProducts(
      (await api.get("/products")).data.filter((p) => p.itemType !== "service"),
    );
  }
  async function open(id) {
    await state.run(async () => {
      setSelected((await api.get("/autoparts/parts/" + id)).data);
      setEquivalent("");
      setReason("");
    });
  }
  function edit(part) {
    const d = part.partDetails || {};
    setSelected(null);
    setForm({
      productId: part.id,
      name: part.name,
      manufacturer: d.manufacturer || "",
      partNumber: d.partNumber || "",
      originalCodes: (d.originalCodes || []).join("\n"),
      applications: structuredClone(d.applications || []),
      notes: d.notes || "",
      revision: d.revision || 0,
    });
  }
  async function save(e) {
    e.preventDefault();
    await state.run(async () => {
      await api.put("/autoparts/parts/" + form.productId, {
        ...form,
        originalCodes: form.originalCodes
          .split(/\r?\n/)
          .map((c) => c.trim())
          .filter(Boolean),
      });
      const id = form.productId;
      setForm(null);
      await refreshProducts();
      setSelected((await api.get("/autoparts/parts/" + id)).data);
    });
  }
  async function addEquivalent(e) {
    e.preventDefault();
    await state.run(async () => {
      await api.post("/autoparts/equivalences", {
        productId: selected.id,
        equivalentId: equivalent,
        note: reason,
      });
      setSelected((await api.get("/autoparts/parts/" + selected.id)).data);
      setEquivalent("");
      setReason("");
    });
  }
  async function deleteEquivalent() {
    await state.run(async () => {
      await api.delete(
        `/autoparts/equivalences/${selected.id}/${remove.productId}`,
      );
      setSelected((await api.get("/autoparts/parts/" + selected.id)).data);
      setRemove(null);
    });
  }
  const applications = products.flatMap(
    (p) => p.partDetails?.applications || [],
  );
  const options = (key) =>
    [
      ...new Set(
        applications
          .filter(
            (a) =>
              !filters.brand || normalize(a.brand) === normalize(filters.brand),
          )
          .map((a) => a[key])
          .filter(Boolean),
      ),
    ].sort();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <p className="commerce-eyebrow">Cadastros e estoque</p>
          <h1 className="text-3xl font-bold">Autopeças</h1>
          <p className="text-muted-foreground">
            Referências, aplicações por veículo e equivalências cadastradas.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={state.busy}
          onClick={() =>
            state.run(async () => {
              await refreshProducts();
              if (selected)
                setSelected(
                  (await api.get("/autoparts/parts/" + selected.id)).data,
                );
            })
          }
        >
          Atualizar
        </Button>
      </div>
      <Feedback state={state} />
      <form
        className="commerce-panel p-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ ...filters });
        }}
      >
        <label className="block">
          Produto, fabricante ou código
          <Input
            aria-label="Buscar referência"
            placeholder="Nome, referência, código original ou código de barras"
            maxLength={200}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </label>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ["brand", "Marca do veículo"],
            ["model", "Modelo"],
            ["year", "Ano"],
            ["engine", "Motorização"],
            ["version", "Versão"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <Input
                aria-label={label}
                list={key === "year" ? undefined : "filter-" + key}
                type={key === "year" ? "number" : "text"}
                min="1900"
                max="2100"
                maxLength={100}
                value={filters[key]}
                onChange={(e) =>
                  setFilters({ ...filters, [key]: e.target.value })
                }
              />
              {key !== "year" && (
                <datalist id={"filter-" + key}>
                  {options(key).map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              )}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Os dados do veículo devem corresponder à mesma aplicação cadastrada.
          Campos de motor ou versão não informados no cadastro não confirmam
          compatibilidade.
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.active === ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  active: e.target.checked ? "" : "true",
                })
              }
            />
            Incluir inativos
          </label>
          <Button>Buscar peças</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFilters(emptyFilters);
              setQuery(emptyFilters);
            }}
          >
            Limpar filtros
          </Button>
          <span role="status" className="text-sm">
            {state.data.length} produtos encontrados
          </span>
        </div>
      </form>
      {writable && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="font-medium">Complementar um produto cadastrado</p>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Produto para cadastro técnico"
              className="commerce-select flex-1 min-w-44"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">Selecione um produto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.active ? "" : " — Inativo"}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              disabled={!choice || state.busy}
              onClick={() =>
                state.run(async () =>
                  edit((await api.get("/autoparts/parts/" + choice)).data),
                )
              }
            >
              Editar cadastro técnico
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Cadastre o produto em{" "}
            <Link to="/products" className="underline">
              Produtos e serviços
            </Link>{" "}
            antes de incluir suas referências. Preços e estoque continuam nesse
            cadastro.
          </p>
        </div>
      )}
      <div className="commerce-panel overflow-x-auto">
        <table className="commerce-table">
          <thead>
            <tr>
              <th>Produto / fabricante</th>
              <th>Referências</th>
              <th>Aplicações</th>
              <th>Preço / estoque</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {state.data.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                  <p>
                    {p.partDetails?.manufacturer || "Fabricante não informado"}
                  </p>
                  {!p.active && <span className="text-xs">Inativo</span>}
                </td>
                <td>
                  {p.partDetails?.partNumber || "Sem referência"}
                  <p className="text-xs">
                    {p.partDetails?.originalCodes.join(" · ")}
                  </p>
                </td>
                <td>
                  {p.partDetails?.applications.length || 0} cadastradas
                  <p className="text-xs">
                    {p.equivalents.length} equivalentes diretos
                  </p>
                </td>
                <td>
                  {money(p.salePrice)}
                  <p>
                    {Number(p.currentStock).toLocaleString("pt-BR")}{" "}
                    {p.unitOfMeasure}
                  </p>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => open(p.id)}>
                      Ver aplicações
                    </Button>
                    {writable && (
                      <Button variant="outline" onClick={() => edit(p)}>
                        Editar
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!state.loading && !state.data.length && (
          <p className="commerce-empty">
            Nenhum produto encontrado com os filtros informados. Confira as
            referências e aplicações cadastradas.
          </p>
        )}
      </div>
      <Dialog
        open={Boolean(form)}
        onOpenChange={(open) => {
          if (!open && !state.busy) setForm(null);
        }}
      >
        <DialogContent className="grid-cols-1 sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastro técnico da peça</DialogTitle>
            <DialogDescription>
              {form?.name} · Confira as informações no catálogo do fabricante
              antes de salvar.
            </DialogDescription>
          </DialogHeader>
          {state.error && (
            <p role="alert" className="text-destructive">
              {state.error} Feche e reabra para carregar a revisão atual.
            </p>
          )}
          {form && (
            <form onSubmit={save}>
              <fieldset disabled={state.busy} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <label>
                    Fabricante da peça
                    <Input
                      maxLength={100}
                      value={form.manufacturer}
                      onChange={(e) =>
                        setForm({ ...form, manufacturer: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Referência do fabricante
                    <Input
                      maxLength={100}
                      value={form.partNumber}
                      onChange={(e) =>
                        setForm({ ...form, partNumber: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label className="block">
                  Códigos originais (um por linha)
                  <textarea
                    aria-label="Códigos originais (um por linha)"
                    className="commerce-select min-h-20"
                    value={form.originalCodes}
                    onChange={(e) =>
                      setForm({ ...form, originalCodes: e.target.value })
                    }
                  />
                </label>
                <h3 className="font-semibold">Aplicações por veículo</h3>
                {form.applications.map((a, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-3">
                    <div className="flex justify-between items-center">
                      <strong>Aplicação {i + 1}</strong>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setForm({
                            ...form,
                            applications: form.applications.filter(
                              (_, n) => n !== i,
                            ),
                          })
                        }
                      >
                        Remover aplicação {i + 1}
                      </Button>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                        ["brand", "Marca do veículo"],
                        ["model", "Modelo"],
                        ["yearFrom", "Ano inicial"],
                        ["yearTo", "Ano final"],
                        ["engine", "Motorização"],
                        ["version", "Versão"],
                      ].map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <Input
                            aria-label={`${label} da aplicação ${i + 1}`}
                            required={[
                              "brand",
                              "model",
                              "yearFrom",
                              "yearTo",
                            ].includes(key)}
                            maxLength={100}
                            type={key.startsWith("year") ? "number" : "text"}
                            min="1900"
                            max="2100"
                            step="1"
                            value={a[key]}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                applications: form.applications.map((row, n) =>
                                  n === i
                                    ? { ...row, [key]: e.target.value }
                                    : row,
                                ),
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <label className="block">
                      Observações da aplicação {i + 1}
                      <Input
                        maxLength={1000}
                        value={a.notes}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            applications: form.applications.map((row, n) =>
                              n === i ? { ...row, notes: e.target.value } : row,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={form.applications.length >= 200}
                  onClick={() =>
                    setForm({
                      ...form,
                      applications: [
                        ...form.applications,
                        {
                          brand: "",
                          model: "",
                          yearFrom: "",
                          yearTo: "",
                          engine: "",
                          version: "",
                          notes: "",
                        },
                      ],
                    })
                  }
                >
                  Adicionar aplicação
                </Button>
                <label className="block">
                  Observações técnicas
                  <textarea
                    aria-label="Observações técnicas"
                    className="commerce-select min-h-20"
                    maxLength={4000}
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </label>
                <Button>Salvar cadastro técnico</Button>
              </fieldset>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selected) && !remove}
        onOpenChange={(open) => {
          if (!open && !state.busy) setSelected(null);
        }}
      >
        <DialogContent className="grid-cols-1 sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aplicações e equivalências</DialogTitle>
            <DialogDescription>{selected?.name}</DialogDescription>
          </DialogHeader>
          {state.error && (
            <p role="alert" className="text-destructive">
              {state.error}
            </p>
          )}
          {selected && (
            <div className="space-y-4">
              <p>
                <strong>Fabricante:</strong>{" "}
                {selected.partDetails?.manufacturer || "Não informado"} ·{" "}
                <strong>Referência:</strong>{" "}
                {selected.partDetails?.partNumber || "Não informada"}
              </p>
              <p>
                Códigos originais:{" "}
                {selected.partDetails?.originalCodes.join(" · ") ||
                  "Não informados"}
              </p>
              <p>
                {money(selected.salePrice)} · Estoque:{" "}
                {Number(selected.currentStock).toLocaleString("pt-BR")}{" "}
                {selected.unitOfMeasure}
                {!selected.active ? " · Inativo" : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                Compatibilidade informada pela empresa. Confirme motor, versão,
                medidas e referência antes da venda ou instalação.
              </p>
              <h3 className="font-semibold">Aplicações cadastradas</h3>
              {selected.partDetails?.applications.map((a, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <p className="font-medium">
                    {a.brand} {a.model} · {a.yearFrom} a {a.yearTo}
                  </p>
                  <p>
                    Motor: {a.engine || "Não informado"} · Versão:{" "}
                    {a.version || "Não informada"}
                  </p>
                  <p>{a.notes}</p>
                </div>
              ))}
              {!selected.partDetails?.applications.length && (
                <p className="text-sm">
                  Nenhuma aplicação cadastrada. A ausência de aplicação não
                  confirma que a peça serve em todos os veículos.
                </p>
              )}
              <p>{selected.partDetails?.notes}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={state.busy}
                  onClick={() => open(selected.id)}
                >
                  Recarregar peça
                </Button>
                {writable && (
                  <Button onClick={() => edit(selected)}>
                    Editar cadastro técnico
                  </Button>
                )}
                {selected.active && (
                  <Button asChild variant="outline">
                    <Link
                      to={"/sales?search=" + encodeURIComponent(selected.name)}
                    >
                      Localizar em Vendas
                    </Link>
                  </Button>
                )}
              </div>
              <h3 className="font-semibold">Equivalentes diretos</h3>
              <p className="text-sm text-muted-foreground">
                Relações cadastradas individualmente. Uma equivalência não
                transfere as aplicações de outro produto.
              </p>
              {selected.equivalents.map((eq) => (
                <div
                  key={eq.productId}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <p className="font-medium">
                    {eq.name}
                    {eq.active ? "" : " · Inativo"}
                  </p>
                  <p>
                    {eq.manufacturer} {eq.partNumber} · {money(eq.salePrice)} ·
                    Estoque: {Number(eq.currentStock).toLocaleString("pt-BR")}
                  </p>
                  <p>{eq.note}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => open(eq.productId)}
                    >
                      Ver peça equivalente
                    </Button>
                    {writable && (
                      <Button variant="ghost" onClick={() => setRemove(eq)}>
                        Remover equivalência
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {!selected.equivalents.length && (
                <p className="text-sm">Nenhuma equivalência cadastrada.</p>
              )}
              {writable && selected.active && (
                <form
                  onSubmit={addEquivalent}
                  className="border-t pt-4 space-y-3"
                >
                  <label className="block">
                    Produto equivalente
                    <select
                      className="commerce-select"
                      aria-label="Produto equivalente"
                      required
                      value={equivalent}
                      onChange={(e) => setEquivalent(e.target.value)}
                    >
                      <option value="">Selecione outro produto ativo</option>
                      {products
                        .filter(
                          (p) =>
                            p.active &&
                            p.id !== selected.id &&
                            !selected.equivalents.some(
                              (eq) => eq.productId === p.id,
                            ),
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block">
                    Justificativa da equivalência
                    <Input
                      required
                      maxLength={1000}
                      placeholder="Ex.: referência cruzada conferida no catálogo do fabricante"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <Button disabled={state.busy}>Relacionar equivalente</Button>
                </form>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(remove)}
        onOpenChange={(open) => {
          if (!open && !state.busy) setRemove(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover equivalência?</DialogTitle>
            <DialogDescription>
              {selected?.name} ↔ {remove?.name}. A relação será removida dos
              dois produtos.
            </DialogDescription>
          </DialogHeader>
          {state.error && (
            <p role="alert" className="text-destructive">
              {state.error}
            </p>
          )}
          <Button
            variant="destructive"
            disabled={state.busy}
            onClick={deleteEquivalent}
          >
            Confirmar remoção
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
