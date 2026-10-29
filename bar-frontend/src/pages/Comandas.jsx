import ComandaLoyaltyDiscount from "../components/ComandaLoyaltyDiscount";
import CustomerSelect from "../components/CustomerSelect";
import { canAccess } from "../lib/access";
import BundlePicker from "../components/BundlePicker";
import PizzaBuilder from "../components/pizza/PizzaBuilder";
import usePizzaCatalog from "../components/pizza/usePizzaCatalog";
import { useAuth } from "../hooks/useAuth";
import PixPayment from "../components/PixPayment";
import { useBusiness } from "../hooks/useBusiness";
import { receiptHeader, escapeHtml } from "../lib/receipt";
import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  Receipt,
  CreditCard,
  Clock,
  User,
  Phone,
  ShoppingCart,
  X,
  Printer,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useSearchParams } from "react-router-dom";

const Comandas = () => {
  const { business } = useBusiness();
  const { user } = useAuth();
  const { menu: pizzaMenu } = usePizzaCatalog(Boolean(business.modules?.pizza));
  const pizzaBases = new Set(
    (pizzaMenu?.sizes || []).filter((s) => s.active).map((s) => s.productId),
  );
  const [searchParams] = useSearchParams();
  const requestedComanda = searchParams.get("comanda");
  const [comandas, setComandas] = useState([]);
  const [openComandas, setOpenComandas] = useState([]);
  const [pizzaOpen, setPizzaOpen] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedComanda, setSelectedComanda] = useState(null);
  const [activeTab, setActiveTab] = useState("open");

  // Dialog states
  const [isNewComandaOpen, setIsNewComandaOpen] = useState(false);
  const [isViewComandaOpen, setIsViewComandaOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isCloseComandaOpen, setIsCloseComandaOpen] = useState(false);

  // Form states
  const [newComandaForm, setNewComandaForm] = useState({
    type: "balcao",
    customerName: "",
    customerPhone: "",
    deliveryType: "balcao",
  });

  const [addItemForm, setAddItemForm] = useState({
    productId: "",
    quantity: "",
    notes: "",
  });

  const [loyalty, setLoyalty] = useState(null),
    [linkedCustomer, setLinkedCustomer] = useState("");
  const [closeComandaForm, setCloseComandaForm] = useState({
    paymentMethod: "",
    paymentStatus: "pago",
    discountValue: "",
    discountPercentage: "",
    notes: "",
  });

  const closingTotal = Math.max(
    0,
    Math.round(
      (Number(selectedComanda?.totalValue || 0) -
        Number(closeComandaForm.discountValue || 0) -
        (Number(selectedComanda?.totalValue || 0) *
          Number(closeComandaForm.discountPercentage || 0)) /
          100) *
        100,
    ) / 100,
  );
  useEffect(() => {
    fetchComandas();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!requestedComanda) return;
    let active = true;
    api
      .get(`/comandas/${requestedComanda}`)
      .then(({ data }) => {
        if (active) {
          setSelectedComanda(data);
          setIsViewComandaOpen(true);
        }
      })
      .catch(() => {
        if (active) toast.error("Não foi possível abrir a comanda vinculada.");
      });
    return () => {
      active = false;
    };
  }, [requestedComanda]);

  useEffect(() => {
    if (isCloseComandaOpen) {
      setLinkedCustomer(selectedComanda?.customerId || "");
      setLoyalty(null);
      setCloseComandaForm((prev) => ({
        ...prev,
        discountValue: "",
        discountPercentage: "",
      }));
    }
  }, [isCloseComandaOpen, selectedComanda?.id, selectedComanda?.customerId]);
  useEffect(() => {
    if (
      loyalty &&
      (loyalty.customerId !== linkedCustomer ||
        loyalty.comandaUpdatedAt !== selectedComanda?.updated_at)
    ) {
      setLoyalty(null);
      setCloseComandaForm((prev) => ({
        ...prev,
        discountValue: "",
        discountPercentage: "",
      }));
    }
  }, [loyalty, linkedCustomer, selectedComanda?.updated_at]);
  const fetchComandas = async () => {
    try {
      setLoading(true);
      const [openResponse, allResponse] = await Promise.all([
        api.get("/comandas/open"),
        api.get("/comandas"),
      ]);

      setOpenComandas(openResponse.data);
      setComandas(allResponse.data.comandas);
    } catch (error) {
      console.error("Erro ao carregar comandas:", error);
      toast.error("Erro ao carregar comandas");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get("/products");
      setProducts(
        response.data.filter(
          (product) =>
            product.active &&
            (product.itemType === "service" ||
              Number(product.availableStock ?? product.currentStock) > 0),
        ),
      );
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
    }
  };

  const handleCreateComanda = async (e) => {
    e.preventDefault();
    try {
      await api.post("/comandas", {
        type: newComandaForm.type,
        customerName: newComandaForm.customerName || null,
        customerPhone: newComandaForm.customerPhone || null,
        deliveryType: newComandaForm.deliveryType,
      });

      toast.success("Comanda criada com sucesso!");
      setIsNewComandaOpen(false);
      resetNewComandaForm();
      fetchComandas();
    } catch (error) {
      console.error("Erro ao criar comanda:", error);
      toast.error(error.response?.data?.error || "Erro ao criar comanda");
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      const product = products.find((p) => p.id === addItemForm.productId);

      if (!product) {
        toast.error("Produto não encontrado");
        return;
      }

      if (
        product.itemType !== "service" &&
        parseFloat(addItemForm.quantity) >
          Number(product.availableStock ?? product.currentStock)
      ) {
        toast.error("Quantidade solicitada maior que o estoque disponível");
        return;
      }

      await api.post(`/comandas/${selectedComanda.id}/items`, {
        productId: addItemForm.productId,
        quantity: parseFloat(addItemForm.quantity),
        notes: addItemForm.notes,
      });

      toast.success("Item adicionado à comanda!");
      setIsAddItemOpen(false);
      resetAddItemForm();
      fetchComandas();
      fetchProducts();

      // Atualizar a comanda selecionada
      const updatedComanda = await api.get(`/comandas/${selectedComanda.id}`);
      setSelectedComanda(updatedComanda.data);
    } catch (error) {
      console.error("Erro ao adicionar item:", error);
      toast.error(error.response?.data?.error || "Erro ao adicionar item");
    }
  };

  const handleRemoveItem = async (itemId) => {
    const member = selectedComanda.items.find((i) => i.id === itemId);
    if (member?.bundle) {
      if (!window.confirm("Remover o combo completo, incluindo os adicionais?"))
        return;
      const hasRecipe = selectedComanda.items.some(
        (i) => i.bundle?.groupId === member.bundle.groupId && i.recipe,
      );
      const restoreIngredients = Boolean(
        hasRecipe &&
        ["admin", "gerente"].includes(user?.role) &&
        window.confirm(
          "Os ingredientes NÃO foram usados? OK repõe os ingredientes; Cancelar mantém o consumo registrado.",
        ),
      );
      try {
        await api.delete(
          "/bundles/comandas/" +
            selectedComanda.id +
            "/" +
            member.bundle.groupId,
          { data: { restoreIngredients } },
        );
        setSelectedComanda(
          (await api.get("/comandas/" + selectedComanda.id)).data,
        );
        fetchProducts();
        fetchComandas();
      } catch (e) {
        toast.error(
          e.response?.data?.error || "Não foi possível remover o combo",
        );
      }
      return;
    }
    if (!window.confirm("Tem certeza que deseja remover este item?")) {
      return;
    }

    try {
      const item = selectedComanda.items.find((i) => i.id === itemId);
      const restoreIngredients = Boolean(
        item?.recipe &&
        ["admin", "gerente"].includes(user?.role) &&
        window.confirm(
          "Os insumos NÃO foram usados? OK repõe os insumos; Cancelar mantém a baixa registrada.",
        ),
      );
      await api.delete(`/comandas/${selectedComanda.id}/items/${itemId}`, {
        data: { restoreIngredients },
      });
      toast.success("Item removido da comanda!");
      fetchComandas();
      fetchProducts();

      // Atualizar a comanda selecionada
      const updatedComanda = await api.get(`/comandas/${selectedComanda.id}`);
      setSelectedComanda(updatedComanda.data);
    } catch (error) {
      console.error("Erro ao remover item:", error);
      toast.error(error.response?.data?.error || "Erro ao remover item");
    }
  };

  const handleUpdateItemQuantity = async (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      handleRemoveItem(itemId);
      return;
    }

    try {
      await api.put(`/comandas/${selectedComanda.id}/items/${itemId}`, {
        quantity: newQuantity,
        restoreIngredients: Boolean(
          selectedComanda.items.find((i) => i.id === itemId)?.recipe &&
          newQuantity <
            Number(
              selectedComanda.items.find((i) => i.id === itemId)?.quantity,
            ) &&
          ["admin", "gerente"].includes(user?.role) &&
          window.confirm(
            "Os insumos da quantidade removida NÃO foram usados? OK repõe; Cancelar mantém a baixa.",
          ),
        ),
      });

      // Atualizar a comanda selecionada
      const updatedComanda = await api.get(`/comandas/${selectedComanda.id}`);
      setSelectedComanda(updatedComanda.data);
    } catch (error) {
      console.error("Erro ao atualizar quantidade:", error);
      toast.error(
        error.response?.data?.error || "Erro ao atualizar quantidade",
      );
    }
  };

  const handleCloseComanda = async (e) => {
    e.preventDefault();
    try {
      const response = await api.put(`/comandas/${selectedComanda.id}/close`, {
        paymentMethod: closeComandaForm.paymentMethod,
        paymentStatus: closeComandaForm.paymentStatus,
        discountValue: closeComandaForm.discountValue
          ? parseFloat(closeComandaForm.discountValue)
          : 0,
        discountPercentage: closeComandaForm.discountPercentage
          ? parseFloat(closeComandaForm.discountPercentage)
          : 0,
        notes: closeComandaForm.notes,
        loyalty: loyalty
          ? {
              customerId: loyalty.customerId,
              comandaId: loyalty.comandaId,
              revision: loyalty.revision,
              scopeDigest: loyalty.scopeDigest,
            }
          : undefined,
      });

      toast.success("Comanda fechada com sucesso!");
      setIsCloseComandaOpen(false);
      setIsViewComandaOpen(false);
      resetCloseComandaForm();
      fetchComandas();

      // Imprimir comprovante se necessário
      if (response.data.receipt) {
        printReceipt(response.data.receipt);
      }
    } catch (error) {
      console.error("Erro ao fechar comanda:", error);
      toast.error(error.response?.data?.error || "Erro ao fechar comanda");
    }
  };

  const printReceipt = (receiptData) => {
    const printWindow = window.open("", "_blank");
    const printContent = `
      <html>
        <head>
          <title>Comanda #${receiptData.id}</title>
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
            <h2>Comanda #${receiptData.id}</h2>
            <p>Data: ${new Date(receiptData.closedAt).toLocaleString("pt-BR")}</p>
            ${receiptData.customerName ? `<p>Cliente: ${receiptData.customerName}</p>` : ""}
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
              ${
                receiptData.items
                  ?.map(
                    (item) => `
                <tr>
                  <td>${escapeHtml(item.bundle?.component?.name || item.pizza?.description || item.product?.name)}${item.bundle ? `<br>${escapeHtml(item.notes || item.bundle.name)}` : ""}</td>
                  <td>${item.quantity}</td>
                  <td>R$ ${parseFloat(item.priceAtSale).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>R$ ${parseFloat(item.totalItemValue).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              `,
                  )
                  .join("") || ""
              }
            </tbody>
          </table>

          ${receiptData.loyaltyBenefit ? `<p>Fidelidade: ${escapeHtml(receiptData.loyaltyBenefit.profile.label)} · ${Number(receiptData.loyaltyBenefit.profile.basisPoints / 100).toLocaleString("pt-BR")}%</p>` : ""}
          ${receiptData.discountValue > 0 ? `<p>Desconto: R$ ${Number(receiptData.discountValue).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>` : ""}

          <div class="total">
            Total: R$ ${parseFloat(receiptData.finalValue ?? receiptData.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>

          ${receiptData.payments?.length ? receiptData.payments.map((p) => `<p>Pagamento: ${escapeHtml(p.method)} — R$ ${Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>`).join("") : `<p>Forma de pagamento: ${escapeHtml(receiptData.paymentMethod || "")}</p>`}

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

  const resetNewComandaForm = () => {
    setNewComandaForm({
      type: "balcao",
      customerName: "",
      customerPhone: "",
      deliveryType: "balcao",
    });
  };

  const resetAddItemForm = () => {
    setAddItemForm({
      productId: "",
      quantity: "",
      notes: "",
    });
  };

  const resetCloseComandaForm = () => {
    setCloseComandaForm({
      paymentMethod: "",
      paymentStatus: "pago",
      discountValue: "",
      discountPercentage: "",
      notes: "",
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      aberta: { label: "Aberta", variant: "default" },
      fechada: { label: "Fechada", variant: "secondary" },
      cancelada: { label: "Cancelada", variant: "destructive" },
    };

    const config = statusConfig[status] || statusConfig["aberta"];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeBadge = (type) => {
    const typeConfig = {
      balcao: { label: "Balcão", variant: "outline" },
      mesa: { label: "Mesa", variant: "default" },
      delivery: { label: "Delivery", variant: "secondary" },
    };

    const config = typeConfig[type] || typeConfig["balcao"];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando comandas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comandas</h1>
          <p className="text-muted-foreground">
            Gerencie comandas de balcão, mesa e delivery
          </p>
        </div>

        <Dialog open={isNewComandaOpen} onOpenChange={setIsNewComandaOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Comanda
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Comanda</DialogTitle>
              <DialogDescription>
                Crie uma nova comanda para atendimento
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateComanda}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo de Comanda</Label>
                  <Select
                    value={newComandaForm.type}
                    onValueChange={(value) =>
                      setNewComandaForm({ ...newComandaForm, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="balcao">Balcão</SelectItem>
                      <SelectItem value="mesa">Mesa</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerName">
                    Nome do Cliente (Opcional)
                  </Label>
                  <Input
                    id="customerName"
                    value={newComandaForm.customerName}
                    onChange={(e) =>
                      setNewComandaForm({
                        ...newComandaForm,
                        customerName: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Telefone (Opcional)</Label>
                  <Input
                    id="customerPhone"
                    value={newComandaForm.customerPhone}
                    onChange={(e) =>
                      setNewComandaForm({
                        ...newComandaForm,
                        customerPhone: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewComandaOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Criar Comanda</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Comandas Abertas
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openComandas.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Recebido no dia
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R${" "}
              {comandas
                .filter(
                  (c) =>
                    c.status === "fechada" &&
                    c.paymentStatus === "pago" &&
                    new Date(c.closedAt).toDateString() ===
                      new Date().toDateString(),
                )
                .reduce(
                  (total, c) =>
                    total + parseFloat(c.finalValue ?? c.totalValue ?? 0),
                  0,
                )
                .toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Comandas do Dia
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                comandas.filter(
                  (c) =>
                    new Date(c.openedAt).toDateString() ===
                    new Date().toDateString(),
                ).length
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R${" "}
              {(() => {
                const closedToday = comandas.filter(
                  (c) =>
                    c.status === "fechada" &&
                    c.paymentStatus === "pago" &&
                    new Date(c.closedAt).toDateString() ===
                      new Date().toDateString(),
                );
                const total = closedToday.reduce(
                  (sum, c) =>
                    sum + parseFloat(c.finalValue ?? c.totalValue ?? 0),
                  0,
                );
                return closedToday.length > 0
                  ? (total / closedToday.length).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "0.00";
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="open">
            Abertas ({openComandas.length})
          </TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comandas Abertas</CardTitle>
              <CardDescription>
                Comandas em andamento que precisam de atenção
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Aberta em</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openComandas.map((comanda) => (
                      <TableRow key={comanda.id}>
                        <TableCell className="font-medium">
                          #{comanda.id}
                        </TableCell>
                        <TableCell>{getTypeBadge(comanda.type)}</TableCell>
                        <TableCell>
                          {comanda.customerName || "Cliente não informado"}
                        </TableCell>
                        <TableCell>
                          {new Date(comanda.openedAt).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          {comanda.items?.length || 0} item(s)
                        </TableCell>
                        <TableCell>
                          R${" "}
                          {parseFloat(comanda.totalValue || 0).toLocaleString(
                            "pt-BR",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedComanda(comanda);
                                setIsViewComandaOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Todas as Comandas</CardTitle>
              <CardDescription>Histórico completo de comandas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aberta em</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comandas.slice(0, 20).map((comanda) => (
                      <TableRow key={comanda.id}>
                        <TableCell className="font-medium">
                          #{comanda.id}
                        </TableCell>
                        <TableCell>{getTypeBadge(comanda.type)}</TableCell>
                        <TableCell>
                          {comanda.customerName || "Cliente não informado"}
                        </TableCell>
                        <TableCell>{getStatusBadge(comanda.status)}</TableCell>
                        <TableCell>
                          {new Date(comanda.openedAt).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          R${" "}
                          {parseFloat(comanda.totalValue || 0).toLocaleString(
                            "pt-BR",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedComanda(comanda);
                              setIsViewComandaOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Visualização da Comanda */}
      <Dialog open={isViewComandaOpen} onOpenChange={setIsViewComandaOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comanda #{selectedComanda?.id}</DialogTitle>
            <DialogDescription>Detalhes e itens da comanda</DialogDescription>
          </DialogHeader>

          {selectedComanda && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Tipo</Label>
                  <p className="text-sm">
                    {getTypeBadge(selectedComanda.type)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <p className="text-sm">
                    {getStatusBadge(selectedComanda.status)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Cliente</Label>
                  <p className="text-sm">
                    {selectedComanda.customerName || "Não informado"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Telefone</Label>
                  <p className="text-sm">
                    {selectedComanda.customerPhone || "Não informado"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-medium">
                    Itens da Comanda
                  </Label>
                  {business.modules?.pizza &&
                    selectedComanda.status === "aberta" && (
                      <Button onClick={() => setPizzaOpen(true)}>
                        Montar pizza
                      </Button>
                    )}
                  {business.modules?.bundles &&
                    selectedComanda.status === "aberta" && (
                      <Button
                        variant="outline"
                        onClick={() => setBundleOpen(true)}
                      >
                        Selecionar combo
                      </Button>
                    )}
                  {bundleOpen && (
                    <BundlePicker
                      onClose={() => setBundleOpen(false)}
                      onAdd={async (data) => {
                        await api.post(
                          "/bundles/comandas/" + selectedComanda.id,
                          {
                            selection: data.selection,
                            quantity: data.quantity,
                            notes: data.notes,
                            expectedUnitPrice: data.preview.unitPrice,
                          },
                        );
                        setSelectedComanda(
                          (await api.get("/comandas/" + selectedComanda.id))
                            .data,
                        );
                        fetchComandas();
                        fetchProducts();
                      }}
                    />
                  )}
                  {pizzaOpen && (
                    <PizzaBuilder
                      onClose={() => setPizzaOpen(false)}
                      onAdd={async (data) => {
                        await api.post(
                          "/comandas/" + selectedComanda.id + "/items",
                          {
                            productId: data.productId,
                            pizza: data.pizza.selection,
                            quantity: data.quantity,
                            notes: data.notes,
                            expectedUnitPrice: data.unitPrice,
                          },
                        );
                        setSelectedComanda(
                          (await api.get("/comandas/" + selectedComanda.id))
                            .data,
                        );
                        fetchComandas();
                        fetchProducts();
                      }}
                    />
                  )}
                  {selectedComanda.status === "aberta" && (
                    <Button size="sm" onClick={() => setIsAddItemOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Item
                    </Button>
                  )}
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Preço Unit.</TableHead>
                        <TableHead>Total</TableHead>
                        {selectedComanda.status === "aberta" && (
                          <TableHead>Ações</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedComanda.items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.bundle?.component?.name ||
                              item.bundle?.components?.[item.bundle.index]
                                ?.name ||
                              item.pizza?.description ||
                              item.product?.name}
                            {item.bundle && (
                              <p className="text-xs text-muted-foreground">
                                {item.bundle.name} · grupo{" "}
                                {item.bundle.groupId.slice(0, 8)}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            {selectedComanda.status === "aberta" &&
                            !item.bundle ? (
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleUpdateItemQuantity(
                                      item.id,
                                      item.quantity - 1,
                                    )
                                  }
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center">
                                  {item.quantity}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleUpdateItemQuantity(
                                      item.id,
                                      item.quantity + 1,
                                    )
                                  }
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              item.quantity
                            )}
                          </TableCell>
                          <TableCell>
                            R${" "}
                            {parseFloat(item.priceAtSale).toLocaleString(
                              "pt-BR",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </TableCell>
                          <TableCell>
                            R${" "}
                            {parseFloat(item.totalItemValue).toLocaleString(
                              "pt-BR",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </TableCell>
                          {selectedComanda.status === "aberta" && (
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                {item.bundle ? "Remover combo" : ""}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold">
                  Total: R${" "}
                  {Number(
                    selectedComanda.status === "fechada"
                      ? (selectedComanda.finalValue ??
                          selectedComanda.totalValue)
                      : selectedComanda.totalValue,
                  ).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedComanda?.status === "aberta" && (
              <Button onClick={() => setIsCloseComandaOpen(true)}>
                <Receipt className="mr-2 h-4 w-4" />
                Fechar Comanda
              </Button>
            )}
            {selectedComanda?.status === "fechada" && (
              <Button onClick={() => printReceipt(selectedComanda)}>
                <Printer className="mr-2 h-4 w-4" />
                Reimprimir
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setIsViewComandaOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Adicionar Item */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Item à Comanda</DialogTitle>
            <DialogDescription>
              Selecione um produto e quantidade
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddItem}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="productId">Produto</Label>
                <Select
                  value={addItemForm.productId}
                  onValueChange={(value) =>
                    setAddItemForm({ ...addItemForm, productId: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products
                      .filter((p) => !pizzaBases.has(p.id))
                      .map((product) => (
                        <SelectItem key={product.id} value={String(product.id)}>
                          {product.name} - R${" "}
                          {parseFloat(product.salePrice).toLocaleString(
                            "pt-BR",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                          (Estoque:{" "}
                          {Number(
                            product.availableStock ?? product.currentStock,
                          )}
                          )
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.001"
                  value={addItemForm.quantity}
                  onChange={(e) =>
                    setAddItemForm({ ...addItemForm, quantity: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={addItemForm.notes}
                  onChange={(e) =>
                    setAddItemForm({ ...addItemForm, notes: e.target.value })
                  }
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddItemOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Adicionar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Fechar Comanda */}
      <Dialog open={isCloseComandaOpen} onOpenChange={setIsCloseComandaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar Comanda</DialogTitle>
            <DialogDescription>
              Finalize a comanda informando o método de pagamento
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCloseComanda}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Método de Pagamento</Label>
                <Select
                  value={closeComandaForm.paymentMethod}
                  onValueChange={(value) =>
                    setCloseComandaForm({
                      ...closeComandaForm,
                      paymentMethod: value,
                    })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao_credito">
                      Cartão de Crédito
                    </SelectItem>
                    <SelectItem value="cartao_debito">
                      Cartão de Débito
                    </SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {closeComandaForm.paymentMethod === "pix" && <PixPayment />}
              <CustomerSelect
                value={linkedCustomer}
                onChange={setLinkedCustomer}
              />
              <Button
                type="button"
                variant="outline"
                permission="tables.edit"
                onClick={async () => {
                  try {
                    const { data } = await api.put(
                      "/comandas/" + selectedComanda.id + "/customer",
                      {
                        customerId: linkedCustomer || null,
                        customerName: selectedComanda.customerName || "",
                      },
                    );
                    setSelectedComanda({ ...selectedComanda, ...data });
                    toast.success("Cliente salvo na comanda.", {
                      duration: 2000,
                    });
                  } catch (e) {
                    toast.error(
                      e.response?.data?.error ||
                        "Não foi possível vincular o cliente",
                    );
                  }
                }}
              >
                Salvar cliente vinculado
              </Button>
              <ComandaLoyaltyDiscount
                comanda={selectedComanda}
                customerId={linkedCustomer}
                onRefresh={async () => {
                  try {
                    setSelectedComanda(
                      (await api.get("/comandas/" + selectedComanda.id)).data,
                    );
                  } catch {
                    toast.error("Não foi possível atualizar a comanda");
                  }
                }}
                onApply={(quote) => {
                  setLoyalty(quote);
                  setCloseComandaForm((prev) => ({
                    ...prev,
                    discountValue: String(quote.discount),
                    discountPercentage: "",
                  }));
                }}
              />
              {loyalty && (
                <p className="font-semibold text-sm">
                  {loyalty.description} aplicado.
                </p>
              )}

              {["admin", "gerente"].includes(user?.role) &&
                canAccess(user, "discounts.apply") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="discountValue">Desconto (R$)</Label>
                      <Input
                        id="discountValue"
                        currency
                        step="0.01"
                        value={closeComandaForm.discountValue}
                        onChange={(e) => {
                          setLoyalty(null);
                          setCloseComandaForm({
                            ...closeComandaForm,
                            discountValue: e.target.value,
                          });
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="discountPercentage">Desconto (%)</Label>
                      <Input
                        id="discountPercentage"
                        type="number"
                        step="0.01"
                        value={closeComandaForm.discountPercentage}
                        onChange={(e) => {
                          setLoyalty(null);
                          setCloseComandaForm({
                            ...closeComandaForm,
                            discountPercentage: e.target.value,
                          });
                        }}
                      />
                    </div>
                  </div>
                )}

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={closeComandaForm.notes}
                  onChange={(e) =>
                    setCloseComandaForm({
                      ...closeComandaForm,
                      notes: e.target.value,
                    })
                  }
                  rows={2}
                />
              </div>

              {selectedComanda && (
                <div className="text-right">
                  <div className="text-lg font-bold">
                    Total: R${" "}
                    {closingTotal.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCloseComandaOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Fechar Comanda</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Comandas;
