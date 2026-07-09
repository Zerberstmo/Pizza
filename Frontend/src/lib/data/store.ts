import type { AppConfig, IngredientItem, NewOrder, OrderData, PizzaTemplate, VoucherDef } from "@/types";
import { INGREDIENTS_DEFAULT, TEMPLATES, VOUCHERS_INIT, DEFAULT_CONFIG, ADMIN_PASSWORD, WEEK_DATA, PIE_DATA } from "./seed";
import { computeSubtotal, computeDiscount, computeTotal, validateVoucher } from "@/lib/pricing";

// Async Datenschicht — die Naht, die in Teil-B gegen Supabase getauscht wird.
// Heute: localStorage + künstliches Delay, damit die UI schon jetzt gegen
// Promises entwickelt wird (Lade-/Fehlerzustände).

const delay = <T>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), 120));

function read<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}
function write<T>(key: string, val: T): void {
  localStorage.setItem(key, JSON.stringify(val));
}

const genId = () => `#${Math.floor(10000 + Math.random() * 90000)}`;

export const getMenu = () => delay(TEMPLATES.slice(0, 4) as PizzaTemplate[]);
export const getIngredients = () => delay(read<IngredientItem[]>("pizza-ingredients", INGREDIENTS_DEFAULT));
export const getVouchers = () => delay(read<VoucherDef[]>("pizza-vouchers", VOUCHERS_INIT));
export const getConfig = () => delay(read<AppConfig>("pizza-config", DEFAULT_CONFIG));
export const getDashboardStats = () => delay({ week: WEEK_DATA, toppings: PIE_DATA });

export const saveIngredients = (list: IngredientItem[]) => delay(write("pizza-ingredients", list));
export const saveVouchers = (list: VoucherDef[]) => delay(write("pizza-vouchers", list));
export const saveConfig = (config: AppConfig) => delay(write("pizza-config", config));

export async function createOrder(input: NewOrder): Promise<OrderData> {
  const vouchers = read<VoucherDef[]>("pizza-vouchers", VOUCHERS_INIT);
  const applied = input.voucherCode
    ? (() => {
        const r = validateVoucher(input.voucherCode!, vouchers, new Date());
        return r.ok ? r.voucher : null;
      })()
    : null;
  const subtotal = computeSubtotal(input.items.length);
  const discount = computeDiscount(subtotal, applied);
  const order: OrderData = {
    id: genId(),
    items: input.items,
    subtotal,
    discount,
    total: computeTotal(subtotal, discount),
    freeIngredient: applied?.type === "ingredient" ? applied.ingredientName : undefined,
    customer: input.customer,
    notes: input.notes,
    pickupDate: input.pickupDate,
    pickupTime: input.pickupTime,
    voucherCode: applied?.code,
  };
  const orders = read<OrderData[]>("pizza-orders", []);
  write("pizza-orders", [order, ...orders]); // TEIL-B: → Supabase insert + Realtime + WhatsApp
  return delay(order);
}

export const verifyAdminPassword = (pw: string) => delay(pw === ADMIN_PASSWORD);
