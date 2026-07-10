import type React from "react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X } from "lucide-react";
import { getIngredients, saveIngredients } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/utils";
import type { IngredientItem } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { SelectInput } from "@/components/common/select-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const uid = () => Math.random().toString(36).slice(2, 9);
const FALLBACK_CATEGORIES = ["Käse", "Fleisch", "Fisch", "Gemüse"];

// Admin: Zutatenverwaltung. Portiert aus App.tsx:1433-1535; persistiert via saveIngredients.
export default function IngredientsPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getIngredients);
  const [list, setList] = useState<IngredientItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", emoji: "🍕", category: "Gemüse", description: "" });

  useEffect(() => { if (data) setList(data); }, [data]);

  // Lokalen State setzen UND persistieren.
  const mutate = (next: IngredientItem[]) => {
    setList(next);
    void saveIngredients(next);
  };

  const addIngredient = () => {
    if (!form.name.trim() || !list) return;
    const newIng: IngredientItem = {
      id: uid(), name: form.name.trim(), emoji: form.emoji,
      category: form.category, description: form.description.trim(), available: true,
    };
    mutate([...list, newIng]);
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

      <AsyncBoundary loading={loading} error={error} data={list}>
        {(items: IngredientItem[]) => {
          const categories = items.reduce<string[]>((acc, i) => {
            if (!acc.includes(i.category)) acc.push(i.category);
            return acc;
          }, []);
          const catList = categories.length > 0 ? categories : FALLBACK_CATEGORIES;
          return (
            <>
              {/* Formular */}
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
                            options={catList.map((c) => ({ value: c, label: c }))} />
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

              <Tabs defaultValue={catList[0]}>
                <TabsList className="w-full">
                  {catList.map((c) => <TabsTrigger key={c} value={c} className="flex-1 text-xs">{c}</TabsTrigger>)}
                </TabsList>
                {catList.map((cat) => (
                  <TabsContent key={cat} value={cat} className="space-y-2 mt-3">
                    {items.filter((i) => i.category === cat).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">Keine Zutaten in dieser Kategorie.</p>
                    )}
                    {items.filter((i) => i.category === cat).map((ing) => (
                      <Card key={ing.id} className={cn(!ing.available && "opacity-40")}>
                        <CardContent className="py-3 px-4 flex items-center gap-3">
                          <span className="text-2xl">{ing.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{ing.name}</p>
                            <p className="text-xs text-muted-foreground">{ing.description || "—"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={ing.available}
                              onCheckedChange={() => mutate(items.map((i) => i.id === ing.id ? { ...i, available: !i.available } : i))} />
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => mutate(items.filter((i) => i.id !== ing.id))}>
                              <X size={12} />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                ))}
              </Tabs>
            </>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
