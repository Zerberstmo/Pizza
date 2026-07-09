export interface IngredientItem {
  id: string;
  name: string;
  emoji: string;
  category: string;
  available: boolean;
  description: string;
}

export interface PizzaTemplate {
  id: string;
  name: string;
  sub: string;
  desc: string;
  color: string;
  ingredientIds: string[];
}

export interface VoucherDef {
  id: string;
  name: string;
  code: string;
  type: "percent" | "fixed" | "ingredient";
  value: number;
  ingredientName?: string;
  expiresAt: string;
  active: boolean;
  maxUses: number;
  uses: number;
}

export interface Customer {
  firstName: string;
  lastName: string;
  phone: string;
}

export interface CartItem {
  cartId: string;
  pizzaName: string;
  ingredientIds: string[];
}

export interface Hours {
  from: string;
  to: string;
}

export interface AppConfig {
  days: Record<string, boolean>;
  hours: Hours;
  leadTimeDays: number;
}

export interface NewOrder {
  items: CartItem[];
  customer: Customer;
  notes: string;
  pickupDate: string;
  pickupTime: string;
  voucherCode?: string;
}

export interface OrderData {
  id: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  discount: number;
  freeIngredient?: string;
  customer: Customer;
  pickupDate: string;
  pickupTime: string;
  notes: string;
  voucherCode?: string;
}
