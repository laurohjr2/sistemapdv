import { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useRecords, money } from "./commerce/helpers";
import { Feedback } from "./commerce/shared";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import SignaturePad from "./SignaturePad";
const checks = {
  general: "Geral",
  body: "Carroceria",
  tires: "Pneus",
  lights: "Luzes",
  accessories: "Acessórios e ferramentas",
  fuelLevel: "Combustível",
};
async function photoData(file) {
  if (!file || !["image/jpeg", "image/png"].includes(file.type))
    throw Error("Selecione uma foto PNG ou JPEG");
  if (file.size > 10 * 1024 * 1024)
    throw Error("A foto original deve ter até 10 MB");
  const bitmap = await createImageBitmap(file);
  try {
    const factor = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * factor));
    canvas.height = Math.max(1, Math.round(bitmap.height * factor));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.85);
    if (data.length > 2800000)
      throw Error(
        "Não foi possível reduzir a foto para 2 MB. Selecione uma imagem menor.",
      );
    return data;
  } finally {
    bitmap.close();
  }
}
function Graphic({ signature }) {
  return (
    <svg
      viewBox="0 0 640 200"
      role="img"
      aria-label={"Assinatura de " + signature.payload.signerName}
      className="w-full bg-white border rounded"
    >
      {signature.payload.strokes.map((line, i) => (
        <polyline
          key={i}
          points={line.map((p) => p.x * 640 + "," + p.y * 200).join(" ")}
          fill="none"
          stroke="#111"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
export default function WorkshopEvidence({ order, onChanged }) {
  const state = useRecords(
      "/workshop/orders/" + order.id + "/evidence?revision=" + order.revision,
    ),
    { user } = useAuth(),
    manager = ["admin", "gerente"].includes(user?.role),
    writable = !user?.support || user?.master;
  const [caption, setCaption] = useState(""),
    [checkKey, setCheckKey] = useState("general"),
    [file, setFile] = useState(null),
    [purpose, setPurpose] = useState(null),
    [strokes, setStrokes] = useState([]),
    [signer, setSigner] = useState(order.customerSnapshot.name),
    [relationship, setRelationship] = useState("Cliente titular"),
    [confirmed, setConfirmed] = useState(false),
    [correction, setCorrection] = useState(null),
    [reason, setReason] = useState(""),
    [preview, setPreview] = useState(null);
  const alive = useRef(true),
    url = useRef(null),
    input = useRef(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, []);
  useEffect(() => {
    if (purpose) {
      setStrokes([]);
      setConfirmed(false);
    }
  }, [order.revision, purpose]);
  const photos = state.data?.photos || [],
    signatures = state.data?.signatures || [],
    stale =
      !state.loading &&
      state.data?.revision !== undefined &&
      state.data.revision !== order.revision,
    disabled = state.busy || state.loading || stale,
    canPhoto =
      writable &&
      (manager || order.assignedUserId === user?.id) &&
      !["delivered", "cancelled"].includes(order.status);
  async function upload(e) {
    e.preventDefault();
    await state.run(async () => {
      const image = await photoData(file);
      await api.post("/workshop/orders/" + order.id + "/photos", {
        revision: order.revision,
        image,
        caption,
        checkKey,
      });
      setCaption("");
      setFile(null);
      if (input.current) input.current.value = "";
      await onChanged();
    });
  }
  async function showPhoto(p) {
    await state.run(async () => {
      const response = await api.get(
        "/workshop/orders/" + order.id + "/photos/" + p.id + "/file",
        { responseType: "blob" },
      );
      if (!alive.current) return;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(response.data);
      setPreview({ ...p, url: url.current });
    });
  }
  async function sign(e) {
    e.preventDefault();
    const ok = await state.run(async () => {
      await api.post("/workshop/orders/" + order.id + "/signatures", {
        revision: order.revision,
        purpose,
        signerName: signer,
        relationship,
        strokes,
        confirmed,
      });
      await onChanged();
    });
    if (ok) setPurpose(null);
  }
  async function correct(e) {
    e.preventDefault();
    const ok = await state.run(async () => {
      await api.post(
        "/workshop/orders/" +
          order.id +
          "/" +
          (correction.kind === "photo" ? "photos/" : "signatures/") +
          correction.id +
          "/" +
          (correction.kind === "photo" ? "archive" : "void"),
        { revision: order.revision, reason },
      );
      await onChanged();
    });
    if (ok) {
      setCorrection(null);
      setReason("");
    }
  }
  function openSign(p) {
    setPurpose(p);
    setStrokes([]);
    setConfirmed(false);
    setSigner(order.customerSnapshot.name);
    setRelationship("Cliente titular");
  }
  return (
    <section className="space-y-4 border rounded-xl p-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h3 className="font-semibold">Fotos e assinaturas</h3>
        <Button
          type="button"
          variant="outline"
          disabled={state.busy}
          onClick={async () => {
            await onChanged();
            await state.load();
          }}
        >
          Atualizar anexos
        </Button>
      </div>
      <Feedback state={state} />
      {stale && (
        <p role="alert">
          A OS mudou em outro terminal. Recarregue a OS antes de registrar novos
          anexos.
        </p>
      )}
      {canPhoto && (
        <form onSubmit={upload}>
          <fieldset disabled={disabled} className="space-y-3 min-w-0">
            <label className="block">
              Item fotografado
              <select
                className="commerce-select"
                aria-label="Item fotografado"
                value={checkKey}
                onChange={(e) => setCheckKey(e.target.value)}
              >
                {Object.entries(checks).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Descrição da foto
              <Input
                required
                aria-label="Descrição da foto"
                maxLength="200"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </label>
            <label className="block">
              Foto do checklist
              <input
                className="block w-full border rounded p-2 text-sm"
                ref={input}
                aria-label="Foto do checklist"
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              A foto é ajustada para JPEG de até 1600 pixels e 2 MB. Até dez
              fotos ativas por OS. O arquivo guardado e sua data permanecem no
              histórico.
            </p>
            <Button disabled={!file || !caption.trim()}>Anexar foto</Button>
          </fieldset>
        </form>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        {photos.map((p) => (
          <article key={p.id} className="border rounded p-3 space-y-2">
            <strong>{p.caption}</strong>
            <p className="text-sm">
              {checks[p.checkKey]} · {p.archivedAt ? "Arquivada" : "Ativa"} ·{" "}
              {new Date(p.createdAt).toLocaleString("pt-BR")}
            </p>
            <p className="text-xs">
              {p.width} × {p.height} · {Math.ceil(p.bytes / 1024)} KB
            </p>
            {p.archiveReason && (
              <p className="text-sm">Motivo: {p.archiveReason}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                disabled={state.busy}
                onClick={() => showPhoto(p)}
              >
                Ver foto
              </Button>
              {manager && writable && !p.archivedAt && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => {
                    setCorrection({ kind: "photo", id: p.id });
                    setReason("");
                  }}
                >
                  Arquivar foto
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!photos.length && !state.loading && (
        <p className="text-sm text-muted-foreground">Nenhuma foto anexada.</p>
      )}
      {manager && writable && (
        <div className="flex flex-wrap gap-2">
          {order.status === "approved" &&
            !signatures.some((s) => s.purpose === "approval" && s.current) && (
              <Button
                type="button"
                disabled={disabled}
                onClick={() => openSign("approval")}
              >
                Registrar assinatura de aceite
              </Button>
            )}
          {order.status === "delivered" &&
            !signatures.some((s) => s.purpose === "delivery" && s.current) && (
              <Button
                type="button"
                disabled={disabled}
                onClick={() => openSign("delivery")}
              >
                Registrar assinatura de recebimento
              </Button>
            )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        As assinaturas registram o desenho feito pelo cliente, o conteúdo
        apresentado e o operador. Fotos adicionadas depois não passam a fazer
        parte de uma assinatura anterior.
      </p>
      {signatures.map((s) => (
        <article key={s.id} className="border rounded p-3 space-y-2">
          <strong>
            {s.purpose === "approval" ? "Aceite" : "Recebimento"} ·{" "}
            {s.payload.signerName}
          </strong>
          <p className="text-sm">
            {new Date(s.payload.signedAt).toLocaleString("pt-BR")} ·{" "}
            {s.voidedAt
              ? "Registro cancelado"
              : s.current
                ? "Escopo atual"
                : "Escopo anterior"}{" "}
            · {s.payload.relationship}
          </p>
          {s.integrity ? (
            <Graphic signature={s} />
          ) : (
            <p role="alert">Integridade do registro não confirmada.</p>
          )}
          <p className="text-xs">
            Total no ato: {money(s.payload.scope.total)} · Fotos referenciadas:{" "}
            {s.payload.photos.length}
          </p>
          <details className="text-xs">
            <summary>Dados do registro</summary>
            <p className="break-all">SHA-256: {s.digest}</p>
          </details>
          {s.voidReason && (
            <p>Motivo do cancelamento do registro: {s.voidReason}</p>
          )}
          {manager && writable && !s.voidedAt && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => {
                setCorrection({ kind: "signature", id: s.id });
                setReason("");
              }}
            >
              Cancelar registro de assinatura
            </Button>
          )}
        </article>
      ))}
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(v) => {
          if (!v) {
            setPreview(null);
            if (url.current) {
              URL.revokeObjectURL(url.current);
              url.current = null;
            }
          }
        }}
      >
        <DialogContent className="grid-cols-1 sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{preview?.caption}</DialogTitle>
            <DialogDescription>
              Arquivo preservado na OS #{order.number}
              {preview?.archivedAt ? " · arquivado" : ""}
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <>
              <img
                src={preview.url}
                alt={preview.caption}
                className="max-h-[65vh] w-full object-contain"
              />
              <p className="text-xs break-all">SHA-256: {preview.digest}</p>
              <a
                href={preview.url}
                download={
                  "foto-os-" +
                  order.number +
                  "-" +
                  preview.id +
                  (preview.mime === "image/png" ? ".png" : ".jpg")
                }
                className="underline"
              >
                Baixar arquivo guardado
              </a>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(purpose)}
        onOpenChange={(v) => {
          if (!v && !state.busy) setPurpose(null);
        }}
      >
        <DialogContent className="grid-cols-1 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {purpose === "approval"
                ? "Assinatura de aceite"
                : "Assinatura de recebimento"}
            </DialogTitle>
            <DialogDescription>
              OS #{order.number} · {order.vehicleSnapshot.plate} · Total{" "}
              {money(order.total)}
            </DialogDescription>
          </DialogHeader>
          <Feedback state={state} />
          <div className="text-sm space-y-1">
            <p>
              Veículo: {order.vehicleSnapshot.brand}{" "}
              {order.vehicleSnapshot.model} · {order.vehicleSnapshot.plate} ·{" "}
              {order.mileage} km
            </p>
            <p>Responsável: {order.assignedName || "Não definido"}</p>
            <p>Relato: {order.complaint}</p>
            <p>Diagnóstico: {order.diagnosis}</p>
            {order.notes && <p>Observações: {order.notes}</p>}
            <details>
              <summary>Checklist apresentado</summary>
              {Object.entries(order.checklist).map(([key, value]) => (
                <p key={key}>
                  {checks[key] || "Observações de entrada"}:{" "}
                  {{
                    ok: "Conferido / OK",
                    attention: "Atenção",
                    not_checked: "Não conferido",
                    empty: "Vazio",
                    quarter: "1/4",
                    half: "1/2",
                    three_quarters: "3/4",
                    full: "Cheio",
                  }[value] || value}
                </p>
              ))}
            </details>
            <p>
              Desconto: {money(order.discount)} · Total: {money(order.total)}
            </p>
          </div>
          <ul className="max-h-40 overflow-auto text-sm">
            {order.lines.map((l, i) => (
              <li key={i}>
                {l.name} · {l.quantity} {l.unit} × {money(l.unitPrice)} ={" "}
                {money(l.total)}
              </li>
            ))}
          </ul>
          {photos.some((p) => !p.archivedAt) && (
            <div className="text-sm space-y-2">
              <p>Fotos anexadas ao registro:</p>
              {photos
                .filter((p) => !p.archivedAt)
                .map((p) => (
                  <Button
                    key={p.id}
                    className="block h-auto w-full whitespace-normal break-words text-left"
                    type="button"
                    variant="outline"
                    disabled={state.busy}
                    onClick={() => showPhoto(p)}
                  >
                    Ver foto: {p.caption}
                  </Button>
                ))}
            </div>
          )}
          <p className="text-sm">
            {purpose === "approval"
              ? "Declaro que conferi e aceito o escopo e os valores desta ordem de serviço apresentados neste registro."
              : "Declaro o recebimento do veículo e a ciência dos serviços e observações apresentados nesta ordem de serviço."}
          </p>
          <form onSubmit={sign}>
            <fieldset disabled={disabled} className="space-y-3 min-w-0">
              <label className="block">
                Nome de quem assina
                <Input
                  required
                  aria-label="Nome de quem assina"
                  maxLength="150"
                  value={signer}
                  onChange={(e) => setSigner(e.target.value)}
                />
              </label>
              <label className="block">
                Vínculo com o cliente
                <Input
                  required
                  aria-label="Vínculo com o cliente"
                  maxLength="200"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                />
              </label>
              <SignaturePad
                value={strokes}
                onChange={setStrokes}
                disabled={disabled}
              />
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Cliente conferiu o conteúdo e assinou neste dispositivo.
              </label>
              <Button disabled={!strokes.length || !confirmed}>
                Salvar assinatura
              </Button>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(correction)}
        onOpenChange={(v) => {
          if (!v && !state.busy) setCorrection(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {correction?.kind === "photo"
                ? "Arquivar foto"
                : "Cancelar registro de assinatura"}
            </DialogTitle>
            <DialogDescription>
              {correction?.kind === "photo"
                ? "A foto será arquivada e o arquivo original será preservado. Informe o motivo."
                : "Este cancelamento afeta apenas o registro desenhado. O status e o aceite da OS permanecem; use Revisar orçamento para alterar a autorização. O original será preservado. Informe o motivo."}
            </DialogDescription>
          </DialogHeader>
          <Feedback state={state} />
          <form onSubmit={correct} className="space-y-3">
            <Input
              required
              aria-label="Motivo da correção do anexo"
              maxLength="1000"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button disabled={disabled || !reason.trim()}>
              Confirmar correção
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
