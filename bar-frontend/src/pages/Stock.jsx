import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { Plus, Minus, Edit, Package, TrendingUp, TrendingDown, AlertTriangle, History, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';

const Stock = () => {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [stockSummary, setStockSummary] = useState({});
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  
  // Dialog states
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isRemoveStockOpen, setIsRemoveStockOpen] = useState(false);
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  
  // Form states
  const [addStockForm, setAddStockForm] = useState({
    productId: '',
    quantity: '',
    unitCost: '',
    notes: '',
    batchNumber: '',
    expirationDate: ''
  });
  
  const [removeStockForm, setRemoveStockForm] = useState({
    productId: '',
    quantity: '',
    reason: 'manual_adjustment',
    notes: ''
  });
  
  const [adjustStockForm, setAdjustStockForm] = useState({
    productId: '',
    newQuantity: '',
    notes: ''
  });

  const [newProductForm, setNewProductForm] = useState({
    name: '',
    category: '',
    price: '',
    unitOfMeasure: 'unidade',
    minStockAlert: '10',
    description: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'movements') {
      fetchMovements();
    }
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [stockResponse, summaryResponse, categoriesResponse] = await Promise.all([
        api.get('/stock/report'),
        api.get('/stock/summary'),
        api.get('/products/categories')
      ]);
      
      setProducts(stockResponse.data.report);
      setStockSummary(summaryResponse.data);
      setCategories(categoriesResponse.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do estoque');
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    try {
      const response = await api.get('/stock/movements?limit=100');
      setMovements(response.data.movements);
    } catch (error) {
      console.error('Erro ao carregar movimentações:', error);
      toast.error('Erro ao carregar movimentações');
    }
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    try {
      await api.post('/stock/add', {
        productId: addStockForm.productId,
        quantity: parseFloat(addStockForm.quantity),
        unitCost: addStockForm.unitCost ? parseFloat(addStockForm.unitCost) : undefined,
        notes: addStockForm.notes,
        batchNumber: addStockForm.batchNumber,
        expirationDate: addStockForm.expirationDate || undefined
      });
      
      toast.success('Estoque adicionado com sucesso!');
      setIsAddStockOpen(false);
      resetAddStockForm();
      fetchData();
    } catch (error) {
      console.error('Erro ao adicionar estoque:', error);
      toast.error(error.response?.data?.error || 'Erro ao adicionar estoque');
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await api.post('/products', {
        name: newProductForm.name,
        category: newProductForm.category,
        salePrice: parseFloat(newProductForm.price),
        costPrice: 0,
        unitOfMeasure: newProductForm.unitOfMeasure,
        minStockAlert: parseFloat(newProductForm.minStockAlert),
        description: newProductForm.description
      });
      
      toast.success('Produto cadastrado com sucesso!');
      setIsAddProductOpen(false);
      resetNewProductForm();
      fetchData();
    } catch (error) {
      console.error('Erro ao cadastrar produto:', error);
      toast.error(error.response?.data?.error || 'Erro ao cadastrar produto');
    }
  };

  const handleRemoveStock = async (e) => {
    e.preventDefault();
    try {
      await api.post('/stock/remove', {
        productId: removeStockForm.productId,
        quantity: parseFloat(removeStockForm.quantity),
        reason: removeStockForm.reason,
        notes: removeStockForm.notes
      });
      
      toast.success('Estoque removido com sucesso!');
      setIsRemoveStockOpen(false);
      resetRemoveStockForm();
      fetchData();
    } catch (error) {
      console.error('Erro ao remover estoque:', error);
      toast.error(error.response?.data?.error || 'Erro ao remover estoque');
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    try {
      await api.post('/stock/adjust', {
        productId: adjustStockForm.productId,
        newQuantity: parseFloat(adjustStockForm.newQuantity),
        notes: adjustStockForm.notes
      });
      
      toast.success('Estoque ajustado com sucesso!');
      setIsAdjustStockOpen(false);
      resetAdjustStockForm();
      fetchData();
    } catch (error) {
      console.error('Erro ao ajustar estoque:', error);
      toast.error(error.response?.data?.error || 'Erro ao ajustar estoque');
    }
  };

  const resetAddStockForm = () => {
    setAddStockForm({
      productId: '',
      quantity: '',
      unitCost: '',
      notes: '',
      batchNumber: '',
      expirationDate: ''
    });
  };

  const resetRemoveStockForm = () => {
    setRemoveStockForm({
      productId: '',
      quantity: '',
      reason: 'manual_adjustment',
      notes: ''
    });
  };

  const resetAdjustStockForm = () => {
    setAdjustStockForm({
      productId: '',
      newQuantity: '',
      notes: ''
    });
  };

  const resetNewProductForm = () => {
    setNewProductForm({
      name: '',
      category: '',
      price: '',
      unitOfMeasure: 'unidade',
      minStockAlert: '10',
      description: ''
    });
  };

  const getStockStatusBadge = (product) => {
    const current = parseFloat(product.currentStock);
    const min = parseFloat(product.minStockAlert);
    
    if (current <= 0) {
      return <Badge variant="destructive">Sem Estoque</Badge>;
    }
    if (current <= min) {
      return <Badge variant="destructive">Estoque Baixo</Badge>;
    }
    if (current <= min * 2) {
      return <Badge variant="secondary">Estoque Médio</Badge>;
    }
    return <Badge variant="default">Estoque OK</Badge>;
  };

  const getCategoryLabel = (categoryValue) => {
    const category = categories.find(cat => cat.value === categoryValue);
    return category ? category.label : categoryValue;
  };

  const getMovementTypeIcon = (type) => {
    return type === 'entrada' ? 
      <TrendingUp className="h-4 w-4 text-green-500" /> : 
      <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || selectedCategory === 'all_categories' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando estoque...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estoque</h1>
          <p className="text-muted-foreground">
            Controle de entrada e saída de produtos
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Package className="mr-2 h-4 w-4" />
                Cadastrar Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Produto</DialogTitle>
                <DialogDescription>
                  Adicione um novo produto ao sistema
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddProduct}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="productName">Nome do Produto *</Label>
                    <Input
                      id="productName"
                      value={newProductForm.name}
                      onChange={(e) => setNewProductForm({...newProductForm, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="productCategory">Categoria *</Label>
                    <Select
                      value={newProductForm.category}
                      onValueChange={(value) => setNewProductForm({...newProductForm, category: value})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="productPrice">Preço de Venda *</Label>
                      <Input
                        id="productPrice"
                        type="number"
                        step="0.01"
                        value={newProductForm.price}
                        onChange={(e) => setNewProductForm({...newProductForm, price: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="productUnit">Unidade *</Label>
                      <Select
                        value={newProductForm.unitOfMeasure}
                        onValueChange={(value) => setNewProductForm({...newProductForm, unitOfMeasure: value})}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Unidade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unidade">Unidade</SelectItem>
                          <SelectItem value="kg">Quilograma</SelectItem>
                          <SelectItem value="litro">Litro</SelectItem>
                          <SelectItem value="ml">Mililitro</SelectItem>
                          <SelectItem value="gramas">Grama</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="productMinStock">Estoque Mínimo</Label>
                    <Input
                      id="productMinStock"
                      type="number"
                      step="0.001"
                      value={newProductForm.minStockAlert}
                      onChange={(e) => setNewProductForm({...newProductForm, minStockAlert: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="productDescription">Descrição</Label>
                    <Textarea
                      id="productDescription"
                      value={newProductForm.description}
                      onChange={(e) => setNewProductForm({...newProductForm, description: e.target.value})}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddProductOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Cadastrar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isAddStockOpen} onOpenChange={setIsAddStockOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Estoque
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Estoque</DialogTitle>
                <DialogDescription>
                  Registre a entrada de produtos no estoque
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddStock}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="addProductId">Produto *</Label>
                    <Select
                      value={addStockForm.productId}
                      onValueChange={(value) => setAddStockForm({...addStockForm, productId: value})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={String(product.id)}>
                            {product.name} (Atual: {product.currentStock} {product.unitOfMeasure})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="addQuantity">Quantidade *</Label>
                    <Input
                      id="addQuantity"
                      type="number"
                      step="0.001"
                      value={addStockForm.quantity}
                      onChange={(e) => setAddStockForm({...addStockForm, quantity: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="addUnitCost">Custo Unitário</Label>
                    <Input
                      id="addUnitCost"
                      type="number"
                      step="0.01"
                      value={addStockForm.unitCost}
                      onChange={(e) => setAddStockForm({...addStockForm, unitCost: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="addBatchNumber">Número do Lote</Label>
                      <Input
                        id="addBatchNumber"
                        value={addStockForm.batchNumber}
                        onChange={(e) => setAddStockForm({...addStockForm, batchNumber: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="addExpirationDate">Data de Validade</Label>
                      <Input
                        id="addExpirationDate"
                        type="date"
                        value={addStockForm.expirationDate}
                        onChange={(e) => setAddStockForm({...addStockForm, expirationDate: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="addNotes">Observações</Label>
                    <Textarea
                      id="addNotes"
                      value={addStockForm.notes}
                      onChange={(e) => setAddStockForm({...addStockForm, notes: e.target.value})}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddStockOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Adicionar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isRemoveStockOpen} onOpenChange={setIsRemoveStockOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Minus className="mr-2 h-4 w-4" />
                Remover Estoque
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remover Estoque</DialogTitle>
                <DialogDescription>
                  Registre a saída de produtos do estoque
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRemoveStock}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="removeProductId">Produto *</Label>
                    <Select
                      value={removeStockForm.productId}
                      onValueChange={(value) => setRemoveStockForm({...removeStockForm, productId: value})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.filter(p => p.currentStock > 0).map((product) => (
                          <SelectItem key={product.id} value={String(product.id)}>                            {product.name} (Disponível: {product.currentStock} {product.unitOfMeasure})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="removeQuantity">Quantidade *</Label>
                      <Input
                        id="removeQuantity"
                        type="number"
                        step="0.001"
                        value={removeStockForm.quantity}
                        onChange={(e) => setRemoveStockForm({...removeStockForm, quantity: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="removeReason">Motivo *</Label>
                      <Select
                        value={removeStockForm.reason}
                        onValueChange={(value) => setRemoveStockForm({...removeStockForm, reason: value})}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um motivo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual_adjustment">Ajuste Manual</SelectItem>
                          <SelectItem value="loss">Perda</SelectItem>
                          <SelectItem value="expiration">Vencimento</SelectItem>
                          <SelectItem value="damage">Avaria</SelectItem>
                          <SelectItem value="transfer">Transferência</SelectItem>
                          <SelectItem value="return">Devolução</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="removeNotes">Observações</Label>
                    <Textarea
                      id="removeNotes"
                      value={removeStockForm.notes}
                      onChange={(e) => setRemoveStockForm({...removeStockForm, notes: e.target.value})}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsRemoveStockOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Remover</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isAdjustStockOpen} onOpenChange={setIsAdjustStockOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Ajustar Estoque
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajustar Estoque</DialogTitle>
                <DialogDescription>
                  Defina a quantidade exata do produto em estoque
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAdjustStock}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="adjustProductId">Produto *</Label>
                    <Select
                      value={adjustStockForm.productId}
                      onValueChange={(value) => setAdjustStockForm({...adjustStockForm, productId: value})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={String(product.id)}>                            {product.name} (Atual: {product.currentStock} {product.unitOfMeasure})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="adjustNewQuantity">Nova Quantidade *</Label>
                    <Input
                      id="adjustNewQuantity"
                      type="number"
                      step="0.001"
                      value={adjustStockForm.newQuantity}
                      onChange={(e) => setAdjustStockForm({...adjustStockForm, newQuantity: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="adjustNotes">Observações</Label>
                    <Textarea
                      id="adjustNotes"
                      value={adjustStockForm.notes}
                      onChange={(e) => setAdjustStockForm({...adjustStockForm, notes: e.target.value})}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAdjustStockOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Ajustar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockSummary.totalProducts || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stockSummary.lowStockProducts || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sem Estoque</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stockSummary.outOfStockProducts || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {parseFloat(stockSummary.totalStockValue || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Produtos em Estoque</CardTitle>
              <CardDescription>
                Controle de estoque de todos os produtos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 mb-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produtos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_categories">Todas as categorias</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.value} value={String(category.value)}>                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Estoque Atual</TableHead>
                      <TableHead>Estoque Mínimo</TableHead>
                      <TableHead>Valor em Estoque</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{getCategoryLabel(product.category)}</TableCell>
                        <TableCell>
                          {product.currentStock} {product.unitOfMeasure}
                        </TableCell>
                        <TableCell>
                          {product.minStockAlert} {product.unitOfMeasure}
                        </TableCell>
                        <TableCell>
                          R$ {parseFloat(product.stockValue).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {getStockStatusBadge(product)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Movimentações de Estoque</CardTitle>
              <CardDescription>
                Histórico de entradas e saídas de produtos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>
                          {new Date(movement.movementDate).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {movement.product?.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getMovementTypeIcon(movement.type)}
                            <span className={movement.type === 'entrada' ? 'text-green-600' : 'text-red-600'}>
                              {movement.type === 'entrada' ? 'Entrada' : 'Saída'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {movement.quantity} {movement.product?.unitOfMeasure}
                        </TableCell>
                        <TableCell>{movement.user?.username}</TableCell>
                        <TableCell>{movement.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Stock;

