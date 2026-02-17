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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      identity_resolutions: {
        Row: {
          computed_at: string
          method_version: string
          resolved_fingerprint: string
          resolved_first_created_at: string
          run_id: string
          subject_fingerprint: string
          subject_source_type: Database["public"]["Enums"]["entity_type"]
          subject_type: Database["public"]["Enums"]["entity_type"]
        }
        Insert: {
          computed_at?: string
          method_version: string
          resolved_fingerprint: string
          resolved_first_created_at: string
          run_id: string
          subject_fingerprint: string
          subject_source_type: Database["public"]["Enums"]["entity_type"]
          subject_type: Database["public"]["Enums"]["entity_type"]
        }
        Update: {
          computed_at?: string
          method_version?: string
          resolved_fingerprint?: string
          resolved_first_created_at?: string
          run_id?: string
          subject_fingerprint?: string
          subject_source_type?: Database["public"]["Enums"]["entity_type"]
          subject_type?: Database["public"]["Enums"]["entity_type"]
        }
        Relationships: []
      }
      raw_identifiers: {
        Row: {
          identifier_fingerprint: string
          raw_identifier: string
        }
        Insert: {
          identifier_fingerprint: string
          raw_identifier: string
        }
        Update: {
          identifier_fingerprint?: string
          raw_identifier?: string
        }
        Relationships: []
      }
      statement_batch_items: {
        Row: {
          batch_root: string
          indexed_at: string
          statement_fingerprint: string
        }
        Insert: {
          batch_root: string
          indexed_at?: string
          statement_fingerprint: string
        }
        Update: {
          batch_root?: string
          indexed_at?: string
          statement_fingerprint?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_batch_items_batch_root_fkey"
            columns: ["batch_root"]
            isOneToOne: false
            referencedRelation: "statement_batches"
            referencedColumns: ["root"]
          },
          {
            foreignKeyName: "statement_batch_items_statement_fingerprint_fkey"
            columns: ["statement_fingerprint"]
            isOneToOne: false
            referencedRelation: "statements"
            referencedColumns: ["statement_fingerprint"]
          },
        ]
      }
      statement_batches: {
        Row: {
          first_seen_at: string
          github_run: string
          owner_id: string
          repo_id: string
          root: string
          url: string
        }
        Insert: {
          first_seen_at?: string
          github_run: string
          owner_id: string
          repo_id: string
          root: string
          url: string
        }
        Update: {
          first_seen_at?: string
          github_run?: string
          owner_id?: string
          repo_id?: string
          root?: string
          url?: string
        }
        Relationships: []
      }
      statements: {
        Row: {
          first_created_at: string
          object_fingerprint: string
          object_source_type: Database["public"]["Enums"]["entity_type"]
          object_type: Database["public"]["Enums"]["entity_type"]
          predicate_fingerprint: string
          statement_fingerprint: string
          subject_fingerprint: string
          subject_source_type: Database["public"]["Enums"]["entity_type"]
          subject_type: Database["public"]["Enums"]["entity_type"]
        }
        Insert: {
          first_created_at?: string
          object_fingerprint: string
          object_source_type: Database["public"]["Enums"]["entity_type"]
          object_type: Database["public"]["Enums"]["entity_type"]
          predicate_fingerprint: string
          statement_fingerprint: string
          subject_fingerprint: string
          subject_source_type: Database["public"]["Enums"]["entity_type"]
          subject_type: Database["public"]["Enums"]["entity_type"]
        }
        Update: {
          first_created_at?: string
          object_fingerprint?: string
          object_source_type?: Database["public"]["Enums"]["entity_type"]
          object_type?: Database["public"]["Enums"]["entity_type"]
          predicate_fingerprint?: string
          statement_fingerprint?: string
          subject_fingerprint?: string
          subject_source_type?: Database["public"]["Enums"]["entity_type"]
          subject_type?: Database["public"]["Enums"]["entity_type"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      refresh_fcp_statements_identifiers_resolved: {
        Args: never
        Returns: undefined
      }
    }
    Enums: {
      entity_type: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7"
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
    Enums: {
      entity_type: ["0", "1", "2", "3", "4", "5", "6", "7"],
    },
  },
} as const
