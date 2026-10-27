import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { DatePickerWithRange } from '../components/ui/date-range-picker';
import { 
  Printer, Download, Receipt, FileText, Search, 
  Calendar, RefreshCw, Eye, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';

const Print = () => {
  const [loading, setLoading] = useState(false);
  const [comandas, setComandas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 dias atrás
    to: new Date()
  });
  
  const [activeTab, setActiveTab] = useState('receipts');

  useEffect(() => {
    fetchComandas();
  }, [statusFilter, dateRange]);

  const printTest = async () => {
    try {
      const response=await api.post('/printer/test',{}, {responseType:'blob'});
      const url=URL.createObjectURL(new Blob([response.data],{type:'application/pdf'}));
      const link=document.createElement('a');link.href=url;link.download='teste-impressao.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      toast.success('PDF de teste gerado. Abra-o e selecione sua impressora.');
    }catch {toast.error('Não foi possível gerar o teste de impressão');}
  };

  const fetchComandas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (dateRange.from) params.append('startDate', dateRange.from.toISOString());
      if (dateRange.to) params.append('endDate', dateRange.to.toISOString());
      params.append('limit', '100');
      
      const response = await api.get(`/comandas?${params.toString()}`);
      setComandas(response.data.comandas || []);
    } catch (error) {
      console.error('Erro ao carregar comandas:', error);
      toast.error('Erro ao carregar comandas');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = async (comandaId, isReprint = false) => {
    try {
      const endpoint = isReprint 
        ? `/print/comanda/${comandaId}/reprint`
        : `/print/comanda/${comandaId}`;
      
      const response = await api.get(endpoint, {
        responseType: 'blob'
      });

      // Criar URL do blob e fazer download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `comanda-${comandaId}${isReprint ? '-copia' : ''}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(isReprint ? 'Segunda via impressa com sucesso!' : 'Cupom impresso com sucesso!');
    } catch (error) {
      console.error('Erro ao imprimir cupom:', error);
      toast.error('Erro ao imprimir cupom');
    }
  };

  const handlePrintSalesReport = async () => {
    try {
      const startDate = dateRange.from?.toISOString();
      const endDate = dateRange.to?.toISOString();
      
      const response = await api.get(`/print/sales-report?startDate=${startDate}&endDate=${endDate}&format=pdf`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-vendas-${startDate?.split('T')[0]}-${endDate?.split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Relatório de vendas gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar relatório de vendas');
    }
  };

  const handlePrintProductReport = async () => {
    try {
      const startDate = dateRange.from?.toISOString();
      const endDate = dateRange.to?.toISOString();
      
      const response = await api.get(`/print/product-report?startDate=${startDate}&endDate=${endDate}&format=pdf`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-produtos-${startDate?.split('T')[0]}-${endDate?.split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Relatório de produtos gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar relatório de produtos');
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      'aberta': 'bg-blue-100 text-blue-800',
      'fechada': 'bg-green-100 text-green-800',
      'cancelada': 'bg-red-100 text-red-800'
    };
    
    const labels = {
      'aberta': 'Aberta',
      'fechada': 'Fechada',
      'cancelada': 'Cancelada'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${variants[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getPaymentStatusBadge = (status) => {
    const variants = {
      'pendente': 'bg-yellow-100 text-yellow-800',
      'pago': 'bg-green-100 text-green-800',
      'nao_pago': 'bg-red-100 text-red-800'
    };
    
    const labels = {
      'pendente': 'Pendente',
      'pago': 'Pago',
      'nao_pago': 'Não Pago'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${variants[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const filteredComandas = comandas.filter(comanda => {
    const matchesSearch = !searchTerm || 
      comanda.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comanda.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comanda.table?.tableNumber?.toString().includes(searchTerm);
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando dados para impressão...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Impressão</h1><Button variant="outline" onClick={printTest}>Gerar PDF de teste</Button>
          <p className="text-muted-foreground">
            Impressão de cupons e relatórios
          </p>
        </div>
        
        <div className="flex gap-2 items-center">
          <DatePickerWithRange
            date={dateRange}
            onDateChange={setDateRange}
          />
          <Button variant="outline" onClick={fetchComandas}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="receipts">Cupons de Comanda</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>
        
        <TabsContent value="receipts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Cupons de Comanda
              </CardTitle>
              <CardDescription>
                Imprima cupons de comandas fechadas ou reimprima segundas vias
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="flex gap-4 items-center mb-6">
                <div className="flex-1">
                  <Label htmlFor="search">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="ID da comanda, cliente ou mesa..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                
                <div className="w-[180px]">
                  <Label htmlFor="status">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="fechada">Fechada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tabela de comandas */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Cliente/Mesa</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredComandas.map((comanda) => (
                      <TableRow key={comanda.id}>
                        <TableCell className="font-mono text-sm">
                          {comanda.id.substring(0, 8).toUpperCase()}
                        </TableCell>
                        <TableCell>
                          {comanda.closedAt 
                            ? new Date(comanda.closedAt).toLocaleString('pt-BR')
                            : new Date(comanda.openedAt).toLocaleString('pt-BR')
                          }
                        </TableCell>
                        <TableCell>
                          {comanda.type === 'mesa' && comanda.table
                            ? `Mesa ${comanda.table.tableNumber}`
                            : comanda.customerName || 'Balcão'
                          }
                        </TableCell>
                        <TableCell>
                          R$ {parseFloat(comanda.finalValue || comanda.totalValue).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(comanda.status)}
                        </TableCell>
                        <TableCell>
                          {comanda.paymentStatus && getPaymentStatusBadge(comanda.paymentStatus)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {comanda.status === 'fechada' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePrintReceipt(comanda.id)}
                                  title="Imprimir cupom"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePrintReceipt(comanda.id, true)}
                                  title="Reimprimir (segunda via)"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {filteredComandas.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma comanda encontrada para os filtros selecionados
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reports" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Relatório de Vendas
                </CardTitle>
                <CardDescription>
                  Relatório detalhado de vendas por período
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Período</Label>
                  <DatePickerWithRange
                    date={dateRange}
                    onDateChange={setDateRange}
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    O relatório incluirá:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Resumo executivo de vendas</li>
                    <li>Detalhamento por comanda</li>
                    <li>Informações de atendentes</li>
                    <li>Métodos de pagamento</li>
                  </ul>
                </div>
                
                <Button 
                  onClick={handlePrintSalesReport}
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Gerar Relatório de Vendas
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Relatório de Produtos
                </CardTitle>
                <CardDescription>
                  Análise de performance dos produtos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Período</Label>
                  <DatePickerWithRange
                    date={dateRange}
                    onDateChange={setDateRange}
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    O relatório incluirá:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Produtos mais vendidos</li>
                    <li>Quantidade vendida por produto</li>
                    <li>Receita por produto</li>
                    <li>Número de pedidos</li>
                  </ul>
                </div>
                
                <Button 
                  onClick={handlePrintProductReport}
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Gerar Relatório de Produtos
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Estatísticas rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas do Período Selecionado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {filteredComandas.filter(c => c.status === 'fechada').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Comandas Fechadas</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    R$ {filteredComandas
                      .filter(c => c.status === 'fechada')
                      .reduce((sum, c) => sum + parseFloat(c.finalValue || c.totalValue), 0)
                      .toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">Faturamento Total</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {filteredComandas.filter(c => c.paymentStatus === 'nao_pago').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Não Pagos</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    R$ {(() => {
                      const fechadas = filteredComandas.filter(c => c.status === 'fechada');
                      const total = fechadas.reduce((sum, c) => sum + parseFloat(c.finalValue || c.totalValue), 0);
                      return fechadas.length > 0 ? (total / fechadas.length).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '0.00';
                    })()}
                  </div>
                  <div className="text-sm text-muted-foreground">Ticket Médio</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Print;

