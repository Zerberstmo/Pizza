import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Check, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfilePage(): React.ReactElement {
  const navigate = useNavigate();
  const { currentUser, updateOwnProfile, updatePassword, logout } = useAuth();
  const [firstName, setFirstName] = useState(currentUser?.firstName ?? "");
  const [lastName, setLastName] = useState(currentUser?.lastName ?? "");
  const [phone, setPhone] = useState(currentUser?.phone ?? "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");

  const save = async () => {
    if (pw && pw !== pw2) { setMsg("Passwörter stimmen nicht überein."); return; }
    await updateOwnProfile({ firstName, lastName, phone });
    if (pw) await updatePassword(pw);
    setPw(""); setPw2("");
    setMsg("Gespeichert.");
    setTimeout(() => setMsg(""), 2000);
  };

  const doLogout = async () => { await logout(); navigate("/login", { replace: true }); };

  return (
    <div className="min-h-screen pb-10">
      <div className="sticky top-0 z-40 bg-background/92 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft size={17} />
        </Button>
        <span className="font-bold text-sm">Mein Profil</span>
      </div>

      <div className="px-4 mt-5 space-y-4">
        <Card>
          <CardHeader><CardTitle>Konto</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>E-Mail</Label>
              <Input value={currentUser?.email ?? ""} disabled />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fn">Vorname</Label>
                <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ln">Nachname</Label>
                <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph">Telefon</Label>
              <Input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Passwort ändern</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="np">Neues Passwort</Label>
              <Input id="np" type="password" placeholder="leer lassen = unverändert" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np2">Bestätigen</Label>
              <Input id="np2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {msg && <p className="text-xs text-center text-muted-foreground">{msg}</p>}
        <Button className="w-full gap-2" onClick={save}><Check size={15} /> Speichern</Button>
        <Button variant="ghost" className="w-full text-muted-foreground gap-2" onClick={doLogout}><LogOut size={14} /> Abmelden</Button>
      </div>
    </div>
  );
}
