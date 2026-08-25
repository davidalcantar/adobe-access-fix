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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      document_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          document_id: string
          id: string
          issue_id: string | null
          project_id: string
          resolved: boolean
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          document_id: string
          id?: string
          issue_id?: string | null
          project_id: string
          resolved?: boolean
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          document_id?: string
          id?: string
          issue_id?: string | null
          project_id?: string
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "document_comments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "document_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_issues: {
        Row: {
          created_at: string
          criterion: string
          criterion_name: string
          detail: string | null
          document_id: string
          element_ref: string | null
          id: string
          level: Database["public"]["Enums"]["conformance_level"]
          page_number: number | null
          project_id: string
          resolved_at: string | null
          resolved_by: string | null
          rule_id: string
          severity: Database["public"]["Enums"]["issue_severity"]
          state: Database["public"]["Enums"]["issue_state"]
          title: string
          waiver_reason: string | null
        }
        Insert: {
          created_at?: string
          criterion: string
          criterion_name: string
          detail?: string | null
          document_id: string
          element_ref?: string | null
          id?: string
          level: Database["public"]["Enums"]["conformance_level"]
          page_number?: number | null
          project_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id: string
          severity?: Database["public"]["Enums"]["issue_severity"]
          state?: Database["public"]["Enums"]["issue_state"]
          title: string
          waiver_reason?: string | null
        }
        Update: {
          created_at?: string
          criterion?: string
          criterion_name?: string
          detail?: string | null
          document_id?: string
          element_ref?: string | null
          id?: string
          level?: Database["public"]["Enums"]["conformance_level"]
          page_number?: number | null
          project_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id?: string
          severity?: Database["public"]["Enums"]["issue_severity"]
          state?: Database["public"]["Enums"]["issue_state"]
          title?: string
          waiver_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_issues_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_structure: {
        Row: {
          document_id: string
          project_id: string
          tree: Json
          updated_at: string
        }
        Insert: {
          document_id: string
          project_id: string
          tree?: Json
          updated_at?: string
        }
        Update: {
          document_id?: string
          project_id?: string
          tree?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_structure_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_structure_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          conformance_score: number
          created_at: string
          created_by: string
          document_id: string
          id: string
          label: string
          project_id: string
          storage_path: string
        }
        Insert: {
          conformance_score?: number
          created_at?: string
          created_by: string
          document_id: string
          id?: string
          label: string
          project_id: string
          storage_path: string
        }
        Update: {
          conformance_score?: number
          created_at?: string
          created_by?: string
          document_id?: string
          id?: string
          label?: string
          project_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          byte_size: number
          conformance_score: number
          created_at: string
          doc_language: string | null
          doc_title: string | null
          filename: string
          id: string
          is_tagged: boolean
          last_audit_at: string | null
          page_count: number
          project_id: string
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          target_level: Database["public"]["Enums"]["conformance_level"]
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          byte_size?: number
          conformance_score?: number
          created_at?: string
          doc_language?: string | null
          doc_title?: string | null
          filename: string
          id?: string
          is_tagged?: boolean
          last_audit_at?: string | null
          page_count?: number
          project_id: string
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          target_level?: Database["public"]["Enums"]["conformance_level"]
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          byte_size?: number
          conformance_score?: number
          created_at?: string
          doc_language?: string | null
          doc_title?: string | null
          filename?: string
          id?: string
          is_tagged?: boolean
          last_audit_at?: string | null
          page_count?: number
          project_id?: string
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string
          target_level?: Database["public"]["Enums"]["conformance_level"]
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      structure_edits: {
        Row: {
          after_value: Json | null
          ai_assisted: boolean
          before_value: Json | null
          created_at: string
          document_id: string
          edit_type: string
          edited_by: string
          element_ref: string | null
          id: string
          project_id: string
          summary: string
        }
        Insert: {
          after_value?: Json | null
          ai_assisted?: boolean
          before_value?: Json | null
          created_at?: string
          document_id: string
          edit_type: string
          edited_by: string
          element_ref?: string | null
          id?: string
          project_id: string
          summary: string
        }
        Update: {
          after_value?: Json | null
          ai_assisted?: boolean
          before_value?: Json | null
          created_at?: string
          document_id?: string
          edit_type?: string
          edited_by?: string
          element_ref?: string | null
          id?: string
          project_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "structure_edits_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structure_edits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      project_role_of: {
        Args: { _project_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["project_role"]
      }
      shares_project_with: {
        Args: { _other_user: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      conformance_level: "A" | "AA" | "AAA"
      doc_status:
        | "uploaded"
        | "auditing"
        | "remediating"
        | "in_review"
        | "approved"
        | "rejected"
      issue_severity: "critical" | "serious" | "moderate" | "minor"
      issue_state: "open" | "fixed" | "waived"
      project_role: "admin" | "author" | "remediator" | "reviewer"
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
      app_role: ["admin", "user"],
      conformance_level: ["A", "AA", "AAA"],
      doc_status: [
        "uploaded",
        "auditing",
        "remediating",
        "in_review",
        "approved",
        "rejected",
      ],
      issue_severity: ["critical", "serious", "moderate", "minor"],
      issue_state: ["open", "fixed", "waived"],
      project_role: ["admin", "author", "remediator", "reviewer"],
    },
  },
} as const
