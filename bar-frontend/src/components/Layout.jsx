import { useState } from 'react';
import BusinessBrand from './BusinessBrand';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { hasRole } from '../lib/auth';
import { Button } from './ui/button';
import { 
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
  Sun
} from 'lucide-react';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home, roles: ['gerente', 'admin'] },
    { name: 'Vendas', href: '/sales', icon: Receipt, roles: ['garcom', 'gerente', 'admin'] },
    { name: 'Mesas', href: '/tables', icon: Table, roles: ['garcom', 'gerente', 'admin'] },
    { name: 'Produtos', href: '/products', icon: Package, roles: ['gerente', 'admin'] },
    { name: 'Impressão', href: '/print', icon: Printer, roles: ['garcom', 'gerente', 'admin'] },
    { name: 'Estoque', href: '/stock', icon: Warehouse, roles: ['gerente', 'admin'] },
    { name: 'Comandas', href: '/comandas', icon: Receipt, roles: ['garcom', 'gerente', 'admin'] },
    { name: 'Cozinha', href: '/kitchen', icon: ChefHat, roles: ['garcom', 'gerente', 'admin'] },
    { name: 'Fila de Espera', href: '/queue', icon: Clock, roles: ['garcom', 'gerente', 'admin'] },
    { name: 'Relatórios', href: '/reports', icon: BarChart3, roles: ['gerente', 'admin'] },
    { name: 'Configurações', href: '/settings', icon: Settings, roles: ['gerente', 'admin'] },
    { name: 'Usuários', href: '/users', icon: Users, roles: ['admin'] },
  ];

  const filteredNavigation = navigation.filter(item => 
    hasRole(item.roles)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
        <div className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border">
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
          <nav className="p-4 space-y-2">
            {filteredNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:bg-card lg:border-r lg:border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center space-x-3">
            <BusinessBrand />
          </div>
        </div>
        <nav className="p-4 space-y-2">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold">
                {filteredNavigation.find(item => item.href === location.pathname)?.name || 'Dashboard'}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleDarkMode}
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  {user?.username} ({user?.role})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

