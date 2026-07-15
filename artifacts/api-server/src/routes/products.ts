import { Router, type IRouter } from "express";
import { db } from "../db"; 
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";

// 1. IMPORTAÇÃO LOCAL DO SCHEMA
import { products as productsTable } from "../db/schema";

const router: IRouter = Router();

// 2. SCHEMAS DE VALIDAÇÃO LOCAIS (Adicionado 'category')
const ProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  currentStock: z.number().default(0),
  minStock: z.number().default(5),
  category: z.string().optional(), 
});

const ProductParams = z.object({
  id: z.string().transform(Number),
});

// Helper para formatar a resposta (Adicionado 'category')
function mapProduct(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    currentStock: p.currentStock,
    minimumStock: p.minStock, 
    category: p.category,  
  };
}

// GET: Listar Produtos
router.get("/products", requireAuth, async (_req, res): Promise<void> => {
  try {
    const products = await db.select().from(productsTable).orderBy(productsTable.name);
    res.json(products.map(mapProduct));
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
});

// POST: Criar Produto (Adicionado 'category')
router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const parsed = ProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, description, price, currentStock, minStock, category } = parsed.data;
  
  const [product] = await db
    .insert(productsTable)
    .values({ 
      name, 
      description, 
      price, 
      currentStock, 
      minStock,
      category 
    })
    .returning();

  res.status(201).json(mapProduct(product));
});

// GET: Produto por ID
router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = ProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }

  res.json(mapProduct(product));
});

// PUT: Atualizar Produto (Adicionado 'category')
router.put("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = ProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = ProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // 👈 AJUSTE 5: Capturar a 'category' no update também
  const { name, description, price, currentStock, minStock, category } = parsed.data;
  
  const [product] = await db
    .update(productsTable)
    .set({ name, description, price, currentStock, minStock, category }) 
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }

  res.json(mapProduct(product));
});

// DELETE: Remover Produto
router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = ProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db.delete(productsTable).where(eq(params.data.id, productsTable.id)).returning();
  
  if (!product) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }

  res.json({ success: true });
});

export default router;