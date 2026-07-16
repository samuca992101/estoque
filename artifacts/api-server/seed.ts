import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { faker } from '@faker-js/faker';
// Importando as tabelas oficiais do seu schema:
import { products, inventoryMovements } from './src/db/schema'; 

const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite);

async function seed() {
  console.log('Limpar banco de dados...');
  await db.delete(inventoryMovements);
  await db.delete(products);

  console.log('Gerando produtos fakes expandidos...');
  
  // Lista robusta de produtos com comportamentos variados de estoque
  const productsToInsert = [
    // --- MERCEARIA & ALIMENTOS ---
    { name: 'Arroz Integral 5kg', description: 'Arroz tipo 1', price: 22.90, minStock: 10, currentStock: 5, category: 'Mercearia' },
    { name: 'Feijão Preto 1kg', description: 'Feijão para feijoada', price: 8.50, minStock: 15, currentStock: 20, category: 'Mercearia' },
    { name: 'Macarrão Espaguete 500g', description: 'Massa de sêmola', price: 4.50, minStock: 20, currentStock: 18, category: 'Mercearia' },
    
    // --- PADARIA & DOCES ---
    { name: 'Chocolate Amargo 100g', description: 'Cacau 70%', price: 7.99, minStock: 5, currentStock: 2, category: 'Doces' },
    { name: 'Pão de Forma Tradicional', description: 'Pão fatiado 450g', price: 6.90, minStock: 12, currentStock: 15, category: 'Padaria' },
    
    // --- BEBIDAS ---
    { name: 'Leite Integral 1L', description: 'Leite UHT', price: 4.89, minStock: 24, currentStock: 12, category: 'Bebidas' },
    { name: 'Suco de Uva Integral 1L', description: 'Sem adição de açúcar', price: 12.90, minStock: 8, currentStock: 3, category: 'Bebidas' },
    
    // --- HORTIFRÚTI (Perecíveis de Alto Giro) ---
    { name: 'Banana Prata kg', description: 'Banana fresca selecionada', price: 5.99, minStock: 30, currentStock: 8, category: 'Hortifrúti' },
    { name: 'Tomate Italiano kg', description: 'Tomate para molho/salada', price: 8.90, minStock: 25, currentStock: 28, category: 'Hortifrúti' },
    
    // --- AÇOUGUE & FRIOS ---
    { name: 'Peito de Frango Resfriado kg', description: 'Filé de peito congelado', price: 18.90, minStock: 15, currentStock: 6, category: 'Açougue' },
    
    // --- HIGIENE & LIMPEZA ---
    { name: 'Detergente Neutro 500ml', description: 'Detergente líquido para louças', price: 2.20, minStock: 15, currentStock: 30, category: 'Limpeza' },
    { name: 'Sabonete Barra 90g', description: 'Sabonete suave hidratação', price: 1.99, minStock: 10, currentStock: 12, category: 'Higiene' }
  ];

  for (const p of productsToInsert) {
    const [inserted] = await db.insert(products).values(p).returning();
    
    console.log(`Gerando vendas para: ${inserted.name}`);
    
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Quantidade padrão vendida por dia (de 1 a 5 unidades)
      let quantity = faker.number.int({ min: 1, max: 5 });
      
      // CONFIGURANDO AS TENDÊNCIAS DA IA:
      
      // 📈 TENDÊNCIA DE ALTA (Mais vendas na última semana)
      if (
        (inserted.name.includes('Arroz') || 
         inserted.name.includes('Banana') || 
         inserted.name.includes('Frango')) && 
        i < 7
      ) {
        quantity += faker.number.int({ min: 8, max: 15 }); // Explosão de vendas recente
      }
      
      // 📉 TENDÊNCIA DE BAIXA (Zero vendas na última semana)
      if (
        (inserted.name.includes('Feijão') || 
         inserted.name.includes('Detergente')) && 
        i < 7
      ) {
        quantity = 0; 
      }

      await db.insert(inventoryMovements).values({
        productId: inserted.id,
        quantity: -quantity, 
        type: 'OUT',
        createdAt: date.toISOString()
      });
    }
  }

  console.log('✅ Seed finalizado com sucesso! Seu mercado virtual está pronto.');
}

seed().catch((err) => {
  console.error('Erro durante o seeding:', err);
});