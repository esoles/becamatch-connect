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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      applicant_calls: {
        Row: {
          created_at: string
          created_by: string
          full_name: string
          id: string
          notes: string
          occurred_at: string
          requires_response: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          full_name?: string
          id?: string
          notes: string
          occurred_at: string
          requires_response?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          full_name?: string
          id?: string
          notes?: string
          occurred_at?: string
          requires_response?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      applicant_followup_audit: {
        Row: {
          actor_id: string
          after_data: Json
          before_data: Json | null
          created_at: string
          id: string
          record_key: string
          record_type: string
        }
        Insert: {
          actor_id: string
          after_data: Json
          before_data?: Json | null
          created_at?: string
          id?: string
          record_key: string
          record_type: string
        }
        Update: {
          actor_id?: string
          after_data?: Json
          before_data?: Json | null
          created_at?: string
          id?: string
          record_key?: string
          record_type?: string
        }
        Relationships: []
      }
      applicant_followups: {
        Row: {
          assigned_to: string | null
          followup_at: string | null
          next_action: string
          objective: string
          person_key: string
          response_resolved_at: string | null
          stage: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          assigned_to?: string | null
          followup_at?: string | null
          next_action?: string
          objective?: string
          person_key: string
          response_resolved_at?: string | null
          stage?: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          assigned_to?: string | null
          followup_at?: string | null
          next_action?: string
          objective?: string
          person_key?: string
          response_resolved_at?: string | null
          stage?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      applicant_identity_links: {
        Row: {
          created_at: string
          evidence: string
          reviewed_by: string
          source_key: string
          target_key: string
        }
        Insert: {
          created_at?: string
          evidence: string
          reviewed_by: string
          source_key: string
          target_key: string
        }
        Update: {
          created_at?: string
          evidence?: string
          reviewed_by?: string
          source_key?: string
          target_key?: string
        }
        Relationships: []
      }
      marketing_posts: {
        Row: {
          campaign: string
          channel: string
          content: Json
          created_at: string
          created_by: string
          id: string
          published_at: string | null
          scholarship_id: string
          status: string
          updated_at: string
          utm_url: string
        }
        Insert: {
          campaign: string
          channel?: string
          content?: Json
          created_at?: string
          created_by: string
          id?: string
          published_at?: string | null
          scholarship_id: string
          status?: string
          updated_at?: string
          utm_url: string
        }
        Update: {
          campaign?: string
          channel?: string
          content?: Json
          created_at?: string
          created_by?: string
          id?: string
          published_at?: string | null
          scholarship_id?: string
          status?: string
          updated_at?: string
          utm_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_posts_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      postulation_requests: {
        Row: {
          ai_analysis: Json | null
          attention_status: string
          created_at: string
          email: string
          full_name: string
          id: string
          recommended_scholarship_ids: string[]
          request_text: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          attention_status?: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          recommended_scholarship_ids?: string[]
          request_text: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          attention_status?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          recommended_scholarship_ids?: string[]
          request_text?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          area: string
          birth_date: string
          countries: string[]
          created_at: string
          email: string
          full_name: string
          gpa: number
          graduation_year: number
          id: string
          languages: Json
          parental_status: string
          study_level: string
          updated_at: string
        }
        Insert: {
          area: string
          birth_date: string
          countries?: string[]
          created_at?: string
          email: string
          full_name: string
          gpa: number
          graduation_year: number
          id: string
          languages?: Json
          parental_status?: string
          study_level: string
          updated_at?: string
        }
        Update: {
          area?: string
          birth_date?: string
          countries?: string[]
          created_at?: string
          email?: string
          full_name?: string
          gpa?: number
          graduation_year?: number
          id?: string
          languages?: Json
          parental_status?: string
          study_level?: string
          updated_at?: string
        }
        Relationships: []
      }
      scholarship_decisions: {
        Row: {
          created_at: string
          decision: string
          id: string
          scholarship_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          scholarship_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          scholarship_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_decisions_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarships: {
        Row: {
          archived: boolean
          area: string | null
          aviso_datos: string | null
          country: string
          coverage: string | null
          created_at: string
          deadline: string
          documentos_requeridos: Json
          documents: string | null
          entity: string
          es_demo: boolean
          estado_datos: string
          fuente_requisitos: string | null
          id: string
          language_code: string | null
          language_level: string | null
          min_gpa: number | null
          name: string
          official_url: string | null
          preguntas_frecuentes: Json
          proceso_postulacion: Json
          requirements: string | null
          requisitos_detallados: Json
          restricciones: Json
          study_level: string | null
          ultima_verificacion: string | null
          verified: boolean
        }
        Insert: {
          archived?: boolean
          area?: string | null
          aviso_datos?: string | null
          country: string
          coverage?: string | null
          created_at?: string
          deadline: string
          documentos_requeridos?: Json
          documents?: string | null
          entity: string
          es_demo?: boolean
          estado_datos?: string
          fuente_requisitos?: string | null
          id?: string
          language_code?: string | null
          language_level?: string | null
          min_gpa?: number | null
          name: string
          official_url?: string | null
          preguntas_frecuentes?: Json
          proceso_postulacion?: Json
          requirements?: string | null
          requisitos_detallados?: Json
          restricciones?: Json
          study_level?: string | null
          ultima_verificacion?: string | null
          verified?: boolean
        }
        Update: {
          archived?: boolean
          area?: string | null
          aviso_datos?: string | null
          country?: string
          coverage?: string | null
          created_at?: string
          deadline?: string
          documentos_requeridos?: Json
          documents?: string | null
          entity?: string
          es_demo?: boolean
          estado_datos?: string
          fuente_requisitos?: string | null
          id?: string
          language_code?: string | null
          language_level?: string | null
          min_gpa?: number | null
          name?: string
          official_url?: string | null
          preguntas_frecuentes?: Json
          proceso_postulacion?: Json
          requirements?: string | null
          requisitos_detallados?: Json
          restricciones?: Json
          study_level?: string | null
          ultima_verificacion?: string | null
          verified?: boolean
        }
        Relationships: []
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
      web_agent_conversations: {
        Row: {
          created_at: string
          id: string
          resume_token_hash: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          resume_token_hash: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          resume_token_hash?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      web_agent_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message: Json
          sdk_message_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message: Json
          sdk_message_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message?: Json
          sdk_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "web_agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      web_agent_plans: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          plan: Json
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          plan: Json
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          plan?: Json
        }
        Relationships: [
          {
            foreignKeyName: "web_agent_plans_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "web_agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          action: string | null
          body: string
          created_at: string
          direction: string
          id: string
          phone: string
          result: string | null
          scholarship_id: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          body: string
          created_at?: string
          direction: string
          id?: string
          phone: string
          result?: string | null
          scholarship_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          body?: string
          created_at?: string
          direction?: string
          id?: string
          phone?: string
          result?: string | null
          scholarship_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sessions: {
        Row: {
          created_at: string
          current_scholarship_id: string | null
          link_token: string | null
          link_token_expires_at: string | null
          pending_action: string | null
          pending_scholarship_id: string | null
          phone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          current_scholarship_id?: string | null
          link_token?: string | null
          link_token_expires_at?: string | null
          pending_action?: string | null
          pending_scholarship_id?: string | null
          phone: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          current_scholarship_id?: string | null
          link_token?: string | null
          link_token_expires_at?: string | null
          pending_action?: string | null
          pending_scholarship_id?: string | null
          phone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sessions_current_scholarship_id_fkey"
            columns: ["current_scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_sessions_pending_scholarship_id_fkey"
            columns: ["pending_scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "student"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user", "student"],
    },
  },
} as const
