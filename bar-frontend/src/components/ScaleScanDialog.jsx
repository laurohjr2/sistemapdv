import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { money } from "./commerce/helpers";
export default function ScaleScanDialog({
  item,
  onClose,
  onConfirm,
  error,
  weight,
  onWeightChange,
  confirmed,
  onConfirmedChange,
}) {
  return (
    <Dialog
      open={Boolean(item)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="grid-cols-1 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conferir etiqueta da balança</DialogTitle>
          <DialogDescription>{item?.productName}</DialogDescription>
        </DialogHeader>
        {item && (
          <div className="space-y-3">
            <p>
              Código: {item.barcode} · PLU {item.plu}
            </p>
            <p className="text-xl font-semibold">
              {item.quantity.toLocaleString("pt-BR", {
                minimumFractionDigits: 3,
              })}{" "}
              kg × {money(item.unitPrice)}/kg
            </p>
            <p className="text-2xl font-bold">Total: {money(item.total)}</p>
            {item.mode === "price" && (
              <div className="space-y-3">
                <p className="text-sm">
                  Peso estimado a partir do preço total. Confira e informe o
                  peso real impresso na embalagem; o valor deve continuar igual
                  ao codificado na etiqueta.
                </p>
                <label className="block">
                  Peso da embalagem (kg)
                  <Input
                    aria-label="Peso da embalagem (kg)"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={weight}
                    onChange={(e) => onWeightChange(e.target.value)}
                  />
                </label>
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => onConfirmedChange(e.target.checked)}
                  />
                  Conferi o peso e o preço/kg na embalagem e na balança.
                </label>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Confira a embalagem. A leitura não identifica o lote; a separação
              dos lotes segue o controle de validade do produto.
            </p>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <Button
              disabled={item.mode === "price" && !confirmed}
              onClick={onConfirm}
            >
              Adicionar peso ao carrinho
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
