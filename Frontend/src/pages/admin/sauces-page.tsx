import type React from "react";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { getSauces, saveSauces } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/utils";
import type { Sauce } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const uid = () => Math.random().toString(36).slice(2, 9);
const EMPTY = { name: "", emoji: "🍅", color: "#B03818" };

// Admin: Soßenverwaltung. Muster der Zutaten-Seite; persistiert via saveSauces.
export default function SaucesPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getSauces);
  const [list, setList] = useState<Sauce[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => { if (data) setList(data); }, [data]);

  const mutate = (next: Sauce[]) => { setList(next); void saveSauces(next); };

  const addSauce = () => {
    if (!form.name.trim() || !list) return;
    mutate([...list, { id: uid(), name: form.name.trim(), emoji: form.emoji, color: form.color, available: true }]);
    setForm(EMPTY);
    setShowForm(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Soßen</h2>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowForm(!showForm)}><Plus size={12} /> Neue Soße</Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-sm">Neue Soße</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Emoji</Label>
                <Input value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} className="text-center text-xl" maxLength={2} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Name</Label>
                <Input placeholder="z.B. Trüffelcreme" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Bodenfarbe</Label>
              <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="h-10 w-full rounded-lg border border-border bg-input-background" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={addSauce} disabled={!form.name.trim()}><Plus size={13} /> Hinzufügen</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AsyncBoundary loading={loading} error={error} data={list}
        empty={<p className="text-sm text-muted-foreground text-center py-8">Noch keine Soßen.</p>}>
        {(sauces: Sauce[]) => (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 items-start">
            {sauces.map((s) => (
              <Card key={s.id} className={cn(!s.available && "opacity-40")}>
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full border border-border shrink-0" style={{ background: s.color }} />
                  <span className="text-xl">{s.emoji}</span>
                  <div className="flex-1 min-w-0"><p className="font-semibold text-sm">{s.name}</p></div>
                  <div className="flex items-center gap-2">
                    <Switch checked={s.available} onCheckedChange={() => mutate(sauces.map((x) => x.id === s.id ? { ...x, available: !x.available } : x))} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => mutate(sauces.filter((x) => x.id !== s.id))}><X size={12} /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
