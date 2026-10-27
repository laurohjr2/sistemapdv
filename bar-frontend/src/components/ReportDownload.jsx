import { useState } from "react";
import api from "../lib/api";
import { Button } from "./ui/button";
export default function ReportDownload({ type, label = "Gerar relatório" }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    try {
      const r = await api.get("/reports/export/pdf", {
        params: { type },
        responseType: "blob",
      });
      const url = URL.createObjectURL(r.data),
        a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-${type}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setError("Não foi possível gerar o relatório");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Button variant="outline" disabled={busy} onClick={download}>
        {busy ? "Gerando..." : label}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
