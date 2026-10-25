import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, DollarSign, ShoppingCart, Users, Package, 
  Calendar, Download, Filter, BarChart3, PieChart as PieChartIcon,
  LineChart as LineChartIcon, TrendingDown, FileText, Printer
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias atrás
    to: new Date()
  });
  
  // Dados dos relatórios
  const [salesData, setSalesData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [paymentData, setPaymentData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [productData, setProductData] = useState([]);
  const [waiterData, setWaiterData] = useState([]);
  const [financialSummary, setFinancialSummary] = useState({});
  const [stockReport, setStockReport] = useState([]);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [groupBy, setGroupBy] = useState('day');

  useEffect(() => {
    fetchAllReports();
  }, [dateRange, groupBy]);

  const fetchAllReports = async () => {
    setLoading(true);
    try {
      const startDate = dateRange.from?.toISOString();
      const endDate = dateRange.to?.toISOString();
      
      const [
        salesResponse,
        categoryResponse,
        paymentResponse,
        hourlyResponse,
        productResponse,
        waiterResponse,
        financialResponse,
        stockResponse
      ] = await Promise.all([
        api.get(`/reports/sales?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`),
        api.get(`/reports/categories?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/reports/payments?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/reports/hourly?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/reports/products?startDate=${startDate}&endDate=${endDate}&limit=10`),
        api.get(`/reports/waiters?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/reports/financial?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/reports/stock`)
      ]);
      
      setSalesData(salesResponse.data);
      setCategoryData(categoryResponse.data);
      setPaymentData(paymentResponse.data);
      setHourlyData(hourlyResponse.data);
      setProductData(productResponse.data);
      setWaiterData(waiterResponse.data);
      setFinancialSummary(financialResponse.data);
      setStockReport(stockResponse.data);
      
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async (reportType) => {
    try {
      const startDate = dateRange.from?.toISOString();
      const endDate = dateRange.to?.toISOString();
      
      const response = await api.get(`/reports/export/pdf?type=${reportType}&startDate=${startDate}&endDate=${endDate}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      toast.error('Erro ao exportar relatório');
    }
  };

  const exportToCSV = async (reportType) => {
    try {
      const startDate = dateRange.from?.toISOString();
      const endDate = dateRange.to?.toISOString();
      
      const response = await api.get(`/reports/export/csv?type=${reportType}&startDate=${startDate}&endDate=${endDate}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      toast.error('Erro ao exportar relatório');
    }
  };

  const printReport = (reportType) => {
    const printWindow = window.open('', '_blank');
    let content = '';
    
    switch (reportType) {
      case 'sales':
        content = generateSalesReportHTML();
        break;
      case 'financial':
        content = generateFinancialReportHTML();
        break;
      case 'stock':
        content = generateStockReportHTML();
        break;
      default:
        content = generateOverviewReportHTML();
    }
    
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const generateSalesReportHTML = () => {
    return `
      <html>
        <head>
          <title>Relatório de Vendas</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .table th { background-color: #f2f2f2; }
            .summary { margin: 20px 0; padding: 15px; background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Mineiro's Bar - Relatório de Vendas</h1>
            <p>Período: ${dateRange.from?.toLocaleDateString('pt-BR')} a ${dateRange.to?.toLocaleDateString('pt-BR')}</p>
          </div>
          
          <div class="summary">
            <h3>Resumo Financeiro</h3>
            <p><strong>Receita Total:</strong> R$ ${parseFloat(financialSummary.totalRevenue || 0).toFixed(2)}</p>
            <p><strong>Total de Vendas:</strong> ${financialSummary.totalSales || 0}</p>
            <p><strong>Ticket Médio:</strong> R$ ${parseFloat(financialSummary.averageTicket || 0).toFixed(2)}</p>
          </div>
          
          <table class="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Vendas</th>
                <th>Receita</th>
              </tr>
            </thead>
            <tbody>
              ${salesData.map(item => `
                <tr>
                  <td>${item.date}</td>
                  <td>${item.sales}</td>
                  <td>R$ ${parseFloat(item.revenue).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
  };

  const generateFinancialReportHTML = () => {
    return `
      <html>
        <head>
          <title>Relatório Financeiro</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .table th { background-color: #f2f2f2; }
            .summary { margin: 20px 0; padding: 15px; background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Mineiro's Bar - Relatório Financeiro</h1>
            <p>Período: ${dateRange.from?.toLocaleDateString('pt-BR')} a ${dateRange.to?.toLocaleDateString('pt-BR')}</p>
          </div>
          
          <div class="summary">
            <h3>Resumo por Forma de Pagamento</h3>
            ${paymentData.map(item => `
              <p><strong>${item.method}:</strong> R$ ${parseFloat(item.total).toFixed(2)} (${item.count} transações)</p>
            `).join('')}
          </div>
        </body>
      </html>
    `;
  };

  const generateStockReportHTML = () => {
    return `
      <html>
        <head>
          <title>Relatório de Estoque</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .table th { background-color: #f2f2f2; }
            .alert { color: red; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Mineiro's Bar - Relatório de Estoque</h1>
            <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          
          <table class="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Estoque Atual</th>
                <th>Estoque Mínimo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${stockReport.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.currentStock}</td>
                  <td>${item.minStock}</td>
                  <td class="${item.status === 'Baixo' ? 'alert' : ''}">${item.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
  };

  const generateOverviewReportHTML = () => {
    return `
      <html>
        <head>
          <title>Relatório Geral</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .summary { margin: 20px 0; padding: 15px; background-color: #f9f9f9; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Mineiro's Bar - Relatório Geral</h1>
            <p>Período: ${dateRange.from?.toLocaleDateString('pt-BR')} a ${dateRange.to?.toLocaleDateString('pt-BR')}</p>
          </div>
          
          <div class="grid">
            <div class="summary">
              <h3>Resumo Financeiro</h3>
              <p><strong>Receita Total:</strong> R$ ${parseFloat(financialSummary.totalRevenue || 0).toFixed(2)}</p>
              <p><strong>Total de Vendas:</strong> ${financialSummary.totalSales || 0}</p>
              <p><strong>Ticket Médio:</strong> R$ ${parseFloat(financialSummary.averageTicket || 0).toFixed(2)}</p>
            </div>
            
            <div class="summary">
              <h3>Produtos Mais Vendidos</h3>
              ${productData.slice(0, 5).map((item, index) => `
                <p><strong>${index + 1}.</strong> ${item.name} - ${item.quantity} unidades</p>
              `).join('')}
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando relatórios...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">
            Análise de vendas, estoque e performance do estabelecimento
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => printReport(activeTab)}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={() => exportToCSV(activeTab)}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button onClick={() => exportToPDF(activeTab)}>
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label>Período</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateRange.from?.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange({...dateRange, from: new Date(e.target.value)})}
                />
                <Input
                  type="date"
                  value={dateRange.to?.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange({...dateRange, to: new Date(e.target.value)})}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Agrupar por</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button onClick={fetchAllReports}>
              <Filter className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="sales">Vendas</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="financial">Financeiro</TabsTrigger>
          <TabsTrigger value="stock">Estoque</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {parseFloat(financialSummary.totalRevenue || 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {financialSummary.revenueGrowth > 0 ? '+' : ''}{parseFloat(financialSummary.revenueGrowth || 0).toFixed(1)}% vs período anterior
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{financialSummary.totalSales || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {financialSummary.salesGrowth > 0 ? '+' : ''}{parseFloat(financialSummary.salesGrowth || 0).toFixed(1)}% vs período anterior
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
                  R$ {parseFloat(financialSummary.averageTicket || 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {financialSummary.ticketGrowth > 0 ? '+' : ''}{parseFloat(financialSummary.ticketGrowth || 0).toFixed(1)}% vs período anterior
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Produtos Vendidos</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{financialSummary.totalProducts || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Itens únicos vendidos
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Vendas por Período</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="revenue" stroke="#8884d8" fill="#8884d8" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Vendas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="sales" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Vendas Diárias</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="sales" fill="#8884d8" name="Vendas" />
                    <Bar dataKey="revenue" fill="#82ca9d" name="Receita" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Vendas por Hora</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="sales" stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Produtos Mais Vendidos</CardTitle>
              <CardDescription>
                Top 10 produtos por quantidade vendida
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={productData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="financial" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Formas de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({method, percent}) => `${method} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total"
                    >
                      {paymentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Resumo por Forma de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {paymentData.map((payment, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{payment.method}</p>
                        <p className="text-sm text-muted-foreground">{payment.count} transações</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">R$ {parseFloat(payment.total).toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          {((payment.total / financialSummary.totalRevenue) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="stock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status do Estoque</CardTitle>
              <CardDescription>
                Produtos com estoque baixo ou em falta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stockReport.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Estoque atual: {item.currentStock} | Mínimo: {item.minStock}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-sm ${
                        item.status === 'Baixo' ? 'bg-red-100 text-red-800' :
                        item.status === 'Médio' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
                
                {stockReport.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Todos os produtos estão com estoque adequado
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;

