import { useState } from "react";
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
import { useRecords } from "../components/commerce/helpers";
const blank = () => ({
  name: "",
  document: "",
  phone: "",
  email: "",
  contact: "",
  notes: "",
  active: true,
});
export default function Suppliers() {
  const state = useRecords("/commerce/suppliers"),
    { user } = useAuth();
  const readOnly = user?.support && !user.master;
  const [form, setForm] = useState(null),
    [search, setSearch] = useState("");
  async function save(e) {
    e.preventDefault();
    const ok = await state.run(() =>
      form.id
        ? api.put("/commerce/suppliers/" + form.id, form)
        : api.post("/commerce/suppliers", form),
    );
    if (ok) setForm(null);
  }
  return (
    <div className="space-y-6">
      <div className="commerce-header">
        <div>
          <p className="commerce-eyebrow">Compras</p>
          <h1 className="text-3xl font-bold">Fornecedores</h1>
          <p className="text-muted-foreground">
            Contatos e dados usados nos pedidos de compra e no financeiro.
          </p>
        </div>
        <Button disabled={readOnly} onClick={() => setForm(blank())}>
          Novo fornecedor
        </Button>
      </div>
      <Feedback state={state} />
      <div className="grid sm:grid-cols-3 gap-3">
        <Metric
          label="Fornecedores ativos"
          value={state.data.filter((s) => s.active).length}
        />
        <Metric
          label="Inativos"
          value={state.data.filter((s) => !s.active).length}
        />
        <Metric
          label="Cadastros com contato"
          value={state.data.filter((s) => s.phone || s.email).length}
        />
      </div>
      <Input
        aria-label="Buscar fornecedores"
        placeholder="Buscar nome, documento ou contato"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="commerce-panel overflow-x-auto">
        <table className="commerce-table">
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>Contato</th>
              <th>Situação</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {state.data
              .filter((s) =>
                (s.name + " " + s.document + " " + s.contact)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <p className="text-muted-foreground text-sm">
                      {s.document || "Documento não informado"}
                    </p>
                  </td>
                  <td>
                    {s.contact}
                    <p>{s.phone}</p>
                    <p className="text-sm">{s.email}</p>
                  </td>
                  <td>
                    <span
                      className={
                        "rounded-full px-2 py-1 text-xs " +
                        (s.active
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-muted")
                      }
                    >
                      {s.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>
                    <Button variant="outline" onClick={() => setForm(s)}>
                      {readOnly ? "Ver" : "Editar"}
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!state.loading && !state.data.length && (
          <p className="commerce-empty">
            Cadastre os fornecedores para começar a organizar as compras.
          </p>
        )}
      </div>
      <Dialog
        open={Boolean(form)}
        onOpenChange={(open) => {
          if (!open && !state.busy) setForm(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form?.id ? "Fornecedor" : "Novo fornecedor"}
            </DialogTitle>
            <DialogDescription>
              Inativar preserva pedidos e histórico existentes.
            </DialogDescription>
          </DialogHeader>
          {state.error && (
            <p role="alert" className="text-red-700">
              {state.error}
            </p>
          )}
          {form && (
            <form onSubmit={save}>
              <fieldset
                disabled={state.busy || readOnly}
                className="grid sm:grid-cols-2 gap-4"
              >
                {[
                  ["name", "Nome / razão social", 150],
                  ["document", "CPF / CNPJ", 30],
                  ["contact", "Pessoa de contato", 100],
                  ["phone", "Telefone", 40],
                  ["email", "E-mail", 150],
                  ["notes", "Observações", 2000],
                ].map(([key, label, max]) => (
                  <label key={key}>
                    {label}
                    <Input
                      required={key === "name"}
                      maxLength={max}
                      type={key === "email" ? "email" : "text"}
                      value={form[key] || ""}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) =>
                      setForm({ ...form, active: e.target.checked })
                    }
                  />
                  Fornecedor ativo
                </label>
                <Button disabled={state.busy}>Salvar fornecedor</Button>
              </fieldset>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
