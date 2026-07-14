import type React from "react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, Pencil } from "lucide-react";
import { getIngredients, saveIngredients } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/utils";
import type { IngredientItem } from "@/types";
import { mergeCategories, BASE_CATEGORIES } from "@/lib/ingredient-categories";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { SelectInput } from "@/components/common/select-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const uid = () => Math.random().toString(36).slice(2, 9);
const NEW_CAT = "__new__";
const EMPTY_FORM = { name: "", emoji: "🍕", category: "Gemüse", description: "" };

// Admin: Zutatenverwaltung — Anlegen, Bearbeiten, Verfügbar-Toggle, Löschen. Persistiert via saveIngredients.
export default function IngredientsPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getIngredients);
  const [list, setList] = useState<IngredientItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCatMode, setNewCatMode] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { if (data) setList(data); }, [data]);

  // Lokalen State setzen UND persistieren (fire-and-forget, wie im Bestand).
  const mutate = (next: IngredientItem[]) => {
    setList(next);
    void saveIngredients(next);
  };

  // Formular im Anlege-Modus öffnen/schließen (setzt einen evtl. Edit-Zustand zurück).
  const toggleAddForm = () => {
    if (showForm) { setShowForm(false); setEditingId(null); setNewCatMode(false); }
    else { setEditingId(null); setForm(EMPTY_FORM); setNewCatMode(false); setShowForm(true); }
  };

  // Bearbeiten starten: Formular mit den Werten der Zutat vorausfüllen.
  const startEdit = (ing: IngredientItem) => {
    setForm({ name: ing.name, emoji: ing.emoji, category: ing.category, description: ing.description });
    setEditingId(ing.id);
    setNewCatMode(false);
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditingId(null); setNewCatMode(false); setForm(EMPTY_FORM); };

  // Anlegen oder Speichern (je nach editingId).
  const submit = () => {
    if (!list || !form.name.trim() || !form.category.trim()) return;
    const next = editingId
      ? list.map((i) => i.id === editingId
          ? { ...i, name: form.name.trim(), emoji: form.emoji, category: form.category.trim(), description: form.description.trim() }
          : i)
      : [...list, { id: uid(), name: form.name.trim(), emoji: form.emoji, category: form.category.trim(), description: form.description.trim(), available: true }];
    mutate(next);
    setForm(EMPTY_FORM); setEditingId(null); setNewCatMode(false); setShowForm(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Zutaten</h2>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={toggleAddForm}>
          <Plus size={12} /> Neue Zutat
        </Button>
      </div>

      <AsyncBoundary loading={loading} error={error} data={list}>
        {(items: IngredientItem[]) => {
          const catList = mergeCategories(items, BASE_CATEGORIES);
          const selectValue = newCatMode ? NEW_CAT : form.category;
          const canSubmit = !!form.name.trim() && !!form.category.trim();
          return (
            <>
              {/* Formular (Anlegen + Bearbeiten) */}
              <AnimatePresence>
                {showForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <Card className="border-primary/20">
                      <CardHeader><CardTitle className="text-sm">{editingId ? "Zutat bearbeiten" : "Neue Zutat hinzufügen"}</CardTitle></CardHeader>
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
                          <SelectInput value={selectValue}
                            onChange={(v) => {
                              if (v === NEW_CAT) { setNewCatMode(true); setForm((f) => ({ ...f, category: "" })); }
                              else { setNewCatMode(false); setForm((f) => ({ ...f, category: v })); }
                            }}
                            options={[...catList.map((c) => ({ value: c, label: c })), { value: NEW_CAT, label: "＋ Neue Kategorie…" }]} />
                          {newCatMode && (
                            <Input placeholder="Name der neuen Kategorie" value={form.category}
                              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label>Beschreibung</Label>
                          <Input placeholder="Kurze Beschreibung..." value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="flex gap-2">
                          <Button className="flex-1" onClick={submit} disabled={!canSubmit}>
                            {editingId ? "Speichern" : <><Plus size={13} /> Hinzufügen</>}
                          </Button>
                          <Button variant="ghost" onClick={cancelForm}>Abbrechen</Button>
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
                          <div className="flex items-center gap-1.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => startEdit(ing)}>
                              <Pencil size={12} />
                            </Button>
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
