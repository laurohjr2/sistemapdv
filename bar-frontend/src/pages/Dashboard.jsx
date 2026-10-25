import { useState, useEffect } from 'react';
import { reportsAPI } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { 
  DollarSign, 
  Receipt, 
  TrendingUp, 
  AlertTriangle,
  Users,
  Package
} from 'lucide-react';
import '../App.css';

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await reportsAPI.getDashboard();
      setDashboardData(response.data);
    } catch (error) {
      setError('Erro ao carregar dados do dashboard');
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const { todaySales = {}, openComandas = 0, lowStockCount = 0, topProducts = [] } = dashboardData || {};

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(todaySales.totalSales || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {todaySales.totalComandas || 0} comandas fechadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(todaySales.averageTicket || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Média por comanda hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comandas Abertas</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openComandas}</div>
            <p className="text-xs text-muted-foreground">
              Mesas ocupadas atualmente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground">
              Produtos com estoque baixo
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Produtos Mais Vendidos Hoje</CardTitle>
            <CardDescription>
              Top 5 produtos por faturamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(topProducts && topProducts.length > 0) ? (
                topProducts.map((product, index) => (
                  <div key={product?.productId || index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge variant="secondary" className="w-6 h-6 p-0 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium">{product?.product?.name || 'Produto sem nome'}</p>
                        <p className="text-sm text-muted-foreground">
                          Qtd: {product?.totalQuantity || 0}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(product?.totalRevenue || 0)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma venda registrada hoje
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo do Sistema</CardTitle>
            <CardDescription>
              Status geral das operações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <span>Comandas Abertas</span>
                </div>
                <Badge variant={openComandas > 0 ? "default" : "secondary"}>
                  {openComandas}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>Produtos em Falta</span>
                </div>
                <Badge variant={lowStockCount > 0 ? "destructive" : "secondary"}>
                  {lowStockCount}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>Faturamento Hoje</span>
                </div>
                <Badge variant="default">
                  {formatCurrency(todaySales.totalSales || 0)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

