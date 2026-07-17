import type React from "react";
import { useEffect, useState, useCallback } from "react";
import { Plus, X, Star, Trash2 } from "lucide-react";
import {
  getSpecialItems, saveSpecialItem, deleteSpecialItem,
  getGrants, saveGrant, deleteGrant, getProfiles,
} from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { priceForQty } from "@/lib/special-pricing";
import { formatPrice } from "@/lib/pricing";
import type { SpecialItem, SpecialGrant, User, Tier } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { SelectInput } from "@/components/common/select-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EMPTY_ITEM = { code: "", name: "", emoji: "⭐" };

export default function SpecialItemsPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getSpecialItems);
  const { data: profiles } = useAsync(getProfiles);
  const [items, setItems] = useState<SpecialItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { if (data) setItems(data); }, [data]);

  const addItem = async () => {
    if (!items) return;
    if (!form.code.trim() || !form.name.trim()) return;
    const item: SpecialItem = {
      id: crypto.randomUUID(), code: form.code.trim(), name: form.name.trim(),
      emoji: form.emoji.trim() || "⭐", active: true,
    };
    await saveSpecialItem(item);
    setItems([...items, item]);
    setForm(EMPTY_ITEM);
    setShowForm(false);
  };
  const toggleItem = async (it: SpecialItem) => {
    const next = { ...it, active: !it.active };
    await saveSpecialItem(next);
    setItems((items ?? []).map((x) => (x.id === it.id ? next : x)));
  };
  const removeItem = async (id: string) => {
    await deleteSpecialItem(id);
    setItems((items ?? []).filter((x) => x.id !== id));
    if (expanded === id) setExpanded(null);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg flex items-center gap-2"><Star size={16} className="text-primary" /> Sonderartikel</h2>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowForm(!showForm)}>
          <Plus size={12} /> Neuer Artikel
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-sm">Neuer Sonderartikel</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-1">
                <Label>Emoji</Label>
                <Input value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Name</Label>
                <Input placeholder="VIP-Artikel" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Code (Einlösung im Gutscheinfeld)</Label>
              <Input placeholder="weed420" className="font-mono" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 gap-1.5" onClick={addItem}><Plus size={13} /> Erstellen</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AsyncBoundary loading={loading} error={error} data={items}
        empty={<p className="text-sm text-muted-foreground text-center py-8">Noch keine Sonderartikel.</p>}>
        {(list: SpecialItem[]) => (
          <div className="space-y-3">
            {list.map((it) => (
              <Card key={it.id} className={it.active ? "" : "opacity-45"}>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl">{it.emoji}</span>
                        <span className="font-bold">{it.name}</span>
                        <Badge variant={it.active ? "success" : "secondary"}>{it.active ? "Aktiv" : "Inaktiv"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{it.code}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Switch checked={it.active} onCheckedChange={() => toggleItem(it)} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeItem(it.id)}>
                        <X size={12} />
                      </Button>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setExpanded(expanded === it.id ? null : it.id)}>
                    {expanded === it.id ? "Freischaltungen ausblenden" : "Freischaltungen verwalten"}
                  </Button>
                  {expanded === it.id && <GrantsEditor itemId={it.id} profiles={profiles ?? []} />}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}

// ── Freischaltungen je Item (Nutzer + Staffeln) ──
function GrantsEditor({ itemId, profiles }: { itemId: string; profiles: User[] }): React.ReactElement {
  const load = useCallback(() => getGrants(itemId), [itemId]);
  const { data, loading, reload } = useAsync(load, [load]);
  const [grants, setGrants] = useState<SpecialGrant[]>([]);
  const [userId, setUserId] = useState("");

  useEffect(() => { if (data) setGrants(data); }, [data]);

  const customers = profiles.filter((p) => p.role === "customer");
  const nameOf = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName} (${p.email})`.trim() : id;
  };

  const addGrant = async () => {
    if (!userId || grants.some((g) => g.userId === userId)) return;
    const grant: SpecialGrant = { id: crypto.randomUUID(), itemId, userId, tiers: [{ min_qty: 1, unit_price: 0 }], active: true };
    await saveGrant(grant);
    setUserId("");
    reload();
  };
  const persist = async (g: SpecialGrant) => { await saveGrant(g); setGrants((cur) => cur.map((x) => (x.id === g.id ? g : x))); };
  const removeGrant = async (id: string) => { await deleteGrant(id); setGrants((cur) => cur.filter((x) => x.id !== id)); };

  // Staffeln: die Stufe min_qty:1 ist der Basispreis und muss erhalten bleiben — sonst findet
  // special_line_price (Migration 0012) für kleine Mengen keine Stufe und die Bestellung scheitert.
  const setTier = (g: SpecialGrant, idx: number, patch: Partial<Tier>) => {
    const tiers = g.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    void persist({ ...g, tiers });
  };
  const addTier = (g: SpecialGrant) => void persist({ ...g, tiers: [...g.tiers, { min_qty: 1, unit_price: 0 }] });
  const removeTier = (g: SpecialGrant, idx: number) => void persist({ ...g, tiers: g.tiers.filter((_, i) => i !== idx) });

  if (loading) return <p className="text-xs text-muted-foreground">Lädt…</p>;

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex gap-2">
        <SelectInput value={userId} onChange={setUserId} placeholder="Kunde wählen…"
          options={customers.filter((c) => !grants.some((g) => g.userId === c.id)).map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName} (${c.email})` }))} />
        <Button size="sm" className="shrink-0" onClick={addGrant}>Freischalten</Button>
      </div>
      {grants.length === 0 && <p className="text-xs text-muted-foreground">Noch niemand freigeschaltet.</p>}
      {grants.map((g) => (
        <Card key={g.id} className="bg-muted/30">
          <CardContent className="py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">{nameOf(g.userId)}</span>
              <div className="flex items-center gap-1.5">
                <Switch checked={g.active} onCheckedChange={() => void persist({ ...g, active: !g.active })} />
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeGrant(g.id)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Staffeln (ab Menge → Stückpreis €)</Label>
              {g.tiers.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input type="number" min="1" className="h-8 w-20" value={t.min_qty}
                    onChange={(e) => setTier(g, idx, { min_qty: parseInt(e.target.value, 10) || 1 })} />
                  <span className="text-xs text-muted-foreground">→</span>
                  <Input type="number" min="0" step="0.5" className="h-8 w-24" value={t.unit_price}
                    onChange={(e) => setTier(g, idx, { unit_price: parseFloat(e.target.value) || 0 })} />
                  <span className="text-xs text-muted-foreground">€/Stk</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeTier(g, idx)}>
                    <X size={11} />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => addTier(g)}>
                <Plus size={11} /> Stufe
              </Button>
              <p className="text-[11px] text-muted-foreground">Beispiel 3 Stück: {formatPrice(priceForQty(g.tiers, 3))}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
