import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import api from "../lib/api";
import SupportAccessCodes from "../components/SupportAccessCodes";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
export default function Support() {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [mode, setMode] = useState("password"),
    [operator, setOperator] = useState(null),
    [token, setToken] = useState(sessionStorage.getItem("supportToken") || ""),
    [companies, setCompanies] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const { enterSupportSession } = useAuth(),
    navigate = useNavigate();
  async function list(auth = token) {
    setBusy(true);
    setError("");
    try {
      const config = { headers: { Authorization: "Bearer " + auth } },
        [a, b] = await Promise.all([
          api.get("/support/companies", config),
          api.get("/support/me", config),
        ]);
      setCompanies(a.data);
      setOperator(b.data);
    } catch {
      setError("Sessão de suporte inválida ou expirada. Entre novamente.");
      setToken("");
      setOperator(null);
      sessionStorage.removeItem("supportToken");
    } finally {
      setBusy(false);
    }
  }
  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "code") {
        const { data } = await api.post("/support/access-code", {
          username,
          code: code.trim(),
        });
        setCode("");
        enterSupportSession(data);
        navigate("/settings");
      } else {
        const { data } = await api.post("/support/login", {
          username,
          password,
        });
        sessionStorage.setItem("supportToken", data.token);
        setToken(data.token);
        setPassword("");
        await list(data.token);
      }
    } catch (e) {
      setError(
        mode === "code"
          ? e.response?.data?.error ||
              "Código inválido, usado, revogado ou expirado."
          : "Não foi possível entrar no suporte. Confira o usuário e a senha.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function access(company) {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(
        "/support/sessions",
        { company },
        { headers: { Authorization: "Bearer " + token } },
      );
      enterSupportSession(data);
      navigate("/settings");
    } catch {
      setError("Não foi possível iniciar a sessão de suporte.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      <h1 className="text-3xl font-bold">Acesso do fornecedor</h1>
      <p className="text-muted-foreground">
        Acesso exclusivo da equipe autorizada. As sessões duram até 15 minutos e
        são registradas. Suporte tem acesso de consulta; a conta Master tem
        controle total.
      </p>
      {error && (
        <p role="alert" className="text-red-800 dark:text-red-200">
          {error}
        </p>
      )}
      {!token ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "code"
                ? "Entrar com código temporário"
                : "Entrar como Master / suporte"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={login} className="space-y-4">
              <Label htmlFor="supportUsername">Usuário do fornecedor</Label>
              <Input
                id="supportUsername"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              {mode === "code" ? (
                <>
                  <Label htmlFor="supportCode">
                    Código temporário de uso único
                  </Label>
                  <Input
                    id="supportCode"
                    required
                    type="password"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <p className="text-sm">
                    Use o código emitido pelo Master para seu operador. O acesso
                    fica restrito à empresa autorizada e somente consulta.
                  </p>
                </>
              ) : (
                <>
                  <Label htmlFor="supportPassword">Senha do suporte</Label>
                  <Input
                    id="supportPassword"
                    autoComplete="current-password"
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </>
              )}
              <Button disabled={busy}>
                {mode === "code"
                  ? "Acessar com código temporário"
                  : "Entrar como Master / suporte"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setMode(mode === "code" ? "password" : "code");
                  setPassword("");
                  setCode("");
                  setError("");
                }}
              >
                {mode === "code"
                  ? "Usar senha do fornecedor"
                  : "Entrar com código temporário"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-3">
            <Button disabled={busy} onClick={() => list()}>
              Carregar empresas
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setToken("");
                setCompanies([]);
                setOperator(null);
                sessionStorage.removeItem("supportToken");
              }}
            >
              Encerrar acesso
            </Button>
          </div>
          {companies.map((company) => (
            <Card key={company.slug}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <h2 className="font-semibold">{company.name}</h2>
                  <p className="text-sm">
                    {company.slug} ·{" "}
                    {company.status === "active" ? "Ativo" : "Suspenso"}
                  </p>
                </div>
                <Button disabled={busy} onClick={() => access(company.slug)}>
                  Acessar empresa
                </Button>
              </CardContent>
            </Card>
          ))}
          {operator?.isMaster && (
            <SupportAccessCodes token={token} companies={companies} />
          )}
        </>
      )}
      <Link to="/login" className="block underline">
        Voltar ao acesso do estabelecimento
      </Link>
    </main>
  );
}
