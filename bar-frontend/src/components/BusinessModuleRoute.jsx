import { Link } from "react-router-dom";
import { useBusiness } from "../hooks/useBusiness";
export default function BusinessModuleRoute({ module, children }) {
  const { business, businessLoading, businessError } = useBusiness();
  if (businessLoading)
    return <p role="status">Carregando os módulos da empresa...</p>;
  if (businessError) return <p role="alert">{businessError}</p>;
  if (business.modules?.[module] === false)
    return (
      <div className="commerce-panel p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Módulo desativado</h1>
        <p>Este recurso não está ativo para a empresa selecionada.</p>
        <Link className="underline" to="/sales">
          Voltar para Vendas
        </Link>
      </div>
    );
  return children;
}
