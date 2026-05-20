import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authed/corbeille")({ component: Corbeille });

function Corbeille() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold">Corbeille</h1>
        <p className="text-muted-foreground">Restaurez ou supprimez définitivement.</p>
      </div>
      <Tabs defaultValue="produits">
        <TabsList>
          <TabsTrigger value="produits">Produits</TabsTrigger>
          <TabsTrigger value="vins">Vins</TabsTrigger>
        </TabsList>
        <TabsContent value="produits"><TrashList table="products" labelOf={(r) => `${r.code} · ${r.produit}`} /></TabsContent>
        <TabsContent value="vins"><TrashList table="wines" labelOf={(r) => `${r.chateau ?? "Vin"} · ${r.type_vin ?? ""}`} /></TabsContent>
      </Tabs>
    </div>
  );
}

function TrashList({ table, labelOf }: { table: "products" | "wines"; labelOf: (r: any) => string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["trash", table],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).update({ deleted_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trash", table] });
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Restauré");
    },
  });

  const hardDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trash", table] });
      toast.success("Supprimé définitivement");
    },
  });

  const emptyAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from(table).delete().not("deleted_at", "is", null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trash", table] });
      toast.success("Corbeille vidée");
    },
  });

  return (
    <div className="space-y-3 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} élément(s)</p>
        {data && data.length > 0 && (
          <Button variant="destructive" size="sm" onClick={() => confirm("Vider toute la corbeille ?") && emptyAll.mutate()}>
            <Trash2 className="mr-2 h-4 w-4" /> Tout supprimer
          </Button>
        )}
      </div>
      {(data ?? []).map((r: any) => (
        <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <Badge variant="outline">×{r.quantite}</Badge>
          <p className="flex-1 truncate font-medium">{labelOf(r)}</p>
          <span className="text-xs text-muted-foreground">{new Date(r.deleted_at).toLocaleDateString("fr-FR")}</span>
          <Button size="sm" variant="outline" onClick={() => restore.mutate(r.id)}>
            <RotateCcw className="mr-2 h-4 w-4" /> Restaurer
          </Button>
          <Button size="sm" variant="destructive" onClick={() => hardDelete.mutate(r.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {(data?.length ?? 0) === 0 && <p className="text-muted-foreground text-center py-8">Corbeille vide.</p>}
    </div>
  );
}
