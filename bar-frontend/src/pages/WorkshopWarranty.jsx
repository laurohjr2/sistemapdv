import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import api from "../lib/api";
import { useRecords, downloadPdf } from "../components/commerce/helpers";
import { Feedback } from "../components/commerce/shared";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
const labels = {
  open: "Em análise",
  accepted: "Aceito",
  rejected: "Recusado",
  completed: "Concluído",
};
export default function WorkshopWarranty() {
  const state = useRecords("/workshop-warranty"),
    orders = useRecords("/workshop/orders"),
    { user } = useAuth(),
    manager =
      ["admin", "gerente"].includes(user?.role) &&
      (!user?.support || user?.master);
  const [form, setForm] = useState(null),
    [action, setAction] = useState(null),
    [note, setNote] = useState(""),
    [km, setKm] = useState(""),
    [orderId, setOrderId] = useState("");
  const warranties = state.data?.warranties || [],
    returns = state.data?.returns || [],
    set = (k, v) => setForm({ ...form, [k]: v });
  async function issue(e) {
    e.preventDefault();
    if (await state.run(() => api.post("/workshop-warranty", form)))
      setForm(null);
  }
  async function act(e) {
    e.preventDefault();
    const base = "/workshop-warranty/",
      a = action;
    const path =
      a.kind === "return"
        ? a.record.id + "/returns"
        : a.kind === "void"
          ? a.record.id + "/void"
          : "returns/" +
            a.record.id +
            "/" +
            (a.kind === "order" ? "order" : "status");
    if (
      await state.run(() =>
        api.post(base + path, {
          revision: a.record.revision,
          reason: note,
          note,
          status: a.status,
          mileage: km,
          orderId,
        }),
      )
    )
      setAction(null);
  }
  const open = (kind, record, status) => {
    setAction({ kind, record, status });
    setNote("");
    setKm(String(record.snapshot?.mileage || ""));
    setOrderId("");
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Garantias e retornos</h1>
          <p className="text-muted-foreground">
            Condições informadas pelo estabelecimento e análise de retornos da
            oficina.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={state.load}>
            Atualizar garantias
          </Button>
          {manager && (
            <Button
              onClick={() =>
                setForm({
                  orderId: "",
                  expiresOn: "",
                  mileageLimit: "",
                  terms: "",
                })
              }
            >
              Registrar garantia
            </Button>
          )}
        </div>
      </div>
      <Link className="underline" to="/workshop">
        Ordens de serviço
      </Link>
      <Feedback state={state} />
      <Feedback state={orders} />
      <p className="rounded-lg border p-3 text-sm">
        Prazo e km auxiliam a análise. O sistema permite registrar retorno fora
        desses limites e exige parecer da gerência. Este cadastro não substitui
        os direitos legais do consumidor e não gera cobrança ou baixa de
        estoque.
      </p>
      {warranties.map((w) => (
        <article key={w.id} className="border rounded-xl bg-card p-4 space-y-3">
          <strong>
            OS #{w.snapshot.number} · {w.snapshot.vehicle.plate} ·{" "}
            {w.snapshot.customer.name}
          </strong>
          <p>
            Entrega: {w.startsOn} · Prazo informado: {w.expiresOn} · Limite de
            km: {w.mileageLimit ?? "Não informado"}
            {w.voidedAt ? " · Registro cancelado" : ""}
          </p>
          <p className="whitespace-pre-wrap">{w.terms}</p>
          {w.voidedAt && <p>Motivo: {w.voidReason}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                state.run(() =>
                  downloadPdf(
                    "/workshop-warranty/" + w.id + "/pdf",
                    "garantia-os-" + w.snapshot.number + ".pdf",
                  ),
                )
              }
            >
              Imprimir garantia e retornos
            </Button>
            {manager && !w.voidedAt && (
              <>
                <Button onClick={() => open("return", w)}>
                  Registrar retorno
                </Button>
                <Button variant="outline" onClick={() => open("void", w)}>
                  Cancelar registro de garantia
                </Button>
              </>
            )}
          </div>
          {returns
            .filter((r) => r.warrantyId === w.id)
            .map((r) => (
              <div key={r.id} className="rounded-lg border p-3 space-y-2">
                <strong>Retorno: {labels[r.status]}</strong>
                <p>
                  {r.receivedOn} · {r.mileage} km
                </p>
                <p>{r.reason}</p>
                <p
                  className={
                    !r.eligibility.withinDate || !r.eligibility.withinMileage
                      ? "font-semibold text-red-800 dark:text-red-200"
                      : "text-sm"
                  }
                >
                  Prazo: {r.eligibility.withinDate ? "Dentro" : "Fora"} ·
                  Quilometragem:{" "}
                  {r.eligibility.withinMileage ? "Dentro" : "Fora"}
                </p>
                {r.orderId && (
                  <p>
                    OS do retorno: #
                    {orders.data?.find((o) => o.id === r.orderId)?.number ||
                      "—"}
                  </p>
                )}
                {manager && (
                  <div className="flex flex-wrap gap-2">
                    {(r.status === "open"
                      ? ["accepted", "rejected"]
                      : r.status === "accepted"
                        ? ["completed"]
                        : []
                    ).map((status) => (
                      <Button
                        variant="outline"
                        key={status}
                        onClick={() => open("status", r, status)}
                      >
                        {labels[status]}
                      </Button>
                    ))}
                    {r.status === "accepted" && !r.orderId && (
                      <Button
                        variant="outline"
                        onClick={() => open("order", { ...r, warranty: w })}
                      >
                        Vincular OS do retorno
                      </Button>
                    )}
                  </div>
                )}
                <details>
                  <summary>Pareceres e histórico do retorno</summary>
                  {r.events.map((e, i) => (
                    <p key={i} className="text-sm">
                      {new Date(e.at).toLocaleString("pt-BR")} · {e.username} ·{" "}
                      {e.note}
                    </p>
                  ))}
                </details>
              </div>
            ))}
          <details>
            <summary>Histórico da garantia</summary>
            {w.events.map((e, i) => (
              <p key={i} className="text-sm break-words">
                {new Date(e.at).toLocaleString("pt-BR")} · {e.username} ·{" "}
                {e.note}
              </p>
            ))}
          </details>
        </article>
      ))}
      {!warranties.length && !state.loading && (
        <p>Nenhuma garantia registrada.</p>
      )}
      <Dialog
        open={!!form}
        onOpenChange={(v) => {
          if (!v) setForm(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Registrar garantia</DialogTitle>
            <DialogDescription>
              Registro vinculado a uma OS entregue e recebida. As condições
              serão preservadas.
            </DialogDescription>
          </DialogHeader>
          <Feedback state={state} />
          {form && (
            <form onSubmit={issue}>
              <fieldset className="space-y-3" disabled={state.busy}>
                <label className="block">
                  OS entregue
                  <select
                    className="commerce-select"
                    required
                    aria-label="OS entregue"
                    value={form.orderId}
                    onChange={(e) => set("orderId", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {orders.data
                      ?.filter(
                        (o) =>
                          o.status === "delivered" &&
                          o.sale?.status === "completed" &&
                          !warranties.some((w) => w.orderId === o.id),
                      )
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          #{o.number} · {o.vehicleSnapshot.plate} ·{" "}
                          {o.customerSnapshot.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block">
                  Prazo final informado
                  <Input
                    required
                    type="date"
                    value={form.expiresOn}
                    onChange={(e) => set("expiresOn", e.target.value)}
                  />
                </label>
                <label className="block">
                  Limite de km (opcional)
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    max="9999999"
                    value={form.mileageLimit}
                    onChange={(e) => set("mileageLimit", e.target.value)}
                  />
                </label>
                <label className="block">
                  Condições, itens e serviços cobertos
                  <textarea
                    className="commerce-select min-h-28"
                    required
                    maxLength={5000}
                    value={form.terms}
                    onChange={(e) => set("terms", e.target.value)}
                  />
                </label>
                <Button>Salvar garantia</Button>
              </fieldset>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!action}
        onOpenChange={(v) => {
          if (!v) setAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action?.kind === "return"
                ? "Registrar retorno"
                : action?.kind === "order"
                  ? "Vincular OS do retorno"
                  : action?.kind === "void"
                    ? "Cancelar registro de garantia"
                    : "Parecer do retorno"}
            </DialogTitle>
            <DialogDescription>
              O registro e o histórico serão mantidos. Não altera
              automaticamente pagamento ou serviços da OS.
            </DialogDescription>
          </DialogHeader>
          <Feedback state={state} />
          {action && (
            <form onSubmit={act} className="space-y-3">
              {action.kind === "order" ? (
                <label className="block">
                  Nova OS do retorno
                  <select
                    className="commerce-select"
                    required
                    aria-label="Nova OS do retorno"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {orders.data
                      ?.filter(
                        (o) =>
                          o.id !== action.record.warranty.orderId &&
                          o.vehicleId ===
                            action.record.warranty.snapshot.vehicleId &&
                          o.customerId ===
                            action.record.warranty.snapshot.customerId &&
                          !["delivered", "cancelled"].includes(o.status),
                      )
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          OS #{o.number}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="block">
                    {action.kind === "return"
                      ? "Relato do retorno"
                      : "Parecer ou motivo"}
                    <textarea
                      required
                      maxLength={action.kind === "void" ? 2000 : 3000}
                      className="commerce-select min-h-24"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  {action.kind === "return" && (
                    <label className="block">
                      Quilometragem no retorno
                      <Input
                        required
                        type="number"
                        min="0"
                        max="9999999"
                        step="1"
                        value={km}
                        onChange={(e) => setKm(e.target.value)}
                      />
                    </label>
                  )}
                </>
              )}
              <Button disabled={state.busy}>Confirmar registro</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
