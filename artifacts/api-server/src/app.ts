import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

// 🛠️ IMPORTAÇÕES DO BANCO DE DADOS ADICIONADAS
import { db } from "./db";
import { products as productsTable, inventoryMovements as salesTable } from "./db/schema";
import { eq } from "drizzle-orm";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🛠️ ROTA DE REPOSIÇÃO GLOBAL INJETADA DIRETAMENTE NO APP
app.post("/api/inventory/in", async (req, res) => {
  const { productId, quantity } = req.body;
  
  if (!productId || !quantity) {
    return res.status(400).json({ error: "productId e quantity são obrigatórios" });
  }

  try {
    await db.transaction(async (tx) => {
      const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, Number(productId)));
      if (!product) throw new Error("Produto não encontrado na base de dados");

      // Salva o registro de entrada ('IN') positivo para a IA calcular previsões futuramente
      await tx.insert(salesTable).values({
        productId: Number(productId),
        quantity: Number(quantity),
        type: "IN",
        createdAt: new Date().toISOString(),
      });

      // Soma a nova quantidade ao estoque atual do produto
      await tx
        .update(productsTable)
        .set({ currentStock: (product.currentStock || 0) + Number(quantity) })
        .where(eq(productsTable.id, Number(productId)));
    });

    return res.json({ success: true, message: "Estoque atualizado com sucesso!" });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || "Erro ao atualizar estoque" });
  }
});

// Mantém o restante das rotas do sistema funcionando normalmente
app.use("/api", router);

export default app;