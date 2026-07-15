import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Tabela de Produtos
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  price: real('price').notNull(),
  currentStock: integer('current_stock').default(0),
  minStock: integer('min_stock').default(5), 
  category: text('category'), 
});

// Tabela de Movimentações 
export const inventoryMovements = sqliteTable('inventory_movements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').references(() => products.id),
  quantity: integer('quantity').notNull(), 
  type: text('type').notNull(), 
  createdAt: text('created_at').notNull(), 
});


export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
});