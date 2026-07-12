import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

// Ziel des Passwort-Reset-Links. Supabase stellt beim Öffnen eine Recovery-Session her,
// sodass updateUser({password}) hier funktioniert.
export default function ResetPasswordPage(): React.ReactElement {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async () => {
    if (!pw || pw !== pw2) { setMsg("Passwörter stimmen nicht überein."); return; }
    try { await updatePassword(pw); setMsg("Passwort geändert. Weiter zum Login…"); setTimeout(() => navigate("/login", { replace: true }), 1500); }
    catch { setMsg("Reset-Link abgelaufen oder ungültig. Bitte erneut anfordern."); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-black text-center">Neues Passwort</h1>
        <Card><CardContent className="pt-5 space-y-4">
          <div className="space-y-1.5"><Label htmlFor="p1">Neues Passwort</Label>
            <Input id="p1" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="p2">Bestätigen</Label>
            <Input id="p2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
          <Button className="w-full gap-2" onClick={submit}><Check size={15} /> Speichern</Button>
        </CardContent></Card>
      </div>
    </div>
  );
}
