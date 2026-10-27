import { useEffect, useState } from "react";
import api from "../lib/api";
import release from "../release.json";
import { useAuth } from "../hooks/useAuth";
import { useBusiness } from "../hooks/useBusiness";
import { Button } from "../components/ui/button";
export default function About() {
  const [server, setServer] = useState(null),
    [message, setMessage] = useState("");
  const { user } = useAuth(),
    { business } = useBusiness();
  useEffect(() => {
    api
      .get("/version")
      .then((r) => setServer(r.data))
      .catch(() =>
        setMessage("Não foi possível consultar a versão do servidor."),
      );
  }, []);
  const role = user?.master
    ? "Master / fornecedor"
    : user?.support
      ? "Suporte / consulta"
      : user?.role === "admin"
        ? "Administrador da empresa"
        : user?.role === "gerente"
          ? "Gerente"
          : "Atendente";
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `Sistema PDV\nInterface: ${release.version}\nServidor: ${server?.version || "indisponível"}\nEmpresa: ${user?.company}\nPerfil: ${business.businessProfileName || "Não informado"}\nAcesso: ${role}`,
      );
      setMessage("Informações de versão copiadas para enviar ao suporte.");
    } catch {
      setMessage("Copie os números de versão mostrados nesta página.");
    }
  }
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="commerce-eyebrow">Sistema</p>
        <h1 className="text-3xl font-bold">Sobre o sistema</h1>
        <p className="text-muted-foreground">
          Versão instalada e informações para atendimento.
        </p>
      </div>
      <div className="commerce-panel p-6 space-y-4">
        <dl className="grid sm:grid-cols-2 gap-4">
          {[
            ["Interface", release.version],
            ["Servidor", server?.version || "Consultando..."],
            ["Novidades", release.name],
            ["Empresa", business.companyName],
            ["Perfil", business.businessProfileName || "Não informado"],
            ["Seu acesso", role],
          ].map(([key, value]) => (
            <div key={key}>
              <dt className="text-sm text-muted-foreground">{key}</dt>
              <dd className="font-medium mt-1">{value}</dd>
            </div>
          ))}
        </dl>
        <Button variant="outline" onClick={copy}>
          Copiar informações para suporte
        </Button>
        {message && <p role="status">{message}</p>}
      </div>
      <div className="commerce-panel p-6 space-y-3">
        <h2 className="font-semibold">Conferir uma atualização</h2>
        <p>
          A versão da interface e do servidor deve ser a mesma. Depois de uma
          atualização, recarregue a página e confira estes números.
        </p>
        <p className="text-sm text-muted-foreground">
          A atualização da instalação é feita pelo responsável, com backup e
          preservação dos dados.
        </p>
      </div>
    </div>
  );
}
