import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useOptions, type OptionField } from "@/hooks/use-options";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2, Check, X, Database } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/donnees")({ component: DonneesPage });

const FIELDS: { field: OptionField; label: string; group: "produits" | "vins" | "communs" }[] = [
  { field: "produit", label: "Produit", group: "produits" },
  { field: "animal", label: "Animal", group: "produits" },
  { field: "fruit", label: "Fruit / Légume", group: "produits" },
  { field: "version", label: "Version", group: "produits" },
  { field: "unite_poids", label: "Unité de poids", group: "produits" },
  { field: "etiquette_format", label: "Format d'étiquette", group: "produits" },
  { field: "type_vin", label: "Type de vin", group: "vins" },
  { field: "chateau", label: "Château / Domaine", group: "vins" },
  { field: "millesime", label: "Millésime", group: "vins" },
  { field: "couleur_vin", label: "Couleur du vin", group: "vins" },
  { field: "emplacement", label: "Emplacement", group: "communs" },
];

function DonneesPage() {
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl">
      <div className="flex items-start gap-3">
        <Database className="h-7 w-7 mt-1 text-primary" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Données</h1>
          <p className="text-sm text-muted-foreground">
            Gérez les valeurs des listes déroulantes utilisées dans les formulaires.
            Les valeurs par défaut ne sont pas modifiables ; seules vos valeurs personnalisées peuvent être éditées ou supprimées.
          </p>
        </div>
      </div>

      {(["produits", "vins", "communs"] as const).map((g) => (
        <section key={g} className="space-y-3">
          <h2 className="text-lg font-semibold capitalize border-b pb-1">{g}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {FIELDS.filter((f) => f.group === g).map((f) => (
              <FieldEditor key={f.field} field={f.field} label={f.label} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FieldEditor({ field, label }: { field: OptionField; label: string }) {
  const { defaults, custom, add, update, remove } = useOptions(field);
  const [newVal, setNewVal] = useState("");

  async function handleAdd() {
    if (!newVal.trim()) return;
    try {
      await add.mutateAsync(newVal);
      setNewVal("");
      toast.success("Valeur ajoutée");
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{label}</h3>
        <Badge variant="outline">{defaults.length + custom.length}</Badge>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Nouvelle valeur"
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button onClick={handleAdd} disabled={!newVal.trim() || add.isPending} size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1 max-h-64 overflow-auto">
        {defaults.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Par défaut</p>
            {defaults.map((v) => (
              <div key={`d-${v}`} className="flex items-center justify-between p-2 rounded bg-muted/40 text-sm">
                <span>{v}</span>
                <Badge variant="secondary" className="text-xs">verrouillé</Badge>
              </div>
            ))}
          </div>
        )}
        {custom.length > 0 && (
          <div className="space-y-1 pt-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Personnalisées</p>
            {custom.map((c) => (
              <EditableRow
                key={c.id}
                value={c.value}
                onSave={(v) => update.mutate({ id: c.id, value: v })}
                onDelete={() => {
                  if (confirm(`Supprimer "${c.value}" ? Les entrées existantes ne sont pas modifiées.`))
                    remove.mutate(c.id);
                }}
              />
            ))}
          </div>
        )}
        {defaults.length === 0 && custom.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Aucune valeur. Ajoutez-en une ci-dessus.</p>
        )}
      </div>
    </div>
  );
}

function EditableRow({ value, onSave, onDelete }: {
  value: string; onSave: (v: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (editing) {
    return (
      <div className="flex gap-1 items-center p-1">
        <Input value={v} onChange={(e) => setV(e.target.value)} className="h-8" />
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { onSave(v); setEditing(false); }}><Check className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setV(value); setEditing(false); }}><X className="h-4 w-4" /></Button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between p-2 rounded hover:bg-muted text-sm">
      <span>{value}</span>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete}><Trash2 className="h-3 w-3 text-destructive" /></Button>
      </div>
    </div>
  );
}
