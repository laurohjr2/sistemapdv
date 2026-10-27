import ReportDownload from '../components/ReportDownload';
import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Plus, Edit, Trash2, Package, Search, AlertTriangle, Filter, Eye, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    subcategory: '',
    unitOfMeasure: 'unidade',
    costPrice: '',
    salePrice: '',
    minStockAlert: '',
    barcode: '',
    active: true,
    preparationTime: '',
    ingredients: '',
    allergens: '',
    nutritionalInfo: '',
    // Campos para entrada inicial de estoque
    initialStock: '',
    unitCost: '',
    batchNumber: '',
    expirationDate: '',
    stockNotes: ''
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (error) {
      setError('Erro ao carregar produtos');
      console.error('Erro ao carregar produtos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/products/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const productData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        subcategory: formData.subcategory,
        unitOfMeasure: formData.unitOfMeasure,
        costPrice: parseFloat(formData.costPrice) || 0,
        salePrice: parseFloat(formData.salePrice) || 0,
        minStockAlert: parseFloat(formData.minStockAlert) || 0,
        barcode: formData.barcode,
        active: formData.active,
        preparationTime: parseInt(formData.preparationTime) || null,
        ingredients: formData.ingredients,
        allergens: formData.allergens,
        nutritionalInfo: formData.nutritionalInfo
      };

      let response;
      if (editingProduct) {
        response = await api.put(`/products/${editingProduct.id}`, productData);
        toast.success('Produto atualizado com sucesso!');
      } else {
        response = await api.post('/products', productData);
        
        // Se há estoque inicial, adicionar ao estoque
        if (formData.initialStock && parseFloat(formData.initialStock) > 0) {
          try {
            await api.post('/stock/add', {
              productId: response.data.id,
              quantity: parseFloat(formData.initialStock),
              unitCost: formData.unitCost ? parseFloat(formData.unitCost) : undefined,
              notes: formData.stockNotes || 'Estoque inicial do produto',
              batchNumber: formData.batchNumber,
              expirationDate: formData.expirationDate || undefined
            });
            toast.success('Produto criado e estoque inicial adicionado com sucesso!');
          } catch (stockError) {
            console.error('Erro ao adicionar estoque inicial:', stockError);
            toast.success('Produto criado com sucesso, mas houve erro ao adicionar estoque inicial');
          }
        } else {
          toast.success('Produto criado com sucesso!');
        }
      }

      setIsDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      setError(error.response?.data?.error || 'Erro ao salvar produto');
      console.error('Erro ao salvar produto:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      subcategory: product.subcategory || '',
      unitOfMeasure: product.unitOfMeasure || 'unidade',
      costPrice: product.costPrice?.toString() || '',
      salePrice: product.salePrice?.toString() || '',
      minStockAlert: product.minStockAlert?.toString() || '',
      barcode: product.barcode || '',
      active: product.active,
      preparationTime: product.preparationTime?.toString() || '',
      ingredients: product.ingredients || '',
      allergens: product.allergens || '',
      nutritionalInfo: product.nutritionalInfo || '',
      // Limpar campos de estoque para edição
      initialStock: '',
      unitCost: '',
      batchNumber: '',
      expirationDate: '',
      stockNotes: ''
    });
    setIsDialogOpen(true);
  };

  const handleView = (product) => {
    setViewingProduct(product);
    setIsViewDialogOpen(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Tem certeza que deseja excluir este produto?')) {
      return;
    }

    try {
      await api.delete(`/products/${productId}`);
      toast.success('Produto excluído com sucesso!');
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao excluir produto');
      console.error('Erro ao excluir produto:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      subcategory: '',
      unitOfMeasure: 'unidade',
      costPrice: '',
      salePrice: '',
      minStockAlert: '',
      barcode: '',
      active: true,
      preparationTime: '',
      ingredients: '',
      allergens: '',
      nutritionalInfo: '',
      initialStock: '',
      unitCost: '',
      batchNumber: '',
      expirationDate: '',
      stockNotes: ''
    });
    setEditingProduct(null);
  };

  const getStockStatusBadge = (product) => {
    const current = parseFloat(product.currentStock || 0);
    const min = parseFloat(product.minStockAlert || 0);
    
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

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || selectedCategory === 'all_categories' || product.category === selectedCategory;
    const matchesTab = activeTab === 'all' || 
                      (activeTab === 'active' && product.active) ||
                      (activeTab === 'inactive' && !product.active) ||
                      (activeTab === 'low_stock' && parseFloat(product.currentStock || 0) <= parseFloat(product.minStockAlert || 0));
    
    return matchesSearch && matchesCategory && matchesTab;
  });

  const productStats = {
    total: products.length,
    active: products.filter(p => p.active).length,
    inactive: products.filter(p => !p.active).length,
    lowStock: products.filter(p => parseFloat(p.currentStock || 0) <= parseFloat(p.minStockAlert || 0)).length
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <ReportDownload type="catalog" label="Relatório de produtos"/><h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie o catálogo de produtos do estabelecimento
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </DialogTitle>
              <DialogDescription>
                {editingProduct ? 'Modifique as informações do produto' : 'Adicione um novo produto ao catálogo'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
                    <TabsTrigger value="pricing">Preços e Estoque</TabsTrigger>
                    <TabsTrigger value="details">Detalhes</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome do Produto *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="category">Categoria</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(value) => setFormData({ ...formData, category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.value} value={String(category.value)}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="subcategory">Subcategoria</Label>
                        <Input
                          id="subcategory"
                          value={formData.subcategory}
                          onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="unitOfMeasure">Unidade de Medida</Label>
                        <Select
                          value={formData.unitOfMeasure}
                          onValueChange={(value) => setFormData({ ...formData, unitOfMeasure: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unidade">Unidade</SelectItem>
                            <SelectItem value="kg">Quilograma</SelectItem>
                            <SelectItem value="gramas">Grama</SelectItem>
                            <SelectItem value="litro">Litro</SelectItem>
                            <SelectItem value="ml">Mililitro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="pricing" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="costPrice">Preço de Custo (R$)</Label>
                        <Input
                          id="costPrice"
                          currency
                          step="0.01"
                          value={formData.costPrice}
                          onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="salePrice">Preço de Venda (R$) *</Label>
                        <Input
                          id="salePrice"
                          currency
                          step="0.01"
                          value={formData.salePrice}
                          onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="minStockAlert">Estoque Mínimo</Label>
                        <Input
                          id="minStockAlert"
                          type="number"
                          step="0.001"
                          value={formData.minStockAlert}
                          onChange={(e) => setFormData({ ...formData, minStockAlert: e.target.value })}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="barcode">Código de Barras</Label>
                        <Input
                          id="barcode"
                          value={formData.barcode}
                          onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        />
                      </div>
                    </div>

                    {!editingProduct && (
                      <>
                        <div className="border-t pt-4">
                          <h4 className="text-sm font-medium mb-3 flex items-center">
                            <PackagePlus className="mr-2 h-4 w-4" />
                            Estoque Inicial (Opcional)
                          </h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="initialStock">Quantidade Inicial</Label>
                              <Input
                                id="initialStock"
                                type="number"
                                step="0.001"
                                value={formData.initialStock}
                                onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
                                placeholder="0"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="unitCost">Custo Unitário (R$)</Label>
                              <Input
                                id="unitCost"
                                currency
                                step="0.01"
                                value={formData.unitCost}
                                onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                                placeholder="0.00"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="space-y-2">
                              <Label htmlFor="batchNumber">Número do Lote</Label>
                              <Input
                                id="batchNumber"
                                value={formData.batchNumber}
                                onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="expirationDate">Data de Validade</Label>
                              <Input
                                id="expirationDate"
                                type="date"
                                value={formData.expirationDate}
                                onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="space-y-2 mt-4">
                            <Label htmlFor="stockNotes">Observações do Estoque</Label>
                            <Textarea
                              id="stockNotes"
                              value={formData.stockNotes}
                              onChange={(e) => setFormData({ ...formData, stockNotes: e.target.value })}
                              rows={2}
                              placeholder="Observações sobre o estoque inicial..."
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="details" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="preparationTime">Tempo de Preparo (min)</Label>
                        <Input
                          id="preparationTime"
                          type="number"
                          value={formData.preparationTime}
                          onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={formData.active ? 'true' : 'false'}
                          onValueChange={(value) => setFormData({ ...formData, active: value === 'true' })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Ativo</SelectItem>
                            <SelectItem value="false">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ingredients">Ingredientes</Label>
                      <Textarea
                        id="ingredients"
                        value={formData.ingredients}
                        onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="allergens">Alérgenos</Label>
                      <Textarea
                        id="allergens"
                        value={formData.allergens}
                        onChange={(e) => setFormData({ ...formData, allergens: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="nutritionalInfo">Informações Nutricionais</Label>
                      <Textarea
                        id="nutritionalInfo"
                        value={formData.nutritionalInfo}
                        onChange={(e) => setFormData({ ...formData, nutritionalInfo: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : (editingProduct ? 'Atualizar' : 'Criar Produto')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productStats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos Ativos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{productStats.active}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos Inativos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{productStats.inactive}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{productStats.lowStock}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Produtos</CardTitle>
          <CardDescription>
            Gerencie todos os produtos do estabelecimento
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
                    <SelectItem key={category.value} value={String(category.value)}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="all">Todos ({productStats.total})</TabsTrigger>
              <TabsTrigger value="active">Ativos ({productStats.active})</TabsTrigger>
              <TabsTrigger value="inactive">Inativos ({productStats.inactive})</TabsTrigger>
              <TabsTrigger value="low_stock">Estoque Baixo ({productStats.lowStock})</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{product.name}</div>
                            {product.description && (
                              <div className="text-sm text-muted-foreground">
                                {product.description.substring(0, 50)}
                                {product.description.length > 50 && '...'}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getCategoryLabel(product.category)}</TableCell>
                        <TableCell>R$ {parseFloat(product.salePrice || 0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>
                              {parseFloat(product.currentStock || 0).toFixed(3)} {product.unitOfMeasure}
                            </span>
                            {getStockStatusBadge(product)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.active ? 'default' : 'secondary'}>
                            {product.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleView(product)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(product)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog de Visualização */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Produto</DialogTitle>
          </DialogHeader>
          
          {viewingProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Nome</Label>
                  <p className="text-sm">{viewingProduct.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Categoria</Label>
                  <p className="text-sm">{getCategoryLabel(viewingProduct.category)}</p>
                </div>
              </div>
              
              {viewingProduct.description && (
                <div>
                  <Label className="text-sm font-medium">Descrição</Label>
                  <p className="text-sm">{viewingProduct.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Preço de Custo</Label>
                  <p className="text-sm">R$ {parseFloat(viewingProduct.costPrice || 0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Preço de Venda</Label>
                  <p className="text-sm">R$ {parseFloat(viewingProduct.salePrice || 0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Estoque Atual</Label>
                  <p className="text-sm">
                    {parseFloat(viewingProduct.currentStock || 0).toFixed(3)} {viewingProduct.unitOfMeasure}
                  </p>
                </div>
              </div>
              
              {viewingProduct.ingredients && (
                <div>
                  <Label className="text-sm font-medium">Ingredientes</Label>
                  <p className="text-sm">{viewingProduct.ingredients}</p>
                </div>
              )}
              
              {viewingProduct.allergens && (
                <div>
                  <Label className="text-sm font-medium">Alérgenos</Label>
                  <p className="text-sm">{viewingProduct.allergens}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;

