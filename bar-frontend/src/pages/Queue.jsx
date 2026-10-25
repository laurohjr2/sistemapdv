import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { Clock, ChefHat, CheckCircle, AlertCircle, Users, Timer, TrendingUp, Package } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';

const Queue = () => {
  const [queueData, setQueueData] = useState({
    items: [],
    groupedItems: { pendente: [], preparando: [], pronto: [] },
    summary: { total: 0, pendente: 0, preparando: 0, pronto: 0 }
  });
  const [queueSummary, setQueueSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [activeTab, setActiveTab] = useState('kanban');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  
  // Auto-refresh interval
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchQueueData();
    fetchQueueSummary();
  }, []);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchQueueData();
        fetchQueueSummary();
      }, 30000); // Refresh a cada 30 segundos
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchQueueData = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterPriority) params.append('priority', filterPriority);
      
      const response = await api.get(`/queue?${params.toString()}`);
      setQueueData(response.data);
    } catch (error) {
      console.error('Erro ao carregar fila:', error);
      toast.error('Erro ao carregar fila de preparo');
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueSummary = async () => {
    try {
      const response = await api.get('/queue/summary');
      setQueueSummary(response.data);
    } catch (error) {
      console.error('Erro ao carregar resumo da fila:', error);
    }
  };

  const handleStatusUpdate = async (itemId, newStatus) => {
    try {
      await api.put(`/queue/items/${itemId}/status`, { status: newStatus });
      toast.success('Status atualizado com sucesso!');
      fetchQueueData();
      fetchQueueSummary();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error(error.response?.data?.error || 'Erro ao atualizar status');
    }
  };

  const handlePriorityUpdate = async (itemId, newPriority) => {
    try {
      await api.put(`/queue/items/${itemId}/priority`, { priority: newPriority });
      toast.success('Prioridade atualizada com sucesso!');
      fetchQueueData();
    } catch (error) {
      console.error('Erro ao atualizar prioridade:', error);
      toast.error(error.response?.data?.error || 'Erro ao atualizar prioridade');
    }
  };

  const handleMultipleDelivery = async () => {
    if (selectedItems.length === 0) {
      toast.error('Selecione pelo menos um item');
      return;
    }

    try {
      await api.put('/queue/items/deliver-multiple', { itemIds: selectedItems });
      toast.success(`${selectedItems.length} itens marcados como entregues!`);
      setSelectedItems([]);
      fetchQueueData();
      fetchQueueSummary();
    } catch (error) {
      console.error('Erro ao entregar itens:', error);
      toast.error(error.response?.data?.error || 'Erro ao entregar itens');
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      'pendente': 'secondary',
      'preparando': 'default',
      'pronto': 'default',
      'entregue': 'outline'
    };
    
    const labels = {
      'pendente': 'Pendente',
      'preparando': 'Preparando',
      'pronto': 'Pronto',
      'entregue': 'Entregue'
    };
    
    const colors = {
      'pendente': 'bg-yellow-100 text-yellow-800',
      'preparando': 'bg-blue-100 text-blue-800',
      'pronto': 'bg-green-100 text-green-800',
      'entregue': 'bg-gray-100 text-gray-800'
    };
    
    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const variants = {
      'baixa': 'outline',
      'normal': 'secondary',
      'alta': 'default',
      'urgente': 'destructive'
    };
    
    const labels = {
      'baixa': 'Baixa',
      'normal': 'Normal',
      'alta': 'Alta',
      'urgente': 'Urgente'
    };
    
    return <Badge variant={variants[priority]}>{labels[priority]}</Badge>;
  };

  const getWaitingTime = (createdAt) => {
    const minutes = Math.round((new Date() - new Date(createdAt)) / (1000 * 60));
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  };

  const getTableInfo = (comanda) => {
    if (comanda.type === 'mesa' && comanda.table) {
      return `Mesa ${comanda.table.tableNumber}`;
    }
    return comanda.customerName || 'Balcão';
  };

  const handleItemSelection = (itemId, checked) => {
    if (checked) {
      setSelectedItems([...selectedItems, itemId]);
    } else {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    }
  };

  const selectAllInStatus = (status, checked) => {
    const statusItems = queueData.groupedItems[status] || [];
    const itemIds = statusItems.map(item => item.id);
    
    if (checked) {
      const newSelected = [...new Set([...selectedItems, ...itemIds])];
      setSelectedItems(newSelected);
    } else {
      setSelectedItems(selectedItems.filter(id => !itemIds.includes(id)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando fila de preparo...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos da cozinha</h1>
          <p className="text-muted-foreground">
            Gerenciamento de pedidos em preparo na cozinha
          </p>
        </div>
        
        <div className="flex gap-2 items-center">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
            size="sm"
          >
            <Timer className="mr-2 h-4 w-4" />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          
          {selectedItems.length > 0 && (
            <Button onClick={handleMultipleDelivery}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Entregar Selecionados ({selectedItems.length})
            </Button>
          )}
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens na Fila</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueData.summary.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preparando</CardTitle>
            <ChefHat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueData.summary.preparando}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prontos</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueData.summary.pronto}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {parseFloat(queueSummary.averagePreparationTime || 0).toFixed(1)} min
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 items-center">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="preparando">Preparando</SelectItem>
            <SelectItem value="pronto">Pronto</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline" onClick={fetchQueueData}>
          Atualizar
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>
        
        <TabsContent value="kanban" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Coluna Pendente */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    Pendente ({queueData.groupedItems.pendente.length})
                  </CardTitle>
                  <Checkbox
                    checked={queueData.groupedItems.pendente.length > 0 && 
                             queueData.groupedItems.pendente.every(item => selectedItems.includes(item.id))}
                    onCheckedChange={(checked) => selectAllInStatus('pendente', checked)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {queueData.groupedItems.pendente.map((item) => (
                  <Card key={item.id} className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={(checked) => handleItemSelection(item.id, checked)}
                        />
                        <div>
                          <h4 className="font-medium text-sm">{item.product.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {getTableInfo(item.comanda)}
                          </p>
                        </div>
                      </div>
                      {getPriorityBadge(item.priority)}
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                      <span>Qtd: {item.quantity}</span>
                      <span>{getWaitingTime(item.createdAt)}</span>
                    </div>
                    
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusUpdate(item.id, 'preparando')}
                        className="flex-1 text-xs"
                      >
                        Iniciar
                      </Button>
                      <Select
                        value={item.priority}
                        onValueChange={(value) => handlePriorityUpdate(item.id, value)}
                      >
                        <SelectTrigger className="w-20 h-8">
                          <SelectValue placeholder="Prioridade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baixa">Baixa</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="urgente">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </Card>
                ))}
                
                {queueData.groupedItems.pendente.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum item pendente
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Coluna Preparando */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-blue-500" />
                    Preparando ({queueData.groupedItems.preparando.length})
                  </CardTitle>
                  <Checkbox
                    checked={queueData.groupedItems.preparando.length > 0 && 
                             queueData.groupedItems.preparando.every(item => selectedItems.includes(item.id))}
                    onCheckedChange={(checked) => selectAllInStatus('preparando', checked)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {queueData.groupedItems.preparando.map((item) => (
                  <Card key={item.id} className="p-3 border-blue-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={(checked) => handleItemSelection(item.id, checked)}
                        />
                        <div>
                          <h4 className="font-medium text-sm">{item.product.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {getTableInfo(item.comanda)}
                          </p>
                        </div>
                      </div>
                      {getPriorityBadge(item.priority)}
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                      <span>Qtd: {item.quantity}</span>
                      <span>{getWaitingTime(item.preparationStartedAt || item.createdAt)}</span>
                    </div>
                    
                    <Button
                      size="sm"
                      onClick={() => handleStatusUpdate(item.id, 'pronto')}
                      className="w-full text-xs"
                    >
                      Finalizar
                    </Button>
                  </Card>
                ))}
                
                {queueData.groupedItems.preparando.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum item em preparo
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Coluna Pronto */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Pronto ({queueData.groupedItems.pronto.length})
                  </CardTitle>
                  <Checkbox
                    checked={queueData.groupedItems.pronto.length > 0 && 
                             queueData.groupedItems.pronto.every(item => selectedItems.includes(item.id))}
                    onCheckedChange={(checked) => selectAllInStatus('pronto', checked)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {queueData.groupedItems.pronto.map((item) => (
                  <Card key={item.id} className="p-3 border-green-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={(checked) => handleItemSelection(item.id, checked)}
                        />
                        <div>
                          <h4 className="font-medium text-sm">{item.product.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {getTableInfo(item.comanda)}
                          </p>
                        </div>
                      </div>
                      {getPriorityBadge(item.priority)}
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                      <span>Qtd: {item.quantity}</span>
                      <span>Pronto há {getWaitingTime(item.preparationCompletedAt)}</span>
                    </div>
                    
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleStatusUpdate(item.id, 'entregue')}
                      className="w-full text-xs bg-green-600 hover:bg-green-700"
                    >
                      Entregar
                    </Button>
                  </Card>
                ))}
                
                {queueData.groupedItems.pronto.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum item pronto
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Itens na Fila</CardTitle>
              <CardDescription>
                Todos os itens em preparo organizados por ordem de chegada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={queueData.items.length > 0 && 
                                   queueData.items.every(item => selectedItems.includes(item.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedItems(queueData.items.map(item => item.id));
                            } else {
                              setSelectedItems([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Tempo</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueData.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedItems.includes(item.id)}
                            onCheckedChange={(checked) => handleItemSelection(item.id, checked)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.product.name}
                        </TableCell>
                        <TableCell>
                          {getTableInfo(item.comanda)}
                        </TableCell>
                        <TableCell>
                          {item.quantity}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(item.preparationStatus)}
                        </TableCell>
                        <TableCell>
                          {getPriorityBadge(item.priority)}
                        </TableCell>
                        <TableCell>
                          {getWaitingTime(item.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {item.preparationStatus === 'pendente' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusUpdate(item.id, 'preparando')}
                              >
                                Iniciar
                              </Button>
                            )}
                            {item.preparationStatus === 'preparando' && (
                              <Button
                                size="sm"
                                onClick={() => handleStatusUpdate(item.id, 'pronto')}
                              >
                                Finalizar
                              </Button>
                            )}
                            {item.preparationStatus === 'pronto' && (
                              <Button
                                size="sm"
                                onClick={() => handleStatusUpdate(item.id, 'entregue')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Entregar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {queueData.items.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum item na fila de preparo
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Alerta para item mais antigo */}
      {queueSummary.oldestPendingItem && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-orange-800">
              <AlertCircle className="h-5 w-5" />
              Atenção: Item aguardando há muito tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700">
              <strong>{queueSummary.oldestPendingItem.productName}</strong> está aguardando há{' '}
              <strong>{queueSummary.oldestPendingItem.waitingTime} minutos</strong>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Queue;


