import type { AppConfig, IngredientItem, NewOrder, NotifyConfig, OrderData, OrderRow, OrderStatus, PizzaTemplate, VoucherDef, Sauce, User, PublicOrderStatus } from "@/types";
import { TEMPLATES } from "./seed";
import { computeSubtotal, computeDiscount, computeTotal, validateVoucher } from "@/lib/pricing";
import { computeDashboard, type DashboardStats } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";
import { rowToPublicStatus } from "@/lib/public-order";
// Hinweis: INGREDIENTS_DEFAULT/SAUCES_DEFAULT/VOUCHERS_INIT/DEFAULT_CONFIG werden NICHT mehr importiert
// (Daten kommen jetzt aus Supabase). noUnusedLocals=true → ungenutzte Imports brächen den Build.


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

// Dashboard-Kennzahlen aus echten Bestellungen (Admin-RLS) aggregieren.
export async function getDashboardStats(): Promise<DashboardStats> {
  const [orders, ingredients] = await Promise.all([getOrders(), getIngredients()]);
  const names = Object.fromEntries(ingredients.map((i) => [i.id, i.name]));
  return computeDashboard(orders, names);
}

// ── Bestellung → Supabase insert (Preislogik client-seitig; Härtung = B4) ──
export async function createOrder(input: NewOrder): Promise<OrderData> {
  const vouchers = await getVouchers();
  const applied = input.voucherCode
    ? (() => { const r = validateVoucher(input.voucherCode!, vouchers, new Date()); return r.ok ? r.voucher : null; })()
    : null;
  const subtotal = computeSubtotal(input.items.length);
  const discount = computeDiscount(subtotal, applied);
  const { data: sess } = await supabase.auth.getUser();
  const publicToken = crypto.randomUUID();
  const order: OrderData = {
    id: genId(), publicToken, items: input.items, subtotal, discount, total: computeTotal(subtotal, discount),
    freeIngredient: applied?.type === "ingredient" ? applied.ingredientName : undefined,
    customer: input.customer, notes: input.notes, pickupDate: input.pickupDate, pickupTime: input.pickupTime,
    serviceMode: input.serviceMode ?? "takeaway", voucherCode: applied?.code,
  };
  const { error } = await supabase.from("orders").insert({
    id: order.id, public_token: order.publicToken, user_id: sess.user?.id ?? null, items: order.items,
    subtotal: order.subtotal, discount: order.discount, total: order.total,
    free_ingredient: order.freeIngredient ?? null, service_mode: order.serviceMode,
    pickup_date: order.pickupDate, pickup_time: order.pickupTime, notes: order.notes,
    voucher_code: order.voucherCode ?? null, status: "eingegangen",
    customer_name: `${input.customer.firstName} ${input.customer.lastName}`.trim(),
    customer_phone: input.customer.phone,
  });
  if (error) throw error;
  return order;
}

// Öffentlicher Bestell-Status über den nicht-ratbaren Token (RPC umgeht RLS feld-begrenzt).
export async function getOrderStatus(token: string): Promise<PublicOrderStatus | null> {
  const { data, error } = await supabase.rpc("get_order_status", { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? rowToPublicStatus(row) : null;
}

// ── Nutzer/Profile → Supabase (`profiles`-Tabelle + Edge Function `admin-users`) ──
export async function getProfiles(): Promise<User[]> {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, email: r.email ?? "", firstName: r.first_name, lastName: r.last_name, phone: r.phone, role: r.role, active: r.active }));
}
export async function setProfileActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
  if (error) throw error;
}
async function invokeAdmin(body: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) return error.message;
  if (data && (data as { error?: string }).error) return (data as { error: string }).error;
  return null;
}
export const adminCreateUser = (input: { email: string; password: string; firstName: string; lastName: string; phone: string; role: User["role"] }) =>
  invokeAdmin({ action: "create", ...input });
export const adminDeleteUser = (id: string) => invokeAdmin({ action: "delete", userId: id }).then((e) => { if (e) throw new Error(e); });
export const adminResetPassword = (id: string, password: string) => invokeAdmin({ action: "reset", userId: id, password }).then((e) => { if (e) throw new Error(e); });

// ── Bestellungen (B2) ──
function rowToOrder(r: any): OrderRow {
  return {
    id: r.id, publicToken: r.public_token, items: r.items, total: Number(r.total), serviceMode: r.service_mode,
    pickupDate: r.pickup_date, pickupTime: r.pickup_time, notes: r.notes ?? "",
    status: r.status, createdAt: r.created_at, userId: r.user_id ?? null,
  };
}

export async function getOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToOrder);
}

export async function getMyOrders(): Promise<OrderRow[]> {
  const { data: sess } = await supabase.auth.getUser();
  const uid = sess.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase.from("orders").select("*").eq("user_id", uid).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToOrder);
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw error;
}

// ── Benachrichtigungs-Config (B3, nur Admins per RLS) ──
export async function getNotifyConfig(): Promise<NotifyConfig> {
  const { data, error } = await supabase.from("notify_config").select("*").eq("id", 1).single();
  if (error) throw error;
  return { recipientPhone: data.recipient_phone, callmebotApikey: data.callmebot_apikey, enabled: data.enabled };
}
export async function saveNotifyConfig(cfg: NotifyConfig): Promise<void> {
  const { error } = await supabase.from("notify_config").upsert({
    id: 1, recipient_phone: cfg.recipientPhone, callmebot_apikey: cfg.callmebotApikey, enabled: cfg.enabled,
  });
  if (error) throw error;
}
