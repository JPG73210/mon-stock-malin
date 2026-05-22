export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      label_templates: {
        Row: {
          created_at: string
          file_url: string | null
          format: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          format: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          format?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      print_jobs: {
        Row: {
          created_at: string
          error: string | null
          format: string
          id: string
          label_data: Json
          pdf_base64: string | null
          printed_at: string | null
          printer_name: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          format: string
          id?: string
          label_data: Json
          pdf_base64?: string | null
          printed_at?: string | null
          printer_name?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          format?: string
          id?: string
          label_data?: Json
          pdf_base64?: string | null
          printed_at?: string | null
          printer_name?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      product_counters: {
        Row: {
          last_num: number
          letters: string
          user_id: string
          year_prefix: string
        }
        Insert: {
          last_num?: number
          letters: string
          user_id: string
          year_prefix: string
        }
        Update: {
          last_num?: number
          letters?: string
          user_id?: string
          year_prefix?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          ancien_code: string | null
          animal: string | null
          bague: string | null
          code: string
          created_at: string
          date_creation: string
          deleted_at: string | null
          emplacement: string
          etiquette_format: string
          fruit: string | null
          id: string
          needs_label: boolean
          notes: string | null
          poids: number | null
          produit: string
          quantite: number
          template_id: string | null
          unite_poids: string | null
          updated_at: string
          user_id: string
          version: string | null
        }
        Insert: {
          ancien_code?: string | null
          animal?: string | null
          bague?: string | null
          code: string
          created_at?: string
          date_creation?: string
          deleted_at?: string | null
          emplacement: string
          etiquette_format?: string
          fruit?: string | null
          id?: string
          needs_label?: boolean
          notes?: string | null
          poids?: number | null
          produit: string
          quantite?: number
          template_id?: string | null
          unite_poids?: string | null
          updated_at?: string
          user_id: string
          version?: string | null
        }
        Update: {
          ancien_code?: string | null
          animal?: string | null
          bague?: string | null
          code?: string
          created_at?: string
          date_creation?: string
          deleted_at?: string | null
          emplacement?: string
          etiquette_format?: string
          fruit?: string | null
          id?: string
          needs_label?: boolean
          notes?: string | null
          poids?: number | null
          produit?: string
          quantite?: number
          template_id?: string | null
          unite_poids?: string | null
          updated_at?: string
          user_id?: string
          version?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          code: string | null
          created_at: string
          delta: number
          id: string
          item_id: string
          kind: string
          label: string | null
          note: string | null
          reason: string
          user_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          delta: number
          id?: string
          item_id: string
          kind: string
          label?: string | null
          note?: string | null
          reason: string
          user_id: string
        }
        Update: {
          code?: string | null
          created_at?: string
          delta?: number
          id?: string
          item_id?: string
          kind?: string
          label?: string | null
          note?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_options: {
        Row: {
          created_at: string
          field: string
          id: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          field: string
          id?: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      wines: {
        Row: {
          chateau: string | null
          code_barre: string | null
          couleur: string | null
          created_at: string
          deleted_at: string | null
          emplacement: string | null
          favori: boolean
          id: string
          millesime: number | null
          notes: string | null
          photo_url: string | null
          quantite: number
          template_id: string | null
          type_vin: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chateau?: string | null
          code_barre?: string | null
          couleur?: string | null
          created_at?: string
          deleted_at?: string | null
          emplacement?: string | null
          favori?: boolean
          id?: string
          millesime?: number | null
          notes?: string | null
          photo_url?: string | null
          quantite?: number
          template_id?: string | null
          type_vin?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chateau?: string | null
          code_barre?: string | null
          couleur?: string | null
          created_at?: string
          deleted_at?: string | null
          emplacement?: string | null
          favori?: boolean
          id?: string
          millesime?: number | null
          notes?: string | null
          photo_url?: string | null
          quantite?: number
          template_id?: string | null
          type_vin?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_product_code: {
        Args: {
          _animal: string
          _date: string
          _fruit: string
          _produit: string
          _user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
