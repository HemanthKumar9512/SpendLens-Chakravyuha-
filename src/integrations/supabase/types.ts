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
      alert_log: {
        Row: {
          alert_type: string | null
          channel: string | null
          id: string
          message: string | null
          sent_at: string | null
          severity: string | null
          tenant_id: string | null
        }
        Insert: {
          alert_type?: string | null
          channel?: string | null
          id?: string
          message?: string | null
          sent_at?: string | null
          severity?: string | null
          tenant_id?: string | null
        }
        Update: {
          alert_type?: string | null
          channel?: string | null
          id?: string
          message?: string | null
          sent_at?: string | null
          severity?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      anomalies: {
        Row: {
          anomaly_type: string | null
          arthashastra_score: number | null
          detected_at: string | null
          id: string
          impact_inr: number | null
          provider: string | null
          reversibility: number | null
          risk_level: string | null
          service: string | null
          status: string | null
          tenant_id: string | null
          z_score: number | null
        }
        Insert: {
          anomaly_type?: string | null
          arthashastra_score?: number | null
          detected_at?: string | null
          id?: string
          impact_inr?: number | null
          provider?: string | null
          reversibility?: number | null
          risk_level?: string | null
          service?: string | null
          status?: string | null
          tenant_id?: string | null
          z_score?: number | null
        }
        Update: {
          anomaly_type?: string | null
          arthashastra_score?: number | null
          detected_at?: string | null
          id?: string
          impact_inr?: number | null
          provider?: string | null
          reversibility?: number | null
          risk_level?: string | null
          service?: string | null
          status?: string | null
          tenant_id?: string | null
          z_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "anomalies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          amount_inr: number | null
          created_at: string | null
          event_date: string | null
          id: string
          provider: string | null
          resource_id: string | null
          service: string | null
          tenant_id: string | null
          usage_unit: string | null
        }
        Insert: {
          amount_inr?: number | null
          created_at?: string | null
          event_date?: string | null
          id?: string
          provider?: string | null
          resource_id?: string | null
          service?: string | null
          tenant_id?: string | null
          usage_unit?: string | null
        }
        Update: {
          amount_inr?: number | null
          created_at?: string | null
          event_date?: string | null
          id?: string
          provider?: string | null
          resource_id?: string | null
          service?: string | null
          tenant_id?: string | null
          usage_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      carbon_jobs: {
        Row: {
          co2_saved_kg: number | null
          created_at: string | null
          delay_tolerance_hrs: number | null
          id: string
          job_name: string | null
          scheduled_at: string | null
          source_intensity: number | null
          source_region: string | null
          status: string | null
          target_intensity: number | null
          target_region: string | null
          tenant_id: string | null
          workload_size: string | null
        }
        Insert: {
          co2_saved_kg?: number | null
          created_at?: string | null
          delay_tolerance_hrs?: number | null
          id?: string
          job_name?: string | null
          scheduled_at?: string | null
          source_intensity?: number | null
          source_region?: string | null
          status?: string | null
          target_intensity?: number | null
          target_region?: string | null
          tenant_id?: string | null
          workload_size?: string | null
        }
        Update: {
          co2_saved_kg?: number | null
          created_at?: string | null
          delay_tolerance_hrs?: number | null
          id?: string
          job_name?: string | null
          scheduled_at?: string | null
          source_intensity?: number | null
          source_region?: string | null
          status?: string | null
          target_intensity?: number | null
          target_region?: string | null
          tenant_id?: string | null
          workload_size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carbon_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_providers: {
        Row: {
          id: string
          last_synced_at: string | null
          monthly_spend_inr: number | null
          provider: string
          region: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          last_synced_at?: string | null
          monthly_spend_inr?: number | null
          provider: string
          region?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          last_synced_at?: string | null
          monthly_spend_inr?: number | null
          provider?: string
          region?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cloud_providers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_runs: {
        Row: {
          created_at: string | null
          forecast_json: Json | null
          fourier_pulse: Json | null
          horizon_days: number | null
          id: string
          mape: number | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          forecast_json?: Json | null
          fourier_pulse?: Json | null
          horizon_days?: number | null
          id?: string
          mape?: number | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          forecast_json?: Json | null
          fourier_pulse?: Json | null
          horizon_days?: number | null
          id?: string
          mape?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forecast_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kosha_scores: {
        Row: {
          carbon_score: number | null
          compliance_score: number | null
          cost_score: number | null
          esg_grade: string | null
          id: string
          performance_score: number | null
          scored_at: string | null
          security_score: number | null
          tenant_id: string | null
        }
        Insert: {
          carbon_score?: number | null
          compliance_score?: number | null
          cost_score?: number | null
          esg_grade?: string | null
          id?: string
          performance_score?: number | null
          scored_at?: string | null
          security_score?: number | null
          tenant_id?: string | null
        }
        Update: {
          carbon_score?: number | null
          compliance_score?: number | null
          cost_score?: number | null
          esg_grade?: string | null
          id?: string
          performance_score?: number | null
          scored_at?: string | null
          security_score?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kosha_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          role: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      remediation_actions: {
        Row: {
          action_type: string | null
          anomaly_id: string | null
          approved_by: string | null
          created_at: string | null
          executed_at: string | null
          id: string
          provider: string | null
          resource_id: string | null
          ring_level: number | null
          risk_level: string | null
          saving_inr: number | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          action_type?: string | null
          anomaly_id?: string | null
          approved_by?: string | null
          created_at?: string | null
          executed_at?: string | null
          id?: string
          provider?: string | null
          resource_id?: string | null
          ring_level?: number | null
          risk_level?: string | null
          saving_inr?: number | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          action_type?: string | null
          anomaly_id?: string | null
          approved_by?: string | null
          created_at?: string | null
          executed_at?: string | null
          id?: string
          provider?: string | null
          resource_id?: string | null
          ring_level?: number | null
          risk_level?: string | null
          saving_inr?: number | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remediation_actions_anomaly_id_fkey"
            columns: ["anomaly_id"]
            isOneToOne: false
            referencedRelation: "anomalies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remediation_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          monthly_budget_inr: number | null
          name: string
          plan: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          monthly_budget_inr?: number | null
          name: string
          plan?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          monthly_budget_inr?: number | null
          name?: string
          plan?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
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
