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
      drivers: {
        Row: {
          created_at: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          id: string
          license_class: string | null
          license_expiry: string
          license_number: string
          notes: string | null
          phone: string | null
          safety_score: number
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
          user_id: string | null
          years_experience: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          id?: string
          license_class?: string | null
          license_expiry: string
          license_number: string
          notes?: string | null
          phone?: string | null
          safety_score?: number
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          user_id?: string | null
          years_experience?: number
        }
        Update: {
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          id?: string
          license_class?: string | null
          license_expiry?: string
          license_number?: string
          notes?: string | null
          phone?: string | null
          safety_score?: number
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          user_id?: string | null
          years_experience?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          incurred_on: string
          trip_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          incurred_on?: string
          trip_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          incurred_on?: string
          trip_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_logs: {
        Row: {
          cost: number
          created_at: string
          created_by: string | null
          driver_id: string | null
          id: string
          liters: number
          logged_at: string
          notes: string | null
          odometer_km: number | null
          station: string | null
          vehicle_id: string
        }
        Insert: {
          cost: number
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          liters: number
          logged_at?: string
          notes?: string | null
          odometer_km?: number | null
          station?: string | null
          vehicle_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          liters?: number
          logged_at?: string
          notes?: string | null
          odometer_km?: number | null
          station?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          actual_completion: string | null
          cost: number
          created_at: string
          created_by: string | null
          expected_completion: string | null
          id: string
          issue_description: string
          mechanic_name: string | null
          priority: Database["public"]["Enums"]["maintenance_priority"]
          status: Database["public"]["Enums"]["maintenance_status"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          actual_completion?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          expected_completion?: string | null
          id?: string
          issue_description: string
          mechanic_name?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          status?: Database["public"]["Enums"]["maintenance_status"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          actual_completion?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          expected_completion?: string | null
          id?: string
          issue_description?: string
          mechanic_name?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          status?: Database["public"]["Enums"]["maintenance_status"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          severity: string
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          severity?: string
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          cargo_weight_kg: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          delivery_notes: string | null
          destination: string
          dispatched_at: string | null
          driver_id: string | null
          estimated_fuel_l: number
          id: string
          origin: string
          planned_distance_km: number
          scheduled_at: string | null
          status: Database["public"]["Enums"]["trip_status"]
          trip_code: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          cargo_weight_kg?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivery_notes?: string | null
          destination: string
          dispatched_at?: string | null
          driver_id?: string | null
          estimated_fuel_l?: number
          id?: string
          origin: string
          planned_distance_km?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          trip_code?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          cargo_weight_kg?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivery_notes?: string | null
          destination?: string
          dispatched_at?: string | null
          driver_id?: string | null
          estimated_fuel_l?: number
          id?: string
          origin?: string
          planned_distance_km?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          trip_code?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          acquisition_cost: number
          created_at: string
          created_by: string | null
          id: string
          insurance_expiry: string | null
          insurance_provider: string | null
          max_load_kg: number
          model: string
          notes: string | null
          odometer_km: number
          registration_number: string
          status: Database["public"]["Enums"]["vehicle_status"]
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at: string
        }
        Insert: {
          acquisition_cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_provider?: string | null
          max_load_kg?: number
          model: string
          notes?: string | null
          odometer_km?: number
          registration_number: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
        }
        Update: {
          acquisition_cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_provider?: string | null
          max_load_kg?: number
          model?: string
          notes?: string | null
          odometer_km?: number
          registration_number?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "fleet_manager"
        | "driver"
        | "safety_officer"
        | "financial_analyst"
      driver_status: "available" | "on_trip" | "off_duty" | "suspended"
      expense_category:
        | "fuel"
        | "maintenance"
        | "toll"
        | "insurance"
        | "parking"
        | "repair"
        | "salary"
        | "other"
      maintenance_priority: "low" | "medium" | "high" | "critical"
      maintenance_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
      trip_status: "draft" | "dispatched" | "completed" | "cancelled"
      vehicle_status: "available" | "in_transit" | "in_shop" | "retired"
      vehicle_type: "truck" | "van" | "trailer" | "tanker" | "reefer" | "pickup"
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
      app_role: [
        "fleet_manager",
        "driver",
        "safety_officer",
        "financial_analyst",
      ],
      driver_status: ["available", "on_trip", "off_duty", "suspended"],
      expense_category: [
        "fuel",
        "maintenance",
        "toll",
        "insurance",
        "parking",
        "repair",
        "salary",
        "other",
      ],
      maintenance_priority: ["low", "medium", "high", "critical"],
      maintenance_status: [
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
      ],
      trip_status: ["draft", "dispatched", "completed", "cancelled"],
      vehicle_status: ["available", "in_transit", "in_shop", "retired"],
      vehicle_type: ["truck", "van", "trailer", "tanker", "reefer", "pickup"],
    },
  },
} as const
