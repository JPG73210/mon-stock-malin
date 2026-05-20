import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authed")({
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted-foreground">Chargement…</div>;
  if (!user) return <Navigate to="/auth" />;
  return <AppShell />;
}
