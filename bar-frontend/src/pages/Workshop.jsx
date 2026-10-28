import WorkshopEvidence from "../components/WorkshopEvidence";
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
import CustomerSelect from "../components/CustomerSelect";
import PixPayment from "../components/PixPayment";
import { Feedback, Metric, LineEditor } from "../components/commerce/shared";
import {
  useRecords,
  money,
  linesTotal,
  downloadPdf,
} from "../components/commerce/helpers";
const labels = {
  draft: "Rascunho",
  waiting: "Aguardando aprovação",
  approved: "Aprovada",
  in_progress: "Em execução",
  ready: "Pronta",
  delivered: "Entregue",
  rejected: "Recusada",
  cancelled: "Cancelada",
};
const checks = {
  body: "Carroceria",
  tires: "Pneus",
  lights: "Luzes",
  accessories: "Acessórios e ferramentas",
};
const methods = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
};
const date = (value) => new Date(value).toLocaleString("pt-BR");
export default function Workshop() {
  const state = useRecords("/workshop/orders");
  const { user } = useAuth();
  const manager = ["admin", "gerente"].includes(user?.role),
    writable = !user?.support || user?.master;
  const [tab, setTab] = useState("orders"),
    [vehicles, setVehicles] = useState([]),
    [staff, setStaff] = useState([]),
    [products, setProducts] = useState([]),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [vehicle, setVehicle] = useState(null),
    [form, setForm] = useState(null),
    [selected, setSelected] = useState(null),
    [action, setAction] = useState(null),
    [note, setNote] = useState(""),
    [cash, setCash] = useState(null),
    [payments, setPayments] = useState([]);
  const { setError } = state;
  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/workshop/vehicles"),
      api.get("/workshop/staff"),
      api.get("/products"),
    ])
      .then(([v, s, p]) => {
        if (active) {
          setVehicles(v.data);
          setStaff(s.data);
          setProducts(p.data);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Não foi possível carregar os cadastros da oficina. Recarregue a página.",
          );
      });
    return () => {
      active = false;
    };
  }, [setError]);
  async function refreshVehicles() {
    setVehicles((await api.get("/workshop/vehicles")).data);
  }
  async function details(id) {
    await state.run(async () =>
      setSelected((await api.get("/workshop/orders/" + id)).data),
    );
  }
  async function saveVehicle(e) {
    e.preventDefault();
    await state.run(async () => {
      if (vehicle.id)
        await api.put("/workshop/vehicles/" + vehicle.id, vehicle);
      else await api.post("/workshop/vehicles", vehicle);
      await refreshVehicles();
      setVehicle(null);
    });
  }
  async function saveOrder(e) {
    e.preventDefault();
    await state.run(async () => {
      const r = form.id
        ? await api.put("/workshop/orders/" + form.id, form)
        : await api.post("/workshop/orders", form);
      setForm(null);
      await refreshVehicles();
      setSelected((await api.get("/workshop/orders/" + r.data.id)).data);
    });
  }
  async function change(e) {
    e.preventDefault();
    await state.run(async () => {
      await api.post(`/workshop/orders/${action.order.id}/status`, {
        status: action.status,
        revision: action.order.revision,
        note,
      });
      setSelected((await api.get("/workshop/orders/" + action.order.id)).data);
      setAction(null);
    });
  }
  function prepare(order, status) {
    setNote("");
    setAction({ order, status });
  }
  async function checkout(order) {
    await state.run(async () => {
      setCash((await api.get("/cash-register/status")).data);
      setPayments([{ method: "dinheiro", amount: String(order.total) }]);
      setAction({ order, status: "pay" });
    });
  }
  async function receive(e) {
    e.preventDefault();
    const received = payments.reduce(
      (sum, p) => sum + Math.round(Number(p.amount) * 100),
      0,
    );
    if (received !== Math.round(Number(action.order.total) * 100)) {
      state.setError("A soma dos pagamentos deve ser igual ao total da OS.");
      return;
    }
    await state.run(async () => {
      await api.post(`/workshop/orders/${action.order.id}/checkout`, {
        revision: action.order.revision,
        cash_register_id: cash.id,
        payment_method: payments[0].method,
        payments:
          Number(action.order.total) === 0 && payments.length === 1
            ? undefined
            : payments,
      });
      setSelected((await api.get("/workshop/orders/" + action.order.id)).data);
      setAction(null);
    });
  }
  function newOrder() {
    setSelected(null);
    const v = vehicles.find((v) => v.active);
    setForm({
      vehicleId: v?.id || "",
      mileage: String(v?.mileage || 0),
      assignedUserId: "",
      complaint: "",
      diagnosis: "",
      checklist: {},
      lines: [],
      discount: "0",
      notes: "",
    });
  }
  const total = form ? linesTotal(form.lines) - Number(form.discount || 0) : 0;
  const rows = state.data.filter(
    (o) =>
      (!filter || o.status === filter) &&
      `${o.number} ${o.customerSnapshot.name} ${o.vehicleSnapshot.plate} ${o.vehicleSnapshot.model} ${o.assignedName}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const pdf = (o) =>
    state.run(() =>
      downloadPdf(
        `/workshop/orders/${o.id}/pdf`,
        `ordem-servico-${o.number}.pdf`,
      ),
    );
  const badge = (o) => (
    <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs">
      {labels[o.status]}
    </span>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="commerce-eyebrow">Atendimento</p>
          <h1 className="text-3xl font-bold">Oficina mecânica</h1>
          <p className="text-muted-foreground">
            Veículos, autorizações e ordens de serviço.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() =>
              state.run(async () => {
                await refreshVehicles();
                if (selected)
                  setSelected(
                    (await api.get("/workshop/orders/" + selected.id)).data,
                  );
              })
            }
            disabled={state.busy}
          >
            Atualizar
          </Button>
          {manager && writable && (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  setVehicle({
                    customerId: "",
                    plate: "",
                    brand: "",
                    model: "",
                    year: "",
                    mileage: "0",
                    color: "",
                    notes: "",
                    active: true,
                  })
                }
              >
                Novo veículo
              </Button>
              <Button onClick={newOrder}>Nova ordem de serviço</Button>
            </>
          )}
        </div>
      </div>
      <Feedback state={state} />
      <div className="grid sm:grid-cols-3 gap-3">
        <Metric
          label="Em atendimento"
          value={
            state.data.filter((o) =>
              ["draft", "waiting", "approved", "in_progress", "ready"].includes(
                o.status,
              ),
            ).length
          }
        />
        <Metric
          label="Aguardando aprovação"
          value={state.data.filter((o) => o.status === "waiting").length}
        />
        <Metric
          label="Prontas para entrega"
          value={state.data.filter((o) => o.status === "ready").length}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={tab === "orders" ? "default" : "outline"}
          onClick={() => setTab("orders")}
        >
          Ordens de serviço
        </Button>
        <Button
          variant={tab === "vehicles" ? "default" : "outline"}
          onClick={() => setTab("vehicles")}
        >
          Veículos
        </Button>
      </div>
      {tab === "orders" ? (
        <>
          <div className="flex flex-wrap gap-3">
            <Input
              className="sm:max-w-sm"
              aria-label="Buscar ordens"
              placeholder="Buscar OS, placa, cliente ou responsável"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="commerce-select sm:max-w-xs"
              aria-label="Filtrar situação"
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
                  <th>OS / cliente</th>
                  <th>Veículo</th>
                  <th>Responsável</th>
                  <th>Situação</th>
                  <th>Total / recebimento</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>#{o.number}</strong>
                      <p>{o.customerSnapshot.name}</p>
                    </td>
                    <td>
                      {o.vehicleSnapshot.plate}
                      <p>
                        {o.vehicleSnapshot.brand} {o.vehicleSnapshot.model}
                      </p>
                    </td>
                    <td>{o.assignedName || "Não definido"}</td>
                    <td>{badge(o)}</td>
                    <td>
                      {money(o.total)}
                      <p className="text-xs">
                        {o.sale?.status === "completed"
                          ? "Recebida"
                          : o.sale
                            ? "Pagamento cancelado"
                            : "Não recebida"}
                      </p>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => details(o.id)}>
                          Ver OS
                        </Button>
                        <Button variant="outline" onClick={() => pdf(o)}>
                          PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && !state.loading && (
              <p className="commerce-empty">Nenhuma ordem encontrada.</p>
            )}
          </div>
        </>
      ) : (
        <div className="commerce-panel overflow-x-auto">
          <table className="commerce-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Veículo</th>
                <th>Cliente</th>
                <th>Quilometragem</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td>{v.plate}</td>
                  <td>
                    {v.brand} {v.model} {v.year}
                  </td>
                  <td>{v.customer?.name}</td>
                  <td>{v.mileage} km</td>
                  <td>{v.active ? "Ativo" : "Inativo"}</td>
                  <td>
                    {manager && writable && (
                      <Button
                        variant="outline"
                        onClick={() => setVehicle({ ...v, year: v.year || "" })}
                      >
                        Editar veículo
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!vehicles.length && (
            <p className="commerce-empty">
              Cadastre o cliente e seu primeiro veículo para abrir uma OS.
            </p>
          )}
        </div>
      )}
      <Dialog
        open={Boolean(vehicle)}
        onOpenChange={(open) => {
          if (!open && !state.busy) setVehicle(null);
        }}
      >
        <DialogContent className="grid-cols-1 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {vehicle?.id ? "Editar veículo" : "Novo veículo"}
            </DialogTitle>
            <DialogDescription>
              Vincule o veículo a um cliente cadastrado. O histórico das ordens
              será preservado.
            </DialogDescription>
          </DialogHeader>
          {state.error && (
            <p role="alert" className="text-destructive">
              {state.error}
            </p>
          )}
          {vehicle && (
            <form onSubmit={saveVehicle}>
              <fieldset disabled={state.busy} className="space-y-4">
                <CustomerSelect
                  value={vehicle.customerId}
                  onChange={(id) => setVehicle({ ...vehicle, customerId: id })}
                />
                <Link to="/customers" className="text-sm underline">
                  Cadastrar cliente
                </Link>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    ["plate", "Placa", true],
                    ["brand", "Marca", true],
                    ["model", "Modelo", true],
                    ["year", "Ano", false],
                    ["mileage", "Quilometragem", true],
                    ["color", "Cor", false],
                  ].map(([key, label, required]) => (
                    <label key={key}>
                      {label}
                      <Input
                        required={required}
                        type={
                          ["year", "mileage"].includes(key) ? "number" : "text"
                        }
                        min={key === "year" ? 1900 : 0}
                        step="1"
                        value={vehicle[key]}
                        onChange={(e) =>
                          setVehicle({ ...vehicle, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                </div>
                <label className="block">
                  Observações
                  <Input
                    maxLength={2000}
                    value={vehicle.notes}
                    onChange={(e) =>
                      setVehicle({ ...vehicle, notes: e.target.value })
                    }
                  />
                </label>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={vehicle.active}
                    onChange={(e) =>
                      setVehicle({ ...vehicle, active: e.target.checked })
                    }
                  />
                  Veículo ativo
                </label>
                <Button>Salvar veículo</Button>
              </fieldset>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(form)}
        onOpenChange={(open) => {
          if (!open && !state.busy) setForm(null);
        }}
      >
        <DialogContent className="grid-cols-1 sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form?.id ? "Revisar ordem de serviço" : "Nova ordem de serviço"}
            </DialogTitle>
            <DialogDescription>
              Peças não são reservadas. Estoque será baixado somente no
              recebimento; alterações de escopo exigem novo aceite.
            </DialogDescription>
          </DialogHeader>
          {state.error && (
            <p role="alert" className="text-destructive">
              {state.error}
            </p>
          )}
          {form && (
            <form onSubmit={saveOrder}>
              <fieldset disabled={state.busy} className="space-y-4">
                <label className="block">
                  Veículo do cliente
                  <select
                    required
                    aria-label="Veículo do cliente"
                    className="commerce-select"
                    value={form.vehicleId}
                    onChange={(e) => {
                      const v = vehicles.find((v) => v.id === e.target.value);
                      setForm({
                        ...form,
                        vehicleId: e.target.value,
                        mileage: String(v?.mileage || 0),
                      });
                    }}
                  >
                    <option value="">Selecione um veículo</option>
                    {vehicles
                      .filter((v) => v.active)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plate} — {v.brand} {v.model} — {v.customer?.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label>
                    Quilometragem na entrada
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={form.mileage}
                      onChange={(e) =>
                        setForm({ ...form, mileage: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Responsável
                    <select
                      aria-label="Responsável"
                      className="commerce-select"
                      value={form.assignedUserId || ""}
                      onChange={(e) =>
                        setForm({ ...form, assignedUserId: e.target.value })
                      }
                    >
                      <option value="">Definir antes da execução</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.username}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {[
                  ["complaint", "Problema relatado", true],
                  ["diagnosis", "Diagnóstico", false],
                ].map(([key, label, required]) => (
                  <label className="block" key={key}>
                    {label}
                    <textarea
                      className="commerce-select min-h-20"
                      required={required}
                      maxLength={4000}
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <div className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold">Checklist de entrada</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {Object.entries(checks).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <select
                          className="commerce-select"
                          aria-label={label}
                          value={form.checklist[key] || "not_checked"}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              checklist: {
                                ...form.checklist,
                                [key]: e.target.value,
                              },
                            })
                          }
                        >
                          <option value="not_checked">Não conferido</option>
                          <option value="ok">Conferido / OK</option>
                          <option value="attention">Atenção</option>
                        </select>
                      </label>
                    ))}
                    <label>
                      Combustível
                      <select
                        className="commerce-select"
                        aria-label="Combustível"
                        value={form.checklist.fuelLevel || "not_checked"}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            checklist: {
                              ...form.checklist,
                              fuelLevel: e.target.value,
                            },
                          })
                        }
                      >
                        {Object.entries({
                          not_checked: "Não conferido",
                          empty: "Vazio",
                          quarter: "1/4",
                          half: "1/2",
                          three_quarters: "3/4",
                          full: "Cheio",
                        }).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    Observações de entrada
                    <Input
                      maxLength={2000}
                      value={form.checklist.notes || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          checklist: {
                            ...form.checklist,
                            notes: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                </div>
                <LineEditor
                  rows={form.lines}
                  onChange={(lines) => setForm({ ...form, lines })}
                  products={products}
                />
                <label className="block sm:max-w-xs">
                  Desconto (R$)
                  <Input
                    currency
                    value={form.discount}
                    onChange={(e) =>
                      setForm({ ...form, discount: e.target.value })
                    }
                  />
                </label>
                <label className="block">
                  Observações da OS
                  <textarea
                    className="commerce-select"
                    maxLength={4000}
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </label>
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <strong>Total: {money(total)}</strong>
                  <Button>Salvar rascunho</Button>
                </div>
              </fieldset>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selected) && !action}
        onOpenChange={(open) => {
          if (!open && !state.busy) setSelected(null);
        }}
      >
        <DialogContent className="grid-cols-1 sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ordem de serviço #{selected?.number}</DialogTitle>
            <DialogDescription>
              {selected?.vehicleSnapshot.plate} ·{" "}
              {selected?.customerSnapshot.name}
            </DialogDescription>
          </DialogHeader>
          {state.error && (
            <p role="alert" className="text-destructive">
              {state.error} Recarregue os dados antes de tentar novamente.
            </p>
          )}
          {selected && (
            <div className="space-y-3">
              {badge(selected)}
              <p>
                {selected.vehicleSnapshot.brand}{" "}
                {selected.vehicleSnapshot.model} · {selected.mileage} km ·
                Responsável: {selected.assignedName || "Não definido"}
              </p>
              <p>
                <strong>Relato:</strong> {selected.complaint}
              </p>
              <p>
                <strong>Diagnóstico:</strong> {selected.diagnosis || "Pendente"}
              </p>
              <WorkshopEvidence
                order={selected}
                onChanged={async () => {
                  const id = selected.id,
                    fresh = (await api.get("/workshop/orders/" + id)).data;
                  setSelected((current) =>
                    current?.id === id ? fresh : current,
                  );
                  await state.load();
                }}
              />
              <details>
                <summary className="cursor-pointer font-medium">
                  Checklist de entrada
                </summary>
                {Object.entries(checks).map(([key, label]) => (
                  <p key={key}>
                    {label}:{" "}
                    {
                      {
                        ok: "Conferido / OK",
                        attention: "Atenção",
                        not_checked: "Não conferido",
                      }[selected.checklist[key]]
                    }
                  </p>
                ))}
                <p>
                  Combustível:{" "}
                  {
                    {
                      not_checked: "Não conferido",
                      empty: "Vazio",
                      quarter: "1/4",
                      half: "1/2",
                      three_quarters: "3/4",
                      full: "Cheio",
                    }[selected.checklist.fuelLevel]
                  }
                </p>
                <p>{selected.checklist.notes}</p>
              </details>
              {selected.lines.map((l) => (
                <div
                  key={l.productId}
                  className="flex justify-between border-b pb-2 gap-3"
                >
                  <span>
                    {l.name}{" "}
                    <small>
                      ({l.itemType === "service" ? "Serviço" : "Peça"})
                    </small>{" "}
                    × {l.quantity}
                  </span>
                  <strong className="whitespace-nowrap">
                    {money(l.total)}
                  </strong>
                </div>
              ))}
              <p>Desconto: {money(selected.discount)}</p>
              <p className="text-xl font-semibold">
                Total: {money(selected.total)}
              </p>
              <p>{selected.notes}</p>
              {selected.approvedAt && (
                <p className="rounded-lg border p-3">
                  Aceite em {date(selected.approvedAt)}: {selected.approvalNote}
                </p>
              )}
              <p>
                {selected.sale
                  ? `Venda #${selected.sale.id} — ${selected.sale.status === "completed" ? "Recebida" : "Pagamento cancelado"}`
                  : "Pagamento ainda não registrado"}
              </p>
              {selected.sale?.payments?.map((p, i) => (
                <p key={i}>
                  {methods[p.method] || p.method}: {money(p.amount)}
                </p>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={state.busy}
                  onClick={() => details(selected.id)}
                >
                  Recarregar OS
                </Button>
                <Button variant="outline" onClick={() => pdf(selected)}>
                  Imprimir / PDF
                </Button>
                {writable && (
                  <>
                    {manager &&
                      ["draft", "rejected"].includes(selected.status) &&
                      !selected.saleId && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setForm({
                              ...selected,
                              discount: String(selected.discount),
                            });
                            setSelected(null);
                          }}
                        >
                          Editar OS
                        </Button>
                      )}
                    {manager && selected.status === "draft" && (
                      <Button onClick={() => prepare(selected, "waiting")}>
                        Enviar para aprovação
                      </Button>
                    )}
                    {manager && selected.status === "waiting" && (
                      <>
                        <Button onClick={() => prepare(selected, "approved")}>
                          Registrar aprovação
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => prepare(selected, "rejected")}
                        >
                          Registrar recusa
                        </Button>
                      </>
                    )}
                    {(manager || selected.assignedUserId === user?.id) &&
                      selected.status === "approved" && (
                        <Button
                          onClick={() => prepare(selected, "in_progress")}
                        >
                          Iniciar execução
                        </Button>
                      )}
                    {(manager || selected.assignedUserId === user?.id) &&
                      selected.status === "in_progress" && (
                        <Button onClick={() => prepare(selected, "ready")}>
                          Marcar como pronta
                        </Button>
                      )}
                    {manager &&
                      selected.status === "ready" &&
                      selected.sale?.status !== "completed" && (
                        <Button onClick={() => checkout(selected)}>
                          Receber OS
                        </Button>
                      )}
                    {manager &&
                      selected.status === "ready" &&
                      selected.sale?.status === "completed" && (
                        <Button onClick={() => prepare(selected, "delivered")}>
                          Registrar entrega
                        </Button>
                      )}
                    {manager &&
                      ["waiting", "approved", "in_progress", "ready"].includes(
                        selected.status,
                      ) &&
                      !selected.saleId && (
                        <Button
                          variant="outline"
                          onClick={() => prepare(selected, "draft")}
                        >
                          Revisar orçamento
                        </Button>
                      )}
                    {manager &&
                      !["delivered", "cancelled"].includes(selected.status) &&
                      selected.sale?.status !== "completed" && (
                        <Button
                          variant="ghost"
                          onClick={() => prepare(selected, "cancelled")}
                        >
                          Cancelar OS
                        </Button>
                      )}
                  </>
                )}
              </div>
              <details>
                <summary className="cursor-pointer font-medium">
                  Histórico da OS
                </summary>
                {selected.events.map((ev, i) => (
                  <div key={i} className="text-sm border-b py-2">
                    <p>
                      {date(ev.at)} · {ev.username} ·{" "}
                      {labels[ev.action] ||
                        {
                          photo_added: "Foto anexada",
                          photo_archived: "Foto arquivada",
                          signature_recorded: "Assinatura registrada",
                          signature_voided: "Registro de assinatura cancelado",
                          created: "Criada",
                          revised: "Revisada",
                          paid: "Recebida",
                          payment_cancelled: "Pagamento cancelado",
                        }[ev.action] ||
                        ev.action}
                    </p>
                    <p>{ev.note}</p>
                    {ev.budget && (
                      <details>
                        <summary>
                          Escopo aprovado · {money(ev.budget.total)}
                        </summary>
                        {ev.budget.lines.map((l) => (
                          <p key={l.productId}>
                            {l.name} × {l.quantity} · {money(l.total)}
                          </p>
                        ))}
                        <p>Desconto: {money(ev.budget.discount)}</p>
                      </details>
                    )}
                  </div>
                ))}
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(action)}
        onOpenChange={(open) => {
          if (!open && !state.busy) setAction(null);
        }}
      >
        <DialogContent className="grid-cols-1 sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {action?.status === "pay"
                ? "Receber ordem de serviço"
                : action?.status === "approved"
                  ? "Registrar aprovação do cliente"
                  : labels[action?.status] || "Atualizar OS"}
            </DialogTitle>
            <DialogDescription>
              OS #{action?.order.number} · {action?.order.customerSnapshot.name}
            </DialogDescription>
          </DialogHeader>
          {state.error && (
            <p role="alert" className="text-destructive">
              {state.error}
            </p>
          )}
          {action?.status === "pay" ? (
            <form onSubmit={receive} className="space-y-4">
              <p className="text-xl font-semibold">
                Total: {money(action.order.total)}
              </p>
              {!cash?.is_open ? (
                <p>
                  Você precisa abrir um caixa para vender.{" "}
                  <Link className="underline" to="/sales">
                    Ir para Vendas
                  </Link>
                </p>
              ) : (
                <fieldset disabled={state.busy} className="space-y-3">
                  {payments.map((p, i) => (
                    <div key={i} className="flex flex-wrap gap-2">
                      <label className="flex-1">
                        Forma de pagamento {i + 1}
                        <select
                          className="commerce-select"
                          aria-label={`Forma de pagamento ${i + 1}`}
                          value={p.method}
                          onChange={(e) =>
                            setPayments(
                              payments.map((v, n) =>
                                n === i ? { ...v, method: e.target.value } : v,
                              ),
                            )
                          }
                        >
                          {Object.entries(methods).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="w-36">
                        Valor {i + 1}
                        <Input
                          currency
                          required
                          value={p.amount}
                          onChange={(e) =>
                            setPayments(
                              payments.map((v, n) =>
                                n === i ? { ...v, amount: e.target.value } : v,
                              ),
                            )
                          }
                        />
                      </label>
                      {payments.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setPayments(payments.filter((_, n) => n !== i))
                          }
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setPayments([...payments, { method: "pix", amount: "0" }])
                    }
                  >
                    Adicionar pagamento
                  </Button>
                  {payments.some((p) => p.method === "pix") && <PixPayment />}
                  <p className="text-sm">
                    A soma dos pagamentos deve ser igual ao total. A confirmação
                    registra a venda e baixa o estoque das peças uma única vez.
                  </p>
                  <Button>Confirmar recebimento</Button>
                </fieldset>
              )}
            </form>
          ) : (
            <form onSubmit={change} className="space-y-3">
              <label className="block">
                {action?.status === "approved"
                  ? "Como e por quem o cliente autorizou?"
                  : "Registro da ação"}
                <textarea
                  className="commerce-select min-h-24"
                  required={[
                    "approved",
                    "rejected",
                    "cancelled",
                    "draft",
                  ].includes(action?.status)}
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Registre o motivo ou a autorização recebida"
                />
              </label>
              {action?.status === "draft" && (
                <p>
                  O aceite será removido da revisão atual. Após alterar os
                  itens, será necessária nova aprovação.
                </p>
              )}
              <Button disabled={state.busy}>Confirmar ação</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
