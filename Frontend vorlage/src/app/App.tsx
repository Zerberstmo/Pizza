import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Home, Settings, BarChart2, Calendar,
  Clock, Package, Tag, LogOut, Eye, EyeOff,
  Check, X, AlertCircle, ArrowLeft,
  User, Phone, Ticket, Plus, ChevronRight,
  FileText, ChefHat, ShoppingCart,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type UserPage = "home" | "configurator" | "checkout" | "confirmation";
type AdminPage = "admin-dashboard" | "admin-days" | "admin-hours" | "admin-ingredients" | "admin-vouchers";
type View = UserPage | "admin-login" | AdminPage;

interface IngredientItem {
  id: string;
  name: string;
  emoji: string;
  category: string;
  available: boolean;
  description: string;
}

interface VoucherDef {
  id: string;
  name: string;
  code: string;
  type: "percent" | "fixed" | "ingredient";
  value: number;
  ingredientName?: string; // used when type === "ingredient"
  expiresAt: string;
  active: boolean;
  maxUses: number;
  uses: number;
}

interface Customer {
  firstName: string;
  lastName: string;
  phone: string;
}

interface CartItem {
  cartId: string;       // unique per cart entry
  pizzaName: string;
  ingredientIds: string[];
}

interface OrderData {
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

interface PizzaTemplate {
  id: string;
  name: string;
  sub: string;
  desc: string;
  color: string;
  ingredientIds: string[];
}

interface VoucherState {
  code: string;
  applied: VoucherDef | null;
  message: { text: string; ok: boolean } | null;
}

interface Hours { from: string; to: string; }

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const BASE_PRICE = 10.00;
const ADMIN_PASSWORD = "pizza";

const INGREDIENTS_DEFAULT: IngredientItem[] = [
  // Käse
  { id: "mozzarella",  name: "Mozzarella",    emoji: "🧀", category: "Käse",    available: true,  description: "Frischer ital. Mozzarella"      },
  { id: "extra-kaese", name: "Extra Käse",    emoji: "🫕", category: "Käse",    available: true,  description: "Doppelt so viel Käse"            },
  { id: "gorgonzola",  name: "Gorgonzola",    emoji: "🧀", category: "Käse",    available: true,  description: "Würziger Blauschimmelkäse"       },
  // Fleisch
  { id: "salami",      name: "Salami",        emoji: "🍖", category: "Fleisch", available: true,  description: "Würzige Salamischeiben"           },
  { id: "schinken",    name: "Schinken",      emoji: "🥩", category: "Fleisch", available: true,  description: "Zarter Kochschinken"             },
  { id: "haehnchen",   name: "Hähnchen",      emoji: "🍗", category: "Fleisch", available: true,  description: "Gegrilltes Hähnchen"             },
  { id: "hackfleisch", name: "Hackfleisch",   emoji: "🫙", category: "Fleisch", available: true,  description: "Gewürztes Rinderhackfleisch"     },
  // Fisch
  { id: "thunfisch",   name: "Thunfisch",     emoji: "🐟", category: "Fisch",   available: true,  description: "Milder Thunfisch"                },
  { id: "garnelen",    name: "Garnelen",      emoji: "🍤", category: "Fisch",   available: true,  description: "Gegrillte Garnelen"              },
  // Gemüse & Sonstiges
  { id: "ananas",      name: "Ananas",        emoji: "🍍", category: "Gemüse",  available: true,  description: "Frische Ananasstreifen"          },
  { id: "paprika",     name: "Paprika",       emoji: "🫑", category: "Gemüse",  available: true,  description: "Bunte Paprikastreifen"           },
  { id: "mais",        name: "Mais",          emoji: "🌽", category: "Gemüse",  available: true,  description: "Süßer Zuckermais"                },
  { id: "jalapenos",   name: "Jalapeños",     emoji: "🌶️", category: "Gemüse",  available: true,  description: "Feurige Jalapeños"              },
  { id: "pilze",       name: "Pilze",         emoji: "🍄", category: "Gemüse",  available: true,  description: "Frische Champignons"             },
  { id: "zwiebeln",    name: "Zwiebeln",      emoji: "🧅", category: "Gemüse",  available: true,  description: "Rote Zwiebeln"                   },
  { id: "oliven",      name: "Oliven",        emoji: "🫒", category: "Gemüse",  available: true,  description: "Schwarze Oliven"                 },
  { id: "rucola",      name: "Rucola",        emoji: "🥬", category: "Gemüse",  available: true,  description: "Frischer Rucola"                 },
  { id: "spinat",      name: "Spinat",        emoji: "🌿", category: "Gemüse",  available: true,  description: "Junger Blattspinat"              },
  { id: "kirschtomaten", name: "Kirschtomaten", emoji: "🍅", category: "Gemüse", available: true, description: "Halbierte Kirschtomaten"         },
  { id: "artischocken", name: "Artischocken", emoji: "🌱", category: "Gemüse",  available: false, description: "Zarte Artischockenherzen"        },
  { id: "knoblauch",   name: "Knoblauch",     emoji: "🧄", category: "Gemüse",  available: true,  description: "Frischer Knoblauch"              },
  { id: "basilikum",   name: "Basilikum",     emoji: "🌿", category: "Gemüse",  available: true,  description: "Frisches Basilikum"              },
  { id: "peperoncini", name: "Peperoncini",   emoji: "🫑", category: "Gemüse",  available: true,  description: "Milde eingelegte Peperoncini"    },
];

const CATEGORIES = ["Käse", "Fleisch", "Fisch", "Gemüse"] as const;

const TEMPLATES: PizzaTemplate[] = [
  { id: "margherita", name: "Margherita",        sub: "La Classica",   color: "#F97316",
    desc: "Tomatensauce, Mozzarella & frischer Rucola.",
    ingredientIds: ["mozzarella", "rucola", "basilikum"] },
  { id: "salami",     name: "Salami",             sub: "La Piccante",   color: "#EF4444",
    desc: "Würzige Salamischeiben auf cremigem Mozzarella.",
    ingredientIds: ["salami", "mozzarella"] },
  { id: "hawaii",     name: "Hawaii",             sub: "La Dolce",      color: "#EAB308",
    desc: "Schinken & süße Ananas — ein Klassiker.",
    ingredientIds: ["schinken", "ananas", "mozzarella"] },
  { id: "speciale",   name: "Speciale",           sub: "La Nostra",     color: "#A855F7",
    desc: "Salami, Schinken, Paprika, Pilze & Mozzarella.",
    ingredientIds: ["salami", "schinken", "paprika", "pilze", "mozzarella"] },
  { id: "diavolo",    name: "Diavolo",            sub: "La Infernale",  color: "#DC2626",
    desc: "Salami, Jalapeños & Mozzarella — für mutige Gaumen.",
    ingredientIds: ["salami", "jalapenos", "mozzarella"] },
  { id: "tonno",      name: "Tonno",              sub: "Del Mare",      color: "#3B82F6",
    desc: "Thunfisch, rote Zwiebeln & cremiger Mozzarella.",
    ingredientIds: ["thunfisch", "zwiebeln", "mozzarella"] },
  { id: "funghi",     name: "Funghi",             sub: "Del Bosco",     color: "#78716C",
    desc: "Frische Champignons & Mozzarella — schlicht und gut.",
    ingredientIds: ["pilze", "mozzarella"] },
  { id: "quattro",    name: "Quattro Stagioni",   sub: "Le Quattro",    color: "#22C55E",
    desc: "Schinken, Pilze, Oliven & Paprika.",
    ingredientIds: ["schinken", "pilze", "oliven", "paprika", "mozzarella"] },
  { id: "garnelen",   name: "Gamberi",            sub: "Del Pesce",     color: "#F97316",
    desc: "Gegrillte Garnelen, Knoblauch & Kirschtomaten.",
    ingredientIds: ["garnelen", "knoblauch", "kirschtomaten", "mozzarella"] },
  { id: "gorgonzola", name: "Gorgonzola",         sub: "Quattro Formaggi", color: "#F59E0B",
    desc: "Gorgonzola, Extra Käse & frischer Rucola.",
    ingredientIds: ["gorgonzola", "extra-kaese", "rucola"] },
];

const VOUCHERS_INIT: VoucherDef[] = [
  { id: "v1", name: "Willkommen",  code: "WELCOME10", type: "percent",    value: 10, expiresAt: "2026-12-31", active: true,  maxUses: 100, uses: 23 },
  { id: "v2", name: "Sommer",      code: "SOMMER15",  type: "percent",    value: 15, expiresAt: "2026-08-31", active: true,  maxUses: 50,  uses: 12 },
  { id: "v3", name: "Festrabatt",  code: "PIZZA5",    type: "fixed",      value: 5,  expiresAt: "2026-09-30", active: false, maxUses: 200, uses: 87 },
  { id: "v4", name: "Special",     code: "WEED420",   type: "ingredient", value: 0,  ingredientName: "Weed 🌿", expiresAt: "2026-12-31", active: true, maxUses: 50, uses: 4 },
];

const DAYS_OF_WEEK = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"] as const;
const JS_DAY_MAP: Record<number, string> = { 0: "Sonntag", 1: "Montag", 2: "Dienstag", 3: "Mittwoch", 4: "Donnerstag", 5: "Freitag", 6: "Samstag" };

const WEEK_DATA = [
  { day: "Mo", n: 12 }, { day: "Di", n: 8 },  { day: "Mi", n: 15 },
  { day: "Do", n: 10 }, { day: "Fr", n: 24 }, { day: "Sa", n: 31 }, { day: "So", n: 19 },
];
const PIE_DATA   = [{ name: "Salami", v: 42 }, { name: "Mozzarella", v: 38 }, { name: "Schinken", v: 31 }, { name: "Paprika", v: 24 }, { name: "Pilze", v: 19 }];
const PIE_COLORS = ["#F97316", "#EAB308", "#22C55E", "#3B82F6", "#A855F7"];

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────

const fmt = (n: number): string => `${n.toFixed(2).replace(".", ",")} €`;
const genId = (): string => `#${Math.floor(10000 + Math.random() * 90000)}`;
const uid = (): string => Math.random().toString(36).slice(2, 9);

function ingById(list: IngredientItem[], id: string): IngredientItem | undefined {
  return list.find((i) => i.id === id);
}

function getRecs(selected: string[]): Array<{ text: string; addId: string }> {
  const recs: Array<{ text: string; addId: string }> = [];
  if (selected.length > 0 && !selected.includes("mozzarella"))
    recs.push({ text: "Fast alle wählen dazu Mozzarella.", addId: "mozzarella" });
  if (selected.includes("schinken") && !selected.includes("rucola"))
    recs.push({ text: "Rucola passt perfekt zu Schinken.", addId: "rucola" });
  if (selected.includes("salami") && !selected.includes("jalapenos"))
    recs.push({ text: "Jalapeños machen Salami zum Erlebnis.", addId: "jalapenos" });
  if (selected.includes("thunfisch") && !selected.includes("zwiebeln"))
    recs.push({ text: "Zwiebeln runden Thunfisch klassisch ab.", addId: "zwiebeln" });
  return recs.slice(0, 2);
}

function getAvailableDates(enabledDays: Record<string, boolean>): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 60 && dates.length < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayName = JS_DAY_MAP[d.getDay()];
    if (enabledDays[dayName]) {
      dates.push(d.toISOString().split("T")[0]);
    }
  }
  return dates;
}

function getAvailableTimes(from: string, to: string): string[] {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const start = fh * 60 + fm;
  const end   = th * 60 + tm;
  const slots: string[] = [];
  for (let m = start; m <= end; m += 15) {
    const h   = Math.floor(m / 60).toString().padStart(2, "0");
    const min = (m % 60).toString().padStart(2, "0");
    slots.push(`${h}:${min}`);
  }
  return slots;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${days[d.getDay()]}, ${dd}.${mm}.${d.getFullYear()}`;
}

// ─────────────────────────────────────────────────────────────
// PIZZA SVG
// ─────────────────────────────────────────────────────────────

const TOPPING_POSITIONS: [number, number][] = (() => {
  const cx = 100, cy = 100;
  const pts: [number, number][] = [];
  for (const { r, n, off } of [
    { r: 24, n: 5,  off: 0 },
    { r: 46, n: 8,  off: Math.PI / 8 },
    { r: 63, n: 11, off: 0 },
  ]) {
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * 2 * Math.PI - Math.PI / 2;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
})();

function getToppingPositions(idx: number, total: number): [number, number][] {
  return TOPPING_POSITIONS.filter((_, i) => i % total === idx).slice(0, 5);
}

interface TP { x: number; y: number; rot?: number; }

const TOPPING_COLORS: Record<string, string> = {
  mozzarella: "#F5F0DC", "extra-kaese": "#F5D76E", salami: "#8B2525",
  schinken: "#D4857A", haehnchen: "#E8D4A0", hackfleisch: "#8B4513",
  thunfisch: "#8FAFB8", garnelen: "#FFAA80",
  ananas: "#FCD34D", paprika: "#E84B3A", mais: "#F1C40F",
  jalapenos: "#2ECC71", pilze: "#9B7B5A", zwiebeln: "#C084FC",
  oliven: "#1A1A2E", rucola: "#22C55E", spinat: "#166534",
  kirschtomaten: "#DC2626", artischocken: "#4B7A5A", knoblauch: "#F5E6C8",
  basilikum: "#16A34A", peperoncini: "#84CC16", gorgonzola: "#92A0B8",
};

function ToppingDot({ x, y, color, r = 7 }: TP & { color: string; r?: number }): React.ReactElement {
  return <circle cx={x} cy={y} r={r} fill={color} opacity="0.9" />;
}
function SalamiT({ x, y }: TP): React.ReactElement {
  return (
    <g>
      <circle cx={x} cy={y} r={11} fill="#6B1A1A" opacity="0.92" />
      <circle cx={x} cy={y} r={7}  fill="#8B2525" opacity="0.9" />
      <circle cx={x} cy={y} r={2}  fill="#501010" opacity="0.7" />
    </g>
  );
}
function MozzarellaT({ x, y }: TP): React.ReactElement {
  return <ellipse cx={x} cy={y} rx={10} ry={8} fill="#F5F0DC" opacity="0.95" />;
}
function SchinkenT({ x, y, rot = 0 }: TP): React.ReactElement {
  return <ellipse cx={x} cy={y} rx={12} ry={7} fill="#D4857A" opacity="0.88" transform={`rotate(${rot} ${x} ${y})`} />;
}
function PaprikaT({ x, y, rot = 0 }: TP): React.ReactElement {
  const cs = ["#E84B3A", "#27AE60", "#F39C12"];
  return <rect x={x - 7} y={y - 2.5} width="14" height="5" rx="2.5" fill={cs[Math.abs(Math.round(rot)) % 3]} opacity="0.9" transform={`rotate(${rot} ${x} ${y})`} />;
}
function PilzeT({ x, y }: TP): React.ReactElement {
  return (
    <g>
      <path d={`M${x-7},${y} Q${x-7},${y-9} ${x},${y-9} Q${x+7},${y-9} ${x+7},${y} Z`} fill="#9B7B5A" opacity="0.9" />
      <rect x={x - 2.5} y={y} width="5" height="5" rx="1" fill="#B89070" opacity="0.9" />
    </g>
  );
}
function JalapenoT({ x, y, rot = 0 }: TP): React.ReactElement {
  return <ellipse cx={x} cy={y} rx={8} ry={4} fill="#2ECC71" opacity="0.9" transform={`rotate(${rot} ${x} ${y})`} />;
}
function ZwiebelnT({ x, y, rot = 0 }: TP): React.ReactElement {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={9} ry={4} fill="none" stroke="#C084FC" strokeWidth="2" opacity="0.85" transform={`rotate(${rot} ${x} ${y})`} />
      <ellipse cx={x} cy={y} rx={5} ry={2} fill="none" stroke="#C084FC" strokeWidth="1.5" opacity="0.85" transform={`rotate(${rot} ${x} ${y})`} />
    </g>
  );
}
function OlivenT({ x, y }: TP): React.ReactElement {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={6} ry={4.5} fill="#1A1A2E" opacity="0.9" />
      <ellipse cx={x} cy={y} rx={3} ry={2}   fill="#27273A" opacity="0.9" />
    </g>
  );
}
function RucolaT({ x, y }: TP): React.ReactElement {
  return (
    <g transform={`translate(${x - 7} ${y - 7})`} fill="#22C55E" opacity="0.9">
      <path d="M7,7 C5,2 1,3 2,7 C0,4 0,8 4,8 C1,9 2,13 5,10 C5,14 8,14 9,10 C12,13 12,9 10,8 C13,8 13,4 11,7 C12,3 8,2 7,7Z" />
    </g>
  );
}
function AnanaT({ x, y }: TP): React.ReactElement {
  return (
    <g>
      <rect x={x - 8} y={y - 4} width="16" height="8" rx="3" fill="#FCD34D" opacity="0.9" />
      <line x1={x - 5} y1={y} x2={x + 5} y2={y} stroke="#F59E0B" strokeWidth="1.5" opacity="0.6" />
    </g>
  );
}

const RENDERERS: Record<string, (p: TP) => React.ReactElement> = {
  "mozzarella":   (p) => <MozzarellaT {...p} />,
  "extra-kaese":  (p) => <MozzarellaT {...p} />,
  "salami":       (p) => <SalamiT     {...p} />,
  "schinken":     (p) => <SchinkenT   {...p} />,
  "haehnchen":    (p) => <SchinkenT   {...p} />,
  "hackfleisch":  (p) => <ToppingDot  {...p} color="#8B4513" r={8} />,
  "thunfisch":    (p) => <SchinkenT   {...p} />,
  "garnelen":     (p) => <ToppingDot  {...p} color="#FFAA80" r={7} />,
  "ananas":       (p) => <AnanaT      {...p} />,
  "paprika":      (p) => <PaprikaT    {...p} />,
  "mais":         (p) => <ToppingDot  {...p} color="#F1C40F" r={4} />,
  "jalapenos":    (p) => <JalapenoT   {...p} />,
  "pilze":        (p) => <PilzeT      {...p} />,
  "zwiebeln":     (p) => <ZwiebelnT   {...p} />,
  "oliven":       (p) => <OlivenT     {...p} />,
  "rucola":       (p) => <RucolaT     {...p} />,
  "spinat":       (p) => <ToppingDot  {...p} color="#166534" r={6} />,
  "kirschtomaten":(p) => <ToppingDot  {...p} color="#DC2626" r={5} />,
  "artischocken": (p) => <ToppingDot  {...p} color="#4B7A5A" r={6} />,
  "knoblauch":    (p) => <ToppingDot  {...p} color="#F5E6C8" r={4} />,
  "basilikum":    (p) => <RucolaT     {...p} />,
  "peperoncini":  (p) => <JalapenoT   {...p} />,
  "gorgonzola":   (p) => <MozzarellaT {...p} />,
};

function PizzaSVG({ selected }: { selected: string[] }): React.ReactElement {
  const total = selected.length;
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="96" fill="#C4956A" />
      <circle cx="100" cy="100" r="88" fill="#B03818" />
      <circle cx="100" cy="100" r="84" fill="#9B2A14" />
      <circle cx="100" cy="100" r="82" fill="#E8C070" opacity="0.38" />
      {total === 0 && (
        <text x="100" y="107" textAnchor="middle" fill="#C4956A" fontSize="9"
          fontFamily="DM Sans, sans-serif" opacity="0.5">Zutaten wählen</text>
      )}
      {selected.map((id, idx) => {
        const renderer = RENDERERS[id] ?? ((p: TP) => <ToppingDot {...p} color={TOPPING_COLORS[id] ?? "#888"} />);
        return getToppingPositions(idx, total).map(([x, y], i) => (
          <g key={`${id}-${i}`}>
            {renderer({ x, y, rot: (idx * 47 + i * 73) % 360 })}
          </g>
        ));
      })}
      <circle cx="100" cy="100" r="96" fill="none" stroke="#D4A574" strokeWidth="1.5" opacity="0.25" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// QR CODE
// ─────────────────────────────────────────────────────────────

function QRCode({ data }: { data: string }): React.ReactElement {
  const seed = data.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const N = 25;
  const cells = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => {
      const inCorner = (i < 8 && j < 8) || (i < 8 && j >= N - 8) || (i >= N - 8 && j < 8);
      if (inCorner) {
        const ci = i < 8 ? i : i - (N - 8);
        const cj = j < 8 ? j : j - (N - 8);
        return ci === 0 || ci === 6 || cj === 0 || cj === 6 || (ci >= 2 && ci <= 4 && cj >= 2 && cj <= 4);
      }
      return ((seed * 31 + i * 37 + j * 41) % 17) > 8;
    })
  );
  return (
    <svg viewBox={`0 0 ${N * 4} ${N * 4}`} className="w-full h-full rounded-lg">
      <rect width="100%" height="100%" fill="white" />
      {cells.flatMap((row, i) =>
        row.map((cell, j) =>
          cell ? <rect key={`q-${i}-${j}`} x={j * 4} y={i * 4} width="4" height="4" fill="#09090B" /> : null
        )
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED: SELECT INPUT
// ─────────────────────────────────────────────────────────────

function SelectInput({ value, onChange, options, placeholder, disabled = false }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "flex h-11 w-full rounded-xl border border-border bg-input-background px-4 py-2.5",
        "text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/50 transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        !value && "text-muted-foreground"
      )}
      style={{ colorScheme: "dark" }}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ background: "#18181B", color: "#FAFAF9" }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────
// BOTTOM NAV
// ─────────────────────────────────────────────────────────────

function BottomNav({ view, setView, cartCount }: {
  view: View;
  setView: (v: View) => void;
  cartCount: number;
}): React.ReactElement {
  const inConfigurator = ["configurator"].includes(view);
  const inCheckout     = ["checkout", "confirmation"].includes(view);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border max-w-lg mx-auto">
      <div className="flex">
        {/* Speisekarte */}
        <button onClick={() => setView("home")}
          className={cn("flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors",
            view === "home" ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
          <Home size={21} strokeWidth={view === "home" ? 2.5 : 2} />
          <span className="text-[10px] font-semibold">Speisekarte</span>
        </button>

        {/* Eigene Pizza */}
        <button onClick={() => setView("configurator")}
          className={cn("flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors",
            inConfigurator ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
          <ChefHat size={21} strokeWidth={inConfigurator ? 2.5 : 2} />
          <span className="text-[10px] font-semibold">Eigene Pizza</span>
        </button>

        {/* Warenkorb */}
        <button onClick={() => setView("checkout")}
          className={cn("flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors relative",
            inCheckout ? "text-primary" : cartCount > 0 ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
          <div className="relative">
            <ShoppingCart size={21} strokeWidth={inCheckout ? 2.5 : 2} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-primary text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold">Warenkorb</span>
        </button>

        {/* Admin */}
        <button onClick={() => setView("admin-login")}
          className="flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors text-muted-foreground hover:text-foreground">
          <Settings size={21} strokeWidth={2} />
          <span className="text-[10px] font-semibold">Admin</span>
        </button>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE: HOME  — complete redesign
// ─────────────────────────────────────────────────────────────

// Only the first 4 templates are shown to customers
const MENU = TEMPLATES.slice(0, 4);

// Unsplash images per pizza (deterministic, not random)
const PIZZA_IMAGES: Record<string, string> = {
  margherita: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=400&fit=crop&auto=format",
  salami:     "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&h=400&fit=crop&auto=format",
  hawaii:     "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop&auto=format",
  speciale:   "https://images.unsplash.com/photo-1571407970349-bc81e71e5c53?w=600&h=400&fit=crop&auto=format",
};

interface HomePageProps {
  onAddToCart: (template: PizzaTemplate) => void;
  cartCount: number;
  onGoToCart: () => void;
}

function HomePage({ onAddToCart, cartCount, onGoToCart }: HomePageProps): React.ReactElement {
  return (
    <div className="pb-24">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-5 pt-10 pb-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="text-[10px] font-black tracking-[0.3em] uppercase text-primary mb-3">
            Pizzeria · Nur Abholung
          </p>
          <h1 className="text-4xl font-black leading-none tracking-tight mb-1">
            Unsere<br />
            <span className="text-primary">Speisekarte.</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Jede Pizza <span className="text-primary font-bold">10 €</span> · Bezahlung bei Abholung
          </p>
        </motion.div>
      </div>

      <Separator />

      {/* ── 2 × 2 Pizza grid ───────────────────────────────── */}
      <div className="px-4 pt-5 grid grid-cols-2 gap-3">
        {MENU.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.3 }}
          >
            <button
              onClick={() => onAddToCart(t)}
              className="w-full text-left group focus:outline-none"
            >
              <div className="rounded-2xl overflow-hidden border border-border bg-card
                group-hover:border-primary/35 group-active:scale-[0.98]
                transition-all duration-200 shadow-sm">

                {/* Image */}
                <div className="relative h-36 bg-muted overflow-hidden">
                  <img
                    src={PIZZA_IMAGES[t.id] ?? PIZZA_IMAGES.margherita}
                    alt={t.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Color stripe */}
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: t.color }} />
                  {/* Price badge */}
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white
                    text-[10px] font-black px-2 py-0.5 rounded-full">
                    10 €
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="font-black text-sm leading-tight">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground/60 italic mt-0.5">{t.sub}</p>
                  <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                    {t.desc}
                  </p>

                  {/* Ingredient emojis */}
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {t.ingredientIds.map((id) => {
                      const ing = INGREDIENTS_DEFAULT.find((x) => x.id === id);
                      return ing ? (
                        <span key={id} className="text-sm">{ing.emoji}</span>
                      ) : null;
                    })}
                  </div>

                  {/* CTA */}
                  <div className="mt-3 w-full bg-primary/10 border border-primary/20 rounded-lg py-2
                    text-xs font-bold text-primary text-center
                    group-hover:bg-primary group-hover:text-white transition-all duration-200">
                    + In den Warenkorb
                  </div>
                </div>
              </div>
            </button>
          </motion.div>
        ))}
      </div>

      {/* Cart hint bar */}
      {cartCount > 0 && (
        <div className="px-4 mt-4">
          <button onClick={onGoToCart}
            className="w-full flex items-center justify-between bg-primary text-white rounded-2xl px-5 py-3.5 shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform">
            <span className="text-sm font-bold">{cartCount} Pizza{cartCount !== 1 ? "en" : ""} im Warenkorb</span>
            <span className="font-black text-base">{cartCount * BASE_PRICE},00 € →</span>
          </button>
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// PAGE: CONFIGURATOR  (eigene Pizza zusammenstellen)
// ─────────────────────────────────────────────────────────────

function ConfiguratorPage({ selected, toggle, ingredients, setView, onAddToCart }: {
  selected: string[];
  toggle: (id: string) => void;
  ingredients: IngredientItem[];
  setView: (v: View) => void;
  onAddToCart: () => void;
}): React.ReactElement {
  const recs = useMemo(() => getRecs(selected), [selected]);

  return (
    <div className="pb-44">
      <div className="sticky top-0 z-40 bg-background/92 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView("home")}>
            <ArrowLeft size={17} />
          </Button>
          <span className="font-bold text-sm">Eigene Pizza bauen</span>
        </div>
        <Badge variant="secondary" className="font-mono font-bold">10,00 €</Badge>
      </div>

      <div className="px-4 mt-5">
        {/* Live preview */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-36 h-36 shrink-0">
            <motion.div key={selected.join(",")}
              initial={{ scale: 0.93, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.18 }} className="w-full h-full">
              <PizzaSVG selected={selected} />
            </motion.div>
          </div>
          <div className="flex-1 pt-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Ausgewählt</p>
            {selected.length === 0 ? (
              <p className="text-xs text-muted-foreground/50">Noch keine Zutaten.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((id) => {
                  const ing = ingById(ingredients, id);
                  return ing ? (
                    <span key={id} className="inline-flex items-center gap-1 text-xs bg-primary/10 border border-primary/20 text-primary rounded-full px-2.5 py-0.5 font-medium">
                      {ing.emoji} {ing.name}
                      <button onClick={() => toggle(id)} className="ml-0.5 hover:opacity-60 transition-opacity"><X size={9} /></button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recommendations */}
        <AnimatePresence>
          {recs.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
              <div className="space-y-2">
                {recs.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 bg-amber-400/6 border border-amber-400/12 rounded-lg px-3 py-2.5">
                    <span className="text-amber-400 shrink-0 text-sm">✨</span>
                    <p className="text-xs flex-1 text-foreground/65">{r.text}</p>
                    {!selected.includes(r.addId) && (
                      <button onClick={() => toggle(r.addId)}
                        className="text-[10px] font-black text-amber-400 hover:text-amber-300 transition-colors shrink-0">
                        + Hinzu
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ingredient chips by category */}
        {CATEGORIES.map((cat) => {
          const items = ingredients.filter((i) => i.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">{cat}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((ing) => {
                  const active = selected.includes(ing.id);
                  return (
                    <button key={ing.id} disabled={!ing.available}
                      onClick={() => ing.available && toggle(ing.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                        !ing.available
                          ? "opacity-25 cursor-not-allowed border-border bg-card text-muted-foreground"
                          : active
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border bg-card hover:border-border/80 text-foreground"
                      )}>
                      <span className="text-base leading-none">{ing.emoji}</span>
                      {ing.name}
                      {active && <Check size={11} className="text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-[68px] left-0 right-0 z-40 px-4 pb-2 max-w-lg mx-auto">
        <Card className="shadow-2xl shadow-black/60">
          <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {selected.length > 0 ? `${selected.length} Zutat${selected.length !== 1 ? "en" : ""}` : "Keine Zutaten"}
              </p>
              <p className="font-black text-xl text-primary leading-tight">10,00 €</p>
            </div>
            <Button onClick={onAddToCart} disabled={selected.length === 0}
              className="gap-2 shadow-lg shadow-primary/20">
              + Warenkorb
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE: CHECKOUT
// ─────────────────────────────────────────────────────────────

function CheckoutPage({
  cart, removeFromCart, ingredients, subtotal, discount, total,
  customer, setCustomer, notes, setNotes,
  pickupDate, setPickupDate, pickupTime, setPickupTime,
  availableDates, availableTimes,
  voucher, setVoucherCode, applyVoucher, removeVoucher, placeOrder, setView,
}: {
  cart: CartItem[];
  removeFromCart: (cartId: string) => void;
  ingredients: IngredientItem[];
  subtotal: number;
  discount: number;
  total: number;
  customer: Customer;
  setCustomer: React.Dispatch<React.SetStateAction<Customer>>;
  notes: string;
  setNotes: (v: string) => void;
  pickupDate: string;
  setPickupDate: (d: string) => void;
  pickupTime: string;
  setPickupTime: (t: string) => void;
  availableDates: string[];
  availableTimes: string[];
  voucher: VoucherState;
  setVoucherCode: (c: string) => void;
  applyVoucher: () => void;
  removeVoucher: () => void;
  placeOrder: () => void;
  setView: (v: View) => void;
}): React.ReactElement {
  const canOrder = customer.firstName.trim() && customer.lastName.trim() &&
    customer.phone.trim() && pickupDate && pickupTime && cart.length > 0;

  const dateOptions = availableDates.map((d) => ({ value: d, label: formatDateLabel(d) }));
  const timeOptions = availableTimes.map((t) => ({ value: t, label: `${t} Uhr` }));
  const noDates     = availableDates.length === 0;
  const noTimes     = availableTimes.length === 0;

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-24 text-center">
        <p className="text-4xl mb-4">🛒</p>
        <h2 className="font-black text-xl mb-2">Warenkorb ist leer</h2>
        <p className="text-muted-foreground text-sm mb-6">Wähle zuerst eine Pizza aus.</p>
        <Button onClick={() => setView("home")}>Zur Speisekarte</Button>
      </div>
    );
  }

  return (
    <div className="pb-36">
      <div className="sticky top-0 z-40 bg-background/92 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView("home")}>
          <ArrowLeft size={17} />
        </Button>
        <div>
          <h2 className="font-bold leading-tight">Warenkorb</h2>
          <p className="text-xs text-muted-foreground">{cart.length} Pizza{cart.length !== 1 ? "en" : ""}</p>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">
        {/* Cart items */}
        <Card>
          <CardHeader><CardTitle>Deine Bestellung</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-0">
            {cart.map((item, i) => (
              <div key={item.cartId}>
                {i > 0 && <Separator className="mb-3" />}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 shrink-0">
                    <PizzaSVG selected={item.ingredientIds} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{item.pizzaName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.ingredientIds.map((id) => ingById(ingredients, id)?.name).filter(Boolean).join(", ") || "Käse & Sauce"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-black text-sm text-primary">10 €</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFromCart(item.cartId)}>
                      <X size={13} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add more buttons */}
            <Separator />
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={() => setView("home")}>
                <Plus size={11} /> Standard-Pizza
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={() => setView("configurator")}>
                <ChefHat size={11} /> Eigene Pizza
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Customer */}
        <Card>
          <CardHeader><CardTitle>Deine Daten</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fn">Vorname</Label>
                <Input id="fn" placeholder="Max" value={customer.firstName}
                  onChange={(e) => setCustomer((c) => ({ ...c, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ln">Nachname</Label>
                <Input id="ln" placeholder="Mustermann" value={customer.lastName}
                  onChange={(e) => setCustomer((c) => ({ ...c, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph">Telefon</Label>
              <div className="relative">
                <Phone size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="ph" type="tel" placeholder="+49 170 1234567" className="pl-9"
                  value={customer.phone}
                  onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pickup */}
        <Card>
          <CardHeader><CardTitle>Abholung</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {noDates ? (
              <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
                <p className="text-sm text-destructive font-semibold">Aktuell keine Bestelltage verfügbar.</p>
                <p className="text-xs text-muted-foreground mt-0.5">Bitte zu einem späteren Zeitpunkt erneut versuchen.</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Calendar size={11} /> Datum</Label>
                  <SelectInput value={pickupDate} onChange={setPickupDate} options={dateOptions} placeholder="Tag wählen..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Clock size={11} /> Uhrzeit</Label>
                  {noTimes
                    ? <p className="text-xs text-destructive">Keine Zeiten verfügbar.</p>
                    : <SelectInput value={pickupTime} onChange={setPickupTime} options={timeOptions} placeholder="Uhrzeit wählen..." />}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText size={14} className="text-muted-foreground" /> Bemerkungen</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea rows={3} placeholder="z.B. extra scharf, Allergie auf Nüsse..."
              value={notes} onChange={(e) => setNotes(e.target.value)}
              className="flex w-full rounded-xl border border-border bg-input-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/50 transition-colors resize-none" />
          </CardContent>
        </Card>

        {/* Voucher */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Ticket size={14} className="text-muted-foreground" /> Gutschein</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {voucher.applied ? (
              <div className="flex items-center justify-between bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-3">
                <div>
                  <p className="text-green-400 font-bold text-sm font-mono">{voucher.applied.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {voucher.applied.type === "ingredient"
                      ? `Sonderzutat: ${voucher.applied.ingredientName}`
                      : voucher.applied.type === "percent"
                      ? `${voucher.applied.value}% Rabatt`
                      : `${fmt(voucher.applied.value)} Rabatt`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={removeVoucher}><X size={13} /></Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input placeholder="WELCOME10" className="uppercase tracking-widest text-sm font-mono"
                  value={voucher.code} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} />
                <Button variant="secondary" onClick={applyVoucher} className="shrink-0">Einlösen</Button>
              </div>
            )}
            {voucher.message && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className={cn("text-xs flex items-center gap-1.5",
                  voucher.message.ok ? "text-green-400" : "text-destructive")}>
                {voucher.message.ok ? <Check size={11} /> : <AlertCircle size={11} />}
                {voucher.message.text}
              </motion.p>
            )}
          </CardContent>
        </Card>

        {/* Price breakdown */}
        <Card>
          <CardContent className="pt-5 space-y-2 text-sm">
            {cart.map((item) => (
              <div key={item.cartId} className="flex justify-between text-muted-foreground">
                <span>{item.pizzaName}</span>
                <span>{fmt(BASE_PRICE)}</span>
              </div>
            ))}
            {voucher.applied?.type === "ingredient" && voucher.applied.ingredientName && (
              <div className="flex justify-between text-green-400">
                <span>Sonderzutat</span>
                <span>🎁 {voucher.applied.ingredientName}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Gutschein</span><span>− {fmt(discount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-black text-base pt-0.5">
              <span>Gesamt</span>
              <span className="text-primary text-lg">{fmt(total)}</span>
            </div>
            <p className="text-[11px] text-center text-muted-foreground pt-1">Bezahlung bei Abholung in bar</p>
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-[68px] left-0 right-0 z-40 px-4 pb-2 max-w-lg mx-auto">
        <Button size="lg" className="w-full font-black text-base shadow-2xl shadow-primary/25"
          disabled={!canOrder || noDates} onClick={placeOrder}>
          {cart.length} Pizza{cart.length !== 1 ? "en" : ""} bestellen — {fmt(total)}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE: CONFIRMATION
// ─────────────────────────────────────────────────────────────

function ConfirmationPage({ order, ingredients, setView }: {
  order: OrderData; ingredients: IngredientItem[]; setView: (v: View) => void;
}): React.ReactElement {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-24">
      <motion.div initial={{ scale: 0.82, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.25 }} className="w-full max-w-md space-y-4">
        <div className="flex justify-center mb-2">
          <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Check size={36} className="text-green-400" strokeWidth={3} />
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-black">Bestellt!</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {order.items.length} Pizza{order.items.length !== 1 ? "en" : ""} werden vorbereitet.
          </p>
        </div>

        <Card className="border-primary/15 bg-primary/4 text-center">
          <CardContent className="py-5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-2">Bestellnummer</p>
            <p className="text-5xl font-black text-primary">{order.id}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">QR-Code</p>
            <div className="w-36 h-36 mx-auto"><QRCode data={order.id} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-semibold">{order.customer.firstName} {order.customer.lastName}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Abholung</span>
              <span className="font-semibold">{formatDateLabel(order.pickupDate)} · {order.pickupTime} Uhr</span>
            </div>
            <Separator />

            {/* All pizzas */}
            {order.items.map((item, i) => (
              <div key={item.cartId}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 shrink-0"><PizzaSVG selected={item.ingredientIds} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{item.pizzaName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.ingredientIds.map((id) => ingById(ingredients, id)?.name).filter(Boolean).join(", ") || "Käse & Sauce"}
                    </p>
                  </div>
                  <span className="text-primary font-bold shrink-0">10 €</span>
                </div>
                {i < order.items.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}

            {order.freeIngredient && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sonderzutat</span>
                  <span className="text-green-400 font-semibold">🎁 {order.freeIngredient}</span>
                </div>
              </>
            )}
            {order.notes && (
              <>
                <Separator />
                <div className="flex justify-between items-start gap-4">
                  <span className="text-muted-foreground shrink-0">Bemerkung</span>
                  <span className="text-right text-xs text-foreground/80">{order.notes}</span>
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between font-black">
              <span>Gesamt (bar)</span>
              <span className="text-primary">{fmt(order.total)}</span>
            </div>
          </CardContent>
        </Card>

        <Button variant="secondary" className="w-full" onClick={() => setView("home")}>
          Zurück zur Startseite
        </Button>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN: LOGIN
// ─────────────────────────────────────────────────────────────

function AdminLoginPage({ onSuccess, setView }: { onSuccess: () => void; setView: (v: View) => void }): React.ReactElement {
  const [pw, setPw]     = useState<string>("");
  const [show, setShow] = useState<boolean>(false);
  const [err, setErr]   = useState<boolean>(false);

  const attempt = (): void => {
    if (pw === ADMIN_PASSWORD) { onSuccess(); }
    else { setErr(true); setTimeout(() => setErr(false), 1800); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Settings size={26} className="text-primary" />
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black">Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">Nur für autorisierte Personen.</p>
        </div>
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="apw">Passwort</Label>
              <div className="relative">
                <Input id="apw" type={show ? "text" : "password"} placeholder="••••••"
                  className={cn("pr-11", err && "border-destructive")}
                  value={pw} onChange={(e) => setPw(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && attempt()} />
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-9 w-9" onClick={() => setShow(!show)}>
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
              </div>
              {err && <p className="text-destructive text-xs flex items-center gap-1.5"><AlertCircle size={11} /> Falsches Passwort</p>}
            </div>
            <Button className="w-full" onClick={attempt}>Anmelden</Button>
          </CardContent>
        </Card>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setView("home")}>
          ← Zurück zur App
        </Button>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN: SHELL
// ─────────────────────────────────────────────────────────────

function AdminShell({ page, setPage, onLogout, children }: {
  page: AdminPage; setPage: (p: AdminPage) => void; onLogout: () => void; children: React.ReactNode;
}): React.ReactElement {
  const nav: Array<{ id: AdminPage; icon: React.ElementType; label: string }> = [
    { id: "admin-dashboard",   icon: BarChart2, label: "Dashboard"      },
    { id: "admin-days",        icon: Calendar,  label: "Bestelltage"    },
    { id: "admin-hours",       icon: Clock,     label: "Öffnungszeiten" },
    { id: "admin-ingredients", icon: Package,   label: "Zutaten"        },
    { id: "admin-vouchers",    icon: Tag,       label: "Gutscheine"     },
  ];
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat size={16} className="text-primary" />
          <span className="font-black text-sm">Pizza Admin</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout} className="text-xs text-muted-foreground gap-1.5 h-7">
          <LogOut size={11} /> Abmelden
        </Button>
      </header>
      <div className="sticky top-[49px] z-40 bg-sidebar border-b border-sidebar-border overflow-x-auto">
        <div className="flex gap-0.5 px-2 py-1.5 min-w-max">
          {nav.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setPage(id)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
                page === id ? "bg-primary/12 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent")}>
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>
      </div>
      <main className="flex-1 overflow-auto">
        <motion.div
          key={page}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN: DASHBOARD
// ─────────────────────────────────────────────────────────────

// ── Custom SVG bar chart (no third-party lib → no key bugs) ──
function SvgBarChart({ data }: { data: Array<{ day: string; n: number }> }): React.ReactElement {
  const W = 280, H = 120, PAD = { t: 8, r: 4, b: 24, l: 28 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const maxVal = Math.max(...data.map((d) => d.n));
  const barW = Math.floor(innerW / data.length) - 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Grid lines */}
      {[0, 0.5, 1].map((frac) => {
        const y = PAD.t + innerH * (1 - frac);
        return (
          <line key={`gl-${frac}`} x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        );
      })}
      {/* Y labels */}
      {[0, maxVal].map((v, i) => (
        <text key={`yl-${i}`}
          x={PAD.l - 4} y={i === 0 ? H - PAD.b + 4 : PAD.t + 4}
          textAnchor="end" fill="#71717A" fontSize="9">
          {v}
        </text>
      ))}
      {/* Bars + X labels */}
      {data.map((d, i) => {
        const bH = maxVal > 0 ? (d.n / maxVal) * innerH : 0;
        const x  = PAD.l + i * (innerW / data.length) + (innerW / data.length - barW) / 2;
        const y  = PAD.t + innerH - bH;
        return (
          <g key={`bar-${d.day}`}>
            <rect x={x} y={y} width={barW} height={bH} fill="#F97316" rx="3" opacity="0.9" />
            <text x={x + barW / 2} y={H - PAD.b + 14} textAnchor="middle" fill="#71717A" fontSize="10">
              {d.day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Custom SVG donut chart ────────────────────────────────────
function SvgDonutChart({ data, colors }: {
  data: Array<{ name: string; v: number }>;
  colors: string[];
}): React.ReactElement {
  const cx = 55, cy = 55, R = 50, r = 30;
  const total = data.reduce((s, d) => s + d.v, 0);
  let angle = -Math.PI / 2;

  const slices = data.map((d, i) => {
    const sweep  = (d.v / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle);
    const y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(angle + sweep);
    const y2 = cy + R * Math.sin(angle + sweep);
    const ix1 = cx + r * Math.cos(angle);
    const iy1 = cy + r * Math.sin(angle);
    const ix2 = cx + r * Math.cos(angle + sweep);
    const iy2 = cy + r * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z`;
    angle += sweep;
    return { path, color: colors[i], name: d.name };
  });

  return (
    <svg viewBox="0 0 110 110" style={{ width: 110, height: 110 }}>
      {slices.map((s) => (
        <path key={`slice-${s.name}`} d={s.path} fill={s.color} opacity="0.9" />
      ))}
    </svg>
  );
}

function AdminDashboard(): React.ReactElement {
  return (
    <div className="p-4 space-y-5">
      <h2 className="font-bold text-lg">Dashboard</h2>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Heute",        val: "7",      sub: "+3 vs. gestern",  col: "text-primary"  },
          { label: "Diese Woche",  val: "119",    sub: "Mo–So gesamt",    col: "text-chart-2"  },
          { label: "Umsatz heute", val: "70 €",   sub: "7 × 10 €",        col: "text-chart-3"  },
          { label: "Top Zutat",    val: "Salami", sub: "42 mal gewählt",  col: "text-chart-5"  },
        ].map(({ label, val, sub, col }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <p className={cn("font-black text-2xl leading-none mb-1", col)}>{val}</p>
              <p className="text-xs font-semibold">{label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Bestellungen diese Woche</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <SvgBarChart data={WEEK_DATA} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Beliebteste Zutaten</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-4">
            <SvgDonutChart data={PIE_DATA} colors={PIE_COLORS} />
            <div className="space-y-1.5 flex-1">
              {PIE_DATA.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i] }} />
                    <span className="text-xs text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="text-xs font-bold">{d.v}×</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN: DAYS
// ─────────────────────────────────────────────────────────────

function AdminDaysPage({ days, setDays }: {
  days: Record<string, boolean>;
  setDays: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}): React.ReactElement {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="font-bold text-lg">Bestelltage</h2>
        <p className="text-sm text-muted-foreground mt-1">Nur aktive Tage werden im Bestellformular angezeigt.</p>
      </div>
      <Card>
        <CardContent className="py-0">
          {DAYS_OF_WEEK.map((day, i) => (
            <div key={day}>
              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="font-semibold text-sm">{day}</p>
                  <p className={cn("text-xs mt-0.5", days[day] ? "text-green-400" : "text-muted-foreground")}>
                    {days[day] ? "Bestellungen möglich" : "Geschlossen"}
                  </p>
                </div>
                <Switch checked={days[day]} onCheckedChange={() => setDays((d) => ({ ...d, [day]: !d[day] }))} />
              </div>
              {i < DAYS_OF_WEEK.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN: HOURS
// ─────────────────────────────────────────────────────────────

function AdminHoursPage({ hours, setHours }: {
  hours: Hours; setHours: React.Dispatch<React.SetStateAction<Hours>>;
}): React.ReactElement {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="font-bold text-lg">Öffnungszeiten</h2>
        <p className="text-sm text-muted-foreground mt-1">Im Bestellformular werden nur Uhrzeiten in diesem Zeitraum angezeigt.</p>
      </div>
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hf">Öffnet um</Label>
            <Input id="hf" type="time" value={hours.from} onChange={(e) => setHours((h) => ({ ...h, from: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ht">Schließt um</Label>
            <Input id="ht" type="time" value={hours.to} onChange={(e) => setHours((h) => ({ ...h, to: e.target.value }))} />
          </div>
          <div className="bg-primary/8 border border-primary/15 rounded-lg px-4 py-3">
            <p className="text-sm font-bold text-primary">{hours.from} – {hours.to} Uhr</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {getAvailableTimes(hours.from, hours.to).length} Zeitslots à 15 Minuten
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN: INGREDIENTS  (with add-form)
// ─────────────────────────────────────────────────────────────

function AdminIngredientsPage({ ingredients, setIngredients }: {
  ingredients: IngredientItem[];
  setIngredients: React.Dispatch<React.SetStateAction<IngredientItem[]>>;
}): React.ReactElement {
  const [showForm, setShowForm]   = useState<boolean>(false);
  const [form, setForm]           = useState({ name: "", emoji: "🍕", category: "Gemüse", description: "" });

  const addIngredient = (): void => {
    if (!form.name.trim()) return;
    const newIng: IngredientItem = {
      id: uid(), name: form.name.trim(), emoji: form.emoji,
      category: form.category, description: form.description.trim(),
      available: true,
    };
    setIngredients((p) => [...p, newIng]);
    setForm({ name: "", emoji: "🍕", category: "Gemüse", description: "" });
    setShowForm(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Zutaten</h2>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowForm(!showForm)}>
          <Plus size={12} /> Neue Zutat
        </Button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="border-primary/20">
              <CardHeader><CardTitle className="text-sm">Neue Zutat hinzufügen</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Emoji</Label>
                    <Input value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} className="text-center text-xl" maxLength={2} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Name</Label>
                    <Input placeholder="z.B. Balsamico" value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Kategorie</Label>
                  <SelectInput value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                    options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Beschreibung</Label>
                  <Input placeholder="Kurze Beschreibung..." value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={addIngredient} disabled={!form.name.trim()}>
                    <Plus size={13} /> Hinzufügen
                  </Button>
                  <Button variant="ghost" onClick={() => setShowForm(false)}>Abbrechen</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs defaultValue="Käse">
        <TabsList className="w-full">
          {CATEGORIES.map((c) => <TabsTrigger key={c} value={c} className="flex-1 text-xs">{c}</TabsTrigger>)}
        </TabsList>
        {CATEGORIES.map((cat) => (
          <TabsContent key={cat} value={cat} className="space-y-2 mt-3">
            {ingredients.filter((i) => i.category === cat).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Keine Zutaten in dieser Kategorie.</p>
            )}
            {ingredients.filter((i) => i.category === cat).map((ing) => (
              <Card key={ing.id} className={cn(!ing.available && "opacity-40")}>
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <span className="text-2xl">{ing.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{ing.name}</p>
                    <p className="text-xs text-muted-foreground">{ing.description || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={ing.available}
                      onCheckedChange={() => setIngredients((p) => p.map((i) => i.id === ing.id ? { ...i, available: !i.available } : i))} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setIngredients((p) => p.filter((i) => i.id !== ing.id))}>
                      <X size={12} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN: VOUCHERS  (with add-form)
// ─────────────────────────────────────────────────────────────

function AdminVouchersPage({ vouchers, setVouchers }: {
  vouchers: VoucherDef[];
  setVouchers: React.Dispatch<React.SetStateAction<VoucherDef[]>>;
}): React.ReactElement {
  const [showForm, setShowForm] = useState<boolean>(false);
  const [form, setForm] = useState({
    name: "", code: "", type: "percent" as "percent" | "fixed" | "ingredient",
    value: "", ingredientName: "", expiresAt: "", maxUses: "100",
  });
  const [formErr, setFormErr] = useState<string>("");

  const addVoucher = (): void => {
    const needsValue = form.type !== "ingredient";
    const needsIngredient = form.type === "ingredient";
    if (!form.name.trim() || !form.code.trim() || !form.expiresAt) {
      setFormErr("Bitte alle Felder ausfüllen."); return;
    }
    if (needsValue && !form.value) { setFormErr("Bitte einen Rabattwert eingeben."); return; }
    if (needsIngredient && !form.ingredientName.trim()) { setFormErr("Bitte eine Sonderzutat eingeben."); return; }
    const code = form.code.toUpperCase().trim();
    if (vouchers.some((v) => v.code === code)) {
      setFormErr("Dieser Code existiert bereits."); return;
    }
    const newV: VoucherDef = {
      id: uid(), name: form.name.trim(), code,
      type: form.type,
      value: form.type !== "ingredient" ? parseFloat(form.value) : 0,
      ingredientName: form.type === "ingredient" ? form.ingredientName.trim() : undefined,
      expiresAt: form.expiresAt, active: true,
      maxUses: parseInt(form.maxUses, 10) || 100, uses: 0,
    };
    setVouchers((p) => [...p, newV]);
    setForm({ name: "", code: "", type: "percent", value: "", ingredientName: "", expiresAt: "", maxUses: "100" });
    setFormErr("");
    setShowForm(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Gutscheine</h2>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowForm(!showForm)}>
          <Plus size={12} /> Neuer Gutschein
        </Button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="border-primary/20">
              <CardHeader><CardTitle className="text-sm">Neuen Gutschein erstellen</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input placeholder="Sommeraktion" value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Code</Label>
                    <Input placeholder="SOMMER20" className="uppercase font-mono tracking-widest"
                      value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Typ</Label>
                    <SelectInput
                      value={form.type}
                      onChange={(v) => setForm((f) => ({ ...f, type: v as "percent" | "fixed" | "ingredient" }))}
                      options={[
                        { value: "percent",    label: "Prozent (%)"     },
                        { value: "fixed",      label: "Fester Betrag (€)" },
                        { value: "ingredient", label: "Sonderzutat 🌿"  },
                      ]}
                    />
                  </div>
                  <div className="space-y-1.5">
                    {form.type === "ingredient" ? (
                      <>
                        <Label>Sonderzutat</Label>
                        <Input placeholder="z.B. Weed 🌿" value={form.ingredientName}
                          onChange={(e) => setForm((f) => ({ ...f, ingredientName: e.target.value }))} />
                      </>
                    ) : (
                      <>
                        <Label>Wert</Label>
                        <Input type="number" placeholder={form.type === "percent" ? "10" : "5"} min="0"
                          value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Gültig bis</Label>
                    <Input type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Max. Nutzungen</Label>
                    <Input type="number" placeholder="100" min="1"
                      value={form.maxUses} onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))} />
                  </div>
                </div>
                {formErr && <p className="text-destructive text-xs flex items-center gap-1.5"><AlertCircle size={11} />{formErr}</p>}
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={addVoucher}><Plus size={13} /> Erstellen</Button>
                  <Button variant="ghost" onClick={() => { setShowForm(false); setFormErr(""); }}>Abbrechen</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voucher list */}
      <div className="space-y-3">
        {vouchers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Noch keine Gutscheine erstellt.</p>
        )}
        {vouchers.map((v) => {
          const pct = Math.min(100, Math.round((v.uses / v.maxUses) * 100));
          return (
            <Card key={v.id} className={cn(!v.active && "opacity-45")}>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-lg tracking-widest text-primary">{v.code}</span>
                      <Badge variant={v.active ? "success" : "secondary"}>{v.active ? "Aktiv" : "Inaktiv"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{v.name}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch checked={v.active}
                      onCheckedChange={() => setVouchers((p) => p.map((x) => x.id === v.id ? { ...x, active: !x.active } : x))} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setVouchers((p) => p.filter((x) => x.id !== v.id))}>
                      <X size={12} />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {v.type === "ingredient" ? "Zutat:" : "Rabatt:"}{" "}
                    <span className="text-primary font-bold">
                      {v.type === "percent" ? `${v.value}%` : v.type === "fixed" ? fmt(v.value) : v.ingredientName ?? "—"}
                    </span>
                  </span>
                  <span>Bis: {v.expiresAt}</span>
                  <span>{v.uses}/{v.maxUses} genutzt</span>
                </div>
                <div>
                  <Progress value={pct} />
                  <p className="text-[10px] text-muted-foreground/40 text-right mt-1">{pct}% ausgeschöpft</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────

export default function App(): React.ReactElement {
  const [userPage, setUserPage]           = useState<UserPage>("home");
  const [showLogin, setShowLogin]         = useState<boolean>(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState<boolean>(false);
  const [adminPage, setAdminPage]         = useState<AdminPage>("admin-dashboard");

  // ── Cart
  const [cart, setCart]                     = useState<CartItem[]>([]);
  const [customSelected, setCustomSelected] = useState<string[]>([]);

  // ── Checkout form state
  const [customer, setCustomer]             = useState<Customer>({ firstName: "", lastName: "", phone: "" });
  const [notes, setNotes]                   = useState<string>("");
  const [pickupDate, setPickupDate]         = useState<string>("");
  const [pickupTime, setPickupTime]         = useState<string>("");
  const [voucherCode, setVoucherCode]       = useState<string>("");
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherDef | null>(null);
  const [voucherMsg, setVoucherMsg]         = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderData | null>(null);

  const [ingredients, setIngredients] = useState<IngredientItem[]>(INGREDIENTS_DEFAULT);
  const [vouchers, setVouchers]       = useState<VoucherDef[]>(VOUCHERS_INIT);
  const [days, setDays]               = useState<Record<string, boolean>>({
    Montag: true, Dienstag: true, Mittwoch: false, Donnerstag: true,
    Freitag: true, Samstag: true, Sonntag: false,
  });
  const [hours, setHours] = useState<Hours>({ from: "11:00", to: "21:00" });

  const availableDates = useMemo(() => getAvailableDates(days), [days]);
  const availableTimes = useMemo(() => getAvailableTimes(hours.from, hours.to), [hours]);

  const subtotal = BASE_PRICE * cart.length;
  const discount = useMemo(
    () =>
      appliedVoucher && appliedVoucher.type !== "ingredient"
        ? appliedVoucher.type === "percent"
          ? subtotal * appliedVoucher.value / 100
          : appliedVoucher.value
        : 0,
    [appliedVoucher, subtotal]
  );
  const total = Math.max(0, subtotal - discount);

  const addToCart = (pizzaName: string, ingredientIds: string[]): void =>
    setCart((p) => [...p, { cartId: uid(), pizzaName, ingredientIds }]);

  const removeFromCart = (cartId: string): void =>
    setCart((p) => p.filter((x) => x.cartId !== cartId));

  const toggleCustom = (id: string): void =>
    setCustomSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const applyVoucher = (): void => {
    const found = vouchers.find((v) => v.code === voucherCode && v.active);
    if (!found) { setVoucherMsg({ text: "Ungültiger Code.", ok: false }); return; }
    if (new Date(found.expiresAt) < new Date()) { setVoucherMsg({ text: "Gutschein abgelaufen.", ok: false }); return; }
    setAppliedVoucher(found);
    setVoucherMsg({
      text: found.type === "ingredient" ? `Sonderzutat: ${found.ingredientName} 🎁` : "Erfolgreich eingelöst!",
      ok: true,
    });
  };

  const removeVoucher = (): void => { setAppliedVoucher(null); setVoucherMsg(null); setVoucherCode(""); };

  const placeOrder = (): void => {
    setConfirmedOrder({
      id: genId(), items: cart, subtotal, total, discount,
      freeIngredient: appliedVoucher?.type === "ingredient" ? appliedVoucher.ingredientName : undefined,
      customer, notes, pickupDate, pickupTime, voucherCode: appliedVoucher?.code,
    });
    setCart([]);
    setCustomSelected([]);
    setUserPage("confirmation");
  };

  const navigateUser = (v: View): void => {
    if (v === "admin-login") { setShowLogin(true); return; }
    setShowLogin(false);
    setAdminLoggedIn(false);
    setUserPage(v as UserPage);
  };

  const onAdminLogin  = (): void => { setAdminLoggedIn(true); setShowLogin(false); };
  const onAdminLogout = (): void => { setAdminLoggedIn(false); setUserPage("home"); };

  const mode    = adminLoggedIn ? "admin" : showLogin ? "login" : "user";
  // Keep admin shell stable — only user/login pages trigger the outer transition
  const animKey = mode === "admin" ? "admin-shell" : mode === "login" ? "login" : userPage;

  return (
    <div className="min-h-screen bg-background text-foreground max-w-lg mx-auto relative"
      style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <AnimatePresence mode="wait">
        <motion.div key={animKey}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.14, ease: "easeOut" }}>

          {mode === "user" && userPage === "home" && (
            <HomePage
              onAddToCart={(t) => addToCart(t.name, t.ingredientIds)}
              cartCount={cart.length}
              onGoToCart={() => navigateUser("checkout")}
            />
          )}
          {mode === "user" && userPage === "configurator" && (
            <ConfiguratorPage
              selected={customSelected}
              toggle={toggleCustom}
              ingredients={ingredients}
              setView={navigateUser}
              onAddToCart={() => {
                if (customSelected.length > 0) {
                  addToCart("Eigene Pizza", customSelected);
                  setCustomSelected([]);
                }
              }}
            />
          )}
          {mode === "user" && userPage === "checkout" && (
            <CheckoutPage
              cart={cart} removeFromCart={removeFromCart}
              ingredients={ingredients}
              subtotal={subtotal} discount={discount} total={total}
              customer={customer} setCustomer={setCustomer}
              notes={notes} setNotes={setNotes}
              pickupDate={pickupDate} setPickupDate={setPickupDate}
              pickupTime={pickupTime} setPickupTime={setPickupTime}
              availableDates={availableDates} availableTimes={availableTimes}
              voucher={{ code: voucherCode, applied: appliedVoucher, message: voucherMsg }}
              setVoucherCode={setVoucherCode} applyVoucher={applyVoucher} removeVoucher={removeVoucher}
              placeOrder={placeOrder} setView={navigateUser}
            />
          )}
          {mode === "user" && userPage === "confirmation" && confirmedOrder !== null && (
            <ConfirmationPage order={confirmedOrder} ingredients={ingredients} setView={navigateUser} />
          )}

          {mode === "login" && (
            <AdminLoginPage onSuccess={onAdminLogin} setView={navigateUser} />
          )}

          {mode === "admin" && (
            <AdminShell page={adminPage} setPage={setAdminPage} onLogout={onAdminLogout}>
              {adminPage === "admin-dashboard"   && <AdminDashboard />}
              {adminPage === "admin-days"        && <AdminDaysPage days={days} setDays={setDays} />}
              {adminPage === "admin-hours"       && <AdminHoursPage hours={hours} setHours={setHours} />}
              {adminPage === "admin-ingredients" && <AdminIngredientsPage ingredients={ingredients} setIngredients={setIngredients} />}
              {adminPage === "admin-vouchers"    && <AdminVouchersPage vouchers={vouchers} setVouchers={setVouchers} />}
            </AdminShell>
          )}
        </motion.div>
      </AnimatePresence>

      {mode === "user" && (
        <BottomNav view={userPage} setView={navigateUser} cartCount={cart.length} />
      )}
    </div>
  );
}
