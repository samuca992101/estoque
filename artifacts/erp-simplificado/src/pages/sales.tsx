import { useState } from "react";
import { 
  useListSales, 
  getListSalesQueryKey,
  useListProducts,
  getListProductsQueryKey,
  useCreateSale,
  getGetDashboardQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Loader2, ShoppingBag, Trash2, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// O Schema do formulário valida a adição de UM item por vez ao carrinho local
const itemSchema = z.object({
  productId: z.coerce.number({ required_error: "Selecione um produto" }),
  quantity: z.coerce.number().int().min(1, "Quantidade deve ser pelo menos 1"),
});

type ItemFormValues = z.infer<typeof itemSchema>;

interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
}

export default function Sales() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 🛒 ESTADO DO CARRINHO LOCAL
  const [cart, setCart] = useState<CartItem[]>([]);

  const { data: sales, isLoading: isSalesLoading } = useListSales({ query: { queryKey: getListSalesQueryKey() } });
  const { data: products, isLoading: isProductsLoading } = useListProducts({ query: { queryKey: getListProductsQueryKey() } });

  const { mutate: createSale, isPending: isCreating } = useCreateSale({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setCart([]); // Limpa o carrinho após salvar no banco
        form.reset({ productId: undefined, quantity: 1 });
        toast({ title: "Venda registrada com sucesso" });
      },
      onError: (err) => toast({ title: "Erro ao registrar venda", description: err.message, variant: "destructive" })
    }
  });

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      quantity: 1
    }
  });

  const selectedProductId = form.watch("productId");
  const selectedProduct = products?.find(p => p.id === selectedProductId);

  // 1. Adicionar item ao carrinho visual (na memória do React)
  const onAddToCart = (data: ItemFormValues) => {
    const product = products?.find(p => p.id === data.productId);
    if (!product) return;

    // Validação de estoque preventiva antes de acumular no carrinho
    const totalQuantityInCart = (cart.find(item => item.productId === product.id)?.quantity || 0) + data.quantity;
    if ((product.currentStock || 0) < totalQuantityInCart) {
      toast({
        title: "Estoque insuficiente",
        description: `Não é possível adicionar mais unidades de "${product.name}". Estoque disponível: ${product.currentStock}`,
        variant: "destructive"
      });
      return;
    }

    const existingItem = cart.find(item => item.productId === data.productId);

    if (existingItem) {
      setCart(cart.map(item => 
        item.productId === data.productId 
          ? { ...item, quantity: item.quantity + data.quantity }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: data.quantity
      }]);
    }

    // Reseta apenas os campos, mantendo o estado pronto para a próxima adição
    form.reset({ productId: undefined, quantity: 1 });
  };

  // Remover item do carrinho antes de finalizar
  const handleRemoveFromCart = (productId: number) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  // 2. Enviar o carrinho estruturado de uma vez só para o Back-end
  const handleFinalizeSale = () => {
    if (cart.length === 0) return;
    
    // Mapeia o payload conforme o formato exigido pelo CreateSaleBody do backend (objeto com chave "items")
    createSale({ 
      data: {
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      } 
    });
  };

  const totalCartValue = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Vendas</h2>
        <p className="text-muted-foreground">Adicione múltiplos produtos ao carrinho para registrar vendas em lote.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <div className="space-y-6">
          {/* Card de Adição de Itens */}
          <Card>
            <CardHeader>
              <CardTitle>Montar Pedido</CardTitle>
              <CardDescription>Adicione itens ao carrinho atual.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onAddToCart)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produto</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value?.toString() || ""}
                          disabled={isProductsLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um produto" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products?.map(product => (
                              <SelectItem key={product.id} value={product.id.toString()}>
                                {product.name} (R$ {product.price.toFixed(2)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} />
                        </FormControl>
                        {selectedProduct && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Estoque atual: {selectedProduct.currentStock} unidades
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" variant="secondary" className="w-full" disabled={!selectedProductId}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Item
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* 🛒 Novo Card: Resumo do Carrinho de Compras Ativo */}
          {cart.length > 0 && (
            <Card className="border-emerald-200 bg-emerald-50/20 dark:bg-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-emerald-600" />
                  Carrinho Atual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {cart.map(item => (
                    <div key={item.productId} className="flex justify-between items-center bg-background p-2 rounded-lg border text-sm">
                      <div className="space-y-0.5">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.quantity}x • R$ {item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveFromCart(item.productId)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-between items-center border-t border-dashed font-bold text-base">
                  <span>Total do Pedido:</span>
                  <span className="text-lg text-emerald-700 dark:text-emerald-400">R$ {totalCartValue.toFixed(2)}</span>
                </div>

                <Button onClick={handleFinalizeSale} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white" disabled={isCreating}>
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingBag className="mr-2 h-4 w-4" />}
                  Finalizar Venda (Enviar Lote)
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Histórico Geral */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Transações</CardTitle>
            <CardDescription>Registro de todas as vendas realizadas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isSalesLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[30px] ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[60px] ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : sales?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        Nenhuma venda registrada ainda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales?.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(sale.saleDate), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">{sale.productName}</TableCell>
                        <td className="p-3 text-center text-red-600 font-medium">-{sale.quantity}</td>
                        <TableCell className="text-right font-medium">
                          R$ {sale.totalValue.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}