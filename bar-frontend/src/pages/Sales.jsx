import {Link} from 'react-router-dom';
import {lineTotal} from '../components/commerce/helpers';
import ScaleScanDialog from '../components/ScaleScanDialog';
import PizzaBuilder from '../components/pizza/PizzaBuilder';
import usePizzaCatalog from '../components/pizza/usePizzaCatalog';
import {useAuth} from '../hooks/useAuth';
import CustomerSelect from '../components/CustomerSelect';
import PixPayment from '../components/PixPayment';
import { useBusiness } from '../hooks/useBusiness';
import { receiptHeader, escapeHtml } from '../lib/receipt';
import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ShoppingCart, Plus, Minus, Trash2, Receipt, X, Search, Scan, DollarSign, Lock, Unlock, Printer } from 'lucide-react';
import api from "../lib/api";

const stockAvailable = product => Number(product.availableStock ?? product.currentStock);
const Sales = () => {
  const {business} = useBusiness();
  const {user}=useAuth();
  const [discount,setDiscount]=useState('');
  const [customerId,setCustomerId]=useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [pizzaOpen,setPizzaOpen]=useState(false);
  const {menu:pizzaMenu,error:pizzaError}=usePizzaCatalog(Boolean(business.modules?.pizza));
  const pizzaBases=new Set((pizzaMenu?.sizes||[]).filter(s=>s.active).map(s=>s.productId));
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('search')?.slice(0,200)||'');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scaleItem,setScaleItem]=useState(null);
  const [scaleError,setScaleError]=useState('');
  const [scaleWeight,setScaleWeight]=useState('');
  const [scaleConfirmed,setScaleConfirmed]=useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  
  // Estados para controle de caixa
  const [cashRegister, setCashRegister] = useState(null);
  const [isOpenCashDialogOpen, setIsOpenCashDialogOpen] = useState(false);
  const [isCloseCashDialogOpen, setIsCloseCashDialogOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [lastSaleReceipt, setLastSaleReceipt] = useState(null);

  // Estados para tickets rápidos
  const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    productId: '',
    quantity: '1',
    customerName: '',
    notes: ''
  });

  useEffect(() => {
    fetchProducts();
    fetchSales();
    fetchCashRegisterStatus();
  }, []);

  const fetchCashRegisterStatus = async () => {
    try {
      const response = await api.get('/cash-register/status');
      setCashRegister(response.data);
      if(response.data.is_open){const report=await api.get('/cash-register/report/'+response.data.id);setCashRegister({...response.data,...report.data});}
    } catch (error) {
      console.error('Erro ao buscar status do caixa:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data.filter(product => product.active).map(product => ({ ...product, price: Number(product.salePrice) })));
    } catch (error) {
      setError('Erro ao carregar produtos');
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const fetchSales = async () => {
    try {
      const response = await api.get('/sales');
      setSales(response.data);
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
    }
  };

  const openCashRegister = async () => {
    if (!openingAmount) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);
      await api.post('/cash-register/open', {

        opening_amount: parseFloat(openingAmount)
      });
      
      setIsOpenCashDialogOpen(false);
      setOpeningAmount('');
      await fetchCashRegisterStatus();
      alert('Caixa aberto com sucesso!');
    } catch (error) {
      setError('Erro ao abrir caixa');
      console.error('Erro ao abrir caixa:', error);
    } finally {
      setLoading(false);
    }
  };

  const closeCashRegister = async () => {
    if (!closingAmount) {
      setError('Informe o valor de fechamento');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/cash-register/close', {
        closing_amount: parseFloat(closingAmount)
      });
      
      setIsCloseCashDialogOpen(false);
      setClosingAmount('');
      await fetchCashRegisterStatus();
      
      // Mostrar relatório de fechamento
      alert(`Caixa fechado com sucesso!\n\nResumo do dia:\nVendas: R$ ${response.data.total_sales.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}\nDiferença: R$ ${response.data.difference.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`);
    } catch (error) {
      setError('Erro ao fechar caixa');
      console.error('Erro ao fechar caixa:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    
    if (!ticketForm.productId || !ticketForm.quantity) {
      setError('Produto e quantidade são obrigatórios');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await api.post('/tickets', {
        productId: ticketForm.productId,
        quantity: parseFloat(ticketForm.quantity),
        customerName: ticketForm.customerName,
        notes: ticketForm.notes
      });

      // Imprimir ticket
      printTicket(response.data);
      
      // Resetar formulário
      setTicketForm({
        productId: '',
        quantity: '1',
        customerName: '',
        notes: ''
      });
      
      setIsTicketDialogOpen(false);
      await fetchProducts(); // Atualizar estoque
      
      alert(`Ticket ${response.data.ticket_number} emitido com sucesso!`);
    } catch (error) {
      setError(error.response?.data?.error || 'Erro ao emitir ticket');
      console.error('Erro ao emitir ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const printTicket = (ticket) => {
    const printWindow = window.open('', '_blank');
    const printContent = `
      <html>
        <head>
          <title>Ticket ${ticket.ticket_number}</title>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; }
            .header { text-align: center; margin-bottom: 10px; }
            .ticket-number { font-size: 16px; font-weight: bold; }
            .content { margin: 10px 0; }
            .footer { text-align: center; margin-top: 10px; font-size: 10px; }
            .dashed { border-top: 1px dashed #000; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>TICKET RÁPIDO</h2>
            <div class="ticket-number">${ticket.ticket_number}</div>
          </div>
          
          <div class="dashed"></div>
          
          <div class="content">
            <p><strong>Produto:</strong> ${ticket.product.name}</p>
            <p><strong>Quantidade:</strong> ${ticket.quantity} ${ticket.product.unitOfMeasure}</p>
            <p><strong>Valor:</strong> R$ ${Number(ticket.total_amount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
            ${ticket.customer_name ? `<p><strong>Cliente:</strong> ${ticket.customer_name}</p>` : ''}
            ${ticket.notes ? `<p><strong>Obs:</strong> ${ticket.notes}</p>` : ''}
            <p><strong>Emitido em:</strong> ${new Date(ticket.issued_at).toLocaleString('pt-BR')}</p>
            <p><strong>Por:</strong> ${ticket.issued_by}</p>
          </div>
          
          <div class="dashed"></div>
          
          <div class="footer">
            <p>Apresente este ticket para retirada</p>
            <p>Válido até: ${new Date(ticket.expires_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const addToCart = (product) => {
    if(!cashRegister?.is_open){setError('Você precisa abrir um caixa para vender');return;}
    if(pizzaBases.has(product.id)){setPizzaOpen(true);return;}
    const used=cart.filter(i=>i.id===product.id).reduce((sum,i)=>sum+Math.round(i.quantity*1000),0);
    if(product.itemType!=='service'&&used+1000>Math.round(stockAvailable(product)*1000)){setError('Saldo disponível insuficiente para mais uma unidade. Confira o peso e os itens do carrinho.');return;}
    const existingItem = cart.find(item => item.id === product.id&&!item.pizza&&!item.scale);
    
    if (existingItem) {
      if (product.itemType==='service'||existingItem.quantity < stockAvailable(product)) {
        setCart(cart.map(item =>
          item.id === product.id&&!item.pizza&&!item.scale
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        setError('Quantidade em estoque insuficiente');
      }
    } else {
      if (product.itemType==='service'||stockAvailable(product) > 0) {
        setCart([...cart, { ...product, cartKey:product.id, quantity: 1 }]);
      } else {
        setError('Produto sem estoque');
      }
    }
  };

  const updateQuantity = (cartKey,newQuantity)=>{
    if(newQuantity===0){removeFromCart(cartKey);return;}
    const current=cart.find(i=>(i.cartKey||i.id)===cartKey);
    if(current?.scale){setError('Leia novamente a etiqueta para alterar o peso desse item.');return;}
    const product=products.find(p=>p.id===current?.id);
    if(!product)return;
    const others=cart.filter(i=>i.id===product.id&&(i.cartKey||i.id)!==cartKey).reduce((n,i)=>n+i.quantity,0);
    if((current.pizza&&newQuantity>99)||(product.itemType!=='service'&&newQuantity+others>stockAvailable(product))){setError('Quantidade em estoque insuficiente ou limite de 99 pizzas por item');return;}
    setCart(cart.map(i=>(i.cartKey||i.id)===cartKey?{...i,quantity:newQuantity}:i));
  };
  const removeFromCart=key=>setCart(cart.filter(i=>(i.cartKey||i.id)!==key));
  async function addPizza(data){
    if(!cashRegister?.is_open)throw new Error('Você precisa abrir um caixa para vender');
    const product=products.find(p=>p.id===data.productId);
    const existing=cart.filter(i=>i.id===data.productId).reduce((n,i)=>n+i.quantity,0);
    if(!product||stockAvailable(product)<existing+data.quantity)throw new Error('Estoque insuficiente do produto-base para esta pizza');
    setCart([...cart,{...product,id:product.id,cartKey:crypto.randomUUID(),name:data.pizza.description,price:data.unitPrice,pizza:data.pizza.selection,quantity:data.quantity,notes:data.notes}]);
  }

  const clearCart = () => {
    setCart([]);
  };

  const getTotalAmount = () => {
    return Math.max(0,Math.round((cart.reduce((total, item) => total + lineTotal({quantity:item.quantity,unitPrice:item.price}), 0)-Number(discount||0))*100)/100);
  };

  const handleBarcodeSearch = async () => {
    const code=barcodeInput.trim();if(!code)return;
    if(!cashRegister?.is_open){setError('Você precisa abrir um caixa para vender');return;}
    setError('');
    try{
      if(business.modules?.market){
        const {data}=await api.post('/scale/scan',{barcode:code});
        if(data.kind==='scale'){setScaleItem(data);setScaleWeight(String(data.quantity));setScaleConfirmed(false);setScaleError('');setBarcodeInput('');return;}
        const product=products.find(p=>p.id===data.productId);if(!product)throw new Error('Atualize os produtos antes de ler novamente');addToCart(product);
      }else{const product=products.find(p=>p.barcode===code);if(!product)throw new Error('Produto não encontrado com este código de barras');addToCart(product);}
      setBarcodeInput('');
    }catch(e){setError(e.response?.data?.error||e.message||'Falha ao ler etiqueta');}
  };
  const confirmScale=async()=>{
    let checked=scaleItem;
    if(checked?.mode==='price'){
      if(!scaleConfirmed){setScaleError('Confira o peso e o preço antes de confirmar.');return;}
      try{checked=(await api.post('/scale/scan',{barcode:checked.barcode,quantity:scaleWeight})).data;}catch(e){setScaleError(e.response?.data?.error||'Não foi possível conferir o peso');return;}
    }
    const p=products.find(p=>p.id===checked?.productId),used=cart.filter(i=>i.id===p?.id).reduce((sum,i)=>sum+Math.round(i.quantity*1000),0);
    if(!cashRegister?.is_open){setScaleError('Você precisa abrir um caixa para vender');return;}
    if(!p||used+Math.round(checked.quantity*1000)>Math.round(stockAvailable(p)*1000)){setScaleError('Saldo disponível insuficiente. Atualize os produtos e confira os lotes.');return;}
    setCart([...cart,{...p,cartKey:crypto.randomUUID(),price:checked.unitPrice,quantity:checked.quantity,scale:checked,notes:`Etiqueta ${checked.barcode} — ${checked.quantity.toLocaleString('pt-BR')} kg`}]);setScaleItem(null);
  };

  const completeSale = async () => {
    if (!cashRegister || !cashRegister.is_open) {
      setError('Você precisa abrir um caixa para vender');
      return;
    }

    if (cart.length === 0) {
      setError('Carrinho vazio');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const saleData = {
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,pizza:item.pizza,scale:item.scale,notes:item.notes
        })),
        customerId:customerId||null,discount_amount:Number(discount||0),
        payment_method: paymentMethod,
        total_amount: getTotalAmount(),
        cash_register_id: cashRegister.id
      };

      const response = await api.post('/sales', saleData);
      
      // Preparar dados para impressão da nota
      const receiptData = {
        id: response.data.id,
        items: response.data.items.map(item=>({name:item.pizza?.description||item.scale?.productName||cart.find(i=>i.id===item.product_id)?.name||'Produto',notes:item.notes,quantity:Number(item.quantity),unit_price:Number(item.unit_price),total:Number(item.total_price)})),
        total: Number(response.data.total_amount),
        customerId:customerId||null,discount_amount:Number(discount||0),
        payment_method: paymentMethod,
        date: new Date().toLocaleString('pt-BR')
      };

      setLastSaleReceipt(receiptData);
      clearCart();setDiscount('');setCustomerId('');
      setIsCartOpen(false);
      await fetchProducts();
      await fetchSales();
      await fetchCashRegisterStatus();
      
      alert('Venda realizada com sucesso!');
    } catch (error) {
      setError(error.response?.data?.error||'Erro ao processar venda');
      console.error('Erro ao processar venda:', error);
    } finally {
      setLoading(false);
    }
  };

  const printReceipt = (receiptData) => {
    const printWindow = window.open('', '_blank');
    const printContent = `
      <html>
        <head>
          <title>Nota Não Fiscal - Venda #${receiptData.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
            .header { text-align: center; margin-bottom: 20px; }
            .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .table th { background-color: #f2f2f2; }
            .total { font-weight: bold; font-size: 14px; margin-top: 20px; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            ${receiptHeader(business)}
            <h2>NOTA NÃO FISCAL</h2>
            <p>Venda #${receiptData.id}</p>
            <p>Data: ${receiptData.date}</p>
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
              ${receiptData.items.map(item => `
                <tr>
                  <td>${escapeHtml(item.name)}${item.notes?`<br>${escapeHtml(item.notes)}`:""}</td>
                  <td>${item.quantity}</td>
                  <td>R$ ${item.unit_price.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                  <td>R$ ${item.total.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total">
            Total: R$ ${receiptData.total.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
          
          <p>Forma de Pagamento: ${receiptData.payment_method}</p>
          
          <div class="footer">
            <p>Esta não é uma nota fiscal</p>
            <p>${escapeHtml(business.receiptMessage)}</p>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const cancelSale = async (saleId) => {
    if (!confirm('Tem certeza que deseja cancelar esta venda?')) return;

    setLoading(true);
    try {
      const detail=(await api.get(`/sales/${saleId}`)).data;
      const restoreIngredients=detail.items?.some(i=>i.recipe)&&window.confirm('Os ingredientes dos produtos preparados NÃO foram usados? OK confirma a reposição; Cancelar mantém a baixa e registra o consumo.');
      await api.put(`/sales/${saleId}/cancel`,{restoreIngredients:Boolean(restoreIngredients)});
      await fetchSales();
      await fetchProducts();
      alert('Venda cancelada com sucesso!');
    } catch (error) {
      setError('Erro ao cancelar venda');
      console.error('Erro ao cancelar venda:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => !pizzaBases.has(product.id)).filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    [product.barcode,product.partDetails?.manufacturer,product.partDetails?.partNumber,...(product.partDetails?.originalCodes||[])].some(value=>value?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <ScaleScanDialog weight={scaleWeight} onWeightChange={value=>{setScaleWeight(value);setScaleConfirmed(false)}} confirmed={scaleConfirmed} onConfirmedChange={setScaleConfirmed} item={scaleItem} onClose={()=>setScaleItem(null)} onConfirm={confirmScale} error={scaleError}/>
      {pizzaOpen&&<PizzaBuilder onAdd={addPizza} onClose={()=>setPizzaOpen(false)}/>}
      {pizzaError&&<p role="alert">{pizzaError}</p>}
      {business.modules?.pizza&&<Button onClick={()=>{if(!cashRegister?.is_open){setError('Você precisa abrir um caixa para vender');return;}setPizzaOpen(true)}}>Montar pizza</Button>}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel de Vendas</h1>
          <p className="text-muted-foreground">
            Registre vendas e acompanhe o caixa.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          {/* Botão Ticket Rápido */}
          <Dialog open={isTicketDialogOpen} onOpenChange={setIsTicketDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!cashRegister?.is_open}>
                <Receipt className="mr-2 h-4 w-4" />
                Ticket Rápido
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Emitir Ticket Rápido</DialogTitle>
                <DialogDescription>
                  Emita um vale para retirada posterior de produtos
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTicket}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="ticketProduct">Produto *</Label>
                    <Select
                      value={ticketForm.productId}
                      onValueChange={(value) => setTicketForm({...ticketForm, productId: value})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.filter(p => stockAvailable(p) > 0).map((product) => (
                          <SelectItem key={product.id} value={String(product.id)}>
                            {product.name} - R$ {Number(product.salePrice)} (Disponível: {stockAvailable(product)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="ticketQuantity">Quantidade *</Label>
                    <Input
                      id="ticketQuantity"
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={ticketForm.quantity}
                      onChange={(e) => setTicketForm({...ticketForm, quantity: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="customerName">Nome do Cliente</Label>
                    <Input
                      id="customerName"
                      value={ticketForm.customerName}
                      onChange={(e) => setTicketForm({...ticketForm, customerName: e.target.value})}
                      placeholder="Nome do cliente (opcional)"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="ticketNotes">Observações</Label>
                    <Input
                      id="ticketNotes"
                      value={ticketForm.notes}
                      onChange={(e) => setTicketForm({...ticketForm, notes: e.target.value})}
                      placeholder="Observações (opcional)"
                    />
                  </div>
                </div>
                <DialogFooter className="mt-4">
                  <Button type="button" variant="outline" onClick={() => setIsTicketDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Emitindo...' : 'Emitir Ticket'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Status do Caixa */}
          <Card className="p-3">
            <div className="flex items-center gap-2">
              {cashRegister?.is_open ? (
                <>
                  <Unlock className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Caixa Aberto</span>
                  <span className="text-xs text-muted-foreground">
                    por {cashRegister.opened_by}
                  </span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-600">Caixa Fechado</span>
                </>
              )}
            </div>
          </Card>

          {/* Botões de Controle do Caixa */}
          {!cashRegister?.is_open ? (
            <Dialog open={isOpenCashDialogOpen} onOpenChange={setIsOpenCashDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Unlock className="mr-2 h-4 w-4" />
                  Abrir Caixa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Abrir Caixa</DialogTitle>
                  <DialogDescription>
                    Informe os dados para abertura do caixa do dia
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="opened_by">Responsável</Label>
                    <Input
                      id="opened_by"
                      value={user?.username||''}
                      readOnly
                      placeholder="Nome do responsável"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="opening_amount">Valor Inicial (R$)</Label>
                    <Input
                      id="opening_amount"
                      currency
                      step="0.01"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={openCashRegister} disabled={loading}>
                    {loading ? 'Abrindo...' : 'Abrir Caixa'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={isCloseCashDialogOpen} onOpenChange={open=>{setIsCloseCashDialogOpen(open);if(open)fetchCashRegisterStatus();}}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Lock className="mr-2 h-4 w-4" />
                  Fechar Caixa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Fechar Caixa</DialogTitle>
                  <DialogDescription>
                    Informe o valor final para fechamento do caixa
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="closing_amount">Valor Final (R$)</Label>
                    <Input
                      id="closing_amount"
                      currency
                      step="0.01"
                      value={closingAmount}
                      onChange={(e) => setClosingAmount(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  {cashRegister && (
                    <div className="text-sm text-muted-foreground">
                      <p>Valor inicial: R$ {Number(cashRegister.opening_amount || 0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                      <p>Aberto por: {cashRegister.opened_by}</p>
                      <p>Entradas financeiras em dinheiro: {Number(cashRegister.financialCashIn||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
                      <p>Saídas financeiras em dinheiro: {Number(cashRegister.financialCashOut||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
                      <p className="font-semibold">Saldo esperado em dinheiro: {Number(cashRegister.expected_amount||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={closeCashRegister} disabled={loading}>
                    {loading ? 'Fechando...' : 'Fechar Caixa'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
            <DialogTrigger asChild>
              <Button disabled={!cashRegister?.is_open}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Carrinho ({cart.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="grid-cols-1 sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Finalizar Venda</DialogTitle>
                <DialogDescription>
                  Revise os itens e finalize a venda
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Preço Unit.</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item.cartKey||item.id}>
                          <TableCell className="whitespace-normal break-words max-w-80">{item.name}{item.notes&&<p className="text-xs text-muted-foreground">{item.notes}</p>}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={Boolean(item.scale)}
                                onClick={() => updateQuantity(item.cartKey||item.id, item.quantity - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={Boolean(item.scale)}
                                onClick={() => updateQuantity(item.cartKey||item.id, item.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>R$ {item.price.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</TableCell>
                          <TableCell>R$ {lineTotal({quantity:item.quantity,unitPrice:item.price}).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeFromCart(item.cartKey||item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center text-lg font-semibold">
                    <span>Total:</span>
                    <span>R$ {getTotalAmount().toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <CustomerSelect value={customerId} onChange={setCustomerId}/>
                  {['admin','gerente'].includes(user?.role)&&<label>Desconto (R$)<Input currency value={discount} onChange={e=>setDiscount(e.target.value)}/></label>}
                  <Label htmlFor="payment_method">Forma de Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="payment_method" aria-label="Forma de Pagamento">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                      <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                    </SelectContent>
                  </Select>
                  {paymentMethod==='pix'&&<PixPayment/>}
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={clearCart}>
                    Limpar Carrinho
                  </Button>
                  <Button onClick={completeSale} disabled={loading || cart.length === 0}>
                    {loading ? 'Processando...' : 'Finalizar Venda'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Alerta se caixa estiver fechado */}
      {!cashRegister?.is_open && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            O caixa está fechado. Abra o caixa para começar a realizar vendas.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel de Produtos */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Produtos Disponíveis</CardTitle>
              <CardDescription>
                Selecione os produtos para adicionar ao carrinho
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Busca por texto */}
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produtos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Busca por código de barras */}
                <div className="flex items-center space-x-2">
                  <Scan className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Código de barras..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleBarcodeSearch()}
                  />
                  <Button onClick={handleBarcodeSearch}>
                    Buscar
                  </Button>
                </div>

                {/* Grid de produtos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                  {filteredProducts.map((product) => (
                    <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold">{product.name}</h3>
                            <p className="text-sm text-muted-foreground">{product.category}</p>
                            <p className="text-lg font-bold text-primary">R$ {Number(product.salePrice).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.itemType==='service'?'Serviço · sem estoque':product.recipeEnabled?`Ficha técnica · disponível: ${stockAvailable(product)}`:product.lotTracked?`Disponível por lotes: ${stockAvailable(product)} · Físico: ${Number(product.currentStock)}`:`Estoque: ${stockAvailable(product)}`}
                            </p>
                          </div>
                          <Button
                            onClick={() => addToCart(product)}
                            disabled={(product.itemType!=='service'&&stockAvailable(product) === 0) || !cashRegister?.is_open}
                            size="sm"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resumo do Carrinho */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Carrinho Atual</CardTitle>
              <CardDescription>
                {cart.length} item(s) selecionado(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cart.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Carrinho vazio
                  </p>
                ) : (
                  <>
                    {cart.map((item) => (
                      <div key={item.cartKey||item.id} className="flex justify-between items-center p-2 border rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity.toLocaleString('pt-BR')}{item.scale?' kg':'x'} R$ {item.price.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
                          </p>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="font-semibold text-sm">
                            R$ {lineTotal({quantity:item.quantity,unitPrice:item.price}).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(item.cartKey||item.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between items-center font-semibold">
                        <span>Total:</span>
                        <span>R$ {getTotalAmount().toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Última venda - botão para imprimir */}
          {lastSaleReceipt && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">Última Venda</CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => printReceipt(lastSaleReceipt)}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir Nota
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Histórico de Vendas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Receipt className="mr-2 h-5 w-5" />
            Vendas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.slice(0, 10).map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>#{sale.id}</TableCell>
                    <TableCell>
                      {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>R$ {Number(sale.total_amount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</TableCell>
                    <TableCell>{sale.payment_method}</TableCell>
                    <TableCell>
                      <Badge variant={sale.status === 'completed' ? 'default' : 'destructive'}>
                        {sale.status === 'completed' ? 'Concluída' : 'Cancelada'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {business.modules?.delivery&&sale.status==='completed'&&<Button variant="outline" size="sm" asChild><Link to={'/deliveries?sale='+sale.id}>Entrega</Link></Button>}
                      {sale.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelSale(sale.id)}
                        >
                          Cancelar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Sales;

