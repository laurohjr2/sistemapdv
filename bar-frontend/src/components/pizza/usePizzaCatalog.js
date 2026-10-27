import { useEffect, useState } from "react";
import api from "../../lib/api";
export default function usePizzaCatalog(enabled) {
  const [menu, setMenu] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!enabled) {
      setMenu(null);
      return;
    }
    api
      .get("/pizza/catalog")
      .then((r) => {
        if (active) {
          setMenu(r.data);
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar o cardápio de pizzas.");
      });
    return () => {
      active = false;
    };
  }, [enabled]);
  return { menu, error };
}
