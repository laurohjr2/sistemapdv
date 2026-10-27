import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import release from "../release.json";
export default function ApplicationVersion() {
  const [server, setServer] = useState(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .get("/version")
      .then((r) => {
        if (active) setServer(r.data);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const mismatch = server && server.version !== release.version;
  return (
    <footer className="px-4 sm:px-6 py-3 border-t text-xs text-muted-foreground">
      <div className="flex flex-wrap justify-between gap-2">
        <Link className="underline" to="/about">
          Sistema PDV · Interface {release.version}
        </Link>
        <span>
          {server
            ? "Servidor " + server.version
            : failed
              ? "Não foi possível consultar a versão do servidor"
              : "Consultando versão..."}
        </span>
      </div>
      {mismatch && (
        <p
          role="alert"
          className="mt-2 rounded border border-amber-300 p-2 text-amber-900 dark:text-amber-100"
        >
          Interface e servidor estão em versões diferentes.{" "}
          <button
            className="underline"
            onClick={() => window.location.reload()}
          >
            Atualizar página
          </button>
          . Se persistir, informe ao responsável pela instalação.
        </p>
      )}
    </footer>
  );
}
