import { useEffect, useState } from "react";
import api from "../lib/api";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
const empty = { name: "", phone: "", email: "", notes: "", active: true };
export default function Customers() {
  const [customers, setCustomers] = useState([]),
    [form, setForm] = useState(empty),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  const load = () =>
    api
      .get("/customers")
      .then((r) => setCustomers(r.data))
      .catch(() => setError("Não foi possível carregar clientes"));
  useEffect(() => {
    load();
  }, []);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (form.id) await api.put("/customers/" + form.id, form);
      else await api.post("/customers", form);
      setForm(empty);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Clientes</h1>
      <p>Vincule clientes às mesas e vendas para acompanhar seu histórico.</p>
      {error && <p role="alert">{error}</p>}
      <form
        onSubmit={save}
        className="border rounded p-4 grid sm:grid-cols-2 gap-4"
      >
        {[
          ["name", "Nome", 150],
          ["phone", "Telefone", 40],
          ["email", "E-mail", 150],
          ["notes", "Observações", 2000],
        ].map(([key, label, max]) => (
          <label key={key}>
            {label}
            <Input
              required={key === "name"}
              type={key === "email" ? "email" : "text"}
              maxLength={max}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />{" "}
          Cliente ativo
        </label>
        <div>
          <Button disabled={busy}>
            {form.id ? "Salvar alterações" : "Cadastrar cliente"}
          </Button>{" "}
          <Button
            type="button"
            variant="outline"
            onClick={() => setForm(empty)}
          >
            Limpar
          </Button>
        </div>
      </form>
      <Input
        aria-label="Buscar clientes"
        placeholder="Buscar por nome ou telefone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="space-y-2">
        {customers
          .filter((c) =>
            (c.name + " " + c.phone)
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((c) => (
            <div
              className="border rounded p-3 flex justify-between gap-3"
              key={c.id}
            >
              <div>
                <strong>{c.name}</strong>
                <p>
                  {c.phone} {c.email}
                </p>
                {!c.active && <span>Inativo</span>}
              </div>
              <Button variant="outline" onClick={() => setForm(c)}>
                Editar
              </Button>
            </div>
          ))}
      </div>
    </div>
  );
}
