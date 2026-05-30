import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/logo-cerf.png";

export const Route = createFileRoute("/auth")({ component: AuthPage });

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user && !loading) nav({ to: "/" }); }, [user, loading, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Compte créé. Vérifiez votre email si nécessaire.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Email de réinitialisation envoyé.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Connecté !");
        nav({ to: "/" });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-xl">
        <div className="text-center space-y-3">
          <img src={logo} alt="Logo" className="h-24 w-24 mx-auto" />
          <h1 className="text-2xl font-bold">🌾🧀🍷 LES PRODUITS DU TERROIRS</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" && "Connectez-vous à votre compte"}
            {mode === "signup" && "Créer un compte"}
            {mode === "forgot" && "Réinitialiser le mot de passe"}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {mode !== "forgot" && (
            <div>
              <Label htmlFor="pw">Mot de passe</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "…" : mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Envoyer le lien"}
          </Button>
        </form>
        <div className="space-y-2 text-center text-sm">
          {mode === "login" && (
            <>
              <button type="button" onClick={() => setMode("forgot")} className="block w-full text-muted-foreground hover:text-foreground">
                Mot de passe oublié ?
              </button>
              <button type="button" onClick={() => setMode("signup")} className="block w-full text-muted-foreground hover:text-foreground">
                Pas encore de compte ? Inscription
              </button>
            </>
          )}
          {mode !== "login" && (
            <button type="button" onClick={() => setMode("login")} className="block w-full text-muted-foreground hover:text-foreground">
              Retour à la connexion
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
