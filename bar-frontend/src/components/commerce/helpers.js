import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../lib/api";
export const money = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
export const localDate = (days = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA").format(d);
};
export const labels = {
  draft: "Rascunho",
  sent: "Enviado",
  approved: "Aprovado",
  rejected: "Recusado",
  converted: "Convertido em venda",
  cancelled: "Cancelado",
  ordered: "Aguardando recebimento",
  partial: "Parcial",
  received: "Recebido",
  open: "Em aberto",
  paid: "Quitado",
};
export function useRecords(path) {
  const [data, setData] = useState([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const inFlight = useRef(false);
  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const response = await api.get(path);
      if (version !== loadVersion.current) return;
      setData(response.data);
      setError("");
    } catch (e) {
      if (version !== loadVersion.current) return;
      setError(
        e.response?.data?.error || "Não foi possível carregar os dados.",
      );
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);
  async function run(fn) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
      return true;
    } catch (e) {
      setError(
        e.response?.data?.error ||
          "Não foi possível concluir. Recarregue os dados antes de tentar novamente.",
      );
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return { data, load, loading, busy, error, run, setError };
}
export async function downloadPdf(path, filename) {
  const r = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(r.data),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const lineTotal = (row) => {
  const a = Math.round(Number(row.quantity || 0) * 1000),
    b = Math.round(Number(row.unitPrice ?? row.unitCost ?? 0) * 100);
  return Number.isSafeInteger(a) && Number.isSafeInteger(b)
    ? Number((BigInt(a) * BigInt(b) + 500n) / 1000n) / 100
    : 0;
};
export const linesTotal = (rows) =>
  rows.reduce((sum, row) => sum + Math.round(lineTotal(row) * 100), 0) / 100;
