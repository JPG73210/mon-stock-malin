import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/logo-cerf.png";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase auto-handles the recovery session via URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Mot de passe mis à jour");
      nav({ to: "/" });
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-xl">
        <div className="text-center space-y-2">
          <img src={logo} alt="Logo" className="h-20 w-20 mx-auto" />
          <h1 className="text-2xl font-bold">Nouveau mot de passe</h1>
        </div>
        {!ready ? (
          <p className="text-sm text-muted-foreground text-center">
            Ouvrez le lien reçu par email pour réinitialiser votre mot de passe.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="pw">Nouveau mot de passe</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "…" : "Mettre à jour"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
