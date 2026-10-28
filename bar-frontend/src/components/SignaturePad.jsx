import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
export default function SignaturePad({ value, onChange, disabled = false }) {
  const ref = useRef(null),
    line = useRef(null),
    [drawing, setDrawing] = useState(false);
  useEffect(() => {
    const canvas = ref.current,
      ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 640, 200);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 640, 200);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of value) {
      ctx.beginPath();
      stroke.forEach((p, i) =>
        i ? ctx.lineTo(p.x * 640, p.y * 200) : ctx.moveTo(p.x * 640, p.y * 200),
      );
      ctx.stroke();
    }
  }, [value]);
  const point = (e) => {
    const rect = ref.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };
  function start(e) {
    if (disabled || !e.isPrimary || e.button !== 0 || line.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    line.current = [point(e)];
    setDrawing(true);
  }
  function move(e) {
    if (disabled || !line.current) return;
    e.preventDefault();
    const p = point(e),
      previous = line.current.at(-1),
      ctx = ref.current.getContext("2d");
    line.current.push(p);
    ctx.beginPath();
    ctx.moveTo(previous.x * 640, previous.y * 200);
    ctx.lineTo(p.x * 640, p.y * 200);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  function end() {
    if (!line.current) return;
    const stroke = line.current;
    line.current = null;
    setDrawing(false);
    if (stroke.length > 1) onChange([...value, stroke]);
    else onChange([...value]);
  }
  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        width="640"
        height="200"
        aria-label="Área para desenhar a assinatura"
        role="img"
        className="border rounded bg-white w-full touch-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <div className="flex flex-wrap gap-3 items-center">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || drawing}
          onClick={() => onChange([])}
        >
          Limpar assinatura
        </Button>
        <span className="text-xs text-muted-foreground">
          Desenhe com o dedo, caneta ou mouse.
        </span>
      </div>
    </div>
  );
}
