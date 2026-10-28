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
import { Feedback, Metric } from "../components/commerce/shared";
import { useRecords, downloadPdf } from "../components/commerce/helpers";
const labels = {
  pending: "Identificação pendente",
  expired: "Vencido",
  soon: "Vence em até 30 dias",
  valid: "Válido",
};
export default function Market() {
  const state = useRecords("/market/lots"),
    { user } = useAuth(),
    writable =
      ["admin", "gerente"].includes(user?.role) &&
      (!user?.support || user?.master);
  const [products, setProducts] = useState([]),
    [choice, setChoice] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [action, setAction] = useState(null),
    [amount, setAmount] = useState(""),
    [batch, setBatch] = useState(""),
    [expiry, setExpiry] = useState(""),
    [note, setNote] = useState("");
  const { setError } = state;
  useEffect(() => {
    api
      .get("/market/products")
      .then((r) => setProducts(r.data))
      .catch(() => setError("Não foi possível carregar os produtos."));
  }, [setError]);
  async function refresh() {
    setProducts((await api.get("/market/products")).data);
  }
  function prepare(kind, lot) {
    setAction({ kind, lot });
    setAmount(String(lot?.quantity || ""));
    setBatch("");
    setExpiry("");
    setNote("");
  }
  async function confirm(e) {
    e.preventDefault();
    await state.run(async () => {
      if (action.kind === "control") {
        const p = products.find((p) => p.id === choice);
        await api.post(`/market/products/${p.id}/control`, {
          enabled: !p.lotTracked,
        });
      } else
        await api.post(`/market/lots/${action.lot.id}/${action.kind}`, {
          revision: action.lot.revision,
          quantity: amount,
          batchNumber: batch,
          expirationDate: expiry,
          note,
        });
      await refresh();
      setAction(null);
    });
  }
  const positive = state.data.filter((l) => Number(l.quantity) > 0),
    rows = positive.filter(
      (l) =>
        (!filter || l.status === filter) &&
        `${l.product.name} ${l.batchNumber || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <p className="commerce-eyebrow">Mercado e estoque</p>
          <h1 className="text-3xl font-bold">Lotes e validade</h1>
          <p className="text-muted-foreground">
            Conferência, identificação e retirada de produtos do estoque.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => state.run(refresh)}
            disabled={state.busy}
          >
            Atualizar
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              state.run(() =>
                downloadPdf("/market/report", "lotes-validade.pdf"),
              )
            }
          >
            Imprimir / PDF
          </Button>
        </div>
      </div>
      <Feedback state={state} />
      <div className="grid sm:grid-cols-3 gap-3">
        {["expired", "soon", "pending"].map((status) => (
          <Metric
            key={status}
            label={labels[status]}
            value={positive.filter((l) => l.status === status).length}
            help="Lotes com saldo"
          />
        ))}
      </div>
      <div className="rounded-lg border p-4 space-y-2 text-sm">
        <p>
          Nas vendas, os lotes válidos com vencimento mais próximo são baixados
          primeiro. Separe fisicamente o mesmo lote na prateleira.
        </p>
        <p>
          Saldos antigos, entradas sem lote e devoluções aguardam identificação.
          Vencidos e pendentes não ficam disponíveis para venda em produtos
          controlados.
        </p>
        <Link className="underline" to="/stock">
          Registrar entrada de estoque com lote e validade
        </Link>
      </div>
      {writable && (
        <div className="commerce-panel p-4 space-y-3">
          <h2 className="font-semibold">Controle por produto</h2>
          <p className="text-sm text-muted-foreground">
            Ative apenas nos produtos que terão lote e validade conferidos. O
            saldo existente ficará pendente, sem alterar o total. Para
            desativar, o saldo deve estar zerado.
          </p>
          <div className="flex flex-wrap gap-2">
            <select
              className="commerce-select flex-1 min-w-40"
              aria-label="Produto para controle"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">Escolha um produto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.lotTracked ? "Controlado" : "Sem controle"} —
                  Saldo: {Number(p.currentStock).toLocaleString("pt-BR")}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              disabled={!choice || state.busy}
              onClick={() => prepare("control")}
            >
              {products.find((p) => p.id === choice)?.lotTracked
                ? "Desativar controle"
                : "Ativar controle"}
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Input
          className="sm:max-w-sm"
          aria-label="Buscar produto ou lote"
          placeholder="Buscar produto ou lote"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="commerce-select sm:max-w-xs"
          aria-label="Situação do lote"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Todas as situações</option>
          {Object.entries(labels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="commerce-panel overflow-x-auto">
        <table className="commerce-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Lote</th>
              <th>Validade</th>
              <th>Saldo</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td>
                  <strong>{l.product.name}</strong>
                  {!l.product.active && <p>Produto inativo</p>}
                </td>
                <td>
                  {l.batchNumber ||
                    (l.kind === "return"
                      ? "Devolução para conferência"
                      : "Sem lote informado")}
                </td>
                <td>
                  {l.expirationDate?.split("-").reverse().join("/") ||
                    "Não informada"}
                </td>
                <td>
                  {Number(l.quantity).toLocaleString("pt-BR")}{" "}
                  {l.product.unitOfMeasure}
                </td>
                <td>
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${l.status === "expired" ? "bg-red-100 text-red-900" : l.status === "pending" || l.status === "soon" ? "bg-amber-100 text-amber-900" : "bg-muted"}`}
                  >
                    {labels[l.status]}
                  </span>
                </td>
                <td>
                  {writable && l.product.lotTracked && (
                    <div className="flex flex-wrap gap-2">
                      {l.status === "pending" && (
                        <Button
                          variant="outline"
                          onClick={() => prepare("identify", l)}
                        >
                          Identificar saldo
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => prepare("discard", l)}
                      >
                        Registrar baixa
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!state.loading && !rows.length && (
          <p className="commerce-empty">
            Nenhum lote com saldo encontrado. Ative o controle de um produto
            para começar.
          </p>
        )}
      </div>
      <Dialog
        open={Boolean(action)}
        onOpenChange={(open) => {
          if (!open && !state.busy) setAction(null);
        }}
      >
        <DialogContent className="grid-cols-1 sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {action?.kind === "control"
                ? "Alterar controle por lote"
                : action?.kind === "identify"
                  ? "Identificar saldo pendente"
                  : "Registrar baixa do lote"}
            </DialogTitle>
            <DialogDescription>
              {action?.lot?.product.name ||
                products.find((p) => p.id === choice)?.name}
            </DialogDescription>
          </DialogHeader>
          {state.error && (
            <p role="alert" className="text-destructive">
              {state.error} Feche e atualize a lista para conferir o saldo.
            </p>
          )}
          <form onSubmit={confirm}>
            <fieldset disabled={state.busy} className="space-y-3">
              {action?.kind === "control" ? (
                <p>
                  Ao ativar, o estoque atual ficará pendente de identificação.
                  Nenhuma quantidade será adicionada. A desativação exige saldo
                  zerado e preserva o histórico.
                </p>
              ) : (
                <>
                  <p>
                    Saldo disponível neste lote: {action?.lot.quantity}{" "}
                    {action?.lot.product.unitOfMeasure}
                  </p>
                  <label className="block">
                    Quantidade
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  {action?.kind === "identify" && (
                    <>
                      <label className="block">
                        Número do lote
                        <Input
                          required
                          maxLength={100}
                          value={batch}
                          onChange={(e) => setBatch(e.target.value)}
                        />
                      </label>
                      <label className="block">
                        Data de validade
                        <Input
                          type="date"
                          required
                          value={expiry}
                          onChange={(e) => setExpiry(e.target.value)}
                        />
                      </label>
                      <p className="text-sm">
                        Confira a embalagem e identifique somente o saldo
                        realmente conferido. A identificação não altera o total
                        de estoque.
                      </p>
                    </>
                  )}
                  <label className="block">
                    Justificativa
                    <Input
                      required
                      maxLength={2000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  {action?.kind === "discard" && (
                    <p className="text-sm">
                      Esta ação retira a quantidade do lote e do estoque total.
                      Use para vencimento, perda ou descarte confirmado.
                    </p>
                  )}
                </>
              )}
              <Button>Confirmar</Button>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
