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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          description: string | null
          expires_at: string | null
          id: string
          key_hash: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          description?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attestation_schemas: {
        Row: {
          created_at: string | null
          name: string | null
          primary_relationship_namespace: string | null
          primary_relationship_type: string | null
          protocol_version: string | null
          schema_definition: string | null
          schema_uid: string
        }
        Insert: {
          created_at?: string | null
          name?: string | null
          primary_relationship_namespace?: string | null
          primary_relationship_type?: string | null
          protocol_version?: string | null
          schema_definition?: string | null
          schema_uid: string
        }
        Update: {
          created_at?: string | null
          name?: string | null
          primary_relationship_namespace?: string | null
          primary_relationship_type?: string | null
          protocol_version?: string | null
          schema_definition?: string | null
          schema_uid?: string
        }
        Relationships: []
      }
      claim_confidence_votes: {
        Row: {
          created_at: string | null
          graph_edge_id: number
          id: number
          reason: string | null
          vote: number
          voter_wallet_address: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          graph_edge_id: number
          id?: never
          reason?: string | null
          vote: number
          voter_wallet_address: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          graph_edge_id?: number
          id?: never
          reason?: string | null
          vote?: number
          voter_wallet_address?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_confidence_votes_graph_edge_id_fkey"
            columns: ["graph_edge_id"]
            isOneToOne: false
            referencedRelation: "entity_graph"
            referencedColumns: ["id"]
          },
        ]
      }
      context_sections: {
        Row: {
          content: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      device_sessions: {
        Row: {
          command_queue: Json | null
          created_at: string | null
          current_path: string | null
          device_info: Json | null
          id: string
          theme: Database["public"]["Enums"]["user_theme_enum"] | null
          user_id: string
        }
        Insert: {
          command_queue?: Json | null
          created_at?: string | null
          current_path?: string | null
          device_info?: Json | null
          id: string
          theme?: Database["public"]["Enums"]["user_theme_enum"] | null
          user_id: string
        }
        Update: {
          command_queue?: Json | null
          created_at?: string | null
          current_path?: string | null
          device_info?: Json | null
          id?: string
          theme?: Database["public"]["Enums"]["user_theme_enum"] | null
          user_id?: string
        }
        Relationships: []
      }
      eas_attestations: {
        Row: {
          attester_wallet_address: string
          chain_id: number
          created_at: string | null
          data: string
          decoded_data: Json | null
          decoder_version: string | null
          eas_uid: string
          expiration_time: string | null
          recipient_wallet_address: string | null
          revoked: boolean
          schema_uid: string
          time: string
          tx_hash: string
        }
        Insert: {
          attester_wallet_address: string
          chain_id: number
          created_at?: string | null
          data: string
          decoded_data?: Json | null
          decoder_version?: string | null
          eas_uid: string
          expiration_time?: string | null
          recipient_wallet_address?: string | null
          revoked?: boolean
          schema_uid: string
          time: string
          tx_hash: string
        }
        Update: {
          attester_wallet_address?: string
          chain_id?: number
          created_at?: string | null
          data?: string
          decoded_data?: Json | null
          decoder_version?: string | null
          eas_uid?: string
          expiration_time?: string | null
          recipient_wallet_address?: string | null
          revoked?: boolean
          schema_uid?: string
          time?: string
          tx_hash?: string
        }
        Relationships: []
      }
      entity_graph: {
        Row: {
          attestation_uid: string
          created_at: string | null
          derived_confidence: number | null
          extraction_rule: string | null
          from_id: string
          hidden_by_policy: boolean | null
          id: number
          is_directed: boolean | null
          relationship_namespace: string
          relationship_type: string
          schema_uid: string
          to_id: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          attestation_uid: string
          created_at?: string | null
          derived_confidence?: number | null
          extraction_rule?: string | null
          from_id: string
          hidden_by_policy?: boolean | null
          id?: never
          is_directed?: boolean | null
          relationship_namespace: string
          relationship_type: string
          schema_uid: string
          to_id: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          attestation_uid?: string
          created_at?: string | null
          derived_confidence?: number | null
          extraction_rule?: string | null
          from_id?: string
          hidden_by_policy?: boolean | null
          id?: never
          is_directed?: boolean | null
          relationship_namespace?: string
          relationship_type?: string
          schema_uid?: string
          to_id?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_graph_attestation_uid_fkey"
            columns: ["attestation_uid"]
            isOneToOne: false
            referencedRelation: "eas_attestations"
            referencedColumns: ["eas_uid"]
          },
          {
            foreignKeyName: "entity_graph_schema_uid_fkey"
            columns: ["schema_uid"]
            isOneToOne: false
            referencedRelation: "attestation_schemas"
            referencedColumns: ["schema_uid"]
          },
        ]
      }
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
      fcp_statements: {
        Row: {
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
      generation_steps: {
        Row: {
          created_at: string | null
          goal_id: string | null
          id: string
          initiative_id: string | null
          is_error: boolean
          message_id: string
          milestone_id: string | null
          project_id: string | null
          result_data: Json | null
          step_index: number
          step_text: string | null
          step_type: string
          task_id: string | null
          team_id: string | null
          tool_args: Json | null
          tool_call_id: string | null
          tool_name: string | null
        }
        Insert: {
          created_at?: string | null
          goal_id?: string | null
          id?: string
          initiative_id?: string | null
          is_error?: boolean
          message_id: string
          milestone_id?: string | null
          project_id?: string | null
          result_data?: Json | null
          step_index: number
          step_text?: string | null
          step_type: string
          task_id?: string | null
          team_id?: string | null
          tool_args?: Json | null
          tool_call_id?: string | null
          tool_name?: string | null
        }
        Update: {
          created_at?: string | null
          goal_id?: string | null
          id?: string
          initiative_id?: string | null
          is_error?: boolean
          message_id?: string
          milestone_id?: string | null
          project_id?: string | null
          result_data?: Json | null
          step_index?: number
          step_text?: string | null
          step_type?: string
          task_id?: string | null
          team_id?: string | null
          tool_args?: Json | null
          tool_call_id?: string | null
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_message_steps_goal_id"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_message_steps_milestone_id"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_message_steps_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_message_steps_task_id"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_steps_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_steps_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_steps_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          assigned_to_member_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          name: string
          status: string | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_to_member_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          status?: string | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_to_member_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          status?: string | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_assigned_to_member_id_fkey"
            columns: ["assigned_to_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      initiatives: {
        Row: {
          assigned_to_member_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          goal_id: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["initiative_status_enum"] | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_to_member_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["initiative_status_enum"] | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_to_member_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          goal_id?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["initiative_status_enum"] | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "initiatives_assigned_to_member_id_fkey"
            columns: ["assigned_to_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiatives_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiatives_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      message_tags: {
        Row: {
          confidence: number | null
          created_at: string | null
          message_id: string
          tag_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          message_id: string
          tag_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          message_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_tags_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: Json | null
          created_at: string
          embedding_openai_3_small: string | null
          id: string
          message: string | null
          platform_connection_id: string | null
          sent_by_member_id: string | null
          sent_to_member_id: string | null
          team_id: string
          trace_ids: Json | null
          triggered_by_message_id: string | null
        }
        Insert: {
          content?: Json | null
          created_at: string
          embedding_openai_3_small?: string | null
          id?: string
          message?: string | null
          platform_connection_id?: string | null
          sent_by_member_id?: string | null
          sent_to_member_id?: string | null
          team_id: string
          trace_ids?: Json | null
          triggered_by_message_id?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string
          embedding_openai_3_small?: string | null
          id?: string
          message?: string | null
          platform_connection_id?: string | null
          sent_by_member_id?: string | null
          sent_to_member_id?: string | null
          team_id?: string
          trace_ids?: Json | null
          triggered_by_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sent_by_member_id_fkey"
            columns: ["sent_by_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sent_to_member_id_fkey"
            columns: ["sent_to_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_triggered_by_message_id_fkey"
            columns: ["triggered_by_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestration_messages_platform_connection_id_fkey"
            columns: ["platform_connection_id"]
            isOneToOne: false
            referencedRelation: "platform_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          assigned_to_member_id: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string
          goal_id: string | null
          id: string
          initiative_id: string | null
          name: string
          project_id: string | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_to_member_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          goal_id?: string | null
          id?: string
          initiative_id?: string | null
          name: string
          project_id?: string | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_to_member_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          goal_id?: string | null
          id?: string
          initiative_id?: string | null
          name?: string
          project_id?: string | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_assigned_to_member_id_fkey1"
            columns: ["assigned_to_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_team_id_fkey1"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          conditions: Json
          created_at: string | null
          enabled: boolean | null
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id: string
          platform_connection_id: string | null
          team_id: string | null
          trigger_priorities:
            | Database["public"]["Enums"]["task_priority_enum"][]
            | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conditions?: Json
          created_at?: string | null
          enabled?: boolean | null
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id?: string
          platform_connection_id?: string | null
          team_id?: string | null
          trigger_priorities?:
            | Database["public"]["Enums"]["task_priority_enum"][]
            | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conditions?: Json
          created_at?: string | null
          enabled?: boolean | null
          event_type?: Database["public"]["Enums"]["notification_event_type"]
          id?: string
          platform_connection_id?: string | null
          team_id?: string | null
          trigger_priorities?:
            | Database["public"]["Enums"]["task_priority_enum"][]
            | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_platform_connection_id_fkey"
            columns: ["platform_connection_id"]
            isOneToOne: false
            referencedRelation: "platform_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string | null
          id: string
          slug: string
        }
        Insert: {
          description?: string | null
          id?: string
          slug: string
        }
        Update: {
          description?: string | null
          id?: string
          slug?: string
        }
        Relationships: []
      }
      platform_connections: {
        Row: {
          connection_config: Json
          created_at: string | null
          enabled: boolean | null
          id: string
          platform_id: string
          type:
            | Database["public"]["Enums"]["platform_connection_type_enum"]
            | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          connection_config: Json
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          platform_id: string
          type?:
            | Database["public"]["Enums"]["platform_connection_type_enum"]
            | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          connection_config?: Json
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          platform_id?: string
          type?:
            | Database["public"]["Enums"]["platform_connection_type_enum"]
            | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_connections_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platforms: {
        Row: {
          created_at: string | null
          display_name: string
          id: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          id?: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          id?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          initiative_id: string | null
          name: string
          owner_member_id: string | null
          status: Database["public"]["Enums"]["project_status_enum"] | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          initiative_id?: string | null
          name: string
          owner_member_id?: string | null
          status?: Database["public"]["Enums"]["project_status_enum"] | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          initiative_id?: string | null
          name?: string
          owner_member_id?: string | null
          status?: Database["public"]["Enums"]["project_status_enum"] | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_member_id_fkey"
            columns: ["owner_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          category: Database["public"]["Enums"]["tag_category_enum"] | null
          created_at: string | null
          id: string
          name: string
          team_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["tag_category_enum"] | null
          created_at?: string | null
          id?: string
          name: string
          team_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["tag_category_enum"] | null
          created_at?: string | null
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      task_complexity_reports: {
        Row: {
          created_at: string | null
          expansion_prompt: string | null
          id: string
          reasoning: string | null
          recommended_subtasks: number | null
          score: number
          task_id: string
        }
        Insert: {
          created_at?: string | null
          expansion_prompt?: string | null
          id?: string
          reasoning?: string | null
          recommended_subtasks?: number | null
          score: number
          task_id: string
        }
        Update: {
          created_at?: string | null
          expansion_prompt?: string | null
          id?: string
          reasoning?: string | null
          recommended_subtasks?: number | null
          score?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_complexity_reports_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string | null
          depends_on_task_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          depends_on_task_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_label_assignments: {
        Row: {
          assigned_at: string | null
          label_id: string
          task_id: string
        }
        Insert: {
          assigned_at?: string | null
          label_id: string
          task_id: string
        }
        Update: {
          assigned_at?: string | null
          label_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_label_assignments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "task_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_label_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_labels: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          team_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          team_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_labels_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      task_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_tasks_orchestration_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orchestrator_message_tasks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to_member_id: string
          complexity_score: number | null
          created_at: string
          description: string
          due_date: string | null
          expects_response: boolean | null
          expires_at: string | null
          id: string
          initiator_user_id: string
          milestone_id: string | null
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority_enum"] | null
          processing_started_at: string | null
          project_id: string | null
          result_comments: string | null
          status: Database["public"]["Enums"]["task_status_enum"] | null
          team_id: string
          test_strategy: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          assigned_to_member_id: string
          complexity_score?: number | null
          created_at?: string
          description: string
          due_date?: string | null
          expects_response?: boolean | null
          expires_at?: string | null
          id?: string
          initiator_user_id: string
          milestone_id?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority_enum"] | null
          processing_started_at?: string | null
          project_id?: string | null
          result_comments?: string | null
          status?: Database["public"]["Enums"]["task_status_enum"] | null
          team_id: string
          test_strategy?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to_member_id?: string
          complexity_score?: number | null
          created_at?: string
          description?: string
          due_date?: string | null
          expects_response?: boolean | null
          expires_at?: string | null
          id?: string
          initiator_user_id?: string
          milestone_id?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority_enum"] | null
          processing_started_at?: string | null
          project_id?: string | null
          result_comments?: string | null
          status?: Database["public"]["Enums"]["task_status_enum"] | null
          team_id?: string
          test_strategy?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_member_id_fkey"
            columns: ["assigned_to_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_initiator_user_id_fkey"
            columns: ["initiator_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          context_config: Json | null
          created_at: string | null
          id: string
          local_tool_packs: string[] | null
          manager_member_id: string | null
          message_history_config: Json | null
          role_id: string | null
          scope_description: string | null
          team_id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context_config?: Json | null
          created_at?: string | null
          id?: string
          local_tool_packs?: string[] | null
          manager_member_id?: string | null
          message_history_config?: Json | null
          role_id?: string | null
          scope_description?: string | null
          team_id: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context_config?: Json | null
          created_at?: string | null
          id?: string
          local_tool_packs?: string[] | null
          manager_member_id?: string | null
          message_history_config?: Json | null
          role_id?: string | null
          scope_description?: string | null
          team_id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_manager_member_id_fkey"
            columns: ["manager_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          billing_team_id: string | null
          created_at: string | null
          id: string
          implicit_child_access_role_id: string | null
          implicit_parent_access_role_id: string | null
          mission: string | null
          name: string
          parent_team_id: string | null
          public_role_id: string | null
          slug: string | null
          status: Database["public"]["Enums"]["team_status_enum"] | null
          updated_at: string | null
        }
        Insert: {
          billing_team_id?: string | null
          created_at?: string | null
          id?: string
          implicit_child_access_role_id?: string | null
          implicit_parent_access_role_id?: string | null
          mission?: string | null
          name: string
          parent_team_id?: string | null
          public_role_id?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["team_status_enum"] | null
          updated_at?: string | null
        }
        Update: {
          billing_team_id?: string | null
          created_at?: string | null
          id?: string
          implicit_child_access_role_id?: string | null
          implicit_parent_access_role_id?: string | null
          mission?: string | null
          name?: string
          parent_team_id?: string | null
          public_role_id?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["team_status_enum"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_billing_team_id_fkey"
            columns: ["billing_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_implicit_child_access_role_id_fkey"
            columns: ["implicit_child_access_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_implicit_parent_access_role_id_fkey"
            columns: ["implicit_parent_access_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_parent_team_id_fkey"
            columns: ["parent_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_public_role_id_fkey"
            columns: ["public_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          a2a_protocol_version: string | null
          a2a_url: string | null
          context_config: string | null
          created_at: string | null
          current_twin_team_id: string | null
          default_input_modes: string[] | null
          default_model: string | null
          default_output_modes: string[] | null
          default_thinking_budget: number | null
          description: string | null
          id: string
          local_tool_packs: string[] | null
          message_history_config: Json | null
          name: string
          notification_preferences: Json | null
          preferred_language: string | null
          preferred_transport:
            | Database["public"]["Enums"]["a2a_transport_protocol_enum"]
            | null
          supports_push_notifications: boolean | null
          supports_streaming: boolean | null
          timezone: string | null
          type: Database["public"]["Enums"]["user_type_enum"]
          updated_at: string | null
        }
        Insert: {
          a2a_protocol_version?: string | null
          a2a_url?: string | null
          context_config?: string | null
          created_at?: string | null
          current_twin_team_id?: string | null
          default_input_modes?: string[] | null
          default_model?: string | null
          default_output_modes?: string[] | null
          default_thinking_budget?: number | null
          description?: string | null
          id?: string
          local_tool_packs?: string[] | null
          message_history_config?: Json | null
          name: string
          notification_preferences?: Json | null
          preferred_language?: string | null
          preferred_transport?:
            | Database["public"]["Enums"]["a2a_transport_protocol_enum"]
            | null
          supports_push_notifications?: boolean | null
          supports_streaming?: boolean | null
          timezone?: string | null
          type: Database["public"]["Enums"]["user_type_enum"]
          updated_at?: string | null
        }
        Update: {
          a2a_protocol_version?: string | null
          a2a_url?: string | null
          context_config?: string | null
          created_at?: string | null
          current_twin_team_id?: string | null
          default_input_modes?: string[] | null
          default_model?: string | null
          default_output_modes?: string[] | null
          default_thinking_budget?: number | null
          description?: string | null
          id?: string
          local_tool_packs?: string[] | null
          message_history_config?: Json | null
          name?: string
          notification_preferences?: Json | null
          preferred_language?: string | null
          preferred_transport?:
            | Database["public"]["Enums"]["a2a_transport_protocol_enum"]
            | null
          supports_push_notifications?: boolean | null
          supports_streaming?: boolean | null
          timezone?: string | null
          type?: Database["public"]["Enums"]["user_type_enum"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_current_twin_team_id_fkey"
            columns: ["current_twin_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_execution_logs: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error: string | null
          execution_id: string
          id: string
          input: Json | null
          node_id: string
          node_name: string
          node_type: string
          output: Json | null
          started_at: string
          status: string
          timestamp: string
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error?: string | null
          execution_id: string
          id?: string
          input?: Json | null
          node_id: string
          node_name: string
          node_type: string
          output?: Json | null
          started_at?: string
          status: string
          timestamp?: string
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error?: string | null
          execution_id?: string
          id?: string
          input?: Json | null
          node_id?: string
          node_name?: string
          node_type?: string
          output?: Json | null
          started_at?: string
          status?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_execution_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "workflow_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_executions: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error: string | null
          id: string
          input: Json | null
          output: Json | null
          started_at: string
          status: Database["public"]["Enums"]["workflow_execution_status_enum"]
          user_id: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["workflow_execution_status_enum"]
          user_id: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["workflow_execution_status_enum"]
          user_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          description: string | null
          edges: Json
          id: string
          name: string
          nodes: Json
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          name: string
          nodes?: Json
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          edges?: Json
          id?: string
          name?: string
          nodes?: Json
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      effective_team_members: {
        Row: {
          effective_role_id: string | null
          hierarchy_depth: number | null
          is_direct: boolean | null
          membership_type: string | null
          source_team_id: string | null
          team_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      effective_team_members_secure: {
        Row: {
          effective_role_id: string | null
          hierarchy_depth: number | null
          is_direct: boolean | null
          membership_type: string | null
          source_team_id: string | null
          team_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      entities: {
        Row: {
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          last_refreshed: string | null
          trust_score: number | null
        }
        Relationships: []
      }
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
      global_trust_scores: {
        Row: {
          calculated_at: string | null
          entity_id: string | null
          trust_score: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      expire_stale_orchestration_tasks: { Args: never; Returns: undefined }
      get_effective_membership: {
        Args: { lookup_team_id: string; lookup_user_id: string }
        Returns: {
          effective_role_id: string
          is_direct: boolean
          is_member: boolean
          membership_type: string
          source_team_id: string
        }[]
      }
      get_team_effective_roster: {
        Args: { lookup_team_id: string }
        Returns: {
          effective_role_id: string | null
          hierarchy_depth: number | null
          is_direct: boolean | null
          membership_type: string | null
          source_team_id: string | null
          team_id: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "effective_team_members"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_permission: {
        Args: { lookup_team_id: string; required_permission: string }
        Returns: boolean
      }
      is_team_member: { Args: { lookup_team_id: string }; Returns: boolean }
      match_messages:
        | {
            Args: {
              filter_team_id: string
              filter_user_id?: string
              match_count: number
              match_threshold: number
              query_embedding: string
            }
            Returns: {
              created_at: string
              id: string
              message: string
              similarity: number
            }[]
          }
        | {
            Args: {
              filter_team_ids: string[]
              filter_user_id?: string
              match_count: number
              match_threshold: number
              query_embedding: string
            }
            Returns: {
              created_at: string
              id: string
              message: string
              similarity: number
            }[]
          }
      match_messages_hybrid:
        | {
            Args: {
              filter_tags?: string[]
              filter_team_id: string
              match_count?: number
              match_threshold?: number
              query_embedding: string
            }
            Returns: {
              content: Json
              created_at: string
              id: string
              matched_tags: string[]
              message: string
              similarity: number
            }[]
          }
        | {
            Args: {
              filter_tags?: string[]
              filter_team_ids: string[]
              match_count?: number
              match_threshold?: number
              query_embedding: string
            }
            Returns: {
              content: Json
              created_at: string
              id: string
              matched_tags: string[]
              message: string
              similarity: number
            }[]
          }
      match_summaries:
        | {
            Args: {
              filter_team_id: string
              match_count: number
              match_threshold: number
              query_embedding: string
            }
            Returns: {
              created_at: string
              id: string
              similarity: number
              summary_text: string
            }[]
          }
        | {
            Args: {
              filter_team_ids: string[]
              match_count: number
              match_threshold: number
              query_embedding: string
            }
            Returns: {
              created_at: string
              id: string
              similarity: number
              summary_text: string
            }[]
          }
      refresh_effective_team_members: { Args: never; Returns: undefined }
      refresh_entities_view: { Args: never; Returns: undefined }
      refresh_fcp_statements_identifiers_resolved: {
        Args: never
        Returns: undefined
      }
      refresh_global_trust_scores: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      a2a_api_key_location_enum: "header" | "query" | "cookie"
      a2a_security_scheme_type_enum:
        | "http"
        | "apiKey"
        | "oauth2"
        | "openIdConnect"
        | "custom"
      a2a_transport_protocol_enum: "JSONRPC" | "GRPC" | "HTTP+JSON"
      fcp_entity_type: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7"
      fcp_statement_predicate_type: "6"
      initiative_status_enum:
        | "active"
        | "completed"
        | "paused"
        | "on_hold"
        | "archived"
      notification_event_type:
        | "task_assigned"
        | "task_completed"
        | "task_blocked"
        | "mention"
        | "system_alert"
      platform_connection_type_enum:
        | "mcp_server"
        | "communication_channel"
        | "tracing_server"
        | "workflow_integration"
      project_status_enum:
        | "active"
        | "completed"
        | "paused"
        | "on_hold"
        | "archived"
      tag_category_enum: "topic" | "sentiment" | "urgency" | "entity"
      task_priority_enum: "high" | "normal" | "low"
      task_status_enum: "pending" | "in_progress" | "done" | "cancelled"
      team_member_type_enum: "manager" | "worker"
      team_status_enum: "active" | "completed" | "paused" | "archived"
      user_theme_enum: "light" | "dark" | "system"
      user_type_enum: "human" | "agent" | "service_account"
      workflow_execution_status_enum:
        | "pending"
        | "running"
        | "success"
        | "error"
        | "cancelled"
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
      a2a_api_key_location_enum: ["header", "query", "cookie"],
      a2a_security_scheme_type_enum: [
        "http",
        "apiKey",
        "oauth2",
        "openIdConnect",
        "custom",
      ],
      a2a_transport_protocol_enum: ["JSONRPC", "GRPC", "HTTP+JSON"],
      fcp_entity_type: ["0", "1", "2", "3", "4", "5", "6", "7"],
      fcp_statement_predicate_type: ["6"],
      initiative_status_enum: [
        "active",
        "completed",
        "paused",
        "on_hold",
        "archived",
      ],
      notification_event_type: [
        "task_assigned",
        "task_completed",
        "task_blocked",
        "mention",
        "system_alert",
      ],
      platform_connection_type_enum: [
        "mcp_server",
        "communication_channel",
        "tracing_server",
        "workflow_integration",
      ],
      project_status_enum: [
        "active",
        "completed",
        "paused",
        "on_hold",
        "archived",
      ],
      tag_category_enum: ["topic", "sentiment", "urgency", "entity"],
      task_priority_enum: ["high", "normal", "low"],
      task_status_enum: ["pending", "in_progress", "done", "cancelled"],
      team_member_type_enum: ["manager", "worker"],
      team_status_enum: ["active", "completed", "paused", "archived"],
      user_theme_enum: ["light", "dark", "system"],
      user_type_enum: ["human", "agent", "service_account"],
      workflow_execution_status_enum: [
        "pending",
        "running",
        "success",
        "error",
        "cancelled",
      ],
    },
  },
} as const
