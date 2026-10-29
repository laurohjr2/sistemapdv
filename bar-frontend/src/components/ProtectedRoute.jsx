import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { canNavigate } from "../lib/access";
import { hasRole } from "../lib/auth";

const ProtectedRoute = ({ children, requiredRoles = null }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && !hasRole(requiredRoles)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Acesso Negado
          </h2>
          <p className="text-gray-600">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  if (pathname !== "/" && !canNavigate(user, pathname))
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-bold">Acesso não permitido</h1>
        <p>
          Seu perfil não permite abrir esta área. Consulte Meus acessos ou
          solicite uma revisão ao administrador.
        </p>
        <a className="underline" href="/my-access">
          Meus acessos
        </a>
      </div>
    );
  return children;
};

export default ProtectedRoute;
