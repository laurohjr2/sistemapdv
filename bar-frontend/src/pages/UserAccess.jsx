import UserAccessEditor from "../components/UserAccessEditor";
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useRecords } from "../components/commerce/helpers";
import { Feedback } from "../components/commerce/shared";
import { Button } from "../components/ui/button";
import api from "../lib/api";
export default function UserAccess() {
  const catalog = useRecords("/access/catalog"),
    users = useRecords("/users"),
    [query, setQuery] = useSearchParams(),
    [selected, setSelected] = useState(query.get("user") || ""),
    [record, setRecord] = useState(null),
    [error, setError] = useState(""),
    [refreshVersion, setRefreshVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    setRecord(null);
    setError("");
    if (selected)
      api
        .get("/access/users/" + selected)
        .then((r) => {
          if (alive) setRecord(r.data);
        })
        .catch((e) => {
          if (alive)
            setError(
              e.response?.data?.error ||
                "Não foi possível consultar os acessos",
            );
        });
    return () => {
      alive = false;
    };
  }, [selected, refreshVersion]);
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Acessos e permissões</h1>
      <p className="text-muted-foreground">
        Matriz por papel e opções de perfil operacional. Usuários atuais mantêm
        os acessos até configuração explícita.
      </p>
      <Link className="underline" to="/users">
        Cadastro e inativação de usuários
      </Link>
      <Feedback state={catalog} />
      <Feedback state={users} />
      {error && <p role="alert">{error}</p>}
      <label className="block max-w-xl">
        Usuário para conferir
        <select
          className="commerce-select"
          aria-label="Usuário para conferir"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setQuery(e.target.value ? { user: e.target.value } : {});
          }}
        >
          <option value="">Selecione</option>
          {users.data?.map((u) => (
            <option value={u.id} key={u.id}>
              {u.username} · {u.role}
              {u.active ? "" : " · inativo"}
            </option>
          ))}
        </select>
      </label>
      {record && (
        <section className="rounded-lg border p-4 space-y-2">
          <strong>
            {record.user.username} · {record.user.role}
          </strong>
          <p>
            {record.access.kind === "administrator"
              ? "Administrador da empresa: controle integral dentro da própria empresa."
              : record.access.mode === "legacy"
                ? "Modelo atual do papel, sem perfil detalhado aplicado."
                : "Perfil com permissões específicas."}
          </p>
          <p className="text-sm">
            Contas Master e suporte são gerenciadas pelo fornecedor e não
            aparecem nesta lista.
          </p>
        </section>
      )}
      {record && catalog.data?.permissions && (
        <UserAccessEditor
          key={selected + ":" + record.access.revision}
          record={record}
          catalog={catalog.data}
          onSaved={() => setRefreshVersion((v) => v + 1)}
        />
      )}
      <Button variant="outline" onClick={() => setRefreshVersion((v) => v + 1)}>
        Recarregar usuário selecionado
      </Button>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Matriz de limites por papel</h2>
        <p className="text-sm text-muted-foreground">
          Os perfis e exceções só podem restringir ou liberar ações dentro deste
          limite. Regras de módulo, caixa, estoque, aprovação e responsável
          continuam valendo.
        </p>
        <div className="overflow-auto">
          <table className="commerce-table">
            <thead>
              <tr>
                <th>Área e ação</th>
                <th>Operador / atendimento</th>
                <th>Gerente</th>
                <th>Administrador</th>
              </tr>
            </thead>
            <tbody>
              {catalog.data?.permissions?.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="text-xs text-muted-foreground block">
                      {p.label}
                    </span>
                    {p.name}
                  </td>
                  {["garcom", "gerente", "admin"].map((role) => (
                    <td key={role}>
                      {p.roles.includes(role)
                        ? "Permitido dentro do papel"
                        : "Restrito"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          Perfis operacionais disponíveis
        </h2>
        {catalog.data?.templates?.map((t) => (
          <p key={t.id} className="border rounded p-3">
            {t.name} · {t.permissions.length} ações ·{" "}
            {t.roles.includes("garcom") ? "Operação e gerência" : "Gerência"}
          </p>
        ))}
      </section>
      <Button variant="outline" onClick={catalog.load}>
        Atualizar matriz
      </Button>
    </div>
  );
}
