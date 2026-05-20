import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { ProductEditDialog } from "@/components/ProductEditDialog";
import { WineEditDialog } from "@/components/WineEditDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function RecentEntries({ kind }: { kind: "product" | "wine" }) {
  const qc = useQueryClient();
  const table = kind === "product" ? "products" : "wines";
  const [edit, setEdit] = useState<any | null>(null);

  const { data = [] } = useQuery({
    queryKey: [kind === "product" ? "recent-products" : "recent-wines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table).select("*").is("deleted_at", null)
        .order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table)
        .update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [kind === "product" ? "recent-products" : "recent-wines"] });
      qc.invalidateQueries({ queryKey: [kind === "product" ? "products" : "wines"] });
      toast.success("Déplacé dans la corbeille");
    },
  });

  return (
    <div className="rounded-xl border bg-card p-4 mt-6">
      <p className="font-semibold mb-3">10 dernières entrées</p>
      {data.length === 0 && <p className="text-sm text-muted-foreground">Aucune entrée récente.</p>}
      <div className="space-y-1">
        {data.map((it: any) => (
          <div key={it.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted">
            <div className="flex-1 min-w-0">
              {kind === "product" ? (
                <>
                  <p className="font-mono text-xs text-muted-foreground truncate">{it.code}</p>
                  <p className="text-sm truncate">{it.produit} {it.animal && `· ${it.animal}`} {it.fruit && `· ${it.fruit}`}</p>
                </>
              ) : (
                <>
                  <p className="text-sm truncate font-medium">{it.chateau || "Vin"} {it.millesime && `· ${it.millesime}`}</p>
                  <p className="text-xs text-muted-foreground truncate">{it.type_vin} · {it.couleur}</p>
                </>
              )}
            </div>
            <Badge variant="secondary">×{it.quantite}</Badge>
            <Button size="icon" variant="ghost" onClick={() => setEdit(it)}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => { if (confirm("Supprimer ?")) del.mutate(it.id); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      {kind === "product"
        ? <ProductEditDialog product={edit} open={!!edit} onClose={() => setEdit(null)} />
        : <WineEditDialog wine={edit} open={!!edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
