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
      fcp_raw_identifiers: {
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
      fcp_statement_batch_items: {
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
            foreignKeyName: "fcp_statement_batch_items_batch_root_fkey"
            columns: ["batch_root"]
            isOneToOne: false
            referencedRelation: "fcp_statement_batches"
            referencedColumns: ["root"]
          },
          {
            foreignKeyName: "fcp_statement_batch_items_statement_fingerprint_fkey"
            columns: ["statement_fingerprint"]
            isOneToOne: false
            referencedRelation: "fcp_statements"
            referencedColumns: ["statement_fingerprint"]
          },
          {
            foreignKeyName: "fcp_statement_batch_items_statement_fingerprint_fkey"
            columns: ["statement_fingerprint"]
            isOneToOne: false
            referencedRelation: "fcp_statements_identifiers_resolved"
            referencedColumns: ["statement_fingerprint"]
          },
        ]
      }
      fcp_statement_batches: {
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
      fcp_statements: {
        Row: {
          first_created_at: string
          object_fingerprint: string
          object_source_type: Database["public"]["Enums"]["fcp_entity_type"]
          object_type: Database["public"]["Enums"]["fcp_entity_type"]
          predicate_fingerprint: string
          predicate_source_type: Database["public"]["Enums"]["fcp_entity_type"]
          predicate_type: Database["public"]["Enums"]["fcp_statement_predicate_type"]
          statement_fingerprint: string
          subject_fingerprint: string
          subject_source_type: Database["public"]["Enums"]["fcp_entity_type"]
          subject_type: Database["public"]["Enums"]["fcp_entity_type"]
        }
        Insert: {
          first_created_at?: string
          object_fingerprint: string
          object_source_type: Database["public"]["Enums"]["fcp_entity_type"]
          object_type: Database["public"]["Enums"]["fcp_entity_type"]
          predicate_fingerprint: string
          predicate_source_type: Database["public"]["Enums"]["fcp_entity_type"]
          predicate_type: Database["public"]["Enums"]["fcp_statement_predicate_type"]
          statement_fingerprint: string
          subject_fingerprint: string
          subject_source_type: Database["public"]["Enums"]["fcp_entity_type"]
          subject_type: Database["public"]["Enums"]["fcp_entity_type"]
        }
        Update: {
          first_created_at?: string
          object_fingerprint?: string
          object_source_type?: Database["public"]["Enums"]["fcp_entity_type"]
          object_type?: Database["public"]["Enums"]["fcp_entity_type"]
          predicate_fingerprint?: string
          predicate_source_type?: Database["public"]["Enums"]["fcp_entity_type"]
          predicate_type?: Database["public"]["Enums"]["fcp_statement_predicate_type"]
          statement_fingerprint?: string
          subject_fingerprint?: string
          subject_source_type?: Database["public"]["Enums"]["fcp_entity_type"]
          subject_type?: Database["public"]["Enums"]["fcp_entity_type"]
        }
        Relationships: []
      }
    }
    Views: {
      fcp_statements_identifiers_resolved: {
        Row: {
          object_fingerprint: string | null
          object_fingerprint_original: string | null
          object_raw_identifier: string | null
          object_raw_identifier_original: string | null
          object_source_type:
            | Database["public"]["Enums"]["fcp_entity_type"]
            | null
          object_source_type_original:
            | Database["public"]["Enums"]["fcp_entity_type"]
            | null
          object_type: Database["public"]["Enums"]["fcp_entity_type"] | null
          predicate_fingerprint: string | null
          predicate_raw_identifier: string | null
          predicate_source_type:
            | Database["public"]["Enums"]["fcp_entity_type"]
            | null
          predicate_type:
            | Database["public"]["Enums"]["fcp_statement_predicate_type"]
            | null
          statement_fingerprint: string | null
          subject_fingerprint: string | null
          subject_fingerprint_original: string | null
          subject_raw_identifier: string | null
          subject_raw_identifier_original: string | null
          subject_source_type:
            | Database["public"]["Enums"]["fcp_entity_type"]
            | null
          subject_source_type_original:
            | Database["public"]["Enums"]["fcp_entity_type"]
            | null
          subject_type: Database["public"]["Enums"]["fcp_entity_type"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      refresh_fcp_statements_identifiers_resolved: {
        Args: never
        Returns: undefined
      }
    }
    Enums: {
      fcp_entity_type: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7"
      fcp_statement_predicate_type: "6"
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
      fcp_entity_type: ["0", "1", "2", "3", "4", "5", "6", "7"],
      fcp_statement_predicate_type: ["6"],
    },
  },
} as const
