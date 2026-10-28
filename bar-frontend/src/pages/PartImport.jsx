import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { useRecords, money } from "../components/commerce/helpers";
import { Feedback } from "../components/commerce/shared";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
const normalized = (v) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export default function PartImport() {
  const state = useRecords("/part-imports"),
    [file, setFile] = useState(null),
    [encoding, setEncoding] = useState("utf-8"),
    [separator, setSeparator] = useState(";"),
    [source, setSource] = useState(""),
    [csv, setCsv] = useState(""),
    [headers, setHeaders] = useState([]),
    [fields, setFields] = useState({}),
    [mapping, setMapping] = useState({}),
    [batch, setBatch] = useState(null),
    [confirmed, setConfirmed] = useState(false);
  const reset = () => {
    setHeaders([]);
    setCsv("");
    setMapping({});
    setBatch(null);
    setConfirmed(false);
  };
  async function read(e) {
    e.preventDefault();
    await state.run(async () => {
      if (!file || file.size > 256 * 1024)
        throw Error("Selecione um arquivo CSV de até 256 KB");
      const value = new TextDecoder(encoding, { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      const { data } = await api.post("/part-imports/headers", {
        csv: value,
        separator,
      });
      setCsv(value);
      setHeaders(data.headers);
      setFields(data.fields);
      const initial = {};
      for (const [k, label] of Object.entries(data.fields)) {
        const index = data.headers.findIndex(
          (h) => normalized(h) === normalized(label),
        );
        if (index >= 0) initial[k] = index;
      }
      setMapping(initial);
      setBatch(null);
      setConfirmed(false);
    });
  }
  async function preview() {
    await state.run(async () => {
      const { data } = await api.post("/part-imports/preview", {
        csv,
        separator,
        mapping,
        filename: file.name,
        source,
      });
      setBatch(data);
      setConfirmed(false);
    });
  }
  async function commit() {
    await state.run(async () => {
      const { data } = await api.post(
        "/part-imports/" + batch.id + "/confirm",
        { digest: batch.digest, confirmed },
      );
      setBatch(data);
      setConfirmed(false);
    });
  }
  function template() {
    const blob = new Blob(
        [
          "\uFEFFNome;Fabricante;Referência;Código de barras;Categoria;Unidade;Custo;Preço;Marca do veículo;Modelo;Ano inicial;Ano final\nFiltro de demonstração;Fabricante exemplo;REF-EXEMPLO;;autopecas;unidade;0,00;0,00;;;;\n",
        ],
        { type: "text/csv;charset=utf-8" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "modelo-autopecas.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Importar catálogo de autopeças</h1>
      <p className="text-muted-foreground">
        Até 200 produtos por arquivo. Confira a fonte, mapeie as colunas e
        revise antes de importar.
      </p>
      <Link className="underline" to="/autoparts">
        Cadastro técnico de autopeças
      </Link>
      <Feedback state={state} />
      <p className="border rounded-lg p-3 text-sm">
        Os produtos entram inativos, com estoque zero. Preços e custos não
        mapeados ficam zerados. Não atualiza produtos existentes, não cria
        equivalências e não presume compatibilidade. Confira aplicações com o
        fabricante.
      </p>
      <form onSubmit={read} className="rounded-xl border bg-card p-4">
        <fieldset disabled={state.busy} className="space-y-3">
          <h2 className="font-semibold">1. Escolher arquivo</h2>
          <Button type="button" variant="outline" onClick={template}>
            Baixar modelo CSV
          </Button>
          <label className="block">
            Arquivo CSV
            <input
              className="block w-full p-2 border rounded"
              type="file"
              accept=".csv,text/csv,text/plain"
              required
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                reset();
              }}
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label>
              Codificação
              <select
                className="commerce-select"
                value={encoding}
                onChange={(e) => {
                  setEncoding(e.target.value);
                  reset();
                }}
              >
                <option value="utf-8">UTF-8</option>
                <option value="windows-1252">Windows-1252 / ANSI</option>
              </select>
            </label>
            <label>
              Separador
              <select
                className="commerce-select"
                value={separator}
                onChange={(e) => {
                  setSeparator(e.target.value);
                  reset();
                }}
              >
                <option value=";">Ponto e vírgula</option>
                <option value=",">Vírgula</option>
                <option value={"\t"}>Tabulação</option>
              </select>
            </label>
          </div>
          <Button>Ler arquivo</Button>
        </fieldset>
      </form>
      {!!headers.length && (
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="font-semibold">2. Mapear colunas</h2>
          <label className="block">
            Fonte do catálogo / fornecedor
            <Input
              value={source}
              maxLength={200}
              onChange={(e) => {
                setSource(e.target.value);
                setBatch(null);
              }}
              placeholder="Ex.: fornecedor e edição do catálogo"
            />
          </label>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(fields).map(([k, label]) => (
              <label key={k}>
                {label}
                {k === "name" ? " *" : ""}
                <select
                  className="commerce-select"
                  value={mapping[k] ?? ""}
                  onChange={(e) => {
                    const next = { ...mapping };
                    if (e.target.value === "") delete next[k];
                    else next[k] = Number(e.target.value);
                    setMapping(next);
                    setBatch(null);
                  }}
                >
                  <option value="">Não importar esta coluna</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="text-sm">
            Use uma linha por produto. Para uma aplicação, informe marca, modelo
            e os dois anos; outras aplicações podem ser cadastradas depois.
            Unidade: unidade, kg, litro, gramas, ml, metro, caixa ou par.
          </p>
          <Button
            disabled={
              state.busy || mapping.name === undefined || !source.trim()
            }
            onClick={preview}
          >
            Preparar prévia
          </Button>
        </section>
      )}
      {batch && (
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="font-semibold">
            3. Conferir prévia —{" "}
            {batch.status === "committed"
              ? "Importação concluída"
              : "Aguardando confirmação"}
          </h2>
          <p>
            {batch.filename} · Fonte: {batch.source} ·{" "}
            {batch.payload.rows.length} linhas
          </p>
          <div className="overflow-auto">
            <table className="commerce-table">
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Produto / referência</th>
                  <th>Custo / preço</th>
                  <th>Conferência</th>
                </tr>
              </thead>
              <tbody>
                {batch.payload.rows.map((r) => (
                  <tr key={r.line}>
                    <td>{r.line}</td>
                    <td>
                      {r.values?.product.name || "Inválido"}
                      <span className="block text-xs">
                        {r.values?.details.manufacturer} ·{" "}
                        {r.values?.details.partNumber}
                      </span>
                    </td>
                    <td>
                      {r.values
                        ? money(r.values.product.costPrice) +
                          " / " +
                          money(r.values.product.salePrice)
                        : "—"}
                    </td>
                    <td>
                      {r.errors.length ? (
                        <span className="text-red-800 dark:text-red-200">
                          {r.errors.join("; ")}
                        </span>
                      ) : r.values?.details.applications.length ? (
                        "Aplicação informada; conferir fonte"
                      ) : (
                        "Sem aplicação informada"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {batch.status === "preview" && (
            <>
              <label className="flex gap-2 items-start">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Conferi a fonte, as colunas, valores e aplicações. Importar
                produtos inativos com estoque zero.
              </label>
              <Button
                disabled={
                  state.busy ||
                  !confirmed ||
                  batch.payload.rows.some((r) => r.errors.length)
                }
                onClick={commit}
              >
                Confirmar importação
              </Button>
            </>
          )}
          {batch.status === "committed" && (
            <p role="status">
              {batch.result.count} produtos importados. Confira e ative em
              Produtos e serviços.
            </p>
          )}
        </section>
      )}
      <section className="space-y-3">
        <h2 className="font-semibold">Histórico das últimas 100 importações</h2>
        {state.data?.map((b) => (
          <article key={b.id} className="border rounded p-3">
            <p>
              {b.filename} · {b.source} ·{" "}
              {b.status === "committed"
                ? "Concluída: " + b.result.count + " produtos"
                : "Prévia"}{" "}
              · {new Date(b.createdAt).toLocaleString("pt-BR")}
            </p>
            <Button
              variant="link"
              onClick={() =>
                state.run(async () => {
                  setBatch((await api.get("/part-imports/" + b.id)).data);
                  setConfirmed(false);
                })
              }
            >
              Ver prévia guardada
            </Button>
          </article>
        ))}
      </section>
    </div>
  );
}
