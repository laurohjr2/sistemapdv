import { useEffect, useState } from "react";
import api from "../lib/api";
export default function CustomerSelect({ value, onChange }) {
  const [customers, setCustomers] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    api
      .get("/customers")
      .then((r) => setCustomers(r.data.filter((c) => c.active)))
      .catch(() => setError("Não foi possível carregar os clientes"));
  }, []);
  return (
    <label className="block space-y-1">
      Cliente cadastrado
      <select
        className="border rounded p-2 w-full"
        value={value || ""}
        onChange={(e) =>
          onChange(
            e.target.value,
            customers.find((c) => c.id === e.target.value),
          )
        }
      >
        <option value="">Sem vínculo / consumidor avulso</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.phone ? " — " + c.phone : ""}
          </option>
        ))}
      </select>
      {error && <span role="alert">{error}</span>}
    </label>
  );
}
