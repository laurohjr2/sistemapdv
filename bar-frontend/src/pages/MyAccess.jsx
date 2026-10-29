import { useRecords } from "../components/commerce/helpers";
import { Feedback } from "../components/commerce/shared";
import { Button } from "../components/ui/button";
export default function MyAccess() {
  const state = useRecords("/access/me"),
    data = state.data?.definitions ? state.data : null;
  return (
    <div className="space-y-4">
      <div className="flex justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Meus acessos</h1>
        <Button variant="outline" onClick={state.load}>
          Atualizar meus acessos
        </Button>
      </div>
      <Feedback state={state} />
      {data && (
        <>
          <p className="border rounded-lg p-4">
            {data.kind === "master"
              ? "Master — acesso total à empresa selecionada."
              : data.kind === "support"
                ? "Suporte — somente consulta, sujeito à validade e revogação da sessão."
                : data.kind === "administrator"
                  ? "Administrador — controle da própria empresa."
                  : data.mode === "legacy"
                    ? "Modelo atual: acessos definidos pelo papel do usuário."
                    : "Perfil com permissões específicas, configurado pelo administrador."}
          </p>
          <p className="text-sm text-muted-foreground">
            Permissões não ativam módulos desabilitados, não alteram limites de
            estoque, aprovação ou pagamento e não dispensam a atribuição de
            responsabilidade de uma OS. O administrador pode conferir e alterar
            seus acessos.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[...new Set(data.definitions.map((p) => p.label))].map((label) => {
              const rows = data.definitions.filter(
                (p) => p.label === label && data.permissions.includes(p.id),
              );
              return rows.length ? (
                <section key={label} className="border rounded-lg p-4">
                  <h2 className="font-semibold">{label}</h2>
                  <ul className="text-sm space-y-1 mt-2">
                    {rows.map((p) => (
                      <li key={p.id}>{p.name}</li>
                    ))}
                  </ul>
                </section>
              ) : null;
            })}
          </div>
          {data.mode === "legacy" && (
            <p className="text-sm">
              A lista mostra o limite do papel; ações também seguem as regras
              existentes de cada módulo. Perfis detalhados não são aplicados
              automaticamente.
            </p>
          )}
          {!data.permissions.length && (
            <p>
              Nenhum acesso operacional foi liberado. Você pode consultar esta
              página e encerrar a sessão.
            </p>
          )}
        </>
      )}
    </div>
  );
}
