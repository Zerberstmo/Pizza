import type { AppConfig, IngredientItem, PizzaTemplate, VoucherDef, Sauce, User } from "@/types";

// Quelle: `Frontend vorlage/src/app/App.tsx` (Konstanten 1:1 übernommen).
// TEIL-B TODO: Diese Seed-Daten werden durch Supabase-Tabellen ersetzt.

export const INGREDIENTS_DEFAULT: IngredientItem[] = [
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

export const CATEGORIES = ["Käse", "Fleisch", "Fisch", "Gemüse"] as const;

export const TEMPLATES: PizzaTemplate[] = [
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

export const SAUCES_DEFAULT: Sauce[] = [
  { id: "tomate", name: "Tomate",        emoji: "🍅", color: "#B03818", available: true },
  { id: "creme",  name: "Crème fraîche", emoji: "🥛", color: "#ECE3C8", available: true },
  { id: "bbq",    name: "BBQ",           emoji: "🍖", color: "#7A3B1E", available: true },
  { id: "pesto",  name: "Pesto",         emoji: "🌿", color: "#4B7A2F", available: true },
  { id: "keine",  name: "Ohne Soße",     emoji: "🚫", color: "#E8C070", available: true },
];

export const VOUCHERS_INIT: VoucherDef[] = [
  { id: "v1", name: "Willkommen",  code: "WELCOME10", type: "percent",    value: 10, expiresAt: "2026-12-31", active: true,  maxUses: 100, uses: 23 },
  { id: "v2", name: "Sommer",      code: "SOMMER15",  type: "percent",    value: 15, expiresAt: "2026-08-31", active: true,  maxUses: 50,  uses: 12 },
  { id: "v3", name: "Festrabatt",  code: "PIZZA5",    type: "fixed",      value: 5,  expiresAt: "2026-09-30", active: false, maxUses: 200, uses: 87 },
  { id: "v4", name: "Special",     code: "WEED420",   type: "ingredient", value: 0,  ingredientName: "Weed 🌿", expiresAt: "2026-12-31", active: true, maxUses: 50, uses: 4 },
];

// Dashboard-Mocks (App.tsx:177-182). TEIL-B TODO: aus echten Bestellungen aggregieren.
export const WEEK_DATA: { day: string; n: number }[] = [
  { day: "Mo", n: 12 }, { day: "Di", n: 8 },  { day: "Mi", n: 15 },
  { day: "Do", n: 10 }, { day: "Fr", n: 24 }, { day: "Sa", n: 31 }, { day: "So", n: 19 },
];
export const PIE_DATA: { name: string; v: number }[] = [
  { name: "Salami", v: 42 }, { name: "Mozzarella", v: 38 }, { name: "Schinken", v: 31 }, { name: "Paprika", v: 24 }, { name: "Pilze", v: 19 },
];
export const PIE_COLORS = ["#F97316", "#EAB308", "#22C55E", "#3B82F6", "#A855F7"];

export const DEFAULT_CONFIG: AppConfig = {
  days: { Montag: true, Dienstag: true, Mittwoch: false, Donnerstag: true, Freitag: true, Samstag: true, Sonntag: false },
  hours: { from: "11:00", to: "21:00" },
  leadTimeDays: 3,
  service: { dineIn: false, takeaway: true },
};

export const ADMIN_PASSWORD = "pizza"; // TEIL-B TODO: durch Supabase-Auth ersetzen

// TEIL-B TODO: Nutzer + Passwörter kommen in Teil-B aus Supabase-Auth (gehasht, serverseitig).
export const USERS_DEFAULT: User[] = [
  { id: "u1", username: "Mo", password: "pizza", firstName: "Mo", lastName: "", phone: "", role: "admin", active: true },
];
