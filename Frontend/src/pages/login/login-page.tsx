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
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(false);

  const attempt = async () => {
    const user = await login(username.trim(), pw);
    if (user) {
      navigate(user.role === "admin" ? "/admin/dashboard" : "/", { replace: true });
    } else {
      setErr(true);
      setTimeout(() => setErr(false), 1800);
    }
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
              <Label htmlFor="un">Benutzername</Label>
              <Input id="un" placeholder="z.B. Mo" value={username}
                onChange={(e) => setUsername(e.target.value)}
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
              {err && <p className="text-destructive text-xs flex items-center gap-1.5"><AlertCircle size={11} /> Falscher Benutzername oder Passwort</p>}
            </div>
            <Button className="w-full gap-2" onClick={attempt}><LogIn size={15} /> Anmelden</Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
