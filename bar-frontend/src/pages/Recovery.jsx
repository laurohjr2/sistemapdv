import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
export default function Recovery() {
  const [query] = useSearchParams();
  const reset = useLocation().pathname === "/reset-password";
  const [form, setForm] = useState({
    company: query.get("company") || localStorage.getItem("company") || "",
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (reset && form.password !== form.confirm) {
      setError("As senhas não conferem");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(
        "/auth/" + (reset ? "reset-password" : "forgot-password"),
        {
          ...form,
          company: form.company.trim().toLowerCase(),
          token: query.get("token"),
        },
      );
      setMessage(data.message);
    } catch (e) {
      setError(
        e.response?.data?.error || "Não foi possível concluir a solicitação",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="max-w-md mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-bold">
        {reset ? "Redefinir senha" : "Esqueci minha senha"}
      </h1>
      {error && <p role="alert">{error}</p>}
      {message ? (
        <p role="status">{message}</p>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          {(reset
            ? [
                ["company", "Código da empresa", "text"],
                ["password", "Nova senha (mínimo 12 caracteres)", "password"],
                ["confirm", "Confirme a nova senha", "password"],
              ]
            : [
                ["company", "Código da empresa", "text"],
                ["username", "Usuário", "text"],
                ["email", "E-mail cadastrado", "email"],
              ]
          ).map(([key, label, type]) => (
            <label className="block" key={key}>
              {label}
              <Input
                type={type}
                required
                minLength={type === "password" ? 12 : undefined}
                maxLength={128}
                autoComplete={type === "password" ? "new-password" : undefined}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <Button disabled={busy}>
            {busy
              ? "Enviando..."
              : reset
                ? "Salvar nova senha"
                : "Enviar link de recuperação"}
          </Button>
        </form>
      )}
      <Link className="underline" to="/login">
        Voltar ao login
      </Link>
    </main>
  );
}
