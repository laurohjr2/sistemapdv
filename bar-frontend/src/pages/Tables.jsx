import { useBusiness } from '../hooks/useBusiness';
import { receiptHeader, escapeHtml } from '../lib/receipt';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Edit, Trash2, Users, DollarSign, Clock, CheckCircle, XCircle, Receipt, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';

const Tables = () => {
  const {business} = useBusiness();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [formData, setFormData] = useState({
    tableNumber: '',
    capacity: '',
    status: 'disponivel'
  });

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tables');
      setTables(response.data);
    } catch (error) {
      console.error('Erro ao buscar mesas:', error);
      toast.error('Erro ao carregar mesas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTable = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tables', {
        tableNumber: parseInt(formData.tableNumber),
        capacity: parseInt(formData.capacity)
      });
      
      toast.success('Mesa criada com sucesso!');
      setIsCreateDialogOpen(false);
      setFormData({ tableNumber: '', capacity: '', status: 'disponivel' });
      fetchTables();
    } catch (error) {
      console.error('Erro ao criar mesa:', error);
      toast.error(error.response?.data?.error || 'Erro ao criar mesa');
    }
  };

  const handleUpdateTable = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/tables/${selectedTable.id}`, {
        tableNumber: parseInt(formData.tableNumber),
        capacity: parseInt(formData.capacity),
        status: formData.status
      });
      
      toast.success('Mesa atualizada com sucesso!');
      setIsEditDialogOpen(false);
      setSelectedTable(null);
      setFormData({ tableNumber: '', capacity: '', status: 'disponivel' });
      fetchTables();
    } catch (error) {
      console.error('Erro ao atualizar mesa:', error);
      toast.error(error.response?.data?.error || 'Erro ao atualizar mesa');
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta mesa?')) {
      return;
    }

    try {
      await api.delete(`/tables/${tableId}`);
      toast.success('Mesa excluída com sucesso!');
      fetchTables();
    } catch (error) {
      console.error('Erro ao excluir mesa:', error);
      toast.error(error.response?.data?.error || 'Erro ao excluir mesa');
    }
  };

  const handleOpenComanda = async (tableId) => {
    try {
      await api.post(`/tables/${tableId}/open-comanda`);
      toast.success('Comanda aberta com sucesso!');
      fetchTables();
    } catch (error) {
      console.error('Erro ao abrir comanda:', error);
      toast.error(error.response?.data?.error || 'Erro ao abrir comanda');
    }
  };

  const handleCloseComanda = async (tableId) => {
    if (!paymentMethod) {
      toast.error('Selecione o método de pagamento');
      return;
    }

    try {
      const response = await api.post(`/tables/${tableId}/close-comanda`, {
        paymentMethod
      });
      
      toast.success('Comanda fechada com sucesso!');
      setReceiptData(response.data.receipt);
      setIsReceiptDialogOpen(true);
      setPaymentMethod('');
      fetchTables();
    } catch (error) {
      console.error('Erro ao fechar comanda:', error);
      toast.error(error.response?.data?.error || 'Erro ao fechar comanda');
    }
  };

  const handleViewReceipt = async (tableId) => {
    try {
      const response = await api.get(`/tables/${tableId}/receipt`);
      setReceiptData(response.data);
      setIsReceiptDialogOpen(true);
    } catch (error) {
      console.error('Erro ao buscar comprovante:', error);
      toast.error(error.response?.data?.error || 'Erro ao buscar comprovante');
    }
  };

  const openEditDialog = (table) => {
    setSelectedTable(table);
    setFormData({
      tableNumber: table.tableNumber.toString(),
      capacity: table.capacity?.toString() || '',
      status: table.status
    });
    setIsEditDialogOpen(true);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'disponivel': { label: 'Disponível', variant: 'default', icon: CheckCircle },
      'ocupada': { label: 'Ocupada', variant: 'destructive', icon: Users },
      'aguardando_fechamento': { label: 'Aguardando Fechamento', variant: 'secondary', icon: Clock }
    };

    const config = statusConfig[status] || statusConfig['disponivel'];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const printReceipt = () => {
    if (!receiptData) return;
    
    const printWindow = window.open('', '_blank');
    const printContent = `
      <html>
        <head>
          <title>Comprovante - Mesa ${receiptData.tableNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .table th { background-color: #f2f2f2; }
            .total { font-weight: bold; font-size: 1.2em; margin-top: 20px; }
            .footer { margin-top: 30px; text-align: center; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <div class="header">
            ${receiptHeader(business)}
            <h2>Comprovante - Mesa ${receiptData.tableNumber}</h2>
            <p>Data: ${new Date(receiptData.closedAt || receiptData.openedAt).toLocaleString('pt-BR')}</p>
          </div>
          
          <table class="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qtd</th>
                <th>Preço Unit.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${receiptData.items?.map(item => `
                <tr>
                  <td>${item.productName || item.product?.name}</td>
                  <td>${item.quantity}</td>
                  <td>R$ ${parseFloat(item.priceAtSale).toFixed(2)}</td>
                  <td>R$ ${parseFloat(item.totalItemValue).toFixed(2)}</td>
                </tr>
              `).join('') || ''}
            </tbody>
          </table>
          
          <div class="total">
            Total: R$ ${parseFloat(receiptData.totalValue).toFixed(2)}
          </div>
          
          ${receiptData.paymentMethod ? `<p>Forma de Pagamento: ${receiptData.paymentMethod}</p>` : ''}
          
          <div class="footer">
            <p>${escapeHtml(business.receiptMessage)}</p>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando mesas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mesas</h1>
          <p className="text-muted-foreground">
            Gerencie as mesas do estabelecimento
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Mesa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Mesa</DialogTitle>
              <DialogDescription>
                Adicione uma nova mesa ao sistema
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTable}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="tableNumber" className="text-right">
                    Número
                  </Label>
                  <Input
                    id="tableNumber"
                    type="number"
                    value={formData.tableNumber}
                    onChange={(e) => setFormData({ ...formData, tableNumber: e.target.value })}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="capacity" className="text-right">
                    Capacidade
                  </Label>
                  <Input
                    id="capacity"
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Criar Mesa</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas das Mesas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Mesas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tables.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mesas Ocupadas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tables.filter(table => table.status === 'ocupada').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mesas Disponíveis</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tables.filter(table => table.status === 'disponivel').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Mesas */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Mesas</CardTitle>
          <CardDescription>
            Visualize e gerencie todas as mesas do estabelecimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Comandas Abertas</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((table) => (
                <TableRow key={table.id}>
                  <TableCell className="font-medium">Mesa {table.tableNumber}</TableCell>
                  <TableCell>
                    {table.capacity ? `${table.capacity} pessoas` : 'Não definida'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(table.status)}
                  </TableCell>
                  <TableCell>
                    {table.comandas && table.comandas.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {table.comandas.length} comanda(s)
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          R$ {table.comandas.reduce((total, comanda) => total + (parseFloat(comanda.totalValue) || 0), 0).toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhuma</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      {table.status === 'disponivel' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenComanda(table.id)}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Abrir Comanda
                        </Button>
                      )}
                      
                      {table.status === 'ocupada' && table.comandas && table.comandas.length > 0 && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewReceipt(table.id)}
                          >
                            <Receipt className="h-4 w-4 mr-1" />
                            Ver Conta
                          </Button>
                          
                          <div className="flex items-center gap-1">
                            <Select
                              value={paymentMethod}
                              onValueChange={setPaymentMethod}
                            >
                              <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Pagamento" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                                <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                                <SelectItem value="pix">PIX</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleCloseComanda(table.id)}
                              disabled={!paymentMethod}
                            >
                              <Square className="h-4 w-4 mr-1" />
                              Fechar
                            </Button>
                          </div>
                        </>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(table)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTable(table.id)}
                        disabled={table.comandas && table.comandas.length > 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Mesa</DialogTitle>
            <DialogDescription>
              Modifique as informações da mesa
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateTable}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editTableNumber" className="text-right">
                  Número
                </Label>
                <Input
                  id="editTableNumber"
                  type="number"
                  value={formData.tableNumber}
                  onChange={(e) => setFormData({ ...formData, tableNumber: e.target.value })}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editCapacity" className="text-right">
                  Capacidade
                </Label>
                <Input
                  id="editCapacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editStatus" className="text-right">
                  Status
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="ocupada">Ocupada</SelectItem>
                    <SelectItem value="aguardando_fechamento">Aguardando Fechamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Salvar Alterações</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Comprovante */}
      <Dialog open={isReceiptDialogOpen} onOpenChange={setIsReceiptDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprovante - Mesa {receiptData?.tableNumber}</DialogTitle>
            <DialogDescription>
              Detalhes da conta da mesa
            </DialogDescription>
          </DialogHeader>
          
          {receiptData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Mesa:</strong> {receiptData.tableNumber}
                </div>
                <div>
                  <strong>Data:</strong> {new Date(receiptData.closedAt || receiptData.openedAt).toLocaleString('pt-BR')}
                </div>
                {receiptData.openedBy && (
                  <div>
                    <strong>Atendente:</strong> {receiptData.openedBy}
                  </div>
                )}
                {receiptData.paymentMethod && (
                  <div>
                    <strong>Pagamento:</strong> {receiptData.paymentMethod}
                  </div>
                )}
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Preço Unit.</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiptData.items?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.productName || item.product?.name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>R$ {parseFloat(item.priceAtSale).toFixed(2)}</TableCell>
                      <TableCell>R$ {parseFloat(item.totalItemValue).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="text-right">
                <div className="text-lg font-bold">
                  Total: R$ {parseFloat(receiptData.totalValue).toFixed(2)}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={printReceipt}>
              <Receipt className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={() => setIsReceiptDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tables;

