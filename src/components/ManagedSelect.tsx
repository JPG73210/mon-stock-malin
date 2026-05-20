import { useState } from "react";
import { useOptions, type OptionField } from "@/hooks/use-options";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

const ADD_VALUE = "__add__";

export function ManagedSelect({
  field, value, onChange, placeholder, allowEmpty,
}: {
  field: OptionField;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const { all, custom, add, update, remove } = useOptions(field);
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState("");
  const [manageOpen, setManageOpen] = useState(false);

  function handleSelect(v: string) {
    if (v === ADD_VALUE) { setAdding(true); return; }
    onChange(v);
  }

  async function confirmAdd() {
    if (!newVal.trim()) return;
    try {
      const v = await add.mutateAsync(newVal);
      onChange(v);
      setNewVal(""); setAdding(false);
      toast.success("Valeur ajoutée");
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="flex gap-1">
      <Select value={value || undefined} onValueChange={handleSelect}>
        <SelectTrigger className="flex-1"><SelectValue placeholder={placeholder ?? "Sélectionner…"} /></SelectTrigger>
        <SelectContent className="max-h-72">
          {allowEmpty && <SelectItem value=" ">—</SelectItem>}
          {all.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          <SelectItem value={ADD_VALUE} className="text-primary font-medium">
            <Plus className="inline h-3 w-3 mr-1" /> Ajouter…
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="icon" title="Gérer la liste">
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Gérer : {field}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-auto">
            {custom.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune valeur personnalisée. Les valeurs par défaut ne sont pas modifiables.</p>
            )}
            {custom.map((c) => (
              <EditableRow key={c.id}
                value={c.value}
                onSave={(v) => update.mutate({ id: c.id, value: v })}
                onDelete={() => {
                  if (confirm(`Supprimer "${c.value}" de la liste ? Les entrées existantes ne sont pas modifiées.`))
                    remove.mutate(c.id);
                }}
              />
            ))}
          </div>
          <div className="flex gap-2 pt-3 border-t">
            <Input placeholder="Nouvelle valeur" value={newVal} onChange={(e) => setNewVal(e.target.value)} />
            <Button onClick={confirmAdd} disabled={!newVal.trim()}><Plus className="h-4 w-4" /></Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nouvelle valeur</DialogTitle></DialogHeader>
          <Input autoFocus value={newVal} onChange={(e) => setNewVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmAdd()} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setAdding(false); setNewVal(""); }}>Annuler</Button>
            <Button onClick={confirmAdd} disabled={!newVal.trim()}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <div className="flex gap-1 items-center">
        <Input value={v} onChange={(e) => setV(e.target.value)} className="h-8" />
        <Button size="icon" variant="ghost" onClick={() => { onSave(v); setEditing(false); }}><Check className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={() => { setV(value); setEditing(false); }}><X className="h-4 w-4" /></Button>
      </div>
    );
  }
  return (
    <div className="flex gap-1 items-center justify-between p-2 rounded hover:bg-muted">
      <span className="text-sm">{value}</span>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></Button>
        <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-3 w-3 text-destructive" /></Button>
      </div>
    </div>
  );
}
