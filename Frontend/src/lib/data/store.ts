import type { AppConfig, IngredientItem, NewOrder, OrderData, PizzaTemplate, VoucherDef, Sauce, User } from "@/types";
import { TEMPLATES, USERS_DEFAULT, WEEK_DATA, PIE_DATA } from "./seed";
import { computeSubtotal, computeDiscount, computeTotal, validateVoucher } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
// Hinweis: INGREDIENTS_DEFAULT/SAUCES_DEFAULT/VOUCHERS_INIT/DEFAULT_CONFIG werden NICHT mehr importiert
// (Daten kommen jetzt aus Supabase). noUnusedLocals=true → ungenutzte Imports brächen den Build.

// ── localStorage-Mock nur noch für die (in Task 6 ersetzte) Auth ──
const delay = <T>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), 120));
function read<T>(key: string, fallback: T): T { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; }
function write<T>(key: string, val: T): void { localStorage.setItem(key, JSON.stringify(val)); }

const genId = () => `#${Math.floor(10000 + Math.random() * 90000)}`;

// ── Menü/Zutaten/Soßen/Gutscheine/Config → Supabase ──
export async function getMenu(): Promise<PizzaTemplate[]> {
  // Menü-Templates bleiben statisch (nicht admin-verwaltet in Teil-A). TEIL-B-später: eigene Tabelle.
  return TEMPLATES.slice(0, 4);
}

export async function getIngredients(): Promise<IngredientItem[]> {
  const { data, error } = await supabase.from("ingredients").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, category: r.category, available: r.available, description: r.description }));
}
export async function saveIngredients(list: IngredientItem[]): Promise<void> {
  const rows = list.map((i) => ({ id: i.id, name: i.name, emoji: i.emoji, category: i.category, available: i.available, description: i.description }));
  const { error } = await supabase.from("ingredients").upsert(rows);
  if (error) throw error;
}

export async function getSauces(): Promise<Sauce[]> {
  const { data, error } = await supabase.from("sauces").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, color: r.color, available: r.available }));
}
export async function saveSauces(list: Sauce[]): Promise<void> {
  const { error } = await supabase.from("sauces").upsert(list.map((s) => ({ id: s.id, name: s.name, emoji: s.emoji, color: s.color, available: s.available })));
  if (error) throw error;
}

export async function getVouchers(): Promise<VoucherDef[]> {
  const { data, error } = await supabase.from("vouchers").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, code: r.code, type: r.type, value: Number(r.value), ingredientName: r.ingredient_name ?? undefined, expiresAt: r.expires_at, active: r.active, maxUses: r.max_uses, uses: r.uses }));
}
export async function saveVouchers(list: VoucherDef[]): Promise<void> {
  const rows = list.map((v) => ({ id: v.id, name: v.name, code: v.code, type: v.type, value: v.value, ingredient_name: v.ingredientName ?? null, expires_at: v.expiresAt, active: v.active, max_uses: v.maxUses, uses: v.uses }));
  const { error } = await supabase.from("vouchers").upsert(rows);
  if (error) throw error;
}

export async function getConfig(): Promise<AppConfig> {
  const { data, error } = await supabase.from("app_config").select("*").eq("id", 1).single();
  if (error) throw error;
  return { days: data.days, hours: data.hours, leadTimeDays: data.lead_time_days, service: data.service };
}
export async function saveConfig(config: AppConfig): Promise<void> {
  const { error } = await supabase.from("app_config").upsert({ id: 1, days: config.days, hours: config.hours, lead_time_days: config.leadTimeDays, service: config.service });
  if (error) throw error;
}

export const getDashboardStats = () => delay({ week: WEEK_DATA, toppings: PIE_DATA }); // TEIL-B-später: echte Aggregation

// ── Bestellung → Supabase insert (Preislogik client-seitig; Härtung = B4) ──
export async function createOrder(input: NewOrder): Promise<OrderData> {
  const vouchers = await getVouchers();
  const applied = input.voucherCode
    ? (() => { const r = validateVoucher(input.voucherCode!, vouchers, new Date()); return r.ok ? r.voucher : null; })()
    : null;
  const subtotal = computeSubtotal(input.items.length);
  const discount = computeDiscount(subtotal, applied);
  const { data: sess } = await supabase.auth.getUser();
  const order: OrderData = {
    id: genId(), items: input.items, subtotal, discount, total: computeTotal(subtotal, discount),
    freeIngredient: applied?.type === "ingredient" ? applied.ingredientName : undefined,
    customer: input.customer, notes: input.notes, pickupDate: input.pickupDate, pickupTime: input.pickupTime,
    serviceMode: input.serviceMode ?? "takeaway", voucherCode: applied?.code,
  };
  const { error } = await supabase.from("orders").insert({
    id: order.id, user_id: sess.user?.id ?? null, items: order.items,
    subtotal: order.subtotal, discount: order.discount, total: order.total,
    free_ingredient: order.freeIngredient ?? null, service_mode: order.serviceMode,
    pickup_date: order.pickupDate, pickup_time: order.pickupTime, notes: order.notes,
    voucher_code: order.voucherCode ?? null, status: "eingegangen",
  });
  if (error) throw error;
  return order;
}

// ── (TASK 6 ersetzt diese Mock-Auth) ──
export const getUsers = () => delay(read<User[]>("pizza-users", USERS_DEFAULT));
export const saveUsers = (list: User[]) => delay(write("pizza-users", list));
export async function verifyLogin(username: string, password: string): Promise<User | null> {
  const users = read<User[]>("pizza-users", USERS_DEFAULT);
  return delay(users.find((x) => x.username === username && x.password === password && x.active) ?? null);
}
