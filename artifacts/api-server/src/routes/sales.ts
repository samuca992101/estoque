import { Router, type IRouter } from "express";
import { db } from "../db"; // Importa a conexão configurada
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";


import { products as productsTable, inventoryMovements as salesTable } from "../db/schema";


const SaleItemSchema = z.object({
  productId: z.number(),
  quantity: z.number().positive(),
});

const CreateSaleBody = z.object({
  items: z.array(SaleItemSchema).min(1, "O carrinho deve ter pelo menos 1 item"),
  saleDate: z.string().optional(),
});

const router: IRouter = Router();

// GET: Listar Vendas (Mantido igual, exibindo o histórico de transações individualmente)
router.get("/sales", requireAuth, async (_req, res): Promise<void> => {
  try {
    const sales = await db
      .select({
        id: salesTable.id,
        productId: salesTable.productId,
        productName: productsTable.name,
        quantity: salesTable.quantity,
        saleDate: salesTable.createdAt, 
        price: productsTable.price,
      })
      .from(salesTable)
      .innerJoin(productsTable, eq(salesTable.productId, productsTable.id));

    const mapped = sales.map((s) => ({
      id: s.id,
      productId: s.productId,
      productName: s.productName,
      // Se no banco está negativo (ex: -4), o map converte para exibição positiva na tabela (4)
      quantity: Math.abs(s.quantity), 
      saleDate: new Date(s.saleDate).toISOString(),
      totalValue: Math.abs(s.quantity) * Number(s.price),
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar vendas" });
  }
});

// POST: Criar Venda com Múltiplos Produtos (Carrinho)
router.post("/sales", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items } = parsed.data;
  const saleDateStr = parsed.data.saleDate 
    ? new Date(parsed.data.saleDate).toISOString() 
    : new Date().toISOString();

  try {
    // Executa as operações em lote dentro de uma transação isolada
    const resultadoVenda = await db.transaction(async (tx) => {
      const itensProcessados = [];

      for (const item of items) {
        // 1. Busca e valida o produto atual
        const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, item.productId));
        if (!product) {
          throw new Error(`Produto com ID ${item.productId} não foi encontrado.`);
        }

        // 2. Valida se há estoque disponível
        if ((product.currentStock || 0) < item.quantity) {
          throw new Error(`Estoque insuficiente para o produto "${product.name}". Disponível: ${product.currentStock} unidades.`);
        }

        // 3. Insere a movimentação de saída de estoque ('OUT')
        const [sale] = await tx
          .insert(salesTable)
          .values({ 
            productId: item.productId, 
            quantity: -item.quantity, // Negativo para saída
            type: 'OUT',
            createdAt: saleDateStr 
          })
          .returning();

        // 4. Deduz a quantidade do estoque do produto
        await tx
          .update(productsTable)
          .set({ currentStock: (product.currentStock || 0) - item.quantity })
          .where(eq(productsTable.id, item.productId));

        // Guarda os detalhes para retornar na resposta da requisição
        itensProcessados.push({
          id: sale.id,
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          totalValue: item.quantity * Number(product.price),
        });
      }

      return itensProcessados;
    });

    // Calcula o valor total final somando todos os produtos do carrinho
    const valorTotalPedido = resultadoVenda.reduce((acc, curr) => acc + curr.totalValue, 0);

    res.status(201).json({
      message: "Venda em lote realizada com sucesso!",
      saleDate: saleDateStr,
      totalPedido: valorTotalPedido,
      items: resultadoVenda,
    });

  } catch (error: any) {
    // Se estourar a validação do Error() acima, a transação desfaz as alterações e cai aqui
    res.status(400).json({ error: error.message || "Erro ao processar lote de vendas" });
  }
});

export default router;