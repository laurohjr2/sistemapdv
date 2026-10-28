import { useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import api from "../../lib/api";
import { Button } from "../ui/button";
import { useRecords } from "../commerce/helpers";
import { Feedback } from "../commerce/shared";
export default function PizzaSaleKitchen({ recipes = false }) {
  const state = useRecords(recipes ? "/recipes/kitchen" : "/pizza/kitchen"),
    { user } = useAuth();
  const { load } = state;
  useEffect(() => {
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);
  const labels = {
    pendente: "Pendente",
    preparando: "Preparando",
    pronto: "Pronto para retirada",
  };
  const next = {
    pendente: ["preparando", "Iniciar preparo"],
    preparando: ["pronto", "Marcar pronta"],
    pronto: ["entregue", "Registrar retirada"],
  };
  return (
    <section className="commerce-panel p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-lg">
            {recipes
              ? "Preparados do balcão — vendas pagas"
              : "Pizzas do balcão — vendas pagas"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Identifique o pedido pelo número da venda no cupom. Atualização a
            cada 20 segundos.
          </p>
        </div>
        <Button variant="outline" onClick={load}>
          Atualizar balcão
        </Button>
      </div>
      <Feedback state={state} />
      <div className="grid lg:grid-cols-2 gap-3">
        {state.data.map((item) => (
          <article key={item.id} className="rounded-xl border p-4 space-y-2">
            <div className="flex justify-between gap-3">
              <strong>Venda #{item.sale_id}</strong>
              <span>{labels[item.preparationStatus]}</span>
            </div>
            <p>
              {Number(item.quantity)}x{" "}
              {item.pizza?.description || item.product?.name}
            </p>
            {item.notes && (
              <p className="font-medium">Observações: {item.notes}</p>
            )}
            <Button
              disabled={state.busy || (user?.support && !user?.master)}
              onClick={() =>
                state.run(() =>
                  api.put(
                    (recipes ? "/recipes/kitchen/" : "/pizza/kitchen/") +
                      item.id,
                    {
                      status: next[item.preparationStatus][0],
                    },
                  ),
                )
              }
            >
              {next[item.preparationStatus][1]}
            </Button>
          </article>
        ))}
      </div>
      {!state.loading && !state.data.length && (
        <p className="text-sm text-muted-foreground">
          {recipes
            ? "Nenhum preparado de venda direta aguardando retirada."
            : "Nenhuma pizza de venda direta aguardando retirada."}
        </p>
      )}
    </section>
  );
}
