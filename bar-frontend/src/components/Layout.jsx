import { useBusiness } from "../hooks/useBusiness";
import ApplicationVersion from "./ApplicationVersion";
import { useState } from "react";
import BusinessBrand from "./BusinessBrand";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { hasRole } from "../lib/auth";
import { Button } from "./ui/button";
import {
  PackageSearch,
  Wrench,
  Pizza,
  FileText,
  Truck,
  ShoppingBag,
  Wallet,
  Info,
  Home,
  Settings,
  ChefHat,
  Users,
  Package,
  Warehouse,
  Table,
  Receipt,
  Clock,
  BarChart3,
  Printer,
  Menu,
  X,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";

const Layout = () => {
  const { user, logout } = useAuth();
  const { business } = useBusiness();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: Home,
      roles: ["gerente", "admin"],
      area: "Visão geral",
    },
    {
      name: "Vendas",
      href: "/sales",
      icon: Receipt,
      roles: ["garcom", "gerente", "admin"],
      area: "Comercial",
    },
    {
      name: "Orçamentos",
      href: "/quotes",
      icon: FileText,
      roles: ["garcom", "gerente", "admin"],
      module: "quotes",
      area: "Comercial",
    },
    {name:"Oficina",href:"/workshop",icon:Wrench,roles:["garcom","gerente","admin"],module:"workshop",area:"Atendimento"},
    {
      name: "Mesas",
      href: "/tables",
      icon: Table,
      roles: ["garcom", "gerente", "admin"],
      module: "tables",
      area: "Atendimento",
    },
    {
      name: "Comandas",
      href: "/comandas",
      icon: Receipt,
      roles: ["garcom", "gerente", "admin"],
      module: "tables",
      area: "Atendimento",
    },
    {
      name: "Cozinha",
      href: "/kitchen",
      icon: ChefHat,
      roles: ["garcom", "gerente", "admin"],
      module: "kitchen",
      area: "Atendimento",
    },
    {
      name: "Clientes",
      href: "/customers",
      icon: Users,
      roles: ["garcom", "gerente", "admin"],
      area: "Cadastros e estoque",
    },
    {name:"Fichas técnicas",href:"/recipes",icon:ChefHat,roles:["gerente","admin"],module:"recipes",area:"Cadastros e estoque"},
    {name:"Balanças e etiquetas",href:"/scale-labels",icon:Printer,roles:["garcom","gerente","admin"],module:"market",area:"Cadastros e estoque"},
    {name:"Lotes e validade",href:"/market",icon:PackageSearch,roles:["garcom","gerente","admin"],module:"market",area:"Cadastros e estoque"},
    {name:"Autopeças",href:"/autoparts",icon:PackageSearch,roles:["garcom","gerente","admin"],module:"autoparts",area:"Cadastros e estoque"},
    {name:"Pizzaria",href:"/pizzeria",icon:Pizza,roles:["gerente","admin"],module:"pizza",area:"Cadastros e estoque"},
    {
      name: "Produtos e serviços",
      href: "/products",
      icon: Package,
      roles: ["gerente", "admin"],
      area: "Cadastros e estoque",
    },
    {
      name: "Estoque",
      href: "/stock",
      icon: Warehouse,
      roles: ["gerente", "admin"],
      area: "Cadastros e estoque",
    },
    {
      name: "Fornecedores",
      href: "/suppliers",
      icon: Truck,
      roles: ["gerente", "admin"],
      module: "purchasing",
      area: "Compras",
    },
    {
      name: "Compras",
      href: "/purchases",
      icon: ShoppingBag,
      roles: ["gerente", "admin"],
      module: "purchasing",
      area: "Compras",
    },
    {
      name: "Financeiro",
      href: "/finance",
      icon: Wallet,
      roles: ["gerente", "admin"],
      module: "finance",
      area: "Gestão",
    },
    {
      name: "Relatórios",
      href: "/reports",
      icon: BarChart3,
      roles: ["gerente", "admin"],
      area: "Gestão",
    },
    {
      name: "Configurações",
      href: "/settings",
      icon: Settings,
      roles: ["gerente", "admin"],
      area: "Sistema",
    },
    {
      name: "Usuários",
      href: "/users",
      icon: Users,
      roles: ["admin"],
      area: "Sistema",
    },
    {
      name: "Sobre o sistema",
      href: "/about",
      icon: Info,
      roles: ["garcom", "gerente", "admin"],
      area: "Sistema",
    },
  ];
  const filteredNavigation = navigation.filter(
    (item) =>
      hasRole(item.roles) &&
      (!item.module || business.modules?.[item.module] !== false),
  );
  function renderNavigation() {
    return filteredNavigation.map((item, index) => (
      <div key={item.href}>
        {(index === 0 || filteredNavigation[index - 1].area !== item.area) && (
          <p className="px-3 pb-1 pt-4 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            {item.area}
          </p>
        )}
        <Link
          to={item.href}
          aria-current={location.pathname === item.href ? "page" : undefined}
          onClick={() => setSidebarOpen(false)}
          className={
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors " +
            (location.pathname === item.href
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted")
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.name}</span>
        </Link>
      </div>
    ));
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? "block" : "hidden"}`}
      >
        <div
          className="fixed inset-0 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="fixed left-0 top-0 h-full w-64 overflow-y-auto bg-card border-r border-border">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center space-x-3">
              <BusinessBrand />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <nav className="p-4 space-y-2">{renderNavigation()}</nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 overflow-y-auto lg:bg-card lg:border-r lg:border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center space-x-3">
            <BusinessBrand />
          </div>
        </div>
        <nav className="p-4 space-y-2">{renderNavigation()}</nav>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {user?.support && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 bg-amber-100 p-3 text-amber-950"
          >
            <span>
              {user.master
                ? "Acesso Master — controle total"
                : "Modo de suporte — somente consulta"}{" "}
              · empresa {user.company}
            </span>
            <Button
              variant="outline"
              onClick={async () => {
                await logout();
                navigate("/support");
              }}
            >
              Sair do suporte
            </Button>
          </div>
        )}
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <h2 className="text-base sm:text-lg font-semibold truncate max-w-32 sm:max-w-none">
                {filteredNavigation.find(
                  (item) => item.href === location.pathname,
                )?.name || "Dashboard"}
              </h2>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button variant="ghost" size="sm" onClick={toggleDarkMode}>
                {darkMode ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>

              <div className="flex items-center space-x-2">
                <span className="text-xs sm:text-sm text-muted-foreground max-w-28 sm:max-w-none truncate">
                  {user?.username}{" "}
                </span>
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="px-4 sm:px-6 py-2 border-b bg-muted/40 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span className="rounded-full border px-2 py-1 text-xs whitespace-nowrap">
            {user?.master
              ? "Master — fornecedor"
              : user?.support
                ? "Suporte — consulta"
                : user?.role === "admin"
                  ? "Administrador da empresa"
                  : user?.role === "gerente"
                    ? "Gerente"
                    : "Atendente"}
          </span>
          <span>
            Empresa:{" "}
            <strong className="text-foreground">{business.companyName}</strong>{" "}
            · {user?.company}
          </span>
          {business.businessProfileName && (
            <span>Perfil: {business.businessProfileName}</span>
          )}
        </div>
        <main className="p-4 sm:p-6 bg-muted/20 min-h-[75vh]">
          <Outlet />
        </main>
        <ApplicationVersion />
      </div>
    </div>
  );
};

export default Layout;
