import type React from "react";
import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { LogIn, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const { login, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  const attempt = async () => {
    const { user, error } = await login(email.trim(), pw);
    if (user) navigate(user.role === "admin" ? "/admin/dashboard" : "/", { replace: true });
    else { setErr(error ?? "Login fehlgeschlagen."); setTimeout(() => setErr(""), 2500); }
  };
  const forgot = async () => {
    if (!email.trim()) { setErr("Bitte E-Mail eingeben."); setTimeout(() => setErr(""), 2500); return; }
    await requestPasswordReset(email.trim());
    setInfo("Falls das Konto existiert, wurde eine E-Mail zum Zurücksetzen gesendet.");
    setTimeout(() => setInfo(""), 4000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="text-3xl">🍕</span>
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black">Anmelden</h1>
          <p className="text-muted-foreground text-sm mt-1">Bitte melde dich an, um zu bestellen.</p>
        </div>
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="em">E-Mail</Label>
              <Input id="em" type="email" placeholder="du@example.de" value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && attempt()} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">Passwort</Label>
              <div className="relative">
                <Input id="pw" type={show ? "text" : "password"} placeholder="••••••"
                  className={cn("pr-11", err && "border-destructive")}
                  value={pw} onChange={(e) => setPw(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && attempt()} />
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-9 w-9" onClick={() => setShow(!show)}>
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
              </div>
              {err && <p className="text-destructive text-xs flex items-center gap-1.5"><AlertCircle size={11} /> {err}</p>}
            </div>
            <Button className="w-full gap-2" onClick={attempt}><LogIn size={15} /> Anmelden</Button>
            <div className="text-center space-y-1">
              <button onClick={forgot} className="text-xs text-muted-foreground hover:text-foreground">Passwort vergessen?</button>
              {info && <p className="text-xs text-green-400">{info}</p>}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
