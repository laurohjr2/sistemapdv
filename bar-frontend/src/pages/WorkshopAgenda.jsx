import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useRecords } from "../components/commerce/helpers";
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
import api from "../lib/api";
const labels = {
  scheduled: "Agendado",
  arrived: "Cliente chegou",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};
const localInput = (value) => {
  const d = new Date(value);
  return new Date(+d - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export default function WorkshopAgenda() {
  const { user } = useAuth(),
    manager =
      ["admin", "gerente"].includes(user?.role) &&
      (!user?.support || user?.master);
  const state = useRecords("/workshop-agenda"),
    vehicles = useRecords("/workshop/vehicles"),
    staff = useRecords("/workshop/staff"),
    orders = useRecords("/workshop/orders");
  const [form, setForm] = useState(null),
    [action, setAction] = useState(null),
    [note, setNote] = useState(""),
    [orderId, setOrderId] = useState(""),
    [day, setDay] = useState("");
  const blank = () => ({
    vehicleId: "",
    assignedUserId: "",
    reason: "",
    startsAt: localInput(Date.now() + 3600000),
    endsAt: localInput(Date.now() + 7200000),
  });
  const set = (k, v) => setForm({ ...form, [k]: v });
  const date = (v) => new Date(v).toLocaleString("pt-BR");
  async function save(e) {
    e.preventDefault();
    if (
      await state.run(() =>
        api[form.id ? "put" : "post"](
          "/workshop-agenda" + (form.id ? "/" + form.id : ""),
          {
            ...form,
            startsAt: new Date(form.startsAt).toISOString(),
            endsAt: new Date(form.endsAt).toISOString(),
          },
        ),
      )
    )
      setForm(null);
  }
  async function act(e) {
    e.preventDefault();
    if (
      await state.run(() =>
        api.post(
          "/workshop-agenda/" +
            action.record.id +
            "/" +
            (action.status === "order" ? "order" : "status"),
          {
            revision: action.record.revision,
            status: action.status,
            note,
            orderId,
          },
        ),
      )
    )
      setAction(null);
  }
  const visible = (state.data || []).filter(
    (a) => !day || localInput(a.startsAt).slice(0, 10) === day,
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Agenda da oficina</h1>
          <p className="text-muted-foreground">
            Horários, responsáveis e chegada dos clientes. Datas no horário
            deste dispositivo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={state.load}>
            Atualizar agenda
          </Button>
          {manager && (
            <Button onClick={() => setForm(blank())}>Novo agendamento</Button>
          )}
        </div>
      </div>
      <Link to="/workshop" className="underline">
        Veículos e ordens de serviço
      </Link>
      <Feedback state={state} />
      <Feedback state={vehicles} />
      <Feedback state={staff} />
      <Feedback state={orders} />
      <label className="block max-w-xs">
        Filtrar por dia
        <Input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </label>
      <div className="space-y-3">
        {visible.map((a) => (
          <article
            className="rounded-xl border bg-card p-4 space-y-2"
            key={a.id}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <strong>
                {a.snapshot.plate} · {a.snapshot.customer}
              </strong>
              <span>{labels[a.status]}</span>
            </div>
            <p>
              {date(a.startsAt)} — {date(a.endsAt)}
            </p>
            <p>
              {a.snapshot.vehicle} · Responsável: {a.snapshot.assigned}
            </p>
            <p>{a.reason}</p>
            {a.orderId && (
              <p>
                OS vinculada: #
                {orders.data?.find((o) => o.id === a.orderId)?.number || "—"}
              </p>
            )}
            {manager && (
              <div className="flex flex-wrap gap-2">
                {a.status === "scheduled" && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setForm({
                        ...a,
                        startsAt: localInput(a.startsAt),
                        endsAt: localInput(a.endsAt),
                      })
                    }
                  >
                    Reagendar
                  </Button>
                )}
                {(a.status === "scheduled"
                  ? ["arrived", "no_show", "cancelled"]
                  : a.status === "arrived"
                    ? ["completed", "cancelled"]
                    : []
                ).map((status) => (
                  <Button
                    variant="outline"
                    key={status}
                    onClick={() => {
                      setAction({ record: a, status });
                      setNote("");
                    }}
                  >
                    {labels[status]}
                  </Button>
                ))}
                {!a.orderId && ["scheduled", "arrived"].includes(a.status) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAction({ record: a, status: "order" });
                      setOrderId("");
                    }}
                  >
                    Vincular OS
                  </Button>
                )}
              </div>
            )}
            <details>
              <summary>Histórico do agendamento</summary>
              {a.events.map((e, i) => (
                <p key={i} className="text-sm">
                  {date(e.at)} · {e.username} ·{" "}
                  {labels[e.action] ||
                    { rescheduled: "Reagendado", order_linked: "OS vinculada" }[
                      e.action
                    ] ||
                    "Criado"}{" "}
                  · {e.note}
                </p>
              ))}
            </details>
          </article>
        ))}
        {!visible.length && !state.loading && (
          <p>Nenhum agendamento nesta seleção.</p>
        )}
      </div>
      <Dialog
        open={!!form}
        onOpenChange={(v) => {
          if (!v) setForm(null);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {form?.id ? "Reagendar atendimento" : "Novo agendamento"}
            </DialogTitle>
            <DialogDescription>
              Conflitos do mesmo responsável ou veículo são bloqueados. O
              agendamento não cobra nem reserva estoque.
            </DialogDescription>
          </DialogHeader>
          <Feedback state={state} />
          {form && (
            <form onSubmit={save}>
              <fieldset disabled={state.busy} className="space-y-3">
                <label className="block">
                  Veículo
                  <select
                    className="commerce-select"
                    required
                    value={form.vehicleId}
                    onChange={(e) => set("vehicleId", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {vehicles.data
                      ?.filter((v) => v.active)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plate} · {v.customer?.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block">
                  Responsável
                  <select
                    className="commerce-select"
                    required
                    value={form.assignedUserId}
                    onChange={(e) => set("assignedUserId", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {staff.data?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  Início
                  <Input
                    required
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => set("startsAt", e.target.value)}
                  />
                </label>
                <label className="block">
                  Fim
                  <Input
                    required
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => set("endsAt", e.target.value)}
                  />
                </label>
                <label className="block">
                  Motivo do atendimento
                  <Input
                    required
                    maxLength={1000}
                    value={form.reason}
                    onChange={(e) => set("reason", e.target.value)}
                  />
                </label>
                <Button>Salvar agendamento</Button>
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
              {action?.status === "order"
                ? "Vincular OS"
                : labels[action?.status]}
            </DialogTitle>
            <DialogDescription>
              O histórico será preservado. Vincular uma OS não altera seu
              atendimento ou pagamento.
            </DialogDescription>
          </DialogHeader>
          <Feedback state={state} />
          {action && (
            <form onSubmit={act} className="space-y-3">
              {action.status === "order" ? (
                <label className="block">
                  Ordem de serviço
                  <select
                    required
                    className="commerce-select"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {orders.data
                      ?.filter(
                        (o) =>
                          o.vehicleId === action.record.vehicleId &&
                          o.customerId === action.record.customerId &&
                          !["cancelled", "delivered"].includes(o.status),
                      )
                      .map((o) => (
                        <option value={o.id} key={o.id}>
                          OS #{o.number}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <label className="block">
                  Observação
                  <Input
                    required
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
              )}
              <Button disabled={state.busy}>Confirmar agendamento</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
