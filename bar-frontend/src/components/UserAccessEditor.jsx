import { useState } from "react";
import api from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useRecords } from "./commerce/helpers";
import { Feedback } from "./commerce/shared";
export default function UserAccessEditor({ record, catalog, onSaved }) {
  const [mode, setMode] = useState(
      record.access.mode === "restricted" ? "restricted" : "legacy",
    ),
    [template, setTemplate] = useState(record.access.template || ""),
    [permissions, setPermissions] = useState(record.access.permissions),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  const history = useRecords("/access/users/" + record.user.id + "/history"),
    rows = catalog.permissions.filter((p) =>
      p.roles.includes(record.user.role),
    ),
    templates = catalog.templates.filter((t) =>
      t.roles.includes(record.user.role),
    );
  function expand(ids) {
    const result = new Set(ids);
    let size;
    do {
      size = result.size;
      for (const p of result)
        for (const dependency of catalog.dependencies[p] || [])
          result.add(dependency);
    } while (size !== result.size);
    return [...result];
  }
  function toggle(id, checked) {
    let next = checked
      ? expand([...permissions, id])
      : permissions.filter((p) => p !== id);
    if (!checked) {
      let size;
      do {
        size = next.length;
        next = next.filter((p) =>
          (catalog.dependencies[p] || []).every((d) => next.includes(d)),
        );
      } while (size !== next.length);
    }
    setPermissions(next);
    setConfirmed(false);
  }
  function choose(value) {
    setTemplate(value);
    const t = templates.find((t) => t.id === value);
    if (t) {
      setMode("restricted");
      setPermissions(t.permissions);
    }
    setConfirmed(false);
  }
  const proposed = mode === "legacy" ? rows.map((p) => p.id) : permissions,
    added = proposed.filter((p) => !record.access.permissions.includes(p)),
    removed = record.access.permissions.filter((p) => !proposed.includes(p)),
    label = (id) => catalog.permissions.find((p) => p.id === id)?.name || id;
  async function save(e) {
    e.preventDefault();
    if (!confirmed) return;
    setBusy(true);
    setError("");
    try {
      await api.put("/access/users/" + record.user.id, {
        mode,
        template: mode === "restricted" ? template || null : null,
        permissions: mode === "restricted" ? permissions : [],
        revision: record.access.revision,
        reason,
      });
      onSaved();
    } catch (e) {
      setError(e.response?.data?.error || "Não foi possível salvar os acessos");
    } finally {
      setBusy(false);
    }
  }
  if (record.access.kind === "administrator")
    return (
      <p className="border rounded p-4">
        Administradores mantêm controle da própria empresa. Perfis operacionais
        são configurados nos demais usuários.
      </p>
    );
  return (
    <section className="space-y-4">
      <form onSubmit={save} className="border rounded-xl bg-card p-4">
        <fieldset disabled={busy} className="space-y-4">
          <h2 className="text-xl font-semibold">
            Configurar acessos de {record.user.username}
          </h2>
          {!record.user.active && (
            <p>
              Este usuário está inativo. As permissões não permitem login até
              sua reativação.
            </p>
          )}
          {error && (
            <p role="alert" className="text-red-800 dark:text-red-200">
              {error}
            </p>
          )}
          <label className="block">
            Modelo de acesso
            <select
              className="commerce-select"
              aria-label="Modelo de acesso"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setConfirmed(false);
              }}
            >
              <option value="legacy">Modelo atual do papel</option>
              <option value="restricted">Perfil e exceções por usuário</option>
            </select>
          </label>
          <label className="block">
            Perfil operacional sugerido
            <select
              className="commerce-select"
              aria-label="Perfil operacional sugerido"
              value={template}
              onChange={(e) => choose(e.target.value)}
            >
              <option value="">Personalizado / escolher manualmente</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {mode === "restricted" && (
            <>
              <p className="text-sm text-muted-foreground">
                Ao liberar uma ação, as consultas necessárias também são
                marcadas. Retirar uma consulta desmarca as ações que dependem
                dela. As exceções respeitam o limite do papel {record.user.role}
                .
              </p>
              <Input
                aria-label="Filtrar permissões"
                placeholder="Filtrar área ou ação"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="grid sm:grid-cols-2 gap-3">
                {[...new Set(rows.map((p) => p.label))].map((group) => {
                  const visible = rows.filter(
                    (p) =>
                      p.label === group &&
                      (p.label + " " + p.name)
                        .toLocaleLowerCase("pt-BR")
                        .includes(search.toLocaleLowerCase("pt-BR")),
                  );
                  return visible.length ? (
                    <fieldset
                      key={group}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <legend className="font-semibold px-1">{group}</legend>
                      {visible.map((p) => (
                        <label
                          key={p.id}
                          className="flex gap-2 items-start text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={permissions.includes(p.id)}
                            onChange={(e) => toggle(p.id, e.target.checked)}
                          />
                          {p.name}
                        </label>
                      ))}
                    </fieldset>
                  ) : null;
                })}
              </div>
            </>
          )}
          <section className="border rounded-lg p-3 space-y-2">
            <h3 className="font-semibold">Prévia da alteração</h3>
            <p>
              Usuário: {record.user.username} ·{" "}
              {mode === "legacy"
                ? "Restaurar modelo atual do papel"
                : proposed.length + " ações liberadas"}
            </p>
            <p>
              {added.length} liberações · {removed.length} retiradas
            </p>
            <details>
              <summary>Conferir ações alteradas</summary>
              {added.map((p) => (
                <p key={p}>Liberar: {label(p)}</p>
              ))}
              {removed.map((p) => (
                <p key={p}>Retirar: {label(p)}</p>
              ))}
              {!added.length && !removed.length && (
                <p>
                  As ações listadas permanecem; o modelo de verificação pode
                  mudar.
                </p>
              )}
            </details>
          </section>
          <label className="block">
            Motivo da alteração de acessos
            <Input
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="flex gap-2 items-start">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Conferi o usuário, o perfil e as liberações/retiradas antes de
            salvar.
          </label>
          <Button disabled={!confirmed || !reason.trim()}>
            Salvar acessos
          </Button>
          <p className="text-sm text-muted-foreground">
            O servidor verifica a configuração nas próximas solicitações. A tela
            do funcionário atualiza ao voltar à janela, em até 30 segundos ou
            após uma operação negada.
          </p>
        </fieldset>
      </form>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          Histórico das últimas 100 alterações
        </h2>
        <Feedback state={history} />
        {history.data?.map((h) => (
          <article key={h.id} className="border rounded p-3">
            <p>
              {new Date(h.createdAt).toLocaleString("pt-BR")} · {h.actorName}
            </p>
            <p>{h.reason}</p>
            <details>
              <summary>Configuração registrada</summary>
              <p>
                {h.after.mode === "legacy"
                  ? "Modelo atual do papel"
                  : "Perfil e exceções"}{" "}
                · revisão {h.after.revision}
              </p>
              <ul className="text-sm">
                {h.after.permissions.map((p) => (
                  <li key={p}>{label(p)}</li>
                ))}
              </ul>
            </details>
          </article>
        ))}
        {!history.data?.length && !history.loading && (
          <p>Nenhuma alteração de acessos registrada.</p>
        )}
      </section>
    </section>
  );
}
