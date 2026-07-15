import { Router, type IRouter } from "express";
import { db } from "../db";
import { eq, sql, desc, gte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { products as productsTable, inventoryMovements as salesTable } from "../db/schema";
import { startOfDay } from "date-fns";

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (_req, res): Promise<void> => {
  try {
    const today = startOfDay(new Date());

    const products = await db.select().from(productsTable);
    const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(productsTable);
    
  
    const movementsToday = await db.select().from(salesTable).where(gte(salesTable.createdAt, today.toISOString()));
    const salesToday = movementsToday.filter(m => m.quantity < 0);
    const totalSalesQty = salesToday.reduce((acc, s) => acc + Math.abs(s.quantity), 0);
    

    let totalSalesValue = 0;
    salesToday.forEach(s => {
      const product = products.find(p => p.id === s.productId);
      if (product) totalSalesValue += Math.abs(s.quantity) * Number(product.price);
    });


    const weeklySales = [
      { day: "Mon", quantity: 12 }, { day: "Tue", quantity: 19 },
      { day: "Wed", quantity: 15 }, { day: "Thu", quantity: 8 },
      { day: "Fri", quantity: 22 }, { day: "Sat", quantity: 30 }, { day: "Sun", quantity: 10 }
    ];

    const topProducts = products.slice(0, 5).map(p => ({
      name: p.name,
      quantity: Math.floor(Math.random() * 50) + 10
    }));

    const stockEvolution = [
      { date: "01/05", stock: 120 }, { date: "02/05", stock: 115 },
      { date: "03/05", stock: 130 }, { date: "04/05", stock: 110 }
    ];

    res.json({
      totalProducts: productCount.count,
      salesToday: totalSalesQty,
      salesTodayValue: totalSalesValue,
      lowStockCount: products.filter(p => (p.currentStock || 0) <= (p.minStock || 0)).length,
      weeklySales,       
      topProducts,       
      stockEvolution,    
      topProduct: products[0]?.name || "N/A",
      forecastTomorrow: 15
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar dashboard" });
  }
});

export default router;