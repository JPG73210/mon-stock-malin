import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  EMPLACEMENTS, VERSIONS, UNITES_POIDS, ETIQUETTE_FORMATS,
  TYPES_VIN, COULEURS_VIN,
} from "@/lib/constants";

export type OptionField =
  | "produit" | "animal" | "fruit" | "emplacement" | "unite_poids"
  | "etiquette_format" | "version"
  | "chateau" | "type_vin" | "couleur_vin" | "millesime";

const DEFAULTS: Record<OptionField, readonly string[]> = {
  produit: [],
  animal: [],
  fruit: [],
  emplacement: EMPLACEMENTS,
  unite_poids: UNITES_POIDS,
  etiquette_format: ETIQUETTE_FORMATS,
  version: VERSIONS,
  chateau: [],
  type_vin: TYPES_VIN,
  couleur_vin: COULEURS_VIN,
  millesime: (() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 32 }, (_, i) => String(y + 1 - i));
  })(),
};

export function useOptions(field: OptionField) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: custom = [] } = useQuery({
    queryKey: ["user_options", field, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_options").select("id,value")
        .eq("field", field).order("value");
      if (error) throw error;
      return data as { id: string; value: string }[];
    },
  });

  const defaults = DEFAULTS[field] ?? [];
  const customValues = custom.map((c) => c.value);
  // merge unique, defaults first
  const all = [...defaults, ...customValues.filter((v) => !defaults.includes(v))];

  const add = useMutation({
    mutationFn: async (value: string) => {
      if (!user) throw new Error("Non connecté");
      const v = value.trim();
      if (!v) throw new Error("Valeur vide");
      const { error } = await supabase.from("user_options")
        .insert({ user_id: user.id, field, value: v });
      if (error && !String(error.message).includes("duplicate")) throw error;
      return v;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_options", field] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase.from("user_options")
        .update({ value: value.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_options", field] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_options").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_options", field] }),
  });

  return { all, custom, defaults, add, update, remove };
}
