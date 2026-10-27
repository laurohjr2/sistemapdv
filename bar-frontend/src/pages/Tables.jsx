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
import TableAccount from '../components/TableAccount';
import WaitingQueue from './WaitingQueue';

const Tables = () => {
  const [accountTable,setAccountTable]=useState(null);
  const [showQueue,setShowQueue]=useState(false);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [formData, setFormData] = useState({
    tableNumber: '',
    capacity: '',
    status: 'disponivel'
  });

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(()=>{const seen=new Set();let active=true;const poll=async()=>{try{const {data}=await api.get('/tables');if(!active)return;setTables(data);for(const table of data)for(const c of table.comandas||[])for(const item of c.items||[])if(item.preparationStatus==='pronto'&&!seen.has(item.id)){seen.add(item.id);toast.success(`${item.product?.name||'Pedido'} pronto — Mesa ${table.tableNumber}`,{duration:10000});}}catch{ /* Mantém a tela, próxima consulta tentará novamente. */ }};const timer=setInterval(poll,10000);return()=>{active=false;clearInterval(timer);};},[]);
  const fetchTables = async () => {
    try {

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando mesas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {accountTable&&<TableAccount table={accountTable} onClose={()=>setAccountTable(null)} onUpdate={fetchTables}/>}
      <Button variant="outline" onClick={()=>setShowQueue(!showQueue)}>{showQueue?'Ocultar fila de espera':'Fila de espera'}</Button>
      {showQueue&&<WaitingQueue/>}
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
                          {table.comandas[0].customerName||'Cliente não informado'} · {table.comandas.length} comanda(s)
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          R$ {table.comandas.reduce((total, comanda) => total + (parseFloat(comanda.totalValue) || 0), 0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
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
                          onClick={() => setAccountTable(table)}
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
                            onClick={() => setAccountTable(table)}
                          >
                            <Receipt className="h-4 w-4 mr-1" />
                            Ver Conta
                          </Button>
                          

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


    </div>
  );
};

export default Tables;

