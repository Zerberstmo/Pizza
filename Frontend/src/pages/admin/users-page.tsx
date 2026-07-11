import type React from "react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, AlertCircle, KeyRound } from "lucide-react";
import { getProfiles, setProfileActive, adminCreateUser, adminDeleteUser, adminResetPassword } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/hooks/use-auth";
import { emailTaken } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Role, User } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { SelectInput } from "@/components/common/select-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EMPTY = { email: "", firstName: "", lastName: "", phone: "", password: "", role: "customer" as Role };

// Admin: Nutzerverwaltung gegen Supabase (`profiles` + Edge Function `admin-users`).
export default function UsersPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getProfiles);
  const { currentUser } = useAuth();
  const [list, setList] = useState<User[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formErr, setFormErr] = useState("");
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");

  useEffect(() => { if (data) setList(data); }, [data]);

  const addUser = async () => {
    if (!list) return;
    if (!form.email.trim() || !form.password.trim()) { setFormErr("E-Mail und Passwort sind Pflicht."); return; }
    if (emailTaken(list, form.email.trim())) { setFormErr("Diese E-Mail existiert bereits."); return; }
    const errMsg = await adminCreateUser({
      email: form.email.trim(), password: form.password,
      firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim(),
      role: form.role,
    });
    if (errMsg) { setFormErr(errMsg); return; }
    setForm(EMPTY); setFormErr(""); setShowForm(false);
    const fresh = await getProfiles();
    setList(fresh);
  };

  const toggleActive = async (u: User) => {
    if (!list) return;
    const next = !u.active;
    await setProfileActive(u.id, next);
    setList(list.map((x) => (x.id === u.id ? { ...x, active: next } : x)));
  };

  const removeUser = async (u: User) => {
    if (!list) return;
    await adminDeleteUser(u.id);
    setList(list.filter((x) => x.id !== u.id));
  };

  const applyReset = async (u: User) => {
    if (!resetPw.trim()) return;
    await adminResetPassword(u.id, resetPw);
    setResetId(null); setResetPw("");
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Nutzer</h2>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowForm(!showForm)}><Plus size={12} /> Neuer Nutzer</Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="border-primary/20">
              <CardHeader><CardTitle className="text-sm">Neuen Nutzer anlegen</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>E-Mail</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rolle</Label>
                    <SelectInput value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}
                      options={[{ value: "customer", label: "Kunde" }, { value: "admin", label: "Admin" }]} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Vorname</Label>
                    <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nachname</Label>
                    <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Telefon</Label>
                    <Input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Startpasswort</Label>
                    <Input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                  </div>
                </div>
                {formErr && <p className="text-destructive text-xs flex items-center gap-1.5"><AlertCircle size={11} />{formErr}</p>}
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={addUser}><Plus size={13} /> Anlegen</Button>
                  <Button variant="ghost" onClick={() => { setShowForm(false); setFormErr(""); }}>Abbrechen</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AsyncBoundary loading={loading} error={error} data={list}
        empty={<p className="text-sm text-muted-foreground text-center py-8">Noch keine Nutzer.</p>}>
        {(users: User[]) => (
          <div className="space-y-2">
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <Card key={u.id} className={cn(!u.active && "opacity-45")}>
                  <CardContent className="py-3 px-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm">{u.email}</span>
                          <Badge variant={u.role === "admin" ? "success" : "secondary"}>{u.role === "admin" ? "Admin" : "Kunde"}</Badge>
                          {isSelf && <span className="text-[10px] text-muted-foreground">(du)</span>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {[`${u.firstName} ${u.lastName}`.trim(), u.phone].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Passwort zurücksetzen"
                          onClick={() => { setResetId(resetId === u.id ? null : u.id); setResetPw(""); }}>
                          <KeyRound size={13} />
                        </Button>
                        <Switch checked={u.active} disabled={isSelf}
                          onCheckedChange={() => void toggleActive(u)} />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={isSelf}
                          onClick={() => void removeUser(u)}>
                          <X size={12} />
                        </Button>
                      </div>
                    </div>
                    {resetId === u.id && (
                      <div className="flex gap-2">
                        <Input placeholder="Neues Passwort" value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
                        <Button variant="secondary" className="shrink-0" onClick={() => void applyReset(u)}>Setzen</Button>
                      </div>
                    )}
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
