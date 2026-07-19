import type React from "react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, AlertCircle } from "lucide-react";
import { getVouchers, saveVouchers } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/pricing";
import type { VoucherDef } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { SelectInput } from "@/components/common/select-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const uid = () => Math.random().toString(36).slice(2, 9);
type VoucherType = "percent" | "fixed" | "ingredient";
const EMPTY_FORM = { name: "", code: "", type: "percent" as VoucherType, value: "", ingredientName: "", expiresAt: "", maxUses: "100" };

// Admin: Gutscheinverwaltung. Portiert aus App.tsx:1541-1706; persistiert via saveVouchers.
export default function VouchersPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getVouchers);
  const [list, setList] = useState<VoucherDef[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErr, setFormErr] = useState("");

  useEffect(() => { if (data) setList(data); }, [data]);

  const mutate = (next: VoucherDef[]) => {
    setList(next);
    void saveVouchers(next);
  };

  const addVoucher = () => {
    if (!list) return;
    if (!form.name.trim() || !form.code.trim() || !form.expiresAt) { setFormErr("Bitte alle Felder ausfüllen."); return; }
    if (form.type !== "ingredient" && !form.value) { setFormErr("Bitte einen Rabattwert eingeben."); return; }
    if (form.type === "ingredient" && !form.ingredientName.trim()) { setFormErr("Bitte eine Sonderzutat eingeben."); return; }
    const code = form.code.toUpperCase().trim();
    if (list.some((v) => v.code === code)) { setFormErr("Dieser Code existiert bereits."); return; }
    const newV: VoucherDef = {
      id: uid(), name: form.name.trim(), code, type: form.type,
      value: form.type !== "ingredient" ? parseFloat(form.value) : 0,
      ingredientName: form.type === "ingredient" ? form.ingredientName.trim() : undefined,
      expiresAt: form.expiresAt, active: true,
      maxUses: parseInt(form.maxUses, 10) || 100, uses: 0,
    };
    mutate([...list, newV]);
    setForm(EMPTY_FORM);
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

      {/* Formular */}
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
                    <SelectInput value={form.type}
                      onChange={(v) => setForm((f) => ({ ...f, type: v as VoucherType }))}
                      options={[
                        { value: "percent",    label: "Prozent (%)" },
                        { value: "fixed",      label: "Fester Betrag (€)" },
                        { value: "ingredient", label: "Sonderzutat 🌿" },
                      ]} />
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

      {/* Liste */}
      <AsyncBoundary loading={loading} error={error} data={list}
        empty={<p className="text-sm text-muted-foreground text-center py-8">Noch keine Gutscheine erstellt.</p>}>
        {(vouchers: VoucherDef[]) => (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3 items-start">
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
                          onCheckedChange={() => mutate(vouchers.map((x) => x.id === v.id ? { ...x, active: !x.active } : x))} />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => mutate(vouchers.filter((x) => x.id !== v.id))}>
                          <X size={12} />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {v.type === "ingredient" ? "Zutat:" : "Rabatt:"}{" "}
                        <span className="text-primary font-bold">
                          {v.type === "percent" ? `${v.value}%` : v.type === "fixed" ? formatPrice(v.value) : v.ingredientName ?? "—"}
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
        )}
      </AsyncBoundary>
    </div>
  );
}
