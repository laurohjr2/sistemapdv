import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { money, labels, lineTotal, linesTotal } from "./helpers";
export function Feedback({ state }) {
  return (
    <>
      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-100"
        >
          {state.error}
          <Button variant="link" onClick={state.load}>
            Recarregar
          </Button>
        </div>
      )}
      {state.loading && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando dados...
        </p>
      )}
    </>
  );
}
export function Status({ value, overdue = false }) {
  return (
    <span
      className={
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium " +
        (overdue
          ? "bg-red-100 text-red-800"
          : value === "paid" || value === "converted" || value === "received"
            ? "bg-emerald-100 text-emerald-900"
            : "bg-muted text-foreground")
      }
    >
      {overdue ? "Vencida" : labels[value] || value}
    </span>
  );
}
export function Metric({ label, value, help }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {help && <p className="mt-1 text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
export function LineEditor({
  rows,
  onChange,
  products,
  purchase = false,
  canPriceEdit = true,
}) {
  const [choice, setChoice] = useState("");
  const field = purchase ? "unitCost" : "unitPrice";
  const options = products.filter(
    (p) =>
      p.active &&
      (!purchase || (p.itemType !== "service" && !p.recipeEnabled)) &&
      !rows.some((row) => row.productId === p.id),
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex-1 min-w-40 text-sm">
          {purchase ? "Produto para comprar" : "Produto ou serviço"}
          <select
            className="commerce-select"
            aria-label={purchase?"Produto para comprar":"Produto ou serviço"}
              value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            <option value="">Selecione um item</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.itemType === "service" ? " — Serviço" : ""}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          className="self-end"
          disabled={!choice}
          onClick={() => {
            const p = options.find((p) => p.id === choice);
            if (p) {
              onChange([
                ...rows,
                {
                  productId: p.id,
                  name: p.name,
                  itemType: p.itemType,
                  quantity: "1",
                  [field]: String(purchase ? p.costPrice : p.salePrice),
                },
              ]);
              setChoice("");
            }
          }}
        >
          Adicionar item
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="commerce-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantidade</th>
              <th>{purchase ? "Custo unitário" : "Preço unitário"}</th>
              <th>Total</th>
              <th>
                <span className="sr-only">Ação</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.productId}>
                <td>
                  {r.name}
                  <span className="block text-xs text-muted-foreground">
                    {r.itemType === "service" ? "Serviço" : "Produto"}
                  </span>
                </td>
                <td>
                  <Input
                    aria-label={"Quantidade de " + r.name}
                    className="min-w-24"
                    type="number"
                    min="0.001"
                    step="0.001"
                    required
                    value={r.quantity}
                    onChange={(e) =>
                      onChange(
                        rows.map((row, j) =>
                          i === j ? { ...row, quantity: e.target.value } : row,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <Input
                    aria-label={"Valor unitário de " + r.name}
                    className="min-w-28"
                    currency
                    readOnly={!canPriceEdit}
                    required
                    value={r[field]}
                    onChange={(e) =>
                      onChange(
                        rows.map((row, j) =>
                          i === j ? { ...row, [field]: e.target.value } : row,
                        ),
                      )
                    }
                  />
                </td>
                <td className="tabular-nums whitespace-nowrap">
                  {money(lineTotal(r))}
                </td>
                <td>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={"Remover " + r.name}
                    onClick={() => onChange(rows.filter((_, j) => i !== j))}
                  >
                    Remover
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="py-5 text-center text-muted-foreground text-sm">
            Adicione os itens para montar o documento.
          </p>
        )}
      </div>
      <p className="text-right font-semibold">
        Subtotal: {money(linesTotal(rows))}
      </p>
    </div>
  );
}
